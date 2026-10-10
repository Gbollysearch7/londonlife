import { PGlite } from "@electric-sql/pglite";
import schema from "../../db/migrations/001_init.sql";
import { setDb } from "./db";

/**
 * The test build keeps Postgres in memory and saves a compressed snapshot to this browser's IndexedDB
 * after each action. If IndexedDB is unavailable, the game still runs and simply resets on reload.
 */
const IDB_NAME = "london-life-test";
const SAVE_KEY = "save";
let accountId: string | null = null;
let db: PGlite | null = null;
export let persistent = true;

export const localAccountId = () => {
  if (!accountId) throw new Error("No local player yet");
  return accountId;
};

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("kv", mode);
      const req = fn(tx.objectStore("kv"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

async function asset(name: string) {
  const res = await fetch(`./${name}`);
  if (!res.ok) throw new Error(`Couldn't load ${name} (${res.status}). Reload the page to try again.`);
  return res;
}

export async function bootDatabase(onProgress: (msg: string) => void) {
  onProgress("Downloading the game engine…");
  const [wasm, initdb, data] = await Promise.all([
    asset("pglite.wasm").then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)),
    asset("initdb.wasm").then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)),
    asset("pglite-fs.wasm").then((r) => r.blob()),
  ]);
  onProgress("Opening your save…");
  let saved: Blob | undefined;
  try {
    saved = (await idb<Blob | undefined>("readonly", (s) => s.get(SAVE_KEY) as IDBRequest<Blob | undefined>)) ?? undefined;
  } catch {
    persistent = false;
  }
  const opts = { pgliteWasmModule: wasm, initdbWasmModule: initdb, fsBundle: data };
  try {
    db = await PGlite.create(saved ? { ...opts, loadDataDir: saved } : opts);
  } catch {
    db = await PGlite.create(opts); // a damaged save starts fresh rather than blocking play
  }
  const ready = await db.query<{ ok: boolean }>("SELECT to_regclass('public.characters') IS NOT NULL AS ok");
  if (!ready.rows[0].ok) await db.exec(schema.replace(/CREATE EXTENSION[^;]*;/, ""));
  setDb(db);
  const acc = await db.query<{ id: string }>("SELECT id FROM accounts LIMIT 1");
  accountId = acc.rows[0]?.id ?? null;
  const ch = accountId ? await db.query("SELECT 1 FROM characters WHERE account_id = $1", [accountId]) : { rows: [] };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());
  return { hasAccount: !!accountId, hasCharacter: ch.rows.length > 0 };
}

let saving: Promise<void> | null = null;
let again = false;
/** Writes a snapshot; overlapping calls coalesce into one follow-up save. */
export function saveNow(): Promise<void> {
  if (!persistent || !db) return Promise.resolve();
  if (saving) {
    again = true;
    return saving;
  }
  saving = (async () => {
    try {
      const blob = await db!.dumpDataDir("gzip");
      await idb("readwrite", (s) => s.put(blob, SAVE_KEY));
    } catch {
      persistent = false;
    } finally {
      saving = null;
      if (again) {
        again = false;
        void saveNow();
      }
    }
  })();
  return saving;
}

/** The test build's stand-in for sign-up: one local adult player per browser. */
export async function createLocalPlayer() {
  const r = await db!.query<{ id: string }>(
    "INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('local-test-player', 'none', now()) RETURNING id",
  );
  accountId = r.rows[0].id;
  await saveNow();
}

export async function resetSave() {
  try {
    await idb("readwrite", (s) => s.delete(SAVE_KEY));
  } catch {}
  location.reload();
}
