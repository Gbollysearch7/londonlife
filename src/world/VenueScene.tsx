"use client";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { TextLabel } from "./TextLabel";
import { activityDef } from "@/content/world";
import type { Appearance } from "@/content/character";
import type { State } from "@/client/api";
import Avatar, { type Pose } from "./Avatar";
import type { Lighting } from "./lighting";

const NIA: Appearance = { body: 1, skin: 4, hairStyle: 3, hairColour: 0, top: 4, bottom: 0, shoes: 1 };
const BEV: Appearance = { body: 1, skin: 1, hairStyle: 4, hairColour: 5, top: 1, bottom: 3, shoes: 2 };

function B({ p, s, c, r = 0.85 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} />
    </mesh>
  );
}

function NpcLabel({ name }: { name: string }) {
  return <TextLabel text={name} sub="· NPC" position={[0, 2.2, 0]} height={0.36} />;
}

function BrickWall({ w, h, p, rotY = 0 }: { w: number; h: number; p: [number, number, number]; rotY?: number }) {
  const rows = Math.floor(h / 0.3);
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <B p={[0, h / 2, 0]} s={[w, h, 0.2]} c="#8e4e3e" />
      {Array.from({ length: rows }, (_, i) => (
        <mesh key={i} position={[0, i * 0.3 + 0.15, 0.105]}>
          <planeGeometry args={[w, 0.02]} />
          <meshStandardMaterial color="#c9b8a8" />
        </mesh>
      ))}
    </group>
  );
}

