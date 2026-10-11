/**
 * Procedural pose library for the stylised avatar rig. Each pose returns joint targets (radians, metres)
 * for a time `t` in seconds; the avatar eases its current joints toward the target every frame,
 * so switching pose never snaps.
 *
 * Conventions (avatar faces +Z): a negative X rotation swings an arm or leg forward; a positive knee
 * rotation bends the shin backwards; a positive Z rotation lifts the right arm outwards (left is mirrored).
 */
export type Pose =
  | "idle"
  | "walk"
  | "jog"
  | "sit"
  | "sleep"
  | "work"
  | "type"
  | "wave"
  | "cook"
  | "eat"
  | "snack"
  | "dance"
  | "exercise"
  | "guitar"
  | "strum"
  | "read"
  | "celebrate"
  | "talk"
  | "perform"
  | "phone"
  | "photo"
  | "yoga"
  | "lift";

export type Prop = "pan" | "book" | "guitar" | "dumbbell" | "phone" | "mic" | "camera" | "plate" | "cup" | "none";

export interface Joints {
  /** Hip height above the feet origin (standing ≈ 0.92). */
  hipY: number;
  /** Whole-body rotation about X (sleep lies the body down). */
  rootX: number;
  /** Extra lift of the whole body (beds, stages). */
  lift: number;
  spineX: number;
  spineY: number;
  spineZ: number;
  headX: number;
  headY: number;
  lShX: number;
  lShZ: number;
  lElX: number;
  rShX: number;
  rShZ: number;
  rElX: number;
  lLegX: number;
  lKneeX: number;
  rLegX: number;
  rKneeX: number;
}

export const STAND: Joints = {
  hipY: 0.92,
  rootX: 0,
  lift: 0,
  spineX: 0,
  spineY: 0,
  spineZ: 0,
  headX: 0,
  headY: 0,
  lShX: 0,
  lShZ: -0.08,
  lElX: -0.12,
  rShX: 0,
  rShZ: 0.08,
  rElX: -0.12,
  lLegX: 0,
  lKneeX: 0,
  rLegX: 0,
  rKneeX: 0,
};

const SIT: Partial<Joints> = { hipY: 0.5, lLegX: -1.5, rLegX: -1.5, lKneeX: 1.5, rKneeX: 1.5, spineX: 0.05 };

const s = Math.sin;
const c = Math.cos;

