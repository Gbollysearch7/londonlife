"use client";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** Procedural canvas textures (original, generated at runtime). Cached by parameters. */
const cache = new Map<string, CanvasTexture>();

function make(key: string, size: number, draw: (x: CanvasRenderingContext2D, s: number) => void) {
  let t = cache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  draw(x, size);
  t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function jitter(hex: string, amt: number, seed: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.sin(seed * 91.7) * 43758.5453;
  const k = 1 + ((r - Math.floor(r)) - 0.5) * amt;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export type FloorKind = "tiles" | "wood" | "stone" | "grass" | "carpet" | "concrete" | "checker" | "herringbone" | "rubber" | "path";

/** One texture tile covers 2×2 world units; callers set `repeat` to width/2, depth/2. */
export function floorTexture(kind: FloorKind, c1: string, c2: string) {
  return make(`floor|${kind}|${c1}|${c2}`, 256, (x, s) => {
    x.fillStyle = c1;
    x.fillRect(0, 0, s, s);
    switch (kind) {
      case "tiles":
      case "checker": {
        const n = kind === "checker" ? 4 : 2;
        const q = s / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            x.fillStyle = (i + j) % 2 ? jitter(c2, 0.06, i * 7 + j) : jitter(c1, 0.06, i * 3 + j * 5);
            x.fillRect(i * q, j * q, q, q);
          }
        x.strokeStyle = "rgba(0,0,0,0.12)";
        x.lineWidth = 2;
        for (let i = 0; i <= n; i++) {
          x.beginPath();
          x.moveTo(i * q, 0);
          x.lineTo(i * q, s);
          x.moveTo(0, i * q);
          x.lineTo(s, i * q);
          x.stroke();
        }
        break;
      }
      case "wood": {
        const planks = 8;
        const q = s / planks;
        for (let i = 0; i < planks; i++) {
          x.fillStyle = jitter(i % 2 ? c1 : c2, 0.1, i);
          x.fillRect(i * q, 0, q, s);
          const off = ((i * 37) % 5) / 5;
          x.fillStyle = "rgba(0,0,0,0.18)";
          x.fillRect(i * q, off * s, q, 2);
          x.fillStyle = "rgba(0,0,0,0.08)";
          for (let g = 0; g < 4; g++) x.fillRect(i * q + 4 + g * (q / 4), 0, 1, s);
        }
        x.fillStyle = "rgba(0,0,0,0.22)";
        for (let i = 0; i <= planks; i++) x.fillRect(i * q - 1, 0, 2, s);
        break;
      }
      case "herringbone": {
        const u = s / 8;
        for (let i = -2; i < 10; i++)
          for (let j = -2; j < 10; j++) {
            x.save();
            x.translate(i * u * 2 + (j % 2) * u, j * u);
            x.rotate(((i + j) % 2 ? 1 : -1) * Math.PI / 4);
            x.fillStyle = jitter((i + j) % 2 ? c1 : c2, 0.1, i * 13 + j);
            x.fillRect(0, 0, u * 1.6, u * 0.55);
            x.strokeStyle = "rgba(0,0,0,0.15)";
            x.strokeRect(0, 0, u * 1.6, u * 0.55);
            x.restore();
          }
        break;
      }
      case "stone":
      case "path": {
        const n = kind === "path" ? 6 : 4;
        const q = s / n;
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const off = j % 2 ? q / 2 : 0;
            x.fillStyle = jitter((i + j) % 3 ? c1 : c2, 0.12, i * 11 + j * 3);
            x.fillRect(i * q + off + 2, j * q + 2, q - 4, q - 4);
            x.fillRect(i * q + off + 2 - s, j * q + 2, q - 4, q - 4);
          }
        break;
      }
      case "grass": {
        for (let i = 0; i < 2600; i++) {
          const r = Math.sin(i * 12.9898) * 43758.5453;
          const f = r - Math.floor(r);
          const r2 = Math.sin(i * 78.233) * 12345.678;
          const g = r2 - Math.floor(r2);
          x.fillStyle = f > 0.5 ? jitter(c2, 0.2, i) : jitter(c1, 0.25, i * 3);
          x.fillRect(f * s, g * s, 2, 4 + f * 4);
        }
        break;
      }
      case "carpet": {
        for (let i = 0; i < 4000; i++) {
          const r = Math.sin(i * 12.9898) * 43758.5453;
          const f = r - Math.floor(r);
          const r2 = Math.sin(i * 39.346) * 9876.54;
          x.fillStyle = f > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
          x.fillRect(f * s, (r2 - Math.floor(r2)) * s, 2, 2);
        }
        x.strokeStyle = c2;
        x.lineWidth = 6;
        x.strokeRect(10, 10, s - 20, s - 20);
        break;
      }
      case "rubber": {
        for (let i = 0; i < 1600; i++) {
          const r = Math.sin(i * 12.9898) * 43758.5453;
          const f = r - Math.floor(r);
          const r2 = Math.sin(i * 39.346) * 9876.54;
          x.fillStyle = (i % 5 === 0 ? c2 : "rgba(255,255,255,0.06)") as string;
          x.fillRect(f * s, (r2 - Math.floor(r2)) * s, 2, 2);
        }
        x.strokeStyle = "rgba(0,0,0,0.25)";
        x.lineWidth = 2;
        x.strokeRect(0, 0, s, s);
        break;
      }
      case "concrete": {
        for (let i = 0; i < 1800; i++) {
          const r = Math.sin(i * 12.9898) * 43758.5453;
          const f = r - Math.floor(r);
          const r2 = Math.sin(i * 39.346) * 9876.54;
          x.fillStyle = f > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
          x.fillRect(f * s, (r2 - Math.floor(r2)) * s, 3, 3);
        }
        x.strokeStyle = "rgba(0,0,0,0.12)";
        x.lineWidth = 2;
        x.strokeRect(1, 1, s - 2, s - 2);
        break;
      }
    }
  });
}