function Floor({ w, d, c1, c2 }: { w: number; d: number; c1: string; c2: string }) {
  return (
    <group>
      {Array.from({ length: w }, (_, x) =>
        Array.from({ length: d }, (_, z) => (
          <mesh key={`${x}-${z}`} position={[x - w / 2 + 0.5, -0.01, z - d / 2 + 0.5]} receiveShadow>
            <boxGeometry args={[1, 0.02, 1]} />
            <meshStandardMaterial color={(x + z) % 2 ? c1 : c2} roughness={0.7} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Pendant({ p, on }: { p: [number, number, number]; on: boolean }) {
  return (
    <group position={p}>
      <B p={[0, 0.4, 0]} s={[0.02, 0.8, 0.02]} c="#17232b" />
      <mesh>
        <coneGeometry args={[0.22, 0.22, 18, 1, true]} />
        <meshStandardMaterial color="#234C42" side={2} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#fff2cf" emissive="#ffd890" emissiveIntensity={1.4} />
      </mesh>
      {on && <pointLight position={[0, -0.2, 0]} intensity={1.6} distance={5} color="#ffd9a0" />}
    </group>
  );
}

function FoodHall({ light }: { light: Lighting }) {
  return (
    <group>
      <Floor w={12} d={9} c1="#d8cfc1" c2="#bfb3a3" />
      <BrickWall w={12} h={3.4} p={[0, 0, -4.6]} />
      <BrickWall w={9.2} h={3.4} p={[-6.1, 0, 0]} rotY={Math.PI / 2} />
      {/* open kitchen */}
      <B p={[0, 0.5, -3.2]} s={[7, 1, 0.8]} c="#234C42" />
      <B p={[0, 1.03, -3.2]} s={[7.1, 0.06, 0.9]} c="#d9d4c8" r={0.4} />
      <B p={[0, 1.2, -4.2]} s={[6, 0.4, 0.5]} c="#3a3a3a" />
      {[-2, -0.6, 0.8, 2.2].map((x, i) => (
        <mesh key={x} position={[x, 1.55, -4.2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
          <meshStandardMaterial color={i % 2 ? "#a9b0b5" : "#46505b"} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <B p={[0, 2.6, -4.48]} s={[3.2, 0.9, 0.04]} c="#17232b" />
      <TextLabel text="Common Table" colour="#f4eee4" background={null} font="700 72px Georgia, serif" billboard={false} position={[0, 2.75, -4.45]} height={0.42} />
      <TextLabel text="Plate of the day £5 · Curry bowl £7" colour="#f4eee4" background={null} font="500 48px system-ui, sans-serif" billboard={false} position={[0, 2.4, -4.45]} height={0.2} />
      {/* shared tables */}
      {[-2.5, 0.5, 3.5].map((x) => (
        <group key={x} position={[x, 0, 1]}>
          <B p={[0, 0.74, 0]} s={[1.1, 0.06, 2.6]} c="#b98b5e" />
          {[-1.1, 1.1].map((z) => (
            <B key={z} p={[0, 0.37, z]} s={[0.9, 0.74, 0.08]} c="#5a3f2a" />
          ))}
          {[-0.85, 0.85].map((bx) => (
            <B key={bx} p={[bx, 0.42, 0]} s={[0.35, 0.06, 2.4]} c="#7a5134" />
          ))}
          <mesh position={[0.2, 0.82, -0.5]}>
            <cylinderGeometry args={[0.16, 0.12, 0.06, 16]} />
            <meshStandardMaterial color="#f2f0ea" />
          </mesh>
        </group>
      ))}
      {/* grocery shelves */}
      <group position={[5.2, 0, -1.5]}>
        <B p={[0, 1, 0]} s={[0.6, 2, 2.6]} c="#7a5134" />
        {[0.45, 1.05, 1.65].map((y, r) =>
          Array.from({ length: 5 }, (_, i) => (
            <B key={`${r}${i}`} p={[-0.1, y, -1 + i * 0.5]} s={[0.4, 0.25, 0.35]} c={["#BC3D3B", "#C69C58", "#3e7a4f", "#e9e2d3", "#d58a3a"][(i + r) % 5]} />
          )),
        )}
      </group>
      {[-3, 0, 3].map((x) => (
        <Pendant key={x} p={[x, 2.6, 1]} on={light.night || light.sunIntensity < 1.5} />
      ))}
      <Avatar appearance={NIA} pose="work" position={[0.8, 0, -3.9]}>
        <NpcLabel name="Nia" />
      </Avatar>
    </group>
  );
}

function CommonRoom({ light }: { light: Lighting }) {
  return (
    <group>
      <Floor w={11} d={9} c1="#c9b79a" c2="#bca98b" />
      <B p={[0, 1.7, -4.6]} s={[11, 3.4, 0.2]} c="#e8dcc6" />
      <B p={[-5.6, 1.7, 0]} s={[0.2, 3.4, 9.2]} c="#dccdb3" />
      {/* bunting */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-4.4 + i * 0.8, 3.0 - Math.sin((i / 11) * Math.PI) * 0.25, -4.45]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.16, 0.3, 3]} />
          <meshStandardMaterial color={["#BC3D3B", "#C69C58", "#234C42", "#2F4A6B"][i % 4]} />
        </mesh>
      ))}
      {/* noticeboard */}
      <group position={[-1.5, 1.6, -4.45]}>
        <B p={[0, 0, 0]} s={[2.4, 1.4, 0.06]} c="#b88a5c" />
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-0.9 + (i % 4) * 0.6, 0.35 - Math.floor(i / 4) * 0.42, 0.04]} rotation={[0, 0, ((i * 37) % 11) / 60 - 0.08]}>
            <planeGeometry args={[0.42, 0.32]} />
            <meshStandardMaterial color={["#fbf8f2", "#f1e3c4", "#dcebe3", "#f5dcd8"][i % 4]} />
          </mesh>
        ))}
      </group>
      {/* kitchen hatch */}
      <group position={[3.2, 0, -3.9]}>
        <B p={[0, 0.5, 0]} s={[3, 1, 0.7]} c="#2F4A6B" />
        <B p={[0, 1.03, 0]} s={[3.1, 0.06, 0.8]} c="#e2ddd2" r={0.4} />
        <mesh position={[0.6, 1.2, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 18]} />
          <meshStandardMaterial color="#a9b0b5" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      {/* old sofa */}
      <group position={[-4.4, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
        <B p={[0, 0.25, 0]} s={[2.2, 0.3, 0.85]} c="#7a6a5a" />
        <B p={[0, 0.6, -0.35]} s={[2.2, 0.55, 0.2]} c="#6c5d4f" />
      </group>
      {/* computers */}
      <group position={[2.6, 0, 1.4]}>
        <B p={[0, 0.74, 0]} s={[2.6, 0.06, 0.9]} c="#d9c3a0" />
        {[-0.8, 0.8].map((x) => (
          <group key={x}>
            <B p={[x, 0.37, 0]} s={[0.05, 0.74, 0.8]} c="#7a5134" />
            <B p={[x * 0.6, 1.05, -0.2]} s={[0.55, 0.38, 0.04]} c="#17232b" />
          </group>
        ))}
      </group>
      {/* games table */}
      <group position={[-1.2, 0, 1.6]}>
        <mesh position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 0.06, 28]} />
          <meshStandardMaterial color="#b98b5e" />
        </mesh>
        <B p={[0, 0.36, 0]} s={[0.12, 0.72, 0.12]} c="#5a3f2a" />
        <B p={[0, 0.77, 0]} s={[0.5, 0.03, 0.5]} c="#f2f0ea" />
      </group>
      <Pendant p={[0, 2.8, 0]} on={light.night || light.sunIntensity < 1.5} />
      <Pendant p={[3, 2.8, 0]} on={light.night || light.sunIntensity < 1.5} />
      <Avatar appearance={BEV} pose="idle" position={[-0.2, 0, -3.6]} rotation={[0, 0.4, 0]}>
        <NpcLabel name="Bev" />
      </Avatar>
    </group>
  );
}

const PRIYA: Appearance = { body: 1, skin: 3, hairStyle: 4, hairColour: 0, top: 2, bottom: 0, shoes: 1 };
const COLLEAGUES: Appearance[] = [
  { body: 0, skin: 1, hairStyle: 0, hairColour: 1, top: 5, bottom: 1, shoes: 1 },
  { body: 1, skin: 5, hairStyle: 2, hairColour: 0, top: 3, bottom: 0, shoes: 0 },
];

function Desk({ p, rot = 0 }: { p: [number, number, number]; rot?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.74, 0]} s={[1.6, 0.05, 0.8]} c="#e9e4da" r={0.5} />
      {[-0.72, 0.72].map((x) => (
        <B key={x} p={[x, 0.37, 0]} s={[0.05, 0.74, 0.7]} c="#46505b" />
      ))}
      <B p={[0, 1.02, -0.25]} s={[0.6, 0.36, 0.04]} c="#17232b" r={0.3} />
      <mesh position={[0, 1.02, -0.227]}>
        <planeGeometry args={[0.54, 0.3]} />
        <meshStandardMaterial color="#2b4f66" emissive="#3a6a8a" emissiveIntensity={0.5} />
      </mesh>
      <B p={[0, 0.8, -0.25]} s={[0.06, 0.12, 0.06]} c="#46505b" />
      <B p={[0, 0.45, 0.55]} s={[0.5, 0.06, 0.5]} c="#234C42" />
      <B p={[0, 0.72, 0.78]} s={[0.5, 0.5, 0.06]} c="#234C42" />
    </group>
  );
}