/** Joint targets for a pose at time t. `phase` decorrelates several avatars playing the same pose. */
export function poseTargets(pose: Pose, t: number, phase = 0): Joints {
  const T = t + phase;
  const breath = s(T * 1.7) * 0.015;
  switch (pose) {
    case "walk": {
      const w = s(T * 7.5);
      return {
        ...STAND,
        hipY: 0.92 + Math.abs(c(T * 7.5)) * 0.03,
        spineX: 0.05,
        spineY: w * 0.06,
        lLegX: w * 0.55,
        rLegX: -w * 0.55,
        lKneeX: Math.max(0, -w) * 0.7 + 0.05,
        rKneeX: Math.max(0, w) * 0.7 + 0.05,
        lShX: -w * 0.45,
        rShX: w * 0.45,
        lElX: -0.25,
        rElX: -0.25,
      };
    }
    case "jog": {
      const w = s(T * 11);
      return {
        ...STAND,
        hipY: 0.9 + Math.abs(c(T * 11)) * 0.06,
        spineX: 0.14,
        lLegX: w * 0.8,
        rLegX: -w * 0.8,
        lKneeX: Math.max(0, -w) * 1.3 + 0.2,
        rKneeX: Math.max(0, w) * 1.3 + 0.2,
        lShX: -w * 0.7,
        rShX: w * 0.7,
        lElX: -1.4,
        rElX: -1.4,
      };
    }
    case "sit":
      return { ...STAND, ...SIT, lShX: -0.45, rShX: -0.45, lElX: -0.7, rElX: -0.7, spineX: 0.05 + breath, headX: s(T * 0.4) * 0.06, headY: s(T * 0.23) * 0.2 };
    case "type":
      return {
        ...STAND,
        ...SIT,
        spineX: 0.18,
        headX: 0.18,
        lShX: -0.75 + s(T * 13) * 0.04,
        rShX: -0.75 + c(T * 11) * 0.04,
        lElX: -0.95,
        rElX: -0.95,
        lShZ: 0.12,
        rShZ: -0.12,
      };
    case "sleep":
      return { ...STAND, rootX: -Math.PI / 2, lift: 0.55, headX: -0.15, lShZ: -0.12, rShZ: 0.12, lElX: -0.3, rElX: -0.3, spineX: breath * 2, lKneeX: 0.08, rKneeX: 0.12 };
    case "work":
      return {
        ...STAND,
        spineX: 0.12,
        headX: 0.25,
        lShX: -0.9 + s(T * 5) * 0.15,
        rShX: -0.9 + c(T * 5) * 0.15,
        lElX: -0.7,
        rElX: -0.7,
        lShZ: 0.15,
        rShZ: -0.15,
      };
    case "cook":
      return {
        ...STAND,
        spineX: 0.1,
        headX: 0.35,
        lShX: -0.6,
        lElX: -1.0,
        lShZ: 0.2,
        rShX: -0.85 + s(T * 6) * 0.08,
        rShZ: -0.1 + c(T * 6) * 0.15,
        rElX: -0.9,
      };
    case "eat": {
      const bite = Math.max(0, s(T * 2.2));
      return { ...STAND, ...SIT, lShX: -0.6, lElX: -1.1, lShZ: 0.15, rShX: -0.6 - bite * 0.5, rElX: -1.0 - bite * 1.0, rShZ: -0.1, headX: 0.15 - bite * 0.12 };
    }
    case "snack": {
      const bite = Math.max(0, s(T * 2.2));
      return { ...STAND, headX: 0.1 - bite * 0.1, rShX: -0.5 - bite * 0.6, rElX: -1.2 - bite * 0.9, rShZ: -0.1, lShX: -0.3, lElX: -0.6 };
    }
    case "wave":
      return { ...STAND, rShZ: 2.6 + s(T * 8) * 0.3, rElX: -0.3, headY: 0.1, spineZ: -0.04 };
    case "dance": {
      const b = s(T * 6.3);
      return {
        ...STAND,
        hipY: 0.88 + Math.abs(b) * 0.05,
        spineZ: b * 0.12,
        spineY: c(T * 3.15) * 0.3,
        headX: Math.abs(b) * 0.15 - 0.05,
        headY: -b * 0.15,
        lShZ: -0.6 - Math.max(0, b) * 1.6,
        rShZ: 0.6 + Math.max(0, -b) * 1.6,
        lShX: -0.3,
        rShX: -0.3,
        lElX: -1.2,
        rElX: -1.2,
        lLegX: Math.max(0, b) * -0.35,
        rLegX: Math.max(0, -b) * -0.35,
        lKneeX: Math.max(0, b) * 0.6 + 0.12,
        rKneeX: Math.max(0, -b) * 0.6 + 0.12,
      };
    }
    case "exercise":
    case "lift": {
      const curl = (s(T * 3.2) + 1) / 2;
      return { ...STAND, hipY: 0.9, lShX: -0.15, rShX: -0.15, lElX: -0.2 - curl * 2.0, rElX: -0.2 - curl * 2.0, lShZ: -0.18, rShZ: 0.18, lLegX: -0.05, rLegX: 0.05, lKneeX: 0.1, rKneeX: 0.1, spineX: -0.05, headX: -0.05 };
    }
    case "yoga": {
      const r = (s(T * 0.8) + 1) / 2;
      return { ...STAND, lShZ: -1.4 - r * 1.4, rShZ: 1.4 + r * 1.4, lElX: 0, rElX: 0, rLegX: -0.2 * r, rKneeX: 1.6 * r, spineX: -0.05, headX: -0.1 };
    }
    case "guitar":
      return {
        ...STAND,
        ...SIT,
        spineX: 0.12,
        headX: 0.3,
        headY: 0.2,
        lShX: -0.95,
        lShZ: -0.45,
        lElX: -0.9,
        rShX: -0.35 + s(T * 9) * 0.12,
        rShZ: -0.25,
        rElX: -1.25,
      };
    case "strum":
      return { ...STAND, spineX: 0.06, headX: 0.3, headY: 0.2, lShX: -0.95, lShZ: -0.45, lElX: -0.9, rShX: -0.35 + s(T * 9) * 0.12, rShZ: -0.25, rElX: -1.25 };
    case "read":
      return { ...STAND, ...SIT, headX: 0.42 + s(T * 0.5) * 0.04, headY: s(T * 0.9) * 0.06, lShX: -0.85, rShX: -0.85, lElX: -1.0, rElX: -1.0, lShZ: 0.2, rShZ: -0.2 };
    case "celebrate": {
      const j = Math.max(0, s(T * 9));
      return { ...STAND, lift: j * 0.12, hipY: 0.92 - j * 0.04, lShZ: -2.7 + s(T * 9) * 0.2, rShZ: 2.7 - s(T * 9) * 0.2, lElX: -0.2, rElX: -0.2, headX: -0.25, lKneeX: j * 0.5, rKneeX: j * 0.5, lLegX: -j * 0.2, rLegX: -j * 0.2 };
    }
    case "talk": {
      const g = s(T * 3.1);
      return { ...STAND, spineX: 0.02, headX: s(T * 2.3) * 0.08, headY: s(T * 0.9) * 0.15, rShX: -0.5 + g * 0.2, rElX: -1.0, rShZ: 0.1 + Math.max(0, g) * 0.3, lShX: -0.2, lElX: -0.4 };
    }
    case "perform": {
      const sway = s(T * 2.2);
      return { ...STAND, spineZ: sway * 0.05, spineX: -0.05, headX: -0.1 + s(T * 4.4) * 0.05, rShX: -1.1, rShZ: -0.1, rElX: -1.7, lShZ: -0.4 - Math.max(0, s(T * 1.1)) * 1.2, lElX: -0.4 };
    }
    case "phone":
      return { ...STAND, headX: 0.45, rShX: -0.7, rElX: -1.4, rShZ: -0.15, lShX: -0.5, lElX: -1.3, lShZ: 0.2 };
    case "photo":
      return { ...STAND, headX: 0.05, rShX: -1.3, rElX: -1.1, rShZ: -0.25, lShX: -1.3, lElX: -1.1, lShZ: 0.25, spineX: 0.04 };
    case "idle":
    default:
      return {
        ...STAND,
        spineX: breath,
        headY: s(T * 0.31) * 0.25 * Math.max(0, s(T * 0.11)),
        headX: s(T * 0.5) * 0.03,
        lShZ: -0.08 - breath,
        rShZ: 0.08 + breath,
      };
  }
}

