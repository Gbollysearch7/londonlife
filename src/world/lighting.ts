/**
 * One consistent daylight model driven by London world time and the day's weather (spec ch. 28).
 * Keyframes are blended by fractional hour, so light changes smoothly through the day.
 */
export interface Lighting {
  sky: string;
  skyTop: string;
  fog: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  night: boolean;
  window: string;
}

export const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = ch(pa);
  const [r2, g2, b2] = ch(pb);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((c(r1, r2) << 16) | (c(g1, g2) << 8) | c(b1, b2)).toString(16).padStart(6, "0")}`;
};

type Key = Omit<Lighting, "night"> & { h: number };

const KEYS: Key[] = [
  { h: 0, sky: "#1c2638", skyTop: "#0c1322", fog: "#1f293a", sun: "#9fb4d8", sunIntensity: 0.35, ambient: 0.32, hemiSky: "#5d6f9a", hemiGround: "#2a2630", window: "#22324a" },
  { h: 5, sky: "#2a3148", skyTop: "#141b30", fog: "#2c3246", sun: "#a9b4d8", sunIntensity: 0.4, ambient: 0.34, hemiSky: "#6d79a0", hemiGround: "#2e2a33", window: "#2a3550" },
  { h: 6.5, sky: "#e3c3b4", skyTop: "#8fa4c4", fog: "#d4c6c0", sun: "#ffd2b0", sunIntensity: 1.1, ambient: 0.52, hemiSky: "#f2dccf", hemiGround: "#6f5f58", window: "#e9d6c9" },
  { h: 8.5, sky: "#c9d9e2", skyTop: "#86a9c6", fog: "#cfd9de", sun: "#fff1dc", sunIntensity: 2.0, ambient: 0.7, hemiSky: "#fff4e6", hemiGround: "#7a6655", window: "#d8e8f0" },
  { h: 13, sky: "#bcd2e0", skyTop: "#7aa0c4", fog: "#c7d3d9", sun: "#fff6e6", sunIntensity: 2.3, ambient: 0.78, hemiSky: "#fff6ea", hemiGround: "#7a6655", window: "#d8e8f0" },
  { h: 17, sky: "#f0c8a0", skyTop: "#8fa8c8", fog: "#e2c2a6", sun: "#ffcf96", sunIntensity: 1.9, ambient: 0.66, hemiSky: "#ffe6cc", hemiGround: "#7a5f4c", window: "#f2c999" },
  { h: 19, sky: "#e39a78", skyTop: "#5a6a96", fog: "#cf9c86", sun: "#ffad78", sunIntensity: 1.2, ambient: 0.55, hemiSky: "#f5c6a8", hemiGround: "#5f4a44", window: "#f2b980" },
  { h: 20.5, sky: "#3a3f5e", skyTop: "#1a2140", fog: "#363b54", sun: "#a6b0d8", sunIntensity: 0.5, ambient: 0.38, hemiSky: "#6d74a0", hemiGround: "#2c2832", window: "#2f3a58" },
  { h: 24, sky: "#1c2638", skyTop: "#0c1322", fog: "#1f293a", sun: "#9fb4d8", sunIntensity: 0.35, ambient: 0.32, hemiSky: "#5d6f9a", hemiGround: "#2a2630", window: "#22324a" },
];

/** `hour` may be fractional (e.g. 17.5 = 17:30). */
export function lightingFor(hour: number, weather: string): Lighting {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
  const cols = ["sky", "skyTop", "fog", "sun", "hemiSky", "hemiGround", "window"] as const;
  const l = { night: h < 6 || h >= 20.25 } as Lighting;
  for (const k of cols) l[k] = mix(a[k], b[k], t);
  l.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  l.ambient = a.ambient + (b.ambient - a.ambient) * t;
  const wet = weather === "rain" || weather === "drizzle";
  if (wet || weather === "cloud") {
    const k = wet ? 0.55 : 0.3;
    for (const c of ["sky", "skyTop", "fog"] as const) l[c] = mix(l[c], l.night ? "#2b3038" : "#8f9aa3", k);
    l.sunIntensity *= wet ? 0.55 : 0.8;
    l.ambient *= 0.97;
  }
  return l;
}

/** Fractional London hour from a "HH:MM" clock string. */
export const clockHour = (clock: string) => Number(clock.slice(0, 2)) + Number(clock.slice(3, 5)) / 60;