function CityOffice({ light }: { light: Lighting }) {
  return (
    <group>
      <Floor w={12} d={9} c1="#cfd3d6" c2="#c3c8cc" />
      {/* window wall with distant towers */}
      <group position={[0, 0, -4.6]}>
        <mesh position={[0, 1.7, 0]}>
          <planeGeometry args={[12, 3.4]} />
          <meshStandardMaterial color={light.window} emissive={light.window} emissiveIntensity={light.night ? 0.15 : 0.45} />
        </mesh>
        {[-4.5, -2.6, -0.4, 1.8, 3.9].map((x, i) => (
          <mesh key={x} position={[x, 0.9 + (i % 3) * 0.35, 0.02]}>
            <planeGeometry args={[1.1, 1.8 + (i % 3) * 0.7]} />
            <meshBasicMaterial color={light.night ? "#162033" : "#9aa8b8"} />
          </mesh>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <B key={i} p={[-6 + i * 2, 1.7, 0.05]} s={[0.08, 3.4, 0.1]} c="#2b2f36" />
        ))}
      </group>
      <B p={[-6.1, 1.7, 0]} s={[0.2, 3.4, 9.2]} c="#e6e8ea" />
      {/* reception */}
      <group position={[-4.2, 0, 2.6]}>
        <B p={[0, 0.55, 0]} s={[1.8, 1.1, 0.7]} c="#2F4A6B" />
        <B p={[0, 1.13, 0]} s={[1.9, 0.06, 0.8]} c="#e9e4da" r={0.4} />
      </group>
      {/* desks */}
      {[-2, 0.4, 2.8].flatMap((x) => [-2.2, -0.2].map((z) => <Desk key={`${x}${z}`} p={[x, 0, z]} />))}
      {/* meeting pod */}
      <group position={[4.8, 0, 2.2]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[2, 2.4, 2]} />
          <meshStandardMaterial color="#cfe3ea" transparent opacity={0.22} roughness={0.05} />
        </mesh>
        <B p={[0, 0.72, 0]} s={[1.1, 0.05, 0.7]} c="#b98b5e" />
      </group>
      {/* break kitchen */}
      <group position={[4.6, 0, -2.9]}>
        <B p={[0, 0.5, 0]} s={[2.2, 1, 0.7]} c="#f2f0ea" />
        <B p={[0, 1.03, 0]} s={[2.3, 0.06, 0.8]} c="#3a3a3a" r={0.4} />
        <B p={[0.6, 1.25, -0.1]} s={[0.3, 0.4, 0.3]} c="#1a1a1a" />
      </group>
      {[-2, 0.4, 2.8].map((x) => (
        <Pendant key={x} p={[x, 2.8, -1.2]} on={light.night || light.sunIntensity < 1.5} />
      ))}
      <Avatar appearance={PRIYA} pose="idle" position={[-4.2, 0, 1.9]} rotation={[0, 0.3, 0]}>
        <NpcLabel name="Priya" />
      </Avatar>
      <Avatar appearance={COLLEAGUES[0]} pose="sit" position={[-2, 0, -1.65]} rotation={[0, Math.PI, 0]} />
      <Avatar appearance={COLLEAGUES[1]} pose="sit" position={[2.8, 0, 0.35]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

const ANCHORS: Record<string, { pos: [number, number, number]; rotY: number; pose: Pose }> = {
  "food_hall:table": { pos: [-1.65, 0, 1], rotY: -Math.PI / 2, pose: "sit" },
  "food_hall:counter": { pos: [0.8, 0, -2.3], rotY: Math.PI, pose: "work" },
  "common_room:kitchen": { pos: [3.2, 0, -3.0], rotY: Math.PI, pose: "work" },
  "common_room:board": { pos: [-1.3, 0, -3.3], rotY: Math.PI, pose: "idle" },
  "common_room:computers": { pos: [2.1, 0, 2.15], rotY: Math.PI, pose: "work" },
  "common_room:rest_sofa": { pos: [-4.35, 0, 0.5], rotY: Math.PI / 2, pose: "sit" },
  "city_office:kitchen": { pos: [4.6, 0, -2.2], rotY: Math.PI, pose: "work" },
  "city_office:reception": { pos: [-4.2, 0, 3.5], rotY: Math.PI, pose: "idle" },
  "food_hall:work": { pos: [-0.8, 0, -3.9], rotY: 0, pose: "work" },
  "common_room:work": { pos: [3.2, 0, -3.0], rotY: Math.PI, pose: "work" },
  "city_office:work": { pos: [0.4, 0, -1.65], rotY: Math.PI, pose: "sit" },
};

export default function VenueScene({ state, light }: { state: State; light: Lighting }) {
  const loc = state.character.location;
  const act = state.activity ? activityDef(state.activity.defId) : null;
  const key = state.shift ? `${loc}:work` : act ? `${loc}:${act.id === "rest_sofa" ? "rest_sofa" : act.anchor ?? ""}` : "";
  const hidden = act?.event === "toilet" || act?.id === "public_shower";
  const spot = ANCHORS[key] ?? { pos: [0.5, 0, 3.4] as [number, number, number], rotY: Math.PI * 0.95, pose: act || state.shift ? ("work" as Pose) : ("idle" as Pose) };
  return (
    <>
      <color attach="background" args={[light.sky]} />
      <hemisphereLight args={["#fff4e6", "#6f5f52", light.ambient + 0.15]} />
      <directionalLight position={[6, 10, 7]} intensity={light.sunIntensity * 0.8} color={light.sun} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
      {loc === "food_hall" ? <FoodHall light={light} /> : loc === "city_office" ? <CityOffice light={light} /> : <CommonRoom light={light} />}
      {!hidden && <Avatar appearance={state.character.appearance} pose={spot.pose} position={spot.pos} rotation={[0, spot.rotY + (spot.pose === "idle" && !act ? 0 : 0), 0]} />}
      <ContactShadows position={[0, 0.005, 0]} opacity={0.3} scale={16} blur={2.2} far={3} />
      <OrbitControls target={[0, 0.8, -0.3]} enablePan={false} minDistance={7} maxDistance={22} minPolarAngle={0.6} maxPolarAngle={1.15} minAzimuthAngle={-0.5} maxAzimuthAngle={0.9} enableDamping />
    </>
  );
}