/** Prop held in the right hand for a pose (left for the guitar neck). */
export function defaultProp(pose: Pose): Prop {
  switch (pose) {
    case "cook":
      return "pan";
    case "read":
      return "book";
    case "guitar":
    case "strum":
      return "guitar";
    case "lift":
    case "exercise":
      return "dumbbell";
    case "phone":
      return "phone";
    case "perform":
      return "mic";
    case "photo":
      return "camera";
    case "eat":
      return "plate";
    case "snack":
      return "cup";
    default:
      return "none";
  }
}

/** Frame-rate independent easing of current joints toward a target. */
export function easeJoints(cur: Joints, target: Joints, dt: number, rate = 10) {
  const k = 1 - Math.exp(-dt * rate);
  for (const key of Object.keys(target) as (keyof Joints)[]) cur[key] += (target[key] - cur[key]) * k;
}

/** Standing equivalent of a seated pose, used when an activity's spot has no seat. */
export function standingVariant(pose: Pose): { pose: Pose; prop?: Prop } {
  switch (pose) {
    case "eat":
      return { pose: "snack", prop: "plate" };
    case "type":
      return { pose: "work" };
    case "read":
      return { pose: "phone", prop: "book" };
    case "guitar":
      return { pose: "strum" };
    case "sit":
      return { pose: "idle" };
    default:
      return { pose };
  }
}
