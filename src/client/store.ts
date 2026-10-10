"use client";
import { create } from "zustand";
import { fetchState, sendCommand, ApiError, type State } from "./api";

export type SheetId = "actions" | "map" | "buy" | "phone" | "needs" | null;
export type PhoneApp = "home" | "jobs" | "missions" | "bank" | "skills" | "profile" | "inventory" | "tour";

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
  toasts: Toast[];
  setSheet: (s: SheetId) => void;
  setPhoneApp: (a: PhoneApp) => void;
  setPlacement: (p: Placement | null) => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  refresh: () => Promise<void>;
  run: (type: string, payload?: unknown, label?: string) => Promise<boolean>;
}

let toastId = 0;

function adopt(set: (p: Partial<Store>) => void, get: () => Store, s: unknown) {
  const st = s as State;
  if (!st?.character) return;
  set({ state: st, serverOffset: new Date(st.now).getTime() - Date.now(), offline: false });
  for (const n of st.notices ?? []) get().toast(n, "ok");
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
      adopt(set, get, r.state);
      return true;
    } catch (err) {
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
