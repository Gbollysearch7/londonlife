"use client";
/**
 * Original synthesised sound: effects, ambient beds and a soft generative score, built with the Web Audio API
 * (no recorded or licensed audio). Audio starts only after the first user gesture; levels and mute persist
 * in this browser (spec ch. 28 "Sound").
 */
export interface SoundSettings {
  muted: boolean;
  sfx: number;
  music: number;
  ambience: number;
}

export type Sfx =
  | "click"
  | "pop"
  | "coin"
  | "spend"
  | "xp"
  | "level"
  | "star"
  | "promote"
  | "arrive"
  | "done"
  | "error"
  | "step"
  | "task"
  | "start"
  | "hit"
  | "miss"
  | "correct"
  | "wrong";

export interface Scene {
  /** Ambient layers wanted now, with relative levels 0–1. */
  layers: Partial<Record<Layer, number>>;
  /** Music tempo/feel. */
  music: "calm" | "night" | "club" | "off";
}

type Layer = "rain" | "city" | "room" | "murmur" | "birds" | "office" | "club" | "water" | "wind";

const KEY = "ll-audio-v1";
const DEFAULTS: SoundSettings = { muted: false, sfx: 0.8, music: 0.3, ambience: 0.6 };

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let ambBus: GainNode;
let noise: AudioBuffer;
let settings: SoundSettings = load();
let scene: Scene = { layers: {}, music: "off" };
const live = new Map<Layer, { gain: GainNode; stop: () => void }>();
const listeners = new Set<(s: SoundSettings) => void>();
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let birdTimer: ReturnType<typeof setTimeout> | null = null;
let clubTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function load(): SoundSettings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}

function applyLevels() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx * 0.9, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * 0.5, t, 0.2);
  ambBus.gain.setTargetAtTime(settings.ambience * 0.8, t, 0.2);
}

/** Creates the audio graph on the first user gesture (browsers block audio before that). */
function unlock() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  ambBus = ctx.createGain();
  for (const b of [sfxBus, musicBus, ambBus]) b.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyLevels();
  applyScene();
}

/** Installs the one-time gesture listeners. Safe to call repeatedly. */
export function initSound() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const go = () => unlock();
  window.addEventListener("pointerdown", go, { passive: true });
  window.addEventListener("keydown", go);
}

export function getSoundSettings() {
  return settings;
}

export function setSoundSettings(patch: Partial<SoundSettings>) {
  settings = { ...settings, ...patch };
  persist();
  applyLevels();
  applyScene();
  listeners.forEach((l) => l(settings));
}

export function subscribeSound(fn: (s: SoundSettings) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ───────────────────────────── effects ─────────────────────────────

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, glideTo?: number, bus: GainNode = sfxBus) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.012, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(bus);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noiseBurst(start: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, bus: GainNode = sfxBus) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(start, Math.random() * 1.5);
  src.stop(start + dur + 0.02);
}

