/**
 * Table game registry (spec ch. 22): the rules each friendly table game plugs into the shared
 * table/session framework in src/server/tables.ts. Pure functions only, shared by server and client.
 *
 * A game supplies its starting board, how to read a move from a command payload, how to play a move
 * (returning null when illegal), when the game is over, the move made for a player who runs out of time
 * and the clearly labelled practice opponent's choice. Each played move is stored as `{ seat, ...record }`.
 */
import {
  FOUR_IN_ROW,
  MISSES_TO_FORFEIT,
  TURN_SECONDS,
  aiMove,
  autoMove,
  drop,
  emptyBoard,
  landingRow,
  outcome,
  type Seat,
  type Winner,
} from "./fourInRow";
import {
  DRAUGHTS,
  QUIET_MOVES_EACH,
  draughtsAiMove,
  draughtsAutoMove,
  draughtsOutcome,
  draughtsStart,
  illegalReason,
  legalMoves,
  parsePath,
  playDraughts,
  quietRun,
} from "./draughts";

export type MoveRecord = { seat: Seat; auto?: boolean } & Record<string, unknown>;

export interface TableGameEnd {
  winner: Winner;
  /** Stored as the table's end reason, e.g. "four", "draw", "no_moves", "forty_moves". */
  reason: string;
  line: number[] | null;
}

export interface TableGame<M = unknown> {
  id: string;
  name: string;
  blurb: string;
  rules: readonly string[];
  emptyBoard(): string;
  /** Reads the move from a GameMove payload; null when it is malformed. */
  parseMove(p: Record<string, unknown>): M | null;
  /** Plays a move; null when it is illegal. `record` is what gets stored in the move list (besides seat/auto). */
  play(board: string, seat: Seat, move: M): { board: string; record: Record<string, unknown> } | null;
  /** Outcome once `toMove` is due to play, given the move list including the move just played. */
  end(board: string, toMove: Seat, moves: MoveRecord[]): TableGameEnd | null;
  autoMove(board: string, seat: Seat): M | null;
  aiMove(board: string, seat: Seat): M | null;
  /** Player-facing reason a move was refused. */
  illegalText(board: string, seat: Seat, move: M | null): string;
  /** How the win came about, for result lists ("four in a row", "no moves left"…). */
  reasonLabel: Record<string, string>;
}

const fourInRow: TableGame<number> = {
  id: FOUR_IN_ROW.id,
  name: FOUR_IN_ROW.name,
  blurb: "Drop counters into a 7 × 6 grid. Line up four across, down or diagonally to win.",
  rules: FOUR_IN_ROW.rules,
  emptyBoard,
  parseMove: (p) => {
    const col = Number(p.column);
    return Number.isInteger(col) ? col : null;
  },
  play: (board, seat, col) => {
    if (landingRow(board, col) < 0) return null;
    const d = drop(board, col, seat);
    return d ? { board: d.board, record: { col } } : null;
  },
  end: (board) => {
    const o = outcome(board);
    return o ? { winner: o.winner, reason: o.winner === "draw" ? "draw" : "four", line: o.line } : null;
  },
  autoMove: (board) => {
    const c = autoMove(board);
    return c >= 0 ? c : null;
  },
  aiMove: (board, seat) => {
    const c = aiMove(board, seat);
    return c >= 0 ? c : null;
  },
  illegalText: () => "That column is full or doesn't exist.",
  reasonLabel: { four: "four in a row", draw: "full board", timeout: "missed turns", resigned: "resignation" },
};

const draughts: TableGame<number[]> = {
  id: DRAUGHTS.id,
  name: DRAUGHTS.name,
  blurb: DRAUGHTS.blurb,
  rules: [
    "Dark moves first (in a rematch, whoever went second last time moves first). Men move one square diagonally forward onto an empty dark square.",
    "Capture by jumping an opponent's piece diagonally onto the empty square beyond. Captures are compulsory, and a piece must keep jumping while it can.",
    "A man reaching the far row is crowned a king and its move ends there. Kings move and capture diagonally forwards and backwards, one square at a time.",
    "You win when your opponent has no legal move: every piece taken or blocked in.",
    `If ${QUIET_MOVES_EACH} moves each pass with no capture and no man moving, the game is drawn.`,
    `Each turn lasts ${TURN_SECONDS} seconds. Miss a turn and the first legal move is played for you (a capture if one is due); miss ${MISSES_TO_FORFEIT} in a row and you forfeit.`,
    "Leaving a game in progress counts as resigning. Friendly games only: nothing is staked.",
  ],
  emptyBoard: draughtsStart,
  parseMove: (p) => parsePath(p.path),
  play: (board, seat, path) => {
    const r = playDraughts(board, seat, path);
    return r ? { board: r.board, record: { path, captured: r.captured, crowned: r.crowned, progress: r.progress } } : null;
  },
  end: (board, toMove, moves) => {
    const o = draughtsOutcome(board, toMove, quietRun(moves as { progress?: boolean }[]));
    return o ? { winner: o.winner, reason: o.reason, line: null } : null;
  },
  autoMove: draughtsAutoMove,
  aiMove: draughtsAiMove,
  illegalText: illegalReason,
  reasonLabel: { no_moves: "no moves left", forty_moves: `${QUIET_MOVES_EACH}-move rule`, timeout: "missed turns", resigned: "resignation" },
};

export const TABLE_GAMES: Record<string, TableGame<any>> = {
  [fourInRow.id]: fourInRow,
  [draughts.id]: draughts,
};

export const TABLE_GAME_LIST = Object.values(TABLE_GAMES);

export const tableGame = (id: string): TableGame<any> | undefined => TABLE_GAMES[id];

/** Legal draughts paths for the seat to move, so the board can highlight them (public: no hidden information). */
export function draughtsHints(board: string, seat: Seat): number[][] {
  return legalMoves(board, seat);
}
