"use client";
import { create } from "zustand";
import { fetchState, sendCommand, ApiError, type State } from "./api";
import { diffStates, useFx } from "./fx";
import { sfx, type Sfx } from "./sound";

export type SheetId = "actions" | "map" | "buy" | "phone" | "needs" | null;
export type PhoneApp = "home" | "jobs" | "missions" | "bank" | "skills" | "profile" | "inventory" | "tour" | "stories" | "treasure";

export interface Placement {
  instanceId: string;
  defId: string;
  x: number;
  y: number;
  rot: number;
}

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}

interface Store {
  state: State | null;
  serverOffset: number;
  loading: boolean;
  offline: boolean;
  pending: string | null;
  sheet: SheetId;
  phoneApp: PhoneApp;
  placement: Placement | null;
  /** Venue selected on the city map. */
  mapFocus: string | null;
  setMapFocus: (id: string | null) => void;
  toasts: Toast[];
  setSheet: (s: SheetId) => void;
  setPhoneApp: (a: PhoneApp) => void;
  setPlacement: (p: Placement | null) => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  refresh: () => Promise<void>;
  /** Runs a command; resolves to the server receipt, or false when it was rejected. */
  run: (type: string, payload?: unknown, label?: string) => Promise<false | Receipt>;
}

export interface Receipt {
  message?: string;
  result?: unknown;
}

let toastId = 0;

const CUE_SFX: Record<string, Sfx> = { coin: "coin", spend: "spend", xp: "xp", level: "level", star: "star", promote: "promote", arrive: "arrive", done: "done" };

function adopt(set: (p: Partial<Store>) => void, get: () => Store, s: unknown, fromCommand = false) {
  const st = s as State;
  if (!st?.character) return;
  const prev = get().state;
  set({ state: st, serverOffset: new Date(st.now).getTime() - Date.now(), offline: false });
  for (const n of st.notices ?? []) get().toast(n, "ok");
  // Presentation feedback only: floating numbers, banners and sound for what just changed.
  const diff = diffStates(prev, st, fromCommand || (st.notices ?? []).length > 0);
  if (diff.floats.length || diff.celebrations.length) useFx.getState().push(diff.floats, diff.celebrations);
  const cues = diff.cues.includes("level") || diff.cues.includes("promote") ? diff.cues.filter((c) => c !== "xp") : diff.cues;
  cues.slice(0, 3).forEach((c, i) => setTimeout(() => sfx(CUE_SFX[c]), i * 140));
}

export const useGame = create<Store>((set, get) => ({
  state: null,
  serverOffset: 0,
  loading: true,
  offline: false,
  pending: null,
  sheet: null,
  phoneApp: "home",
  placement: null,
  mapFocus: null,
  setMapFocus: (mapFocus) => set({ mapFocus }),
  toasts: [],
  setSheet: (sheet) => set({ sheet }),
  setPhoneApp: (phoneApp) => set({ phoneApp }),
  setPlacement: (placement) => set({ placement }),
  toast: (text, tone = "info") => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), tone === "error" ? 6000 : 4500);
  },
  refresh: async () => {
    try {
      const s = await fetchState();
      if (!s.character) {
        window.location.href = "/create";
        return;
      }
      adopt(set, get, s);
    } catch (err) {
      if (err instanceof ApiError && err.code === "signed_out") {
        window.location.href = "/";
        return;
      }
      set({ offline: true });
    } finally {
      set({ loading: false });
    }
  },
  run: async (type, payload, label) => {
    if (get().pending) return false;
    set({ pending: label ?? type });
    try {
      const r = await sendCommand(type, payload);
      if (r.receipt?.message) get().toast(r.receipt.message, "ok");
      if (type === "StartActivity" || type === "StartJourney" || type === "StartShift") sfx("start");
      adopt(set, get, r.state, true);
      return (r.receipt ?? {}) as Receipt;
    } catch (err) {
      sfx("error");
      get().toast(err instanceof Error ? err.message : "Something went wrong.", "error");
      await get().refresh();
      return false;
    } finally {
      set({ pending: null });
    }
  },
}));

/** Server-aligned current time in ms. */
export const serverNow = () => Date.now() + useGame.getState().serverOffset;
