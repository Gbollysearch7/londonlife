"use client";
import type { GameState } from "@/server/game";
import type { TableView } from "@/server/tables";

export type State = Extract<GameState, { character: object }> & { character: NonNullable<GameState["character"]> };

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function parse(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) {
    throw new ApiError(body?.code ?? "network", body?.message ?? "Couldn't reach London. Check your connection.");
  }
  return body;
}

export async function fetchState(): Promise<GameState> {
  return parse(await fetch("/api/state", { cache: "no-store" }));
}

/** Public state of one games table (the board overlay polls this). */
export async function fetchTable(id: string): Promise<TableView> {
  return parse(await fetch(`/api/table?id=${encodeURIComponent(id)}`, { cache: "no-store" }));
}

export async function postJson(url: string, data: unknown) {
  return parse(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }));
}

/**
 * Sends a command with one idempotency key. A network failure is retried with the same key,
 * so a lost response can never charge twice.
 */
export async function sendCommand(type: string, payload: unknown = {}) {
  const key = crypto.randomUUID();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await postJson("/api/command", { key, type, payload })) as { receipt: { message?: string; result?: unknown }; replayed: boolean; state: GameState };
    } catch (err) {
      lastErr = err;
      if (err instanceof ApiError && err.code !== "network" && err.code !== "server_error") throw err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw lastErr;
}
