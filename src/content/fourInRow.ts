/**
 * FOUR IN A ROW (spec ch. 22): an original friendly table game, 7 columns × 6 rows with gravity.
 * Pure rules shared by the server (authoritative) and the client (display only).
 * The board is a 42-character string, index = row * 7 + col, row 0 at the bottom; "." empty, "a"/"b" counters.
 */

export const COLS = 7;
export const ROWS = 6;
export type Seat = "a" | "b";
export type Winner = Seat | "draw";

/** Real seconds each player has per turn. Not scaled by any development time scale: people play in real time. */
export const TURN_SECONDS = 60;
/** Missing this many turns in a row forfeits the game (a valid move resets the count). */
export const MISSES_TO_FORFEIT = 2;
/** An open table nobody joins closes after this many real minutes. */
export const OPEN_TABLE_MINUTES = 20;

export const FOUR_IN_ROW = {
  id: "four_in_row",
  name: "Four in a Row",
  rules: [
    "Take turns dropping a counter into one of the seven columns; it falls to the lowest free space.",
    "Line up four of your counters across, down or diagonally to win. A full board with no line is a draw.",
    `Each turn lasts ${TURN_SECONDS} seconds. Miss a turn and a counter is dropped for you in the most central free column; miss ${MISSES_TO_FORFEIT} in a row and you forfeit.`,
    "Leaving a game in progress counts as resigning. Friendly games only: nothing is staked.",
  ],
} as const;

/** Practice opponent. Always shown as a computer-controlled character, never as a real player. */
export const PRACTICE_NPC = { name: "Sam", label: "Sam (NPC practice partner)" };

export const emptyBoard = () => ".".repeat(COLS * ROWS);
export const other = (s: Seat): Seat => (s === "a" ? "b" : "a");

/** Row a counter dropped in `col` lands on, or -1 when the column is full or invalid. */
export function landingRow(board: string, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + col] === ".") return r;
  return -1;
}

export function legalColumns(board: string): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (landingRow(board, c) >= 0) out.push(c);
  return out;
}

/** Drops a counter; null if the move is illegal. */
export function drop(board: string, col: number, seat: Seat): { board: string; index: number } | null {
  const r = landingRow(board, col);
  if (r < 0) return null;
  const index = r * COLS + col;
  return { board: board.slice(0, index) + seat + board.slice(index + 1), index };
}

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

/** The four cell indices of a completed line for `seat`, or null. */
export function winningLine(board: string, seat: Seat): number[] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r * COLS + c] !== seat) continue;
      for (const [dc, dr] of DIRS) {
        const line = [r * COLS + c];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[rr * COLS + cc] !== seat) break;
          line.push(rr * COLS + cc);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

/** Terminal outcome of a position, if any. */
export function outcome(board: string): { winner: Winner; line: number[] | null } | null {
  for (const s of ["a", "b"] as const) {
    const line = winningLine(board, s);
    if (line) return { winner: s, line };
  }
  return legalColumns(board).length === 0 ? { winner: "draw", line: null } : null;
}

/** Columns from the centre outwards: the order used by automatic moves and the practice opponent. */
export const CENTRE_ORDER = [3, 2, 4, 1, 5, 0, 6];

/** The move made for a player who runs out of time: the most central free column. */
export function autoMove(board: string): number {
  return CENTRE_ORDER.find((c) => landingRow(board, c) >= 0) ?? -1;
}

const winsWith = (board: string, col: number, seat: Seat) => {
  const d = drop(board, col, seat);
  return !!d && !!winningLine(d.board, seat);
};

/**
 * Deterministic practice opponent: takes a winning move, otherwise blocks one,
 * otherwise plays the most central column that doesn't hand the opponent a win directly above.
 */
export function aiMove(board: string, me: Seat): number {
  const legal = CENTRE_ORDER.filter((c) => landingRow(board, c) >= 0);
  if (!legal.length) return -1;
  const win = legal.find((c) => winsWith(board, c, me));
  if (win !== undefined) return win;
  const block = legal.find((c) => winsWith(board, c, other(me)));
  if (block !== undefined) return block;
  const safe = legal.find((c) => {
    const d = drop(board, c, me)!;
    return !legalColumns(d.board).some((oc) => winsWith(d.board, oc, other(me)));
  });
  return safe ?? legal[0];
}

/** Rows top-first for display: rows[0] is the top row. */
export function boardRows(board: string): string[][] {
  const rows: string[][] = [];
  for (let r = ROWS - 1; r >= 0; r--) rows.push(board.slice(r * COLS, r * COLS + COLS).split(""));
  return rows;
}
