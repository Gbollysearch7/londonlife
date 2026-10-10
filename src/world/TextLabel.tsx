"use client";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

interface Opts {
  text: string;
  sub?: string;
  colour?: string;
  background?: string | null;
  font?: string;
}

function makeTexture({ text, sub, colour = "#17232b", background = "rgba(251,248,242,0.95)", font = "600 64px system-ui, sans-serif" }: Opts) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width + (sub ? ctx.measureText(` ${sub}`).width : 0)) + 64;
  canvas.width = w;
  canvas.height = 112;
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 112, 56);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = colour;
  ctx.fillText(text, 32, 60);
  if (sub) {
    const x = 32 + ctx.measureText(text).width;
    ctx.fillStyle = "#7b858c";
    ctx.fillText(` ${sub}`, x, 60);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / 112 };
}

/** Text rendered into the scene itself (no DOM overlay), so scene switches can't race React. */
export function TextLabel({ height = 0.28, billboard = true, position, rotation, ...opts }: Opts & { height?: number; billboard?: boolean; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const { tex, aspect } = useMemo(() => makeTexture(opts), [opts.text, opts.sub, opts.colour, opts.background, opts.font]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  if (billboard) {
    return (
      <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
        <spriteMaterial map={tex} transparent depthWrite={false} />
      </sprite>
    );
  }
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}
