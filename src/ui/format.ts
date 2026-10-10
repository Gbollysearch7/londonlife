import type { NeedId } from "@/content/types";

export const money = (p: number) => `${p < 0 ? "−" : ""}£${(Math.abs(p) / 100).toFixed(2)}`;

export function duration(minutes: number) {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
  return `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min`;
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export const NEED_META: Record<NeedId, { label: string; icon: string; colour: string }> = {
  hunger: { label: "Hunger", icon: "◐", colour: "#c69c58" },
  energy: { label: "Energy", icon: "ϟ", colour: "#2f6355" },
  fun: { label: "Fun", icon: "★", colour: "#bc3d3b" },
  social: { label: "Social", icon: "◎", colour: "#2f4a6b" },
  hygiene: { label: "Hygiene", icon: "◇", colour: "#4d8fa8" },
  bladder: { label: "Bladder", icon: "▽", colour: "#7a6a5a" },
};

export function effectChips(needs: Partial<Record<NeedId, number>>) {
  return (Object.entries(needs) as [NeedId, number][]).filter(([, v]) => v).map(([k, v]) => ({ key: k, text: `${NEED_META[k].label} ${v > 0 ? "+" : "−"}${Math.abs(v)}`, good: v > 0 }));
}
