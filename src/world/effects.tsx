"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, type Group, type Object3D, type Sprite } from "three";
import { useFx } from "@/client/fx";
import { useProfile } from "@/client/graphics";

// ───────────────────────────── glyph textures ─────────────────────────────

const glyphCache = new Map<string, CanvasTexture>();

function glyph(char: string, colour: string, font = "700 96px system-ui, sans-serif") {
  const key = `${char}|${colour}|${font}`;
  let tex = glyphCache.get(key);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.font = font;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineWidth = 10;
    x.strokeStyle = "rgba(23,35,43,0.35)";
    x.strokeText(char, 64, 68);
    x.fillStyle = colour;
    x.fillText(char, 64, 68);
    tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    glyphCache.set(key, tex);
  }
  return tex;
}

function pill(text: string, colour: string) {
  const c = document.createElement("canvas");
  const x = c.getContext("2d")!;
  const font = "800 54px system-ui, sans-serif";
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + 44;
  c.width = w;
  c.height = 84;
  x.fillStyle = "rgba(251,248,242,0.96)";
  x.beginPath();
  x.roundRect(2, 2, w - 4, 80, 40);
  x.fill();
  x.strokeStyle = colour;
  x.lineWidth = 4;
  x.stroke();
  x.font = font;
  x.fillStyle = colour;
  x.textBaseline = "middle";
  x.fillText(text, 22, 45);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return { tex, aspect: w / 84 };
}

// ───────────────────────────── floating reward numbers ─────────────────────────────

function FloatSprite({ text, colour, born, slot }: { text: string; colour: string; born: number; slot: number }) {
  const ref = useRef<Sprite>(null);
  const { tex, aspect } = useMemo(() => pill(text, colour), [text, colour]);
  useEffect(() => () => tex.dispose(), [tex]);
  const h = 0.28;
  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const age = (Date.now() - born) / 1000 - slot * 0.18;
    const visible = age > 0 && age < 2.6;
    s.visible = visible;
    if (!visible) return;
    const pop = Math.min(1, age / 0.18);
    s.position.set(((slot % 3) - 1) * 0.35, 2.15 + age * 0.55 + slot * 0.05, 0);
    s.scale.set(h * aspect * pop, h * pop, 1);
    (s.material as { opacity: number }).opacity = age > 1.9 ? Math.max(0, 1 - (age - 1.9) / 0.7) : 1;
  });
  return (
    <sprite ref={ref} renderOrder={20} visible={false}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

/** Rising reward pills above whatever object `target` points at (normally the player's avatar). */
export function FloatingTexts({ target }: { target: React.RefObject<Object3D | null> }) {
  const floats = useFx((s) => s.floats);
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current && target.current) group.current.position.copy(target.current.position);
  });
  return (
    <group ref={group}>
      {floats.map((f) => (
        <FloatSprite key={f.id} text={f.text} colour={f.colour} born={f.born} slot={f.slot} />
      ))}
    </group>
  );
}

// ───────────────────────────── particle emitters ─────────────────────────────

export type ParticleKind = "zzz" | "steam" | "notes" | "sparkle" | "water" | "hearts" | "sweat" | "chat" | "confetti" | "code" | "food";

