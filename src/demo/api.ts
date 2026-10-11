/**
 * Test-build replacement for src/client/api.ts: calls the same command runner and state loader
 * directly against the in-browser database instead of over HTTP.
 */
import type { GameState } from "@/server/game";
import { loadStateFor, loadTableFor, runCommand, socialQueryFor } from "@/server/commands";
import type { TableView } from "@/server/tables";
import { GameError, pool } from "./db";
import { completePasswordReset, requestPasswordReset } from "@/server/recovery";
import { localAccountId, resetSave, saveNow } from "./boot";

export type State = Extract<GameState, { character: object }> & { character: NonNullable<GameState["character"]> };

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Mirror the network boundary: plain JSON in and out, so Dates behave exactly as in the real game.
const wire = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function toApiError(err: unknown) {
  if (err instanceof GameError) return new ApiError(err.code, err.message);
  console.error(err);
  return new ApiError("server_error", "Something went wrong. Nothing was charged; please try again.");
}

export async function fetchState(): Promise<GameState> {
  try {
    return wire(await loadStateFor(localAccountId()));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchTable(id: string): Promise<TableView> {
  try {
    const t = wire(await loadTableFor(localAccountId(), id));
    void saveNow();
    return t;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function postJson(url: string, _data?: unknown) {
  if (url === "/api/auth/signout") {
    await resetSave();
    return new Promise(() => {});
  }
  // Account recovery runs the real rules on the local player; the link is returned for an on-screen,
  // development-only display because the test build has no email.
  if (url === "/api/auth/reset/request" || url === "/api/auth/reset/complete") {
    try {
      if (url === "/api/auth/reset/request") {
        const acc = await pool().query("SELECT email FROM accounts WHERE id = $1", [localAccountId()]);
        const { token } = await requestPasswordReset(String(acc.rows[0]?.email ?? ""), "local", new Date());
        void saveNow();
        return { ok: true, token };
      }
      const body = (_data ?? {}) as { token?: string; password?: string };
      await completePasswordReset(String(body.token ?? ""), String(body.password ?? ""), "local", new Date());
      void saveNow();
      return { ok: true, message: "Password set. The test build has no sign-in screen; in the real game you would now sign in with it." };
    } catch (err) {
      throw toApiError(err);
    }
  }
  throw new ApiError("unsupported", "Not available in the test build.");
}

export async function sendCommand(type: string, payload: unknown = {}) {
  try {
    const result = await runCommand(localAccountId(), crypto.randomUUID(), type, payload);
    const state = await loadStateFor(localAccountId());
    void saveNow();
    return wire({ ...result, state }) as { receipt: { message?: string; result?: unknown }; replayed: boolean; state: GameState };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchSocial<T = Record<string, unknown>>(op: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  try {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return wire({ ok: true, ...(await socialQueryFor(localAccountId(), op, clean)) }) as T;
  } catch (err) {
    throw toApiError(err);
  }
}
