"use client";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { LatheGeometry, MeshStandardMaterial, Vector2, type Group } from "three";
import { APPEARANCE_OPTIONS, type Appearance } from "@/content/character";
import { STAND, defaultProp, easeJoints, poseTargets, type Joints, type Pose, type Prop } from "./poses";

export type { Pose, Prop } from "./poses";
export type Mood = "happy" | "neutral" | "sad";

/** Garment silhouettes; colours still come from the appearance record. */
export interface Outfit {
  /** 0 tee · 1 hoodie · 2 shirt · 3 jacket · 4 jumper */
  top?: number;
  /** 0 trousers · 1 shorts · 2 skirt · 3 joggers */
  bottom?: number;
  /** 0 none · 1 beanie · 2 cap · 3 bucket hat */
  hat?: number;
  glasses?: boolean;
  scarf?: boolean;
}

const torsoProfiles = new Map<string, LatheGeometry>();
function torsoGeometry(shoulder: number, waist: number, hip: number) {
  const key = `${shoulder}|${waist}|${hip}`;
  let g = torsoProfiles.get(key);
  if (!g) {
    // Profile from hip line (y=0) up to the base of the neck (y≈0.5), revolved; scaled flatter in Z by the mesh.
    const pts = [
      new Vector2(0.001, -0.02),
      new Vector2(hip * 0.95, 0),
      new Vector2(hip, 0.06),
      new Vector2(waist, 0.2),
      new Vector2(shoulder * 0.92, 0.36),
      new Vector2(shoulder, 0.43),
      new Vector2(shoulder * 0.7, 0.5),
      new Vector2(0.06, 0.53),
      new Vector2(0.001, 0.535),
    ];
    g = new LatheGeometry(pts, 20);
    torsoProfiles.set(key, g);
  }
  return g;
}

