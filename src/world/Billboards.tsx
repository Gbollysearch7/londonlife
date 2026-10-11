"use client";
/**
 * In-world advertising boards (spec ch. 27). Each spot belongs to an advertising site; it rotates through
 * that site's ads for the current week (from the server's public `ads.live`), or shows a house notice when
 * nothing is booked. Ads are drawn only from preset templates, colours and slogans.
 */
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { State } from "@/client/api";
import { BILLBOARD_SPOTS, type Spot } from "./billboardSpots";

export interface AdArt {
  template: string;
  colour: string;
  slogan: string;
  brand: string;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws one ad (or the house notice) into a canvas texture. */
function drawAd(art: AdArt | null, aspect: number) {
  const W = 512;
  const H = Math.round(W / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const t = art?.template ?? "house";
  const colour = art?.colour ?? "#234C42";
  const bg = t === "neon" ? "#17232b" : t === "chalk" ? "#2b3330" : t === "classic" ? "#f4eee4" : t === "house" ? "#e9e2d3" : colour;
  const fg = t === "neon" ? colour : t === "chalk" ? "#f4eee4" : t === "classic" ? colour : t === "house" ? "#56616a" : "#fbf8f2";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (t === "classic") {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
  } else if (t === "chalk") {
    ctx.strokeStyle = "#8a6a4a";
    ctx.lineWidth = 22;
    ctx.strokeRect(0, 0, W, H);
  } else if (t === "bold") {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
  }
  const font = t === "classic" ? "Georgia, serif" : t === "chalk" ? "'Chalkboard SE', 'Comic Sans MS', cursive" : "system-ui, sans-serif";
  const headline = art?.slogan ?? "Your ad here";
  const portrait = H > W;
  let size = portrait ? 64 : 58;
  ctx.font = `${t === "classic" ? "700" : "800"} ${size}px ${font}`;
  let lines = wrap(ctx, headline, W - 80);
  while ((lines.length * size * 1.15 > H * 0.6 || lines.some((l) => ctx.measureText(l).width > W - 70)) && size > 22) {
    size -= 4;
    ctx.font = `${t === "classic" ? "700" : "800"} ${size}px ${font}`;
    lines = wrap(ctx, headline, W - 80);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  if (t === "neon") {
    ctx.shadowColor = colour;
    ctx.shadowBlur = 24;
  }
  const top = H * 0.42 - ((lines.length - 1) * size * 1.15) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * 1.15));
  ctx.shadowBlur = 0;
  ctx.font = `600 ${Math.round(size * 0.55)}px ${font}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(art ? `— ${art.brand}` : "Book a slot in the Advertising app", W / 2, H * 0.84, W - 60);
  ctx.globalAlpha = 1;
  // Every ad is clearly labelled as one.
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = t === "classic" || t === "house" ? "rgba(23,35,43,0.55)" : "rgba(255,255,255,0.7)";
  ctx.fillText(art ? "AD" : "ADVERTISE HERE", W - 22, 26);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Board({ spot, art }: { spot: Spot; art: AdArt | null }) {
  const tex = useMemo(() => drawAd(art, spot.w / spot.h), [art?.template, art?.colour, art?.slogan, art?.brand, spot.w, spot.h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  const frame = "#2b2f36";
  const mid = spot.base + spot.h / 2;
  return (
    <group position={spot.pos} rotation={[0, (spot.rotY * Math.PI) / 180, 0]}>
      <mesh position={[0, mid, -0.06]} castShadow>
        <boxGeometry args={[spot.w + 0.14, spot.h + 0.14, 0.1]} />
        <meshStandardMaterial color={frame} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, mid, 0.002]}>
        <planeGeometry args={[spot.w, spot.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {(spot.mount ?? "posts") === "posts" &&
        [-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * spot.w * 0.32, spot.base / 2, -0.08]} castShadow>
            <boxGeometry args={[0.12, spot.base, 0.12]} />
            <meshStandardMaterial color={frame} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      {spot.mount === "shelter" && (
        <group>
          <mesh position={[0, spot.base / 2, -0.06]}>
            <boxGeometry args={[spot.w + 0.14, spot.base, 0.1]} />
            <meshStandardMaterial color={frame} roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[spot.w / 2 + 0.9, spot.base + spot.h + 0.12, 0.5]} castShadow>
            <boxGeometry args={[spot.w + 2.0, 0.08, 1.3]} />
            <meshStandardMaterial color="#cfd8dc" transparent opacity={0.55} roughness={0.2} />
          </mesh>
          <mesh position={[spot.w / 2 + 1.8, (spot.base + spot.h + 0.12) / 2, 1.05]}>
            <boxGeometry args={[0.06, spot.base + spot.h + 0.12, 0.06]} />
            <meshStandardMaterial color={frame} />
          </mesh>
          <mesh position={[spot.w / 2 + 0.9, 0.45, -0.05]}>
            <boxGeometry args={[1.6, 0.08, 0.35]} />
            <meshStandardMaterial color="#6b5a48" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Rotates every eight seconds; spots on the same site start on different ads. */
function useRotation(count: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, [count]);
  return tick;
}

export default function Billboards({ where, state }: { where: string; state: State }) {
  const spots = BILLBOARD_SPOTS[where];
  const live = state.ads?.live;
  const most = spots ? Math.max(0, ...spots.map((s) => live?.[s.site]?.length ?? 0)) : 0;
  const tick = useRotation(most);
  if (!spots) return null;
  return (
    <>
      {spots.map((spot, i) => {
        const ads = live?.[spot.site] ?? [];
        const ad = ads.length ? ads[(tick + i) % ads.length] : null;
        return <Board key={i} spot={spot} art={ad ? { template: ad.template, colour: ad.colour, slogan: ad.slogan, brand: ad.brand } : null} />;
      })}
    </>
  );
}