/** Brick wall: one tile covers 2 world units wide × 2 high. */
export function brickTexture(brick: string, mortar = "#c9b8a8") {
  return make(`brick|${brick}|${mortar}`, 256, (x, s) => {
    x.fillStyle = mortar;
    x.fillRect(0, 0, s, s);
    const rows = 14;
    const h = s / rows;
    const w = s / 4;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 2 : 0;
      for (let i = -1; i < 5; i++) {
        x.fillStyle = jitter(brick, 0.18, r * 17 + i);
        x.fillRect(i * w + off + 2, r * h + 2, w - 4, h - 3);
      }
    }
  });
}

/** Painted plaster with a dado rail stripe in the lower third. */
export function plasterTexture(paint: string, dado: string) {
  return make(`plaster|${paint}|${dado}`, 256, (x, s) => {
    x.fillStyle = paint;
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const r = Math.sin(i * 12.9898) * 43758.5453;
      const f = r - Math.floor(r);
      const r2 = Math.sin(i * 39.346) * 9876.54;
      x.fillStyle = f > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.035)";
      x.fillRect(f * s, (r2 - Math.floor(r2)) * s, 3, 3);
    }
    x.fillStyle = dado;
    x.fillRect(0, s * 0.8, s, s * 0.2);
    x.fillStyle = "rgba(0,0,0,0.15)";
    x.fillRect(0, s * 0.8 - 3, s, 3);
  });
}

/** Wooden wall panelling for pubs and libraries. */
export function panelTexture(wood: string) {
  return make(`panel|${wood}`, 256, (x, s) => {
    x.fillStyle = wood;
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = "rgba(0,0,0,0.18)";
      x.fillRect(i * (s / 4) + 6, 10, s / 4 - 12, s - 20);
      x.fillStyle = jitter(wood, 0.08, i);
      x.fillRect(i * (s / 4) + 10, 14, s / 4 - 20, s - 28);
    }
  });
}
