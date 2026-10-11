"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "zustand";
import { fetchTable, type State } from "@/client/api";
import { serverNow, useGame } from "@/client/store";
import { COLS, ROWS } from "@/content/fourInRow";
import type { TableView } from "@/server/tables";
import { countdown } from "./format";
import styles from "./ui.module.css";
import g from "./games.module.css";
import { FocusScope } from "./a11y";

/** Which table's board is open on screen (local presentation state only). */
interface TableUi {
  tableId: string | null;
  /** "id:status" of your own game when you closed its board: it isn't reopened until its status changes. */
  dismissed: string | null;
  open: (id: string) => void;
  close: (key?: string) => void;
}

export const useTableUi = create<TableUi>((set, get) => ({
  tableId: null,
  dismissed: null,
  open: (tableId) => set({ tableId, dismissed: null }),
  close: (key) => set({ tableId: null, dismissed: key ?? get().dismissed }),
}));

const POLL_MS = 1500;

const londonTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" });

// ─────────────────────────── board overlay ───────────────────────────

/** Shows the open table's board; opens automatically when one of your games is in progress. */
export function TableOverlay({ s }: { s: State }) {
  const { tableId, dismissed, open } = useTableUi();
  const mine = s.games?.mine;
  // Your own game opens by itself once someone joins (unless you closed its board).
  useEffect(() => {
    if (mine && mine.status === "active" && !tableId && dismissed !== `${mine.id}:active`) open(mine.id);
  }, [mine, tableId, dismissed, open]);
  if (!tableId || s.minigame) return null;
  return <Board key={tableId} tableId={tableId} />;
}

