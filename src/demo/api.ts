/**
 * Test-build replacement for src/client/api.ts: calls the same command runner and state loader
 * directly against the in-browser database instead of over HTTP.
 */
import type { GameState } from "@/server/game";
import { loadStateFor, loadTableFor, runCommand, socialQueryFor } from "@/server/commands";
import type { TableView } from "@/server/tables";
import { GameError } from "./db";
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
