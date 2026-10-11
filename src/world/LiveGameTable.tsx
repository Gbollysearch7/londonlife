"use client";
/**
 * The live board on a venue's games table (props of type "game_table"). Shows the game in progress at this
 * venue from public state (state.games.here): a draughts board or a Four in a Row frame, or an idle draughts
 * set when nobody is playing. Tapping the table opens the Games app. Display only.
 */
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { COLS, ROWS } from "@/content/fourInRow";
import { colOf, draughtsStart, isKing, ownerOf, rowOf } from "@/content/draughts";
import { TextLabel } from "./TextLabel";
import type { PropSpec } from "./venues/props";

const TOP = 0.745;
const TILE = 0.075;

function DraughtsTop({ board }: { board: string }) {
  return (
    <group position={[0, TOP, 0]}>
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[TILE * 8 + 0.05, 0.012, TILE * 8 + 0.05]} />
        <meshStandardMaterial color="#5a3a26" roughness={0.7} />
      </mesh>
      {Array.from({ length: 64 }, (_, k) => {
        const r = Math.floor(k / 8);
        const c = k % 8;
        return (
          <mesh key={k} position={[(r - 3.5) * TILE, 0.0125, (c - 3.5) * TILE]}>
            <boxGeometry args={[TILE, 0.002, TILE]} />
            <meshStandardMaterial color={(r + c) % 2 === 0 ? "#6f8f6a" : "#ead9bd"} roughness={0.8} />
          </mesh>
        );
      })}
      {[...board].map((ch, i) => {
        const who = ownerOf(ch);
        if (!who) return null;
        // Dark (seat a) sits at -x, light at +x: each player on their stool.
        const x = (rowOf(i) - 3.5) * TILE;
        const z = (colOf(i) - 3.5) * TILE;
        const colour = who === "a" ? "#23272e" : "#efe3cb";
        return (
          <group key={i} position={[x, 0.02, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[TILE * 0.38, TILE * 0.38, 0.014, 14]} />
              <meshStandardMaterial color={colour} roughness={0.45} />
            </mesh>
            {isKing(ch) && (
              <mesh position={[0, 0.014, 0]} castShadow>
                <cylinderGeometry args={[TILE * 0.32, TILE * 0.32, 0.014, 14]} />
                <meshStandardMaterial color={colour} roughness={0.45} emissive="#e2b04a" emissiveIntensity={0.25} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function FourTop({ board }: { board: string }) {
  const cell = 0.07;
  return (
    <group position={[0, TOP, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, (ROWS * cell) / 2 + 0.03, 0]} castShadow>
        <boxGeometry args={[COLS * cell + 0.04, ROWS * cell + 0.04, 0.03]} />
        <meshStandardMaterial color="#1f3f6b" roughness={0.5} />
      </mesh>
      {[...board].map((ch, i) => {
        if (ch === ".") return null;
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        return (
          <mesh key={i} position={[(c - (COLS - 1) / 2) * cell, 0.03 + (r + 0.5) * cell, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cell * 0.4, cell * 0.4, 0.034, 14]} />
            <meshStandardMaterial color={ch === "a" ? "#c8463f" : "#e2b04a"} roughness={0.4} />
          </mesh>
        );
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (COLS * cell * 0.5 + 0.03), 0.01, 0]}>
          <boxGeometry args={[0.04, 0.02, 0.16]} />
          <meshStandardMaterial color="#1f3f6b" />
        </mesh>
      ))}
    </group>
  );
}

export function LiveGameTables({ props, state }: { props: PropSpec[]; state: State }) {
  const tables = props.filter((p) => p.t === "game_table");
  const setSheet = useGame((x) => x.setSheet);
  const setPhoneApp = useGame((x) => x.setPhoneApp);
  const [hover, setHover] = useState(false);
  if (!tables.length) return null;
  const live = state.games?.here ?? null;
  const open = () => {
    setPhoneApp("games");
    setSheet("phone");
  };
  return (
    <>
      {tables.map((p, k) => (
        <group key={k} position={[p.p[0], p.lift ?? 0, p.p[1]]} rotation={[0, ((p.r ?? 0) * Math.PI) / 180, 0]}>
          {live?.game === "four_in_row" ? <FourTop board={live.board} /> : <DraughtsTop board={live?.game === "draughts" ? live.board : draughtsStart()} />}
          {/* Invisible tap target over the table and stools. */}
          <mesh
            position={[0, 0.6, 0]}
            onClick={(e) => {
              if (e.delta > 6) return;
              e.stopPropagation();
              open();
            }}
            onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
            onPointerOut={() => setHover(false)}
          >
            <boxGeometry args={[1.8, 1.2, 1.1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <group rotation={[0, -((p.r ?? 0) * Math.PI) / 180, 0]}>
            <TextLabel
              text={live ? `Live: ${live.gameName}` : "Games table"}
              sub={live ? `${live.players[0]} v ${live.players[1]}` : "· tap to play"}
              position={[0, 1.55, 0]}
              height={hover ? 0.3 : 0.24}
            />
          </group>
        </group>
      ))}
    </>
  );
}
