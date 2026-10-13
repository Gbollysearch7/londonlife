"use client";
import { create } from "zustand";

/**
 * Direct character control: keyboard (WASD / arrows, Shift to run, E to interact) and an on-screen
 * joystick write here; the player avatar reads it every frame. Presentation only — the server still
 * decides what you're doing; moving just changes where your character stands in the scene.
 */
export interface Nearby {
  id: string;
  label: string;
  open: () => void;
}

interface ControlStore {
  /** Joystick input, x right / y forward, each −1…1. */
  stick: { x: number; y: number };
  run: boolean;
  nearby: Nearby | null;
  /** Live player position in the current scene (written by the avatar each frame). */
  player: { x: number; z: number };
  setStick: (x: number, y: number) => void;
  setNearby: (n: Nearby | null) => void;
}

export const useControls = create<ControlStore>((set) => ({
  stick: { x: 0, y: 0 },
  run: false,
  nearby: null,
  player: { x: 0, z: 0 },
  setStick: (x, y) => set({ stick: { x, y } }),
  setNearby: (nearby) => set({ nearby }),
}));

/** Keys currently held (module state; read every frame without re-rendering). */
export const keys = new Set<string>();

const MOVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"];

/** Combined input from keys and joystick: x right, y forward, with run flag. */
export function readInput() {
  let x = 0;
  let y = 0;
  if (keys.has("w") || keys.has("arrowup")) y += 1;
  if (keys.has("s") || keys.has("arrowdown")) y -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  const st = useControls.getState();
  x += st.stick.x;
  y += st.stick.y;
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  const run = keys.has("shift") || Math.hypot(st.stick.x, st.stick.y) > 0.92;
  return { x, y, run, active: m > 0.08 };
}

let installed = false;

/** Installs keyboard listeners once. Typing in a field, or furniture placement mode, never moves the character. */
export function installKeyboard(isBlocked: () => boolean) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  };
  window.addEventListener("keydown", (e) => {
    if (typing(e) || isBlocked()) return;
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.includes(k)) {
      keys.add(k);
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
    }
    if ((k === "e" || k === "enter") && !e.repeat) {
      const n = useControls.getState().nearby;
      if (n && (k === "e" || (e.target as HTMLElement)?.tagName !== "BUTTON")) {
        e.preventDefault();
        n.open();
      }
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
}
