"use client";
import { create } from "zustand";

/** Client-only scene interaction state: where the player asked to walk and which hotspot menu is open. */
export interface Hotspot {
  /** Stable id: furniture instance id, `npc:<id>` or `anchor:<id>`. */
  id: string;
  title: string;
  subtitle?: string;
  position: [number, number, number];
  actionIds: string[];
  furnitureId?: string;
}

interface SceneStore {
  walkTarget: { x: number; z: number; n: number } | null;
  hotspot: Hotspot | null;
  walkTo: (x: number, z: number) => void;
  openHotspot: (h: Hotspot | null) => void;
  reset: () => void;
}

let n = 0;
export const useScene = create<SceneStore>((set) => ({
  walkTarget: null,
  hotspot: null,
  walkTo: (x, z) => set({ walkTarget: { x, z, n: ++n }, hotspot: null }),
  openHotspot: (hotspot) => set({ hotspot }),
  reset: () => set({ walkTarget: null, hotspot: null }),
}));

/** Last idle position per scene, so returning to a room doesn't teleport you to the door. */
export const lastPositions = new Map<string, [number, number, number]>();
