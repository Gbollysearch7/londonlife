"use client";
import { create } from "zustand";

/**
 * Graphics quality and motion preferences (spec ch. 36 quality presets and reduced motion).
 * Quality changes only presentation: shadows, render scale, antialiasing and particle counts. Gameplay,
 * hotspots and timers are identical on every setting.
 */
export type Quality = "high" | "low";

const KEY = "ll_graphics";

interface Saved {
  quality?: Quality;
  showStats?: boolean;
}

function load(): Saved {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const v = raw ? (JSON.parse(raw) as Saved) : {};
    return { quality: v.quality === "low" || v.quality === "high" ? v.quality : undefined, showStats: v.showStats === true };
  } catch {
    return {};
  }
}

function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the setting lasts until reload */
  }
}

/** Small or low-core devices start on Low; anyone can switch in Settings. */
export function deviceDefault(): Quality {
  if (typeof window === "undefined") return "high";
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 8 : 8;
  return small || cores <= 4 ? "low" : "high";
}

export const isSmallScreen = () => typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600;

function mediaReduced() {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface GraphicsStore {
  quality: Quality;
  /** True once the player picked a quality themselves (otherwise it follows the device default). */
  chosen: boolean;
  reducedMotion: boolean;
  showStats: boolean;
  setQuality: (q: Quality) => void;
  setShowStats: (on: boolean) => void;
}

const saved = load();

export const useGraphics = create<GraphicsStore>((set, get) => ({
  quality: saved.quality ?? deviceDefault(),
  chosen: !!saved.quality,
  reducedMotion: mediaReduced(),
  showStats: saved.showStats ?? false,
  setQuality: (quality) => {
    set({ quality, chosen: true });
    save({ quality, showStats: get().showStats });
  },
  setShowStats: (showStats) => {
    set({ showStats });
    save({ quality: get().chosen ? get().quality : undefined, showStats });
  },
}));

if (typeof window !== "undefined") {
  try {
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => useGraphics.setState({ reducedMotion: e.matches }));
  } catch {
    /* older browsers: keep the value read at start */
  }
}

export interface Profile {
  /** Canvas device-pixel-ratio range; adaptive scaling moves within it. */
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  /** Multiplier for particle counts (0 hides decorative particles). */
  particles: number;
  /** Animate decorative motion (pulsing markers, dance floor flashes, drifting particles). */
  motion: boolean;
}

/** What a quality setting means for the renderer, given the screen and motion preference. */
export function profileFor(quality: Quality, opts: { small: boolean; reducedMotion: boolean }): Profile {
  const high = quality === "high";
  return {
    dpr: high ? [1, opts.small ? 1.5 : 1.75] : [0.75, 1],
    shadows: high,
    shadowMapSize: high ? (opts.small ? 1024 : 2048) : 512,
    antialias: high,
    particles: high ? 1 : 0.5,
    motion: !opts.reducedMotion,
  };
}

/** The live profile for scene components (reads the store; re-renders when settings change). */
export function useProfile(): Profile {
  const quality = useGraphics((g) => g.quality);
  const reducedMotion = useGraphics((g) => g.reducedMotion);
  return profileFor(quality, { small: isSmallScreen(), reducedMotion });
}

/** Non-hook read for code that runs inside frame loops. */
export const currentProfile = () => {
  const g = useGraphics.getState();
  return profileFor(g.quality, { small: isSmallScreen(), reducedMotion: g.reducedMotion });
};