export function sfx(name: Sfx) {
  if (!ctx || settings.muted || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case "click":
      tone(1100, t, 0.05, "sine", 0.06, 800);
      break;
    case "pop":
      tone(520, t, 0.07, "sine", 0.08, 900);
      break;
    case "coin":
      tone(988, t, 0.09, "triangle", 0.14);
      tone(1319, t + 0.07, 0.22, "triangle", 0.14);
      break;
    case "spend":
      tone(660, t, 0.08, "triangle", 0.08, 440);
      break;
    case "xp":
      tone(880, t, 0.08, "sine", 0.08, 1320);
      break;
    case "level":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.35, "triangle", 0.13));
      [2093, 2637].forEach((f, i) => tone(f, t + 0.4 + i * 0.06, 0.4, "sine", 0.05));
      break;
    case "star":
      [1568, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.05, 0.5, "sine", 0.06));
      break;
    case "promote":
      [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.12, i === 3 ? 0.8 : 0.25, "triangle", 0.14));
      tone(196, t + 0.36, 0.8, "sine", 0.1);
      break;
    case "arrive":
      tone(784, t, 0.5, "sine", 0.1);
      tone(659, t + 0.22, 0.7, "sine", 0.1);
      break;
    case "done":
      tone(660, t, 0.25, "triangle", 0.09);
      tone(990, t + 0.08, 0.3, "sine", 0.05);
      break;
    case "error":
      tone(170, t, 0.14, "square", 0.04);
      break;
    case "step":
      noiseBurst(t, 0.035, 0.05, "lowpass", 700 + Math.random() * 300);
      break;
    case "task":
      [587, 740, 880].forEach((f, i) => tone(f, t + i * 0.07, 0.18, "triangle", 0.09));
      break;
    case "start":
      tone(440, t, 0.12, "triangle", 0.08, 660);
      break;
    case "hit":
      tone(1046, t, 0.09, "triangle", 0.1);
      noiseBurst(t, 0.03, 0.06, "highpass", 6000);
      break;
    case "miss":
      tone(220, t, 0.12, "sawtooth", 0.035, 180);
      break;
    case "correct":
      tone(784, t, 0.12, "triangle", 0.11);
      tone(1175, t + 0.1, 0.25, "triangle", 0.11);
      break;
    case "wrong":
      tone(330, t, 0.16, "triangle", 0.09, 247);
      break;
  }
}

// ───────────────────────────── ambience & music ─────────────────────────────

/** Sets the ambient bed and music for the current scene; layers crossfade. */
export function setScene(next: Scene) {
  if (JSON.stringify(next) === JSON.stringify(scene)) return;
  scene = next;
  applyScene();
}

function startLayer(layer: Layer): { gain: GainNode; stop: () => void } {
  const c = ctx!;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(ambBus);
  const nodes: AudioScheduledSourceNode[] = [];
  const noiseThrough = (type: BiquadFilterType, freq: number, q = 0.7, vol = 1) => {
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(gain);
    src.start(0, Math.random() * 1.5);
    nodes.push(src);
    return g;
  };
  const lfo = (target: AudioParam, rate: number, depth: number) => {
    const o = c.createOscillator();
    o.frequency.value = rate;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    nodes.push(o);
  };
  switch (layer) {
    case "rain": {
      noiseThrough("highpass", 900, 0.5, 0.35);
      noiseThrough("bandpass", 3500, 0.6, 0.25);
      break;
    }
    case "city": {
      const g = noiseThrough("lowpass", 380, 0.8, 0.9);
      lfo(g.gain, 0.07, 0.35);
      break;
    }
    case "room":
      noiseThrough("lowpass", 160, 0.5, 0.5);
      break;
    case "murmur": {
      const g = noiseThrough("bandpass", 480, 1.2, 0.8);
      lfo(g.gain, 0.9, 0.3);
      const g2 = noiseThrough("bandpass", 900, 1.6, 0.4);
      lfo(g2.gain, 1.7, 0.2);
      break;
    }
    case "office": {
      noiseThrough("lowpass", 260, 0.5, 0.5);
      break;
    }
    case "water": {
      const g = noiseThrough("bandpass", 1100, 0.5, 0.6);
      lfo(g.gain, 0.18, 0.25);
      break;
    }
    case "wind": {
      const g = noiseThrough("bandpass", 600, 0.4, 0.5);
      lfo(g.gain, 0.11, 0.3);
      break;
    }
    case "birds":
    case "club":
      break;
  }
  return {
    gain,
    stop: () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      gain.disconnect();
    },
  };
}