function Hair({ style, mat }: { style: number; mat: MeshStandardMaterial }) {
  switch (style) {
    case 0: // short crop
      return (
        <mesh position={[0, 0.045, -0.01]} castShadow material={mat}>
          <sphereGeometry args={[0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
        </mesh>
      );
    case 1: // curls
      return (
        <group>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const r = i % 2 ? 0.16 : 0.11;
            return (
              <mesh key={i} position={[Math.cos(a) * r, 0.13 + (i % 3) * 0.025, Math.sin(a) * r - 0.03]} castShadow material={mat}>
                <icosahedronGeometry args={[0.085, 1]} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.19, -0.02]} material={mat}>
            <icosahedronGeometry args={[0.12, 1]} />
          </mesh>
        </group>
      );
    case 2: // locs
      return (
        <group>
          <mesh position={[0, 0.05, -0.01]} material={mat}>
            <sphereGeometry args={[0.207, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI * 0.1 + (i / 10) * Math.PI * 0.8;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.19, -0.1, -Math.sin(a) * 0.19]} rotation={[-Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15]} castShadow material={mat}>
                <capsuleGeometry args={[0.024, 0.3, 3, 6]} />
              </mesh>
            );
          })}
        </group>
      );
    case 3: // braids
      return (
        <group>
          <mesh position={[0, 0.05, -0.01]} material={mat}>
            <sphereGeometry args={[0.207, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {[-0.13, 0.13].map((x) => (
            <group key={x} position={[x, -0.05, -0.12]} rotation={[0.25, 0, x > 0 ? -0.1 : 0.1]}>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} position={[0, -k * 0.09, 0]} castShadow material={mat}>
                  <sphereGeometry args={[0.04 - k * 0.004, 8, 6]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case 4: // bob
      return (
        <mesh position={[0, 0.0, -0.01]} castShadow material={mat}>
          <sphereGeometry args={[0.225, 22, 14, 0, Math.PI * 2, 0, Math.PI / 1.62]} />
        </mesh>
      );
    default: // shaved
      return (
        <mesh position={[0, 0.035, 0]}>
          <sphereGeometry args={[0.194, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
          <meshStandardMaterial color={mat.color} roughness={1} transparent opacity={0.55} />
        </mesh>
      );
  }
}

function Hat({ kind, mat }: { kind: number; mat: MeshStandardMaterial }) {
  if (kind === 1)
    return (
      <group position={[0, 0.07, -0.01]}>
        <mesh material={mat} castShadow>
          <sphereGeometry args={[0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.0, 0]} material={mat}>
          <torusGeometry args={[0.205, 0.03, 8, 24]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} material={mat}>
          <sphereGeometry args={[0.045, 10, 8]} />
        </mesh>
      </group>
    );
  if (kind === 2)
    return (
      <group position={[0, 0.07, -0.01]}>
        <mesh material={mat} castShadow>
          <sphereGeometry args={[0.212, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.0, 0.2]} rotation={[0.12, 0, 0]} material={mat}>
          <boxGeometry args={[0.26, 0.02, 0.16]} />
        </mesh>
      </group>
    );
  if (kind === 3)
    return (
      <group position={[0, 0.08, -0.01]}>
        <mesh material={mat} castShadow>
          <cylinderGeometry args={[0.17, 0.21, 0.16, 20]} />
        </mesh>
        <mesh position={[0, -0.07, 0]} material={mat}>
          <cylinderGeometry args={[0.3, 0.3, 0.015, 24]} />
        </mesh>
      </group>
    );
  return null;
}

function HandProp({ prop, side }: { prop: Prop; side: "l" | "r" }) {
  if (side === "l") {
    if (prop === "dumbbell") return <Dumbbell />;
    return null;
  }
  switch (prop) {
    case "pan":
      return (
        <group position={[0, -0.04, 0.05]} rotation={[1.2, 0, 0]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
          <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.11, 0.05, 18]} />
            <meshStandardMaterial color="#3a3f46" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      );
    case "book":
      return (
        <group position={[-0.1, -0.06, 0.06]} rotation={[0.9, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.24, 0.17, 0.035]} />
            <meshStandardMaterial color="#BC3D3B" />
          </mesh>
          <mesh position={[0, 0, 0.019]}>
            <planeGeometry args={[0.22, 0.15]} />
            <meshStandardMaterial color="#fbf8f2" />
          </mesh>
        </group>
      );
    case "dumbbell":
      return <Dumbbell />;
    case "phone":
      return (
        <mesh position={[0, -0.05, 0.04]} rotation={[1.0, 0, 0]}>
          <boxGeometry args={[0.07, 0.13, 0.012]} />
          <meshStandardMaterial color="#17232b" emissive="#3a6a8a" emissiveIntensity={0.4} />
        </mesh>
      );
    case "mic":
      return (
        <group position={[0, -0.02, 0.03]} rotation={[0.4, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.012, 0.16, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#a9b0b5" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
    case "camera":
      return (
        <group position={[-0.1, -0.06, 0.06]} rotation={[1.35, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.1, 0.07]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 14]} />
            <meshStandardMaterial color="#46505b" metalness={0.5} />
          </mesh>
        </group>
      );
    case "cup":
      return (
        <mesh position={[0, -0.06, 0.03]}>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
          <meshStandardMaterial color="#fbf8f2" />
        </mesh>
      );
    case "plate":
      return (
        <mesh position={[0, -0.04, 0.06]} rotation={[1.4, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
          <meshStandardMaterial color="#c9ced2" metalness={0.6} />
        </mesh>
      );
    default:
      return null;
  }
}

function Dumbbell() {
  return (
    <group position={[0, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
        <meshStandardMaterial color="#a9b0b5" metalness={0.7} />
      </mesh>
      {[-0.09, 0.09].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
          <meshStandardMaterial color="#2b2f36" metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function BodyProp({ prop }: { prop: Prop }) {
  if (prop === "guitar")
    return (
      <group position={[0.02, 0.12, 0.2]} rotation={[0.25, 0, 0.95]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.09, 20]} />
          <meshStandardMaterial color="#B98B5E" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.09, 18]} />
          <meshStandardMaterial color="#B98B5E" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.05, 16]} />
          <meshStandardMaterial color="#2b1d14" />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[0.05, 0.55, 0.035]} />
          <meshStandardMaterial color="#3a2a1e" />
        </mesh>
      </group>
    );
  if (prop === "plate")
    return (
      <group position={[0, 0.02, 0.3]}>
        <mesh>
          <cylinderGeometry args={[0.13, 0.1, 0.025, 20]} />
          <meshStandardMaterial color="#f2f0ea" />
        </mesh>
        <mesh position={[0.02, 0.025, 0]}>
          <sphereGeometry args={[0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d58a3a" />
        </mesh>
      </group>
    );
  return null;
}

/**
 * The stylised Londoner. Original procedural rig with two-segment limbs, a blinking face and
 * pose blending. `pose` drives animation; `prop` defaults per pose; `mood` sets the expression.
 */
export default function Avatar({
  appearance,
  pose = "idle",
  prop,
  mood = "neutral",
  outfit,
  phase = 0,
  children,
  ...props
}: { appearance: Appearance; pose?: Pose; prop?: Prop; mood?: Mood; outfit?: Outfit; phase?: number; children?: ReactNode } & ThreeElements["group"]) {
  const skin = APPEARANCE_OPTIONS.skin[appearance.skin] ?? APPEARANCE_OPTIONS.skin[0];
  const hair = APPEARANCE_OPTIONS.hairColour[appearance.hairColour] ?? APPEARANCE_OPTIONS.hairColour[0];
  const top = APPEARANCE_OPTIONS.top[appearance.top] ?? APPEARANCE_OPTIONS.top[0];
  const bottom = APPEARANCE_OPTIONS.bottom[appearance.bottom] ?? APPEARANCE_OPTIONS.bottom[0];
  const shoes = APPEARANCE_OPTIONS.shoes[appearance.shoes] ?? APPEARANCE_OPTIONS.shoes[0];
  const b = appearance.body === 1;
  const shoulder = b ? 0.17 : 0.2;
  const waist = b ? 0.12 : 0.15;
  const hip = b ? 0.165 : 0.15;
  outfit = outfit ?? appearance.outfit;
  const topStyle = outfit?.top ?? 0;
  const bottomStyle = outfit?.bottom ?? 0;
  const longSleeves = topStyle !== 0 && topStyle !== 2;
  const bareShins = bottomStyle === 1 || bottomStyle === 2;
  const heldProp = prop ?? defaultProp(pose);

  const mats = useMemo(() => {
    const m = (color: string, roughness = 0.8) => new MeshStandardMaterial({ color, roughness });
    return {
      skin: m(skin, 0.6),
      skinShade: m(skin, 0.7),
      hair: m(hair, 0.85),
      top: m(top, 0.85),
      topDark: m(shade(top, 0.82), 0.9),
      bottom: m(bottom, 0.9),
      shoes: m(shoes, 0.55),
      sole: m("#2b2622", 0.9),
      eyeWhite: m("#fbf8f2", 0.3),
      eye: m("#17232B", 0.2),
      mouth: m("#6b2f2a", 0.6),
      hat: m(top === "#E9E2D3" ? "#234C42" : shade(top, 0.7), 0.9),
    };
  }, [skin, hair, top, bottom, shoes]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const torso = useMemo(() => torsoGeometry(shoulder, waist, hip), [shoulder, waist, hip]);

  const j = useRef<Joints>({ ...STAND, ...poseTargets(pose, 0, phase) });
  const R = {
    root: useRef<Group>(null),
    hips: useRef<Group>(null),
    spine: useRef<Group>(null),
    head: useRef<Group>(null),
    lSh: useRef<Group>(null),
    rSh: useRef<Group>(null),
    lEl: useRef<Group>(null),
    rEl: useRef<Group>(null),
    lLeg: useRef<Group>(null),
    rLeg: useRef<Group>(null),
    lKnee: useRef<Group>(null),
    rKnee: useRef<Group>(null),
    eyes: useRef<Group>(null),
  };
  const blink = useRef({ next: 1.5 + phase * 3, until: 0 });

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const target = poseTargets(pose, t, phase);
    easeJoints(j.current, target, Math.min(dt, 0.1), pose === "walk" || pose === "jog" || pose === "dance" ? 18 : 9);
    const J = j.current;
    if (R.root.current) {
      R.root.current.rotation.x = J.rootX;
      R.root.current.position.y = J.lift;
    }
    if (R.hips.current) R.hips.current.position.y = J.hipY;
    if (R.spine.current) R.spine.current.rotation.set(J.spineX, J.spineY, J.spineZ);
    if (R.head.current) R.head.current.rotation.set(J.headX, J.headY, 0);
    if (R.lSh.current) R.lSh.current.rotation.set(J.lShX, 0, J.lShZ);
    if (R.rSh.current) R.rSh.current.rotation.set(J.rShX, 0, J.rShZ);
    if (R.lEl.current) R.lEl.current.rotation.x = J.lElX;
    if (R.rEl.current) R.rEl.current.rotation.x = J.rElX;
    if (R.lLeg.current) R.lLeg.current.rotation.x = J.lLegX;
    if (R.rLeg.current) R.rLeg.current.rotation.x = J.rLegX;
    if (R.lKnee.current) R.lKnee.current.rotation.x = J.lKneeX;
    if (R.rKnee.current) R.rKnee.current.rotation.x = J.rKneeX;
    // Blink every few seconds; eyes stay shut while asleep.
    const bl = blink.current;
    if (t > bl.next) {
      bl.until = t + 0.12;
      bl.next = t + 2.5 + ((Math.sin(t * 13.7 + phase * 7) + 1) / 2) * 3;
    }
    if (R.eyes.current) R.eyes.current.scale.y = pose === "sleep" ? 0.12 : t < bl.until ? 0.15 : 1;
  });

  const leg = (side: -1 | 1, legRef: typeof R.lLeg, kneeRef: typeof R.lKnee) => (
    <group ref={legRef} position={[side * (hip - 0.06), -0.02, 0]}>
      <mesh position={[0, -0.21, 0]} castShadow material={bottomStyle === 2 ? mats.skin : mats.bottom}>
        <capsuleGeometry args={[0.068, 0.32, 4, 10]} />
      </mesh>
      <group ref={kneeRef} position={[0, -0.44, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow material={bareShins ? mats.skin : bottomStyle === 3 ? mats.bottom : mats.bottom}>
          <capsuleGeometry args={[bareShins ? 0.05 : 0.06, 0.3, 4, 10]} />
        </mesh>
        {bottomStyle === 3 && (
          <mesh position={[0, -0.37, 0]} material={mats.topDark}>
            <cylinderGeometry args={[0.058, 0.058, 0.04, 10]} />
          </mesh>
        )}
        <group position={[0, -0.42, 0.04]}>
          <mesh position={[0, 0.0, 0]} castShadow material={mats.shoes}>
            <capsuleGeometry args={[0.055, 0.13, 4, 10]} />
          </mesh>
          <mesh position={[0, -0.035, 0]} material={mats.sole} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.058, 0.13, 3, 10]} />
          </mesh>
        </group>
      </group>
    </group>
  );

  const arm = (side: -1 | 1, shRef: typeof R.lSh, elRef: typeof R.lEl) => (
    <group ref={shRef} position={[side * (shoulder + 0.01), 0.41, 0]}>
      <mesh position={[0, 0, 0]} material={mats.top}>
        <sphereGeometry args={[0.065, 12, 10]} />
      </mesh>
      <mesh position={[0, -0.13, 0]} castShadow material={mats.top}>
        <capsuleGeometry args={[0.052, 0.18, 4, 8]} />
      </mesh>
      <group ref={elRef} position={[0, -0.27, 0]}>
        <mesh position={[0, -0.11, 0]} castShadow material={longSleeves ? mats.top : mats.skin}>
          <capsuleGeometry args={[longSleeves ? 0.047 : 0.042, 0.16, 4, 8]} />
        </mesh>
        <group position={[0, -0.25, 0]}>
          <mesh material={mats.skin} scale={[0.9, 1.1, 0.75]}>
            <sphereGeometry args={[0.05, 10, 8]} />
          </mesh>
          <HandProp prop={heldProp} side={side === 1 ? "r" : "l"} />
        </group>
      </group>
    </group>
  );

  const mouth =
    mood === "happy" ? (
      <mesh position={[0, -0.075, 0.172]} rotation={[0.25, 0, Math.PI]} material={mats.mouth}>
        <torusGeometry args={[0.045, 0.01, 6, 14, Math.PI]} />
      </mesh>
    ) : mood === "sad" ? (
      <mesh position={[0, -0.105, 0.17]} rotation={[0.25, 0, 0]} material={mats.mouth}>
        <torusGeometry args={[0.035, 0.009, 6, 14, Math.PI]} />
      </mesh>
    ) : (
      <mesh position={[0, -0.085, 0.176]} rotation={[0.2, 0, 0]} material={mats.mouth}>
        <boxGeometry args={[0.06, 0.012, 0.01]} />
      </mesh>
    );

  return (
    <group {...props}>
      <group ref={R.root}>
        <group ref={R.hips} position={[0, 0.92, 0]}>
          {/* pelvis */}
          <mesh position={[0, 0.0, 0]} castShadow material={bottomStyle === 2 ? mats.bottom : mats.bottom} scale={[1, 1, 0.72]}>
            <sphereGeometry args={[hip + 0.02, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          </mesh>
          {bottomStyle === 2 && (
            <mesh position={[0, -0.12, 0]} castShadow material={mats.bottom}>
              <cylinderGeometry args={[hip + 0.02, hip + 0.1, 0.3, 18, 1, true]} />
            </mesh>
          )}
          {leg(-1, R.lLeg, R.lKnee)}
          {leg(1, R.rLeg, R.rKnee)}
          <group ref={R.spine} position={[0, 0.04, 0]}>
            <mesh geometry={torso} castShadow material={mats.top} scale={[1, 1, 0.68]} />
            {topStyle === 1 && (
              <>
                <mesh position={[0, 0.44, -0.12]} material={mats.topDark} scale={[1, 0.8, 0.8]}>
                  <sphereGeometry args={[0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                </mesh>
                <mesh position={[0, 0.12, 0.105]} material={mats.topDark}>
                  <boxGeometry args={[0.18, 0.1, 0.02]} />
                </mesh>
              </>
            )}
            {topStyle === 2 && (
              <mesh position={[0, 0.49, 0.03]} rotation={[0.3, 0, 0]} material={mats.eyeWhite}>
                <torusGeometry args={[0.075, 0.018, 6, 16]} />
              </mesh>
            )}
            {topStyle === 3 && (
              <>
                {[-1, 1].map((sx) => (
                  <mesh key={sx} position={[sx * 0.07, 0.24, 0.1]} rotation={[0.05, 0, sx * 0.06]} material={mats.topDark}>
                    <boxGeometry args={[0.1, 0.42, 0.02]} />
                  </mesh>
                ))}
              </>
            )}
            {topStyle === 4 && (
              <mesh position={[0, 0.02, 0]} material={mats.topDark} scale={[1, 1, 0.72]}>
                <cylinderGeometry args={[hip + 0.012, hip + 0.012, 0.05, 18]} />
              </mesh>
            )}
            {outfit?.scarf && (
              <mesh position={[0, 0.5, 0.01]} rotation={[0.25, 0, 0]} material={mats.hat}>
                <torusGeometry args={[0.085, 0.035, 8, 18]} />
              </mesh>
            )}
            {arm(-1, R.lSh, R.lEl)}
            {arm(1, R.rSh, R.rEl)}
            <BodyProp prop={heldProp} />
            {/* neck + head */}
            <mesh position={[0, 0.55, 0]} material={mats.skinShade}>
              <cylinderGeometry args={[0.055, 0.065, 0.1, 10]} />
            </mesh>
            <group ref={R.head} position={[0, 0.74, 0]}>
              <mesh castShadow material={mats.skin} scale={[1, 1.06, 0.98]}>
                <sphereGeometry args={[0.19, 28, 20]} />
              </mesh>
              {[-1, 1].map((sx) => (
                <mesh key={sx} position={[sx * 0.185, -0.005, -0.005]} material={mats.skinShade} scale={[0.5, 1, 0.8]}>
                  <sphereGeometry args={[0.04, 10, 8]} />
                </mesh>
              ))}
              <mesh position={[0, -0.02, 0.188]} material={mats.skinShade}>
                <sphereGeometry args={[0.024, 10, 8]} />
              </mesh>
              <group ref={R.eyes} position={[0, 0.025, 0]}>
                {[-0.068, 0.068].map((x) => (
                  <group key={x} position={[x, 0, 0.163]}>
                    <mesh material={mats.eyeWhite} scale={[1, 1.15, 0.6]}>
                      <sphereGeometry args={[0.032, 12, 10]} />
                    </mesh>
                    <mesh position={[0, -0.002, 0.016]} material={mats.eye}>
                      <sphereGeometry args={[0.02, 10, 8]} />
                    </mesh>
                  </group>
                ))}
              </group>
              {[-0.068, 0.068].map((x) => (
                <mesh key={x} position={[x, 0.085, 0.172]} rotation={[0, 0, (mood === "sad" ? 0.25 : mood === "happy" ? -0.08 : 0) * Math.sign(x)]} material={mats.hair}>
                  <boxGeometry args={[0.06, 0.013, 0.012]} />
                </mesh>
              ))}
              {mouth}
              {outfit?.glasses && (
                <group position={[0, 0.025, 0.19]}>
                  {[-0.068, 0.068].map((x) => (
                    <mesh key={x} position={[x, 0, 0]}>
                      <torusGeometry args={[0.04, 0.007, 6, 16]} />
                      <meshStandardMaterial color="#17232b" />
                    </mesh>
                  ))}
                  <mesh>
                    <boxGeometry args={[0.06, 0.008, 0.008]} />
                    <meshStandardMaterial color="#17232b" />
                  </mesh>
                </group>
              )}
              {outfit?.hat ? <Hat kind={outfit.hat} mat={mats.hat} /> : <Hair style={appearance.hairStyle} mat={mats.hair} />}
            </group>
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}

/** Darkens a hex colour by a factor (0–1). */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, "0")}`;
}
