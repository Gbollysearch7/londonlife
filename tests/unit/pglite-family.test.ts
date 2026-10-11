import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The browser test build runs on PGlite: the family SQL (partial unique indexes, row locks, upserts) must work there too. */
describe("family commands on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let db: PGlite;
  const acc: string[] = [];
  const ids: string[] = [];
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    commands = await import("@/server/commands");
    for (const [i, name] of ["Ada", "Ben"].entries()) {
      const a = (await db.query<{ id: string }>("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ($1,'x',now()) RETURNING id", [`f${i}`])).rows[0].id;
      const payload = { name, appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["foodie", "tidy"], ambition: "home_owner" };
      await commands.runCommand(a, `key-f-create-${i}`, "CreateCharacter", payload);
      acc.push(a);
      ids.push((await db.query<{ id: string }>("SELECT id FROM characters WHERE account_id = $1", [a])).rows[0].id);
    }
  });

  it("dates with consent, shares a household and runs a visit invitation", async () => {
    await commands.runCommand(acc[0], "key-f-fr", "SendFriendRequest", { characterId: ids[1] });
    await commands.runCommand(acc[1], "key-f-fr2", "SendFriendRequest", { characterId: ids[0] });
    await db.query("UPDATE friendships SET points = 20");
    await commands.runCommand(acc[0], "key-f-date", "AskToDate", { characterId: ids[1] });
    let s = (await commands.loadStateFor(acc[1])) as any;
    await expect(commands.runCommand(acc[0], "key-f-self", "RespondRomance", { requestId: s.family.romanceRequests.incoming[0].id, accept: true })).rejects.toThrow(/Only the person/);
    await commands.runCommand(acc[1], "key-f-yes", "RespondRomance", { requestId: s.family.romanceRequests.incoming[0].id, accept: true });
    s = (await commands.loadStateFor(acc[0])) as any;
    expect(s.family.romance.status).toBe("dating");

    await commands.runCommand(acc[0], "key-f-hh", "InviteToHousehold", { characterId: ids[1] });
    await commands.runCommand(acc[0], "key-f-visit", "InviteToVisit", { characterId: ids[1] });
    s = (await commands.loadStateFor(acc[1])) as any;
    expect(s.family.invitations.incoming).toHaveLength(2);
    for (const i of s.family.invitations.incoming) await commands.runCommand(acc[1], `key-f-acc-${i.kind}`, "RespondInvitation", { invitationId: i.id, accept: true });
    s = (await commands.loadStateFor(acc[1])) as any;
    expect(s.family.household.role).toBe("member");
    expect(s.social.visit.hostId).toBe(ids[0]);
    expect(s.family.hostHome.actions.length).toBeGreaterThan(0);
  }, 30000);
});
