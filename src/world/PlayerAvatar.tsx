"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { readInput, useControls } from "./controls";
import type { Appearance } from "@/content/character";
import { useFx } from "@/client/fx";
import { sfx } from "@/client/sound";
import Avatar, { type Mood, type Outfit } from "./Avatar";
import { Particles, type ParticleKind } from "./effects";
import { findPath, isBlocked, toCell, type NavGrid, type P2 } from "./nav";
import type { Pose, Prop } from "./poses";
import { lastPositions, useScene } from "./sceneStore";

/** Where the avatar should be and what it should be doing there. Angles in radians. */
export interface Goal {
  key: string;
  pos: P2;
  y: number;
  rotY: number;
  approach: P2;
  pose: Pose;
  prop?: Prop;
  hide?: boolean;
  particles?: ParticleKind;
  /** Wander around the area while acting (jogs, walks). */
  roam?: "walk" | "jog";
}

const SPEED = 1.8;

/** A random walkable point near a centre, for roaming activities. */
function roamPoint(grid: NavGrid, centre: P2, n: number): P2 {
  for (let k = 0; k < 20; k++) {
    const a = Math.sin(n * 91.3 + k * 17.1) * 43758.5453;
    const b = Math.sin(n * 37.7 + k * 29.3) * 12345.6789;
    const x = centre[0] + ((a - Math.floor(a)) - 0.5) * 7;
    const z = centre[1] + ((b - Math.floor(b)) - 0.5) * 5;
    const [i, j] = toCell(grid, x, z);
    if (!isBlocked(grid, i, j)) return [x, z];
  }
  return centre;
}