const KIND: Record<ParticleKind, { chars: string[]; colours: string[]; count: number; life: number; rise: number; spread: number; size: number }> = {
  zzz: { chars: ["Z", "z"], colours: ["#2f4a6b", "#4d6a8f"], count: 3, life: 2.4, rise: 0.9, spread: 0.25, size: 0.22 },
  steam: { chars: ["●"], colours: ["#ffffff"], count: 8, life: 1.6, rise: 0.7, spread: 0.18, size: 0.16 },
  notes: { chars: ["♪", "♫"], colours: ["#234c42", "#bc3d3b", "#c69c58", "#2f4a6b"], count: 4, life: 2.0, rise: 0.8, spread: 0.45, size: 0.24 },
  sparkle: { chars: ["✦"], colours: ["#c69c58", "#f1d58a"], count: 6, life: 1.2, rise: 0.4, spread: 0.5, size: 0.18 },
  water: { chars: ["│"], colours: ["#9cc8dc"], count: 10, life: 0.6, rise: -1.4, spread: 0.3, size: 0.18 },
  hearts: { chars: ["♥"], colours: ["#bc3d3b", "#e0697a"], count: 3, life: 1.8, rise: 0.7, spread: 0.3, size: 0.2 },
  sweat: { chars: ["●"], colours: ["#9cc8dc"], count: 3, life: 0.9, rise: -0.5, spread: 0.2, size: 0.08 },
  chat: { chars: ["…", "!", "♪", "☺"], colours: ["#17232b", "#2f4a6b"], count: 2, life: 2.2, rise: 0.35, spread: 0.25, size: 0.26 },
  confetti: { chars: ["▮", "●", "▲"], colours: ["#bc3d3b", "#c69c58", "#234c42", "#2f4a6b", "#e0697a"], count: 24, life: 1.8, rise: 1.4, spread: 1.0, size: 0.12 },
  code: { chars: ["{", "}", "<>", ";", "01"], colours: ["#2f6355", "#2f4a6b"], count: 4, life: 1.8, rise: 0.6, spread: 0.35, size: 0.18 },
  food: { chars: ["●"], colours: ["#d58a3a", "#c69c58"], count: 3, life: 1.0, rise: 0.35, spread: 0.15, size: 0.09 },
};

function rand(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A small looping emitter of glyph sprites. Stateless per particle (position derived from time). */
export function Particles({ kind, position = [0, 0, 0], intensity = 1 }: { kind: ParticleKind; position?: [number, number, number]; intensity?: number }) {
  const cfg = KIND[kind];
  // Low quality halves particle counts; reduced motion freezes them in place (still visible, no drifting).
  const { particles, motion } = useProfile();
  const count = Math.max(1, Math.round(cfg.count * intensity * particles));
  const refs = useRef<(Sprite | null)[]>([]);
  const textures = useMemo(() => Array.from({ length: count }, (_, i) => glyph(cfg.chars[i % cfg.chars.length], cfg.colours[i % cfg.colours.length])), [cfg, count]);
  useFrame(({ clock }) => {
    const t = motion ? clock.getElapsedTime() : cfg.life * 0.35;
    for (let i = 0; i < count; i++) {
      const s = refs.current[i];
      if (!s) continue;
      const age = (t / cfg.life + i / count) % 1;
      const rise = cfg.rise * age * cfg.life;
      const ang = rand(i, 1) * Math.PI * 2;
      const r = cfg.spread * (kind === "confetti" ? age : 0.4 + 0.6 * rand(i, 2));
      const wobble = Math.sin(t * 3 + i) * 0.05;
      s.position.set(Math.cos(ang) * r + wobble, (kind === "confetti" ? Math.sin(age * Math.PI) * cfg.rise : rise) + (cfg.rise < 0 ? -cfg.rise * cfg.life : 0), Math.sin(ang) * r);
      const sc = cfg.size * (kind === "steam" ? 0.6 + age : 1) * (age < 0.1 ? age / 0.1 : 1);
      s.scale.set(sc, sc, 1);
      (s.material as { opacity: number }).opacity = kind === "steam" ? 0.5 * (1 - age) : age > 0.7 ? (1 - age) / 0.3 : 1;
    }
  });
  return (
    <group position={position}>
      {textures.map((tex, i) => (
        <sprite key={i} ref={(el) => void (refs.current[i] = el)} renderOrder={15}>
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** Confetti burst plus sparkles around the target while a celebration is playing. */
export function CelebrationBurst({ target }: { target: React.RefObject<Object3D | null> }) {
  const until = useFx((s) => s.celebrateUntil);
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current && target.current) group.current.position.copy(target.current.position);
    if (group.current) group.current.visible = Date.now() < until;
  });
  if (Date.now() > until + 100) return null;
  return (
    <group ref={group}>
      <Particles kind="confetti" position={[0, 1.6, 0]} />
      <Particles kind="sparkle" position={[0, 1.9, 0]} />
    </group>
  );
}
