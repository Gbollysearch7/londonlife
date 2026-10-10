/** One consistent daylight model driven by London world time and the day's weather (spec ch. 28). */
export interface Lighting {
  sky: string;
  fog: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  night: boolean;
  window: string;
}

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = ch(pa);
  const [r2, g2, b2] = ch(pb);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((c(r1, r2) << 16) | (c(g1, g2) << 8) | c(b1, b2)).toString(16).padStart(6, "0")}`;
};

export function lightingFor(hour: number, weather: string): Lighting {
  const wet = weather === "rain" || weather === "drizzle";
  let l: Lighting;
  if (hour >= 7 && hour < 17) l = { sky: "#b9cfdc", fog: "#c7d3d9", sun: "#fff3dc", sunIntensity: 2.2, ambient: 0.75, night: false, window: "#d8e8f0" };
  else if (hour >= 17 && hour < 20) l = { sky: "#e3a77d", fog: "#d6a58a", sun: "#ffc183", sunIntensity: 1.6, ambient: 0.6, night: false, window: "#f2b980" };
  else if (hour >= 5 && hour < 7) l = { sky: "#d9c7c0", fog: "#d4cbc6", sun: "#ffe0c4", sunIntensity: 1.2, ambient: 0.55, night: false, window: "#e9d6c9" };
  else l = { sky: "#1c2638", fog: "#1f293a", sun: "#9fb4d8", sunIntensity: 0.35, ambient: 0.32, night: true, window: "#22324a" };
  if (wet) {
    l = { ...l, sky: mix(l.sky, "#8f9aa3", 0.55), fog: mix(l.fog, "#8f9aa3", 0.55), sunIntensity: l.sunIntensity * 0.55, ambient: l.ambient * 0.95 };
  }
  return l;
}