function Board({ tableId }: { tableId: string }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const closeUi = useTableUi((x) => x.close);
  const openTable = useTableUi((x) => x.open);
  const [t, setT] = useState<TableView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState(3);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [, tick] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setT(await fetchTable(tableId));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the table.");
    }
  }, [tableId]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 500);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const close = () => closeUi(t ? `${t.id}:${t.status}` : undefined);
  const yourTurn = !!t?.yourTurn;
  useEffect(() => {
    if (yourTurn) boardRef.current?.focus();
  }, [yourTurn]);

  const drop = async (col: number) => {
    if (!t || !t.yourTurn || pending) return;
    if (t.board[(ROWS - 1) * COLS + col] !== ".") return;
    await run("GameMove", { tableId: t.id, column: col, version: t.version }, "move");
    await load();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setCursor((c) => (c + COLS - 1) % COLS);
    else if (e.key === "ArrowRight") setCursor((c) => (c + 1) % COLS);
    else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") void drop(cursor);
    else if (/^[1-7]$/.test(e.key)) {
      setCursor(Number(e.key) - 1);
      void drop(Number(e.key) - 1);
    } else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
  };

  if (!t)
    return (
      <FocusScope trap focusKey="loading">
      <div className={g.ftOverlay} role="dialog" aria-modal="true" aria-label="Games table">
        <div className={g.ftPanel}>
          <p>{err ?? "Loading the table…"}</p>
          <button className="btn secondary" onClick={close}>
            Close
          </button>
        </div>
      </div>
      </FocusScope>
    );

  const me = t.players.find((p) => p.you);
  const turnPlayer = t.players.find((p) => p.seat === t.turn)!;
  const msLeft = t.turnDeadline ? new Date(t.turnDeadline).getTime() - serverNow() : 0;
  const winner = t.winner && t.winner !== "draw" ? t.players.find((p) => p.seat === t.winner) : null;
  const status =
    t.status === "open"
      ? `${t.players[1].name === "Open seat" ? "Waiting for someone to join" : `${t.players[1].name} to accept`}${t.openUntil ? ` (the table closes ${londonTime(t.openUntil)})` : ""}.`
      : t.status === "cancelled"
        ? "This table closed before the game started."
        : t.status === "finished"
          ? t.winner === "draw"
            ? "Full board — it's a draw."
            : `${winner?.you ? "You win" : `${winner?.name} wins`}${t.endReason === "timeout" ? ", on missed turns" : t.endReason === "resigned" ? ", by resignation" : ""}.`
          : t.yourTurn
            ? "Your move."
            : t.spectating
              ? `${turnPlayer.name} to move.`
              : `Waiting for ${turnPlayer.name}…`;
  const rows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i);
  const win = new Set(t.winLine ?? []);
  const lastIndex = t.lastMove ? (() => {
    for (let r = ROWS - 1; r >= 0; r--) if (t.board[r * COLS + t.lastMove!.col] !== ".") return r * COLS + t.lastMove!.col;
    return -1;
  })() : -1;

  return (
    <FocusScope trap focusKey="table">
    <div className={g.ftOverlay} role="dialog" aria-modal="true" aria-label={`${t.gameName} table`}>
      <div className={g.ftPanel}>
        <div className={g.ftHead}>
          <div>
            <span className={g.ftKicker}>
              {t.gameName} · {t.mode === "practice" ? "Practice" : `${t.venue} · friendly, no stakes`}
            </span>
            <h2>{t.spectating ? "Watching a game" : t.mode === "practice" ? "Practice game" : "Your game"}</h2>
          </div>
          <button className={styles.iconBtn} onClick={close} aria-label={t.spectating ? "Stop watching (the game carries on)" : "Close board (the game carries on)"}>
            ×
          </button>
        </div>

        <ul className={g.ftPlayers}>
          {t.players.map((p) => (
            <li key={p.seat} className={`${g.ftPlayer} ${t.status === "active" && t.turn === p.seat ? g.ftPlayerOn : ""}`}>
              <span className={`${g.ftDot} ${p.seat === "a" ? g.ftRed : g.ftGold}`} aria-hidden />
              <span>
                <strong>{p.you ? `${p.name} (you)` : p.name}</strong>
                {p.npc && <span className="chip">Computer player</span>}
                {p.misses > 0 && t.status === "active" && <span className="tiny"> · missed {p.misses}</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className={g.ftStatusRow}>
          <p className={g.ftStatus} role="status" aria-live="polite">
            {status}
          </p>
          {t.status === "active" && t.turnDeadline && (
            <span className={`${g.ftTimer} ${msLeft < 15_000 ? g.ftTimerLow : ""}`} aria-label={`${Math.max(0, Math.ceil(msLeft / 1000))} seconds left this turn`}>
              {countdown(msLeft)}
            </span>
          )}
        </div>

        <div
          ref={boardRef}
          className={g.ftBoard}
          role="grid"
          aria-label={`Board. ${yourTurn ? `Column ${cursor + 1} selected. Use left and right arrows and Enter, or press 1 to 7.` : ""}`}
          tabIndex={0}
          onKeyDown={onKey}
        >
          {Array.from({ length: COLS }, (_, col) => {
            const full = t.board[(ROWS - 1) * COLS + col] !== ".";
            return (
              <button
                key={col}
                className={`${g.ftCol} ${yourTurn && cursor === col ? g.ftColOn : ""}`}
                disabled={!yourTurn || full || !!pending}
                onClick={() => {
                  setCursor(col);
                  void drop(col);
                }}
                onMouseEnter={() => setCursor(col)}
                aria-label={`Column ${col + 1}${full ? ", full" : ""}`}
                tabIndex={-1}
              >
                {rows.map((r) => {
                  const i = r * COLS + col;
                  const v = t.board[i];
                  return (
                    <span
                      key={r}
                      className={`${g.ftCell} ${v === "a" ? g.ftRed : v === "b" ? g.ftGold : ""} ${win.has(i) ? g.ftWin : ""} ${i === lastIndex ? g.ftLast : ""}`}
                      aria-hidden
                    />
                  );
                })}
              </button>
            );
          })}
        </div>
        {yourTurn && <p className="tiny">Tap a column, or use ← → and Enter (or keys 1–7).</p>}
        {err && <p className="err">{err} Retrying…</p>}

        <div className={g.ftFoot}>
          {me && t.status === "open" && (
            <button className="btn danger small" disabled={!!pending} onClick={() => run("LeaveGameTable", { tableId: t.id }, "leave").then(load)}>
              Close table
            </button>
          )}
          {me && t.status === "active" &&
            (confirmLeave ? (
              <span className={styles.confirm}>
                <span>Leaving now counts as resigning.</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn secondary small" onClick={() => setConfirmLeave(false)}>
                    Keep playing
                  </button>
                  <button className="btn danger small" disabled={!!pending} onClick={() => run("LeaveGameTable", { tableId: t.id }, "resign").then(load)}>
                    Resign
                  </button>
                </span>
              </span>
            ) : (
              <button className="btn danger small" onClick={() => setConfirmLeave(true)}>
                Resign…
              </button>
            ))}
          {me && t.status === "finished" && (
            <button
              className="btn small"
              disabled={!!pending}
              onClick={async () => {
                const r = await run("Rematch", { tableId: t.id }, "rematch");
                const next = r && (r as { tableId?: string }).tableId;
                if (next) openTable(next);
                else await load();
              }}
            >
              {t.mode === "practice" ? "Play again" : "Rematch"}
            </button>
          )}
          <button className="btn secondary small" onClick={close}>
            {t.spectating ? "Stop watching" : "Close board"}
          </button>
        </div>
        <details className={g.ftRules}>
          <summary>How to play</summary>
          <ul>
            {t.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
    </FocusScope>
  );
}

// ─────────────────────────── Games app ───────────────────────────

export function GamesApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const openTable = useTableUi((x) => x.open);
  const gm = s.games;
  const here = gm.venues.find((v) => v.here);
  const start = async (mode: "friendly" | "practice") => {
    const r = await run("CreateGameTable", { mode }, mode);
    const id = r && (r as { tableId?: string }).tableId;
    if (id) openTable(id);
  };
  return (
    <>
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <div>
            <span className="tiny">Friendly table game · no stakes</span>
            <h3 style={{ fontSize: 22 }}>Four in a Row</h3>
          </div>
          <span className="chip">
            {gm.record.wins}W · {gm.record.losses}L · {gm.record.draws}D
          </span>
        </div>
        <p className={styles.actionDesc}>Drop counters into a 7 × 6 grid. Line up four across, down or diagonally to win.</p>
        {gm.mine ? (
          <>
            <p className="tiny">{gm.mine.status === "open" ? "Your table is waiting for an opponent." : "You have a game in progress."}</p>
            <button className="btn small" onClick={() => openTable(gm.mine!.id)}>
              Open board
            </button>
          </>
        ) : (
          <div className={styles.quotes}>
            {here ? (
              <button className="btn small" disabled={!!pending} onClick={() => start("friendly")}>
                Open a table at {here.name}
              </button>
            ) : (
              <button className="btn small secondary" onClick={() => setSheet("map")}>
                Tables are at {gm.venues.map((v) => v.name).join(" or ")}
              </button>
            )}
            <button className="btn small secondary" disabled={!!pending} onClick={() => start("practice")}>
              Practise against Sam (NPC)
            </button>
          </div>
        )}
        <details>
          <summary className="tiny">Rules</summary>
          <ul className="tiny">
            {gm.available[0].rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </section>

      <h3 className={styles.subhead}>Open tables</h3>
      {gm.open.length ? (
        <ul className={styles.list}>
          {gm.open.map((o) => (
            <li key={o.id} className={styles.action}>
              <div className={styles.actionMain}>
                <strong>{o.rematch ? `${o.host} wants a rematch` : `${o.host}'s table`}</strong>
                <span className="tiny">{o.venue}</span>
                {!o.here && !o.rematch && <p className={styles.reason}>Go to {o.venue} to join.</p>}
              </div>
              <button
                className="btn small"
                disabled={!!pending || (!o.here && !o.rematch) || !!gm.mine}
                onClick={async () => {
                  const r = await run("JoinGameTable", { tableId: o.id }, "join");
                  if (r) openTable(o.id);
                }}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No one is waiting for a game right now. Open a table and someone may join.</p>
      )}

      <h3 className={styles.subhead}>Live games to watch</h3>
      {gm.live.length ? (
        <ul className={styles.list}>
          {gm.live.map((l) => (
            <li key={l.id} className={styles.action}>
              <div className={styles.actionMain}>
                <strong>
                  {l.players[0]} v {l.players[1]}
                </strong>
                <span className="tiny">
                  {l.venue} · {l.moves} moves
                </span>
              </div>
              <button className="btn small secondary" onClick={() => openTable(l.id)}>
                Watch
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No games in progress.</p>
      )}

      {gm.recent.length > 0 && (
        <>
          <h3 className={styles.subhead}>Your recent games</h3>
          <ul className={styles.ledger}>
            {gm.recent.map((r) => (
              <li key={r.tableId}>
                <div>
                  <strong>v {r.opponent}</strong>
                  <span className="tiny">{r.reason === "timeout" ? "missed turns" : r.reason === "resigned" ? "resignation" : r.reason === "draw" ? "full board" : "four in a row"}</span>
                </div>
                <span className={r.outcome === "win" ? styles.pos : r.outcome === "loss" ? styles.neg : ""}>{r.outcome === "win" ? "Won" : r.outcome === "loss" ? "Lost" : "Draw"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tiny" style={{ marginTop: 12 }}>
        Practice wins against Sam: {gm.record.practiceWins}. Sam is a computer-controlled character, not a real player.
      </p>
    </>
  );
}

// ─────────────────────────── Government app ───────────────────────────

export function GovernmentApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [policy, setPolicy] = useState(s.civic.platforms[0].id);
  const cv = s.civic;
  const cur = cv.current;
  return (
    <>
      <section className={styles.workCard}>
        <span className="tiny">This week's {cv.office}</span>
        <div className={styles.workRow}>
          <h3 style={{ fontSize: 22 }}>{cur.mayor}</h3>
          {cur.you && <span className="chip good">That's you</span>}
        </div>
        <p>
          <strong>{cur.policy.name}</strong> — {cur.policy.summary}
        </p>
        <span className="tiny">
          In force until {londonTime(cur.endsAt)} London time{cur.caretaker ? " · nobody won a vote, so the caretaker keeps things as they are" : ` · won with ${cur.votes} of ${cur.totalVotes} votes`}
        </span>
      </section>

      <h3 className={styles.subhead}>This week's race · closes {londonTime(cv.closesAt)}</h3>
      <p className="tiny">
        One final ballot per person per week. The winner's policy runs for the following week. Most votes wins; a tie goes to whoever stood first.
        {cv.pollingPlace ? ` Vote in person at ${cv.pollingPlace}.` : " Vote from this app wherever you are."}
      </p>
      {cv.voteBlocker && <p className={styles.reason}>{cv.voteBlocker}</p>}
      {cv.candidates.length ? (
        <ul className={styles.list}>
          {cv.candidates.map((cand) => (
            <li key={cand.id} className={styles.action}>
              <div className={styles.actionMain}>
                <strong>
                  {cand.name}
                  {cand.you ? " (you)" : ""}
                </strong>
                <span className={styles.actionDesc}>
                  {cand.policy.name}: {cand.policy.summary}
                </span>
                <span className="tiny">
                  {cand.votes} vote{cand.votes === 1 ? "" : "s"}
                </span>
              </div>
              {cv.myBallot === cand.id ? (
                <span className="chip good">Your vote</span>
              ) : (
                <button className="btn small" disabled={!!pending || !!cv.myBallot || !!cv.voteBlocker} onClick={() => run("CastVote", { candidateId: cand.id }, "vote")}>
                  Vote
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nobody is standing yet. If no one wins a vote, the caretaker keeps the status quo.</p>
      )}

      {!cv.standing && (
        <section className={styles.workCard} style={{ marginTop: 12 }}>
          <strong>Stand for {cv.office}</strong>
          <p className="tiny">Choose the policy you'll bring in if you win. Standing is free; you can stand once a week.</p>
          <div className={styles.styles} role="radiogroup" aria-label="Policy">
            {cv.platforms.map((p) => (
              <button key={p.id} role="radio" aria-checked={policy === p.id} className={`${styles.styleBtn} ${policy === p.id ? styles.styleOn : ""}`} onClick={() => setPolicy(p.id)}>
                <strong>{p.name}</strong>
                <span className="tiny">{p.summary}</span>
              </button>
            ))}
          </div>
          {cv.eligibleReason ? (
            <p className={styles.reason}>{cv.eligibleReason}</p>
          ) : (
            <button className="btn small" disabled={!!pending} onClick={() => run("StandForElection", { policyId: policy }, "stand")}>
              Stand on “{cv.platforms.find((p) => p.id === policy)?.name}”
            </button>
          )}
        </section>
      )}

      {cv.past.length > 0 && (
        <>
          <h3 className={styles.subhead}>Past results</h3>
          <ul className={styles.ledger}>
            {cv.past.map((p) => (
              <li key={p.raceKey}>
                <div>
                  <strong>{p.mayor}</strong>
                  <span className="tiny">
                    Closed {new Date(`${p.raceKey}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {p.candidates} candidate{p.candidates === 1 ? "" : "s"} · {p.totalVotes} vote
                    {p.totalVotes === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="chip">{p.policy.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tiny" style={{ marginTop: 12 }}>
        A fictional city office in a game. Policies are game rules only; candidates can't promise or transfer anything else.
      </p>
    </>
  );
}
