"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { isKing, ownerOf, sq } from "@/content/draughts";
import type { TableView } from "@/server/tables";
import d from "./draughts.module.css";

/**
 * Draughts board for the table overlay. Display only: the server checks every move.
 * Tap one of your pieces (outlined when it can move), then tap where it lands — for a multi-jump,
 * tap each landing square in turn. Keyboard: arrows move the cursor, Enter or Space picks, Escape clears.
 * Your own pieces are always at the bottom; spectators see dark at the bottom.
 */
export function DraughtsBoard({ t, busy, onMove, onClose }: { t: TableView; busy: boolean; onMove: (path: number[]) => Promise<void>; onClose: () => void }) {
  const [path, setPath] = useState<number[]>([]);
  const [cursor, setCursor] = useState<[number, number]>([2, 2]);
  const ref = useRef<HTMLDivElement>(null);
  const flip = t.yourSeat === "b";
  const hints = useMemo(() => (t.yourTurn && t.hints ? t.hints : []), [t.yourTurn, t.hints]);
  // Clear a half-entered move whenever the position changes.
  useEffect(() => setPath([]), [t.version]);
  useEffect(() => {
    if (t.yourTurn) ref.current?.focus();
  }, [t.yourTurn]);

  const movable = new Set(hints.map((h) => h[0]));
  const matching = hints.filter((h) => path.length > 0 && path.every((x, i) => h[i] === x));
  const targets = new Set(matching.filter((h) => h.length > path.length).map((h) => h[path.length]));
  const lastPath = t.lastMove?.path;
  const last = Array.isArray(lastPath) ? (lastPath as number[]) : [];

  const tap = async (i: number) => {
    if (!t.yourTurn || busy || i < 0) return;
    if (!targets.has(i)) {
      setPath(movable.has(i) ? [i] : []);
      return;
    }
    const next = [...path, i];
    const complete = hints.some((h) => h.length === next.length && h.every((x, k) => x === next[k]));
    const longer = hints.some((h) => h.length > next.length && next.every((x, k) => h[k] === x));
    if (complete && !longer) {
      setPath([]);
      await onMove(next);
    } else setPath(next);
  };

  // Screen rows top to bottom, columns left to right, mapped to board rows/cols.
  const toBoard = (sr: number, sc: number): [number, number] => (flip ? [sr, 7 - sc] : [7 - sr, sc]);
  const onKey = (e: KeyboardEvent) => {
    const [r, c] = cursor;
    if (e.key === "ArrowUp") setCursor([Math.max(0, r - 1), c]);
    else if (e.key === "ArrowDown") setCursor([Math.min(7, r + 1), c]);
    else if (e.key === "ArrowLeft") setCursor([r, Math.max(0, c - 1)]);
    else if (e.key === "ArrowRight") setCursor([r, Math.min(7, c + 1)]);
    else if (e.key === "Enter" || e.key === " ") void tap(sq(...toBoard(r, c)));
    else if (e.key === "Escape") {
      if (path.length) setPath([]);
      else onClose();
    } else return;
    e.preventDefault();
  };

  const name = (i: number) => {
    const ch = t.board[i];
    const who = ownerOf(ch);
    if (!who) return "empty";
    return `${who === "a" ? "dark" : "light"} ${isKing(ch) ? "king" : "man"}`;
  };

  return (
    <>
      <div
        ref={ref}
        className={d.drBoard}
        role="grid"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`Draughts board. ${t.yourTurn ? (path.length ? "Choose where to move." : "Choose a piece to move. Arrow keys move the cursor, Enter picks.") : ""}`}
      >
        {Array.from({ length: 8 }, (_, sr) =>
          Array.from({ length: 8 }, (_, sc) => {
            const [r, c] = toBoard(sr, sc);
            const i = sq(r, c);
            const onCursor = t.yourTurn && cursor[0] === sr && cursor[1] === sc;
            if (i < 0) return <span key={`${sr}-${sc}`} className={`${d.drSq} ${onCursor ? d.drCursor : ""}`} aria-hidden />;
            const ch = t.board[i];
            const who = ownerOf(ch);
            const cls = [d.drSq, d.drDark, path[0] === i ? d.drFrom : "", targets.has(i) ? d.drTarget : "", !path.length && movable.has(i) ? d.drMovable : "", last.includes(i) ? d.drLast : "", onCursor ? d.drCursor : ""].join(" ");
            return (
              <button
                key={`${sr}-${sc}`}
                className={cls}
                tabIndex={-1}
                disabled={!t.yourTurn || busy}
                onClick={() => {
                  setCursor([sr, sc]);
                  void tap(i);
                }}
                aria-label={`${name(i)}${targets.has(i) ? ", move here" : movable.has(i) && !path.length ? ", can move" : ""}`}
              >
                {who && (
                  <span className={`${d.drPiece} ${who === "a" ? d.drPieceDark : d.drPieceLight} ${path.includes(i) && path[path.length - 1] === i ? d.drSel : ""}`} aria-hidden>
                    {isKing(ch) ? "♛" : ""}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      {t.yourTurn && (
        <p className={d.drHint}>
          {path.length === 0
            ? hints.length && hints[0].length > 1 && Math.abs(Math.floor(hints[0][0] / 4) - Math.floor(hints[0][1] / 4)) === 2
              ? "You must take: tap an outlined piece, then each square it jumps to."
              : "Tap an outlined piece, then where it goes. Arrow keys and Enter work too."
            : path.length > 1
              ? "Keep jumping: tap the next landing square."
              : "Tap a highlighted square, or another piece to change your mind."}
        </p>
      )}
      {t.quietMoves !== null && t.quietLimit !== null && t.quietMoves >= t.quietLimit / 2 && t.status === "active" && (
        <p className={d.drHint}>
          {t.quietLimit - t.quietMoves} moves left before a draw unless someone captures or moves a man.
        </p>
      )}
    </>
  );
}

/** Piece colour dot for the player list. */
export function DraughtsDot({ seat }: { seat: "a" | "b" }) {
  return <span className={`${d.drDot} ${seat === "a" ? d.drPieceDark : d.drPieceLight}`} aria-hidden />;
}
