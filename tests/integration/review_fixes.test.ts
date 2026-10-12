import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { loadTableFor } from "@/server/commands";
import { cmd, makeAccount, makeCharacter, resetDb, state } from "./helpers";

/** Regression tests for bugs confirmed by the round-two adversarial review. */

// 14:00 London on a Saturday: The Last Stop is open.
const T0 = new Date("2026-10-10T13:00:00Z");
const secs = (base: Date, s: number) => new Date(base.getTime() + s * 1000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

const at = (acc: string, place: string) => pool().query("UPDATE characters SET location = $2 WHERE account_id = $1", [acc, place]);
const idOf = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;

async function players(n: number, place = "last_stop_pub") {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = await makeAccount();
    await makeCharacter(a, T0);
    await at(a, place);
    out.push(a);
  }
  return out;
}

async function openGame(a: string, b: string, t = T0) {
  const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, t);
  const id = (r.receipt as { tableId: string }).tableId;
  await cmd(b, "JoinGameTable", { tableId: id }, t);
  return id;
}

describe("review fixes · game tables", () => {
  it("the first move alternates on every rematch, not just the first", async () => {
    const [a, b] = await players(2);
    const t1 = await openGame(a, b);
    await cmd(b, "LeaveGameTable", { tableId: t1 }, secs(T0, 5));
    // Rematch 1: A went first, so B goes first.
    const t2 = ((await cmd(b, "Rematch", { tableId: t1 }, secs(T0, 6))).receipt as { tableId: string }).tableId;
    await cmd(a, "Rematch", { tableId: t1 }, secs(T0, 7));
    let v = await loadTableFor(b, t2, secs(T0, 8));
    expect(v.yourTurn).toBe(true);
    await cmd(b, "GameMove", { tableId: t2, column: 3, version: v.version }, secs(T0, 9));
    await cmd(a, "LeaveGameTable", { tableId: t2 }, secs(T0, 10));
    // Rematch 2: B went first, so A goes first — whoever asks.
    const t3 = ((await cmd(b, "Rematch", { tableId: t2 }, secs(T0, 11))).receipt as { tableId: string }).tableId;
    await cmd(a, "Rematch", { tableId: t2 }, secs(T0, 12));
    v = await loadTableFor(a, t3, secs(T0, 13));
    expect(v.status).toBe("active");
    expect(v.yourTurn).toBe(true);
  });

  it("an expired rematch offer doesn't block a fresh one", async () => {
    const [a, b] = await players(2);
    const t1 = await openGame(a, b);
    await cmd(b, "LeaveGameTable", { tableId: t1 }, secs(T0, 5));
    const first = ((await cmd(b, "Rematch", { tableId: t1 }, secs(T0, 6))).receipt as { tableId: string }).tableId;
    // Long after the offer lapsed, B can offer again and A can accept it.
    const later = secs(T0, 2 * 3600);
    const second = ((await cmd(b, "Rematch", { tableId: t1 }, later)).receipt as { tableId: string }).tableId;
    expect(second).not.toBe(first);
    await cmd(a, "Rematch", { tableId: t1 }, secs(later, 1));
    expect((await loadTableFor(a, second, secs(later, 2))).status).toBe("active");
  });

  it("a blocked player can't see or join the blocker's table", async () => {
    const [a, b] = await players(2);
    await cmd(a, "BlockPlayer", { characterId: await idOf(b) }, T0);
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    expect((await state(b, T0)).games.open).toHaveLength(0);
    await expect(cmd(b, "JoinGameTable", { tableId: id }, T0)).rejects.toThrow(/isn't accepting contact/);
  });
});

describe("review fixes · player jobs", () => {
  it("a blocked player can't see or apply to the blocker's job", async () => {
    const [poster, worker] = await players(2, "home");
    await cmd(poster, "BlockPlayer", { characterId: await idOf(worker) }, T0);
    const r = await cmd(poster, "PostJob", { templateId: "move_furniture", payPence: 2_500, hours: 24 }, T0);
    const jobId = (r.receipt as { jobId: string }).jobId;
    const board = (await state(worker, T0)).board?.board ?? [];
    expect(board.some((j: { id: string }) => j.id === jobId)).toBe(false);
    await expect(cmd(worker, "ApplyJob", { jobId }, T0)).rejects.toThrow(/isn't accepting contact/);
  });
});

describe("review fixes · visits and voting", () => {
  it("setting off on a journey ends a home visit", async () => {
    const [host, guest] = await players(2, "home");
    const hostId = await idOf(host);
    await cmd(guest, "SendFriendRequest", { characterId: hostId }, T0);
    const req = (await state(host, T0)).social.incoming[0];
    await cmd(host, "RespondFriendRequest", { requestId: req.id, accept: true }, T0);
    await cmd(guest, "VisitHome", { characterId: hostId }, T0);
    const open = () => pool().query("SELECT count(*)::int AS n FROM home_visits WHERE ended_at IS NULL");
    expect((await open()).rows[0].n).toBe(1);
    await cmd(guest, "StartJourney", { destination: "food_hall", mode: "walk" }, secs(T0, 30));
    expect((await open()).rows[0].n).toBe(0);
  });

  it("a voter who has set off from City Hall can't vote from the journey", async () => {
    const [cand, voter] = await players(2, "city_hall");
    await pool().query("UPDATE characters SET created_at = $1", [secs(T0, -3 * 86400)]);
    await cmd(cand, "StandForElection", { policyId: "half_price_buses" }, T0);
    await cmd(voter, "StartJourney", { destination: "food_hall", mode: "walk" }, T0);
    await expect(cmd(voter, "CastVote", { candidateId: await idOf(cand) }, secs(T0, 5))).rejects.toThrow(/in person/);
  });
});
