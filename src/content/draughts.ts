/**
 * DRAUGHTS (spec ch. 22): English draughts on an 8 × 8 board, the second friendly table game.
 * Pure rules shared by the server (authoritative) and the client (display only).
 *
 * The board is a 32-character string, one character per playable dark square, index = row * 4 + k,
 * row 0 nearest seat "a". On row r the dark squares are columns 2k + (r % 2).
 * "." empty, "a"/"b" men, "A"/"B" kings. Seat "a" plays the dark pieces and moves first, up the board.
 *
 * A move is the full path of squares one piece visits: [from, to] for a step, or [from, land1, land2, …]
 * for a capture. Captures are compulsory; a capturing piece must keep jumping while it can, except that
 * a man reaching the far row is crowned and its turn ends there.
 */
import type { Seat, Winner } from "./fourInRow";

export const SIZE = 8;
export const SQUARES = 32;
/** Moves each without a capture or a man moving before the game is drawn (only kings shuffling about). */
export const QUIET_MOVES_EACH = 40;

export const DRAUGHTS = {
  id: "draughts",
  name: "Draughts",
  blurb: "8 × 8 English draughts. Men move diagonally forward, captures are compulsory, reach the far row to crown a king.",
} as const;

/** Practice opponent for draughts. Always shown as a computer-controlled character, never as a real player. */
export const DRAUGHTS_NPC = { name: "Sam", label: "Sam (NPC practice partner)" };

export type DraughtsMove = number[];

const other = (s: Seat): Seat => (s === "a" ? "b" : "a");

export const rowOf = (i: number) => Math.floor(i / 4);
export const colOf = (i: number) => 2 * (i % 4) + (rowOf(i) % 2);
/** Square index of (row, col), or -1 when off the board or a light square. */
export function sq(row: number, col: number): number {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || (row + col) % 2 !== 0) return -1;
  return row * 4 + (col - (row % 2)) / 2;
}

/** Twelve men each on the three rows nearest their owner. */
export const draughtsStart = () => "a".repeat(12) + ".".repeat(8) + "b".repeat(12);

export const ownerOf = (ch: string): Seat | null => (ch === "a" || ch === "A" ? "a" : ch === "b" || ch === "B" ? "b" : null);
export const isKing = (ch: string) => ch === "A" || ch === "B";
const crownRow = (s: Seat) => (s === "a" ? SIZE - 1 : 0);

function dirs(ch: string): [number, number][] {
  const fwd = ownerOf(ch) === "a" ? 1 : -1;
  const f: [number, number][] = [
    [fwd, -1],
    [fwd, 1],
  ];
  return isKing(ch) ? [...f, [-fwd, -1], [-fwd, 1]] : f;
}

const setAt = (b: string, i: number, ch: string) => b.slice(0, i) + ch + b.slice(i + 1);

/** All complete capture sequences for the piece on `from`. */
function capturesFrom(board: string, from: number): DraughtsMove[] {
  const out: DraughtsMove[] = [];
  const seat = ownerOf(board[from]);
  if (!seat) return out;
  const walk = (b: string, at: number, path: number[]) => {
    const ch = b[at];
    let extended = false;
    // A man that has just been crowned stops: the move ends on the far row.
    const crownedNow = path.length > 1 && !isKing(board[from]) && rowOf(at) === crownRow(seat);
    if (!crownedNow) {
      for (const [dr, dc] of dirs(ch)) {
        const r = rowOf(at);
        const c = colOf(at);
        const mid = sq(r + dr, c + dc);
        const land = sq(r + 2 * dr, c + 2 * dc);
        if (mid < 0 || land < 0) continue;
        if (ownerOf(b[mid]) !== other(seat) || b[land] !== ".") continue;
        extended = true;
        const nb = setAt(setAt(setAt(b, at, "."), mid, "."), land, ch);
        walk(nb, land, [...path, land]);
      }
    }
    if (!extended && path.length > 1) out.push(path);
  };
  walk(board, from, [from]);
  return out;
}

/** Every legal move for `seat`. Captures, when any exist, are the only legal moves. */
export function legalMoves(board: string, seat: Seat): DraughtsMove[] {
  const caps: DraughtsMove[] = [];
  const steps: DraughtsMove[] = [];
  for (let i = 0; i < SQUARES; i++) {
    if (ownerOf(board[i]) !== seat) continue;
    caps.push(...capturesFrom(board, i));
    for (const [dr, dc] of dirs(board[i])) {
      const to = sq(rowOf(i) + dr, colOf(i) + dc);
      if (to >= 0 && board[to] === ".") steps.push([i, to]);
    }
  }
  return caps.length ? caps : steps;
}