function angleTo(from: number, to: number, k: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

/**
 * The player's avatar in a home or venue. Movement is presentation only: the server decides what you
 * are doing; this walks you there along a navigable path and plays the matching pose.
 */
const PlayerAvatar = forwardRef<Group, { appearance: Appearance; mood: Mood; outfit?: Outfit; grid: NavGrid; goal: Goal | null; spawn: P2; sceneKey: string; spawnRotY?: number }>(
  function PlayerAvatar({ appearance, mood, outfit, grid, goal, spawn, sceneKey, spawnRotY = Math.PI }, ref) {
    const group = useRef<Group>(null);
    useImperativeHandle(ref, () => group.current!, []);
    const start = lastPositions.get(sceneKey);
    const st = useRef({
      x: goal ? goal.pos[0] : start ? start[0] : spawn[0],
      z: goal ? goal.pos[1] : start ? start[2] : spawn[1],
      y: goal ? goal.y : 0,
      rot: goal ? goal.rotY : spawnRotY,
      path: [] as P2[],
      phase: (goal ? "act" : "idle") as "idle" | "walk" | "settle" | "act" | "drive",
      running: false,
      goalKey: goal?.key ?? null,
      lastApproach: goal?.approach ?? null as P2 | null,
      stepClock: 0,
      roamPath: [] as P2[],
      roamLeg: 0,
    });
    const walkTarget = useScene((s) => s.walkTarget);
    const seenWalk = useRef(walkTarget?.n ?? 0);
    const celebrateUntil = useFx((s) => s.celebrateUntil);
    const [phase, setPhase] = useState(st.current.phase);
    const [running, setRunning] = useState(false);
    const { camera } = useThree();
    const fwd = useRef(new Vector3());
    const [, rerender] = useState(0);
    useEffect(() => {
      const ms = celebrateUntil - Date.now();
      if (ms <= 0) return;
      const t = setTimeout(() => rerender((n) => n + 1), ms + 50);
      return () => clearTimeout(t);
    }, [celebrateUntil]);

    // A new goal (activity started or changed) walks to its approach point; losing the goal steps off.
    useEffect(() => {
      const s = st.current;
      const key = goal?.key ?? null;
      if (key === s.goalKey) return;
      s.goalKey = key;
      s.roamPath = [];
      if (goal) {
        s.path = findPath(grid, [s.x, s.z], goal.approach);
        s.lastApproach = goal.approach;
        s.phase = s.path.length ? "walk" : "settle";
      } else {
        s.path = s.lastApproach ? findPath(grid, [s.x, s.z], s.lastApproach) : [];
        s.y = 0;
        s.phase = s.path.length ? "walk" : "idle";
      }
      setPhase(s.phase);
    }, [goal, grid]);

    // Tap-to-walk, only when not busy with an activity.
    useEffect(() => {
      if (!walkTarget || walkTarget.n === seenWalk.current) return;
      seenWalk.current = walkTarget.n;
      const s = st.current;
      if (goal) return;
      s.path = findPath(grid, [s.x, s.z], [walkTarget.x, walkTarget.z]);
      s.phase = s.path.length ? "walk" : "idle";
      setPhase(s.phase);
    }, [walkTarget, goal, grid]);

    useEffect(
      () => () => {
        const s = st.current;
        if (s.phase !== "act") lastPositions.set(sceneKey, [s.x, 0, s.z]);
      },
      [sceneKey],
    );

    useFrame((_, rawDt) => {
      const dt = Math.min(rawDt, 0.1);
      const s = st.current;
      // Direct control (keys / joystick) whenever you're free; it overrides any tap-to-walk path.
      const input = goal ? null : readInput();
      if (input?.active) {
        if (s.phase !== "drive") {
          s.phase = "drive";
          s.path = [];
          setPhase("drive");
        }
        if (input.run !== s.running) {
          s.running = input.run;
          setRunning(input.run);
        }
        camera.getWorldDirection(fwd.current);
        const fx = fwd.current.x;
        const fz = fwd.current.z;
        const fl = Math.hypot(fx, fz) || 1;
        // Camera-relative: up on the stick walks away from the camera.
        const mx = (fx / fl) * input.y + (-fz / fl) * input.x;
        const mz = (fz / fl) * input.y + (fx / fl) * input.x;
        const speed = (input.run ? 3.6 : 2.0) * dt;
        const [ci, cj] = toCell(grid, s.x, s.z);
        // Standing inside an obstacle (e.g. just got up from a seat): any step out is allowed.
        const escaping = isBlocked(grid, ci, cj);
        const free = (x: number, z: number) => {
          const ahead = 0.22;
          const m = Math.hypot(mx, mz) || 1;
          const [i, j] = toCell(grid, x + (mx / m) * ahead, z + (mz / m) * ahead);
          const [i2, j2] = toCell(grid, x, z);
          if (escaping) return i2 >= 0 && j2 >= 0 && i2 < grid.cols && j2 < grid.rows;
          return !isBlocked(grid, i, j) && !isBlocked(grid, i2, j2);
        };
        const nx = s.x + mx * speed;
        const nz = s.z + mz * speed;
        // Slide along walls and furniture instead of stopping dead.
        if (free(nx, nz)) {
          s.x = nx;
          s.z = nz;
        } else if (free(nx, s.z)) s.x = nx;
        else if (free(s.x, nz)) s.z = nz;
        s.rot = angleTo(s.rot, Math.atan2(mx, mz), 1 - Math.exp(-dt * 14));
        s.stepClock += dt;
        if (s.stepClock > (input.run ? 0.22 : 0.32)) {
          s.stepClock = 0;
          sfx("step");
        }
      } else if (s.phase === "drive") {
        s.phase = "idle";
        setPhase("idle");
      } else if (s.phase === "walk") {
        const next = s.path[0];
        if (!next) {
          s.phase = goal ? "settle" : "idle";
          setPhase(s.phase);
        } else {
          const dx = next[0] - s.x;
          const dz = next[1] - s.z;
          const dist = Math.hypot(dx, dz);
          const step = SPEED * dt;
          if (dist <= step) {
            s.x = next[0];
            s.z = next[1];
            s.path.shift();
          } else {
            s.x += (dx / dist) * step;
            s.z += (dz / dist) * step;
          }
          if (dist > 0.01) s.rot = angleTo(s.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
          s.stepClock += dt;
          if (s.stepClock > 0.3) {
            s.stepClock = 0;
            sfx("step");
          }
        }
      } else if (s.phase === "settle" && goal) {
        const k = 1 - Math.exp(-dt * 9);
        s.x += (goal.pos[0] - s.x) * k;
        s.z += (goal.pos[1] - s.z) * k;
        s.y += (goal.y - s.y) * k;
        s.rot = angleTo(s.rot, goal.rotY, k);
        if (Math.hypot(goal.pos[0] - s.x, goal.pos[1] - s.z) < 0.02) {
          s.phase = "act";
          setPhase("act");
        }
      } else if (s.phase === "act" && goal?.roam) {
        // Roaming activities keep moving between nearby walkable points.
        if (!s.roamPath.length) s.roamPath = findPath(grid, [s.x, s.z], roamPoint(grid, goal.pos, ++s.roamLeg));
        const next = s.roamPath[0];
        if (next) {
          const dx = next[0] - s.x;
          const dz = next[1] - s.z;
          const dist = Math.hypot(dx, dz);
          const step = (goal.roam === "jog" ? 3.0 : 1.3) * dt;
          if (dist <= step) {
            s.x = next[0];
            s.z = next[1];
            s.roamPath.shift();
          } else {
            s.x += (dx / dist) * step;
            s.z += (dz / dist) * step;
          }
          if (dist > 0.01) s.rot = angleTo(s.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
        } else s.roamPath = [];
      } else if (s.phase === "act" && goal) {
        s.x = goal.pos[0];
        s.z = goal.pos[1];
        s.y = goal.y;
        s.rot = angleTo(s.rot, goal.rotY, 1 - Math.exp(-dt * 9));
      }
      const pl = useControls.getState().player;
      pl.x = s.x;
      pl.z = s.z;
      const g = group.current;
      if (g) {
        g.position.set(s.x, s.y, s.z);
        g.rotation.y = s.rot;
        g.visible = !(s.phase === "act" && goal?.hide);
      }
    });

    const celebrating = celebrateUntil > Date.now() && phase === "idle";
    const pose: Pose = phase === "drive" ? (running ? "jog" : "walk") : phase === "walk" ? "walk" : (phase === "act" || phase === "settle") && goal ? goal.pose : celebrating ? "celebrate" : "idle";
    const prop = phase === "act" || phase === "settle" ? goal?.prop : undefined;
    const showFx = phase === "act" && goal?.particles;

    return (
      <>
        <group ref={group}>
          <Avatar appearance={appearance} pose={pose} prop={prop} mood={celebrating ? "happy" : mood} outfit={outfit} />
        </group>
        {showFx && goal && !goal.roam && <Particles kind={goal.particles!} position={fxPosition(goal)} />}
      </>
    );
  },
);

export default PlayerAvatar;

/** Particles sit above the head; a sleeper's head is ~1.5 m behind their feet along their facing. */
function fxPosition(goal: Goal): [number, number, number] {
  if (goal.particles === "zzz") return [goal.pos[0] - Math.sin(goal.rotY) * 1.45, goal.y + 1.0, goal.pos[1] - Math.cos(goal.rotY) * 1.45];
  if (goal.hide) return [goal.pos[0], 2.0, goal.pos[1]];
  return [goal.pos[0], goal.y + 1.95, goal.pos[1]];
}