function applyScene() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const wanted = settings.muted ? {} : scene.layers;
  for (const [layer, level] of Object.entries(wanted) as [Layer, number][]) {
    if (!level) continue;
    let l = live.get(layer);
    if (!l) {
      l = startLayer(layer);
      live.set(layer, l);
    }
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setTargetAtTime(level, t, 0.6);
  }
  for (const [layer, l] of live) {
    if (wanted[layer]) continue;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setTargetAtTime(0, t, 0.5);
    live.delete(layer);
    setTimeout(() => l.stop(), 3000);
  }
  scheduleBirds(!!wanted.birds);
  scheduleClub(!!wanted.club);
  scheduleMusic();
}

function scheduleBirds(on: boolean) {
  if (birdTimer) clearTimeout(birdTimer);
  birdTimer = null;
  if (!on || !ctx) return;
  const chirp = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 2200 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) tone(base * (1 + Math.random() * 0.15), t + i * 0.09, 0.07, "sine", 0.03 * (scene.layers.birds ?? 0), base * 1.3, ambBus);
    birdTimer = setTimeout(chirp, 900 + Math.random() * 3200);
  };
  birdTimer = setTimeout(chirp, 400);
}

function scheduleClub(on: boolean) {
  if (clubTimer) clearTimeout(clubTimer);
  clubTimer = null;
  if (!on || !ctx) return;
  const beat = 60 / 118;
  let step = 0;
  const tick = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const lv = scene.layers.club ?? 0;
    for (let i = 0; i < 4; i++) {
      const at = t + i * beat;
      tone(120, at, 0.28, "sine", 0.35 * lv, 45, ambBus);
      noiseBurst(at + beat / 2, 0.05, 0.05 * lv, "highpass", 7000, ambBus);
      const bassNotes = [55, 55, 65.4, 49];
      tone(bassNotes[(step + i) % 4] * 2, at + beat / 2, beat * 0.45, "sawtooth", 0.05 * lv, undefined, ambBus);
    }
    step += 4;
    clubTimer = setTimeout(tick, beat * 4 * 1000 - 20);
  };
  tick();
}

const CHORDS: Record<"calm" | "night", number[][]> = {
  // F major: Fmaj7 · Dm7 · Bbmaj7 · C6 (calm), and a mellower minor turn for night.
  calm: [
    [174.6, 220, 261.6, 329.6],
    [146.8, 220, 261.6, 349.2],
    [116.5, 233.1, 293.7, 349.2],
    [130.8, 220, 261.6, 329.6],
  ],
  night: [
    [146.8, 220, 261.6, 349.2],
    [116.5, 233.1, 293.7, 349.2],
    [130.8, 196, 261.6, 329.6],
    [110, 220, 261.6, 329.6],
  ],
};
const PENTA = [523.3, 587.3, 659.3, 784, 880, 1046.5];
let bar = 0;
let playingFeel: string | null = null;

function scheduleMusic() {
  const want = !ctx || settings.muted || settings.music <= 0 || scene.music === "off" || scene.music === "club" ? null : scene.music;
  if (want === playingFeel && (want === null || musicTimer)) return;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  playingFeel = want;
  if (!want) return;
  const feel = want as "calm" | "night";
  const barSec = 60 / 66 * 4;
  const playBar = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const chord = CHORDS[feel][bar % 4];
    chord.forEach((f, i) => {
      for (const det of [-3, 3]) {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(i === 0 ? 0.05 : 0.025, t + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t + barSec + 0.6);
        o.connect(g).connect(musicBus);
        o.start(t);
        o.stop(t + barSec + 0.7);
      }
    });
    // A few soft melody notes, never the same phrase twice in a row.
    const notes = 1 + Math.floor(Math.random() * 3);
    for (let n = 0; n < notes; n++) {
      if (Math.random() < 0.35) continue;
      const at = t + (n * barSec) / notes + Math.random() * 0.2;
      tone(PENTA[Math.floor(Math.random() * PENTA.length)] / (feel === "night" ? 2 : 1), at, 1.2, "sine", 0.035, undefined, musicBus);
    }
    bar++;
    musicTimer = setTimeout(playBar, barSec * 1000);
  };
  playBar();
}