export const isCapture = (path: DraughtsMove) => Math.abs(rowOf(path[0]) - rowOf(path[1])) === 2;
const samePath = (a: DraughtsMove, b: DraughtsMove) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Validates a client-supplied path into a move, or null. */
export function parsePath(raw: unknown): DraughtsMove | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 13) return null;
  if (!raw.every((x) => Number.isInteger(x) && x >= 0 && x < SQUARES)) return null;
  return raw as number[];
}

export interface DraughtsResult {
  board: string;
  captured: number[];
  crowned: boolean;
  /** True when a man moved or anything was captured: resets the quiet-move count. */
  progress: boolean;
}

/** Plays `path` for `seat` if it is one of the legal moves; null otherwise. */
export function playDraughts(board: string, seat: Seat, path: DraughtsMove): DraughtsResult | null {
  if (board.length !== SQUARES) return null;
  if (!legalMoves(board, seat).some((m) => samePath(m, path))) return null;
  let b = board;
  const piece = board[path[0]];
  const captured: number[] = [];
  for (let k = 1; k < path.length; k++) {
    const from = path[k - 1];
    const to = path[k];
    if (Math.abs(rowOf(from) - rowOf(to)) === 2) {
      const mid = sq((rowOf(from) + rowOf(to)) / 2, (colOf(from) + colOf(to)) / 2);
      captured.push(mid);
      b = setAt(b, mid, ".");
    }
  }
  const end = path[path.length - 1];
  const crowned = !isKing(piece) && rowOf(end) === crownRow(seat);
  b = setAt(setAt(b, path[0], "."), end, crowned ? piece.toUpperCase() : piece);
  return { board: b, captured, crowned, progress: !isKing(piece) || captured.length > 0 };
}

/** Why a submitted path was refused, in words a player understands. */
export function illegalReason(board: string, seat: Seat, path: DraughtsMove | null): string {
  const legal = legalMoves(board, seat);
  if (path && legal.length && isCapture(legal[0])) {
    const partial = legal.some((m) => m.length > path.length && path.every((x, i) => x === m[i]));
    if (partial) return "Keep jumping — the capture must continue while it can.";
    return "You must take: a capture is available.";
  }
  return "That move isn't legal.";
}

/**
 * Terminal outcome once `toMove` is due to play. A player with no legal move (no pieces, or all blocked) loses.
 * `quiet` is the number of consecutive moves (both sides) with no capture and no man moving.
 */
export function draughtsOutcome(board: string, toMove: Seat, quiet: number): { winner: Winner; reason: "no_moves" | "forty_moves" } | null {
  if (!legalMoves(board, toMove).length) return { winner: other(toMove), reason: "no_moves" };
  if (quiet >= QUIET_MOVES_EACH * 2) return { winner: "draw", reason: "forty_moves" };
  return null;
}

/** The move played for someone who runs out of time: the first legal move (a capture when one is due). */
export function draughtsAutoMove(board: string, seat: Seat): DraughtsMove | null {
  return legalMoves(board, seat)[0] ?? null;
}

const count = (b: string, s: Seat) => [...b].reduce((n, ch) => n + (ownerOf(ch) === s ? (isKing(ch) ? 3 : 2) : 0), 0);

/**
 * Deterministic, deliberately simple practice opponent. Looks one reply ahead:
 * prefers moves that win material, crown a king and don't hand back a capture; then advances men.
 */
export function draughtsAiMove(board: string, me: Seat): DraughtsMove | null {
  const moves = legalMoves(board, me);
  if (!moves.length) return null;
  let best: DraughtsMove = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const r = playDraughts(board, me, m)!;
    const replies = legalMoves(r.board, other(me));
    // Worst material swing the opponent can answer with.
    let worst = 0;
    for (const reply of replies) {
      if (!isCapture(reply)) break;
      const rr = playDraughts(r.board, other(me), reply)!;
      worst = Math.max(worst, count(r.board, me) - count(rr.board, me));
    }
    const end = m[m.length - 1];
    const advance = isKing(board[m[0]]) ? 0 : me === "a" ? rowOf(end) : SIZE - 1 - rowOf(end);
    const edge = colOf(end) === 0 || colOf(end) === SIZE - 1 ? 0.3 : 0;
    const score = (count(board, other(me)) - count(r.board, other(me))) * 10 + (r.crowned ? 12 : 0) - worst * 9 + advance * 0.5 + edge;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** Consecutive quiet moves at the end of a move list (entries carry `progress`). */
export function quietRun(moves: { progress?: boolean }[]): number {
  let n = 0;
  for (let i = moves.length - 1; i >= 0 && moves[i].progress === false; i--) n++;
  return n;
}
