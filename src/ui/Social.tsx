"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { fetchSocial, type State } from "@/client/api";
import { useGame } from "@/client/store";
import { money } from "./format";
import styles from "./ui.module.css";
import soc from "./social.module.css";

/**
 * Shared life with real players (spec ch. 19, 27): People → Players, Messages, Rankings and the City feed.
 * Every rule (consent, blocks, limits, money) is decided by the server; these screens only ask and show.
 */

type Social = State["social"];

interface SocialUi {
  /** Public profile being viewed, if any (shown inside whichever phone app opened it). */
  profile: string | null;
  /** Conversation open in Messages. */
  thread: string | null;
  setProfile: (id: string | null) => void;
  setThread: (id: string | null) => void;
}
const useSocialUi = create<SocialUi>((set) => ({
  profile: null,
  thread: null,
  setProfile: (profile) => set({ profile }),
  setThread: (thread) => set({ thread }),
}));

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Dot({ online }: { online: boolean }) {
  return <span className={`${soc.socDot} ${online ? soc.socOnline : ""}`} role="img" aria-label={online ? "Online now" : "Offline"} title={online ? "Online now" : "Offline"} />;
}

function NameButton({ id, name }: { id: string; name: string }) {
  const setProfile = useSocialUi((x) => x.setProfile);
  return (
    <button className={soc.socName} onClick={() => setProfile(id)} aria-label={`Open ${name}'s profile`}>
      {name}
    </button>
  );
}

/** Clears the open profile when an app closes, so reopening starts at the app's own screen. */
function useProfileReset() {
  const setProfile = useSocialUi((x) => x.setProfile);
  useEffect(() => () => setProfile(null), [setProfile]);
  return useSocialUi((x) => x.profile);
}

function openThread(id: string) {
  useSocialUi.getState().setProfile(null);
  useSocialUi.getState().setThread(id);
  useGame.getState().setPhoneApp("messages");
}

async function visit(id: string) {
  const ok = await useGame.getState().run("VisitHome", { characterId: id }, "visit");
  if (ok) useGame.getState().setSheet(null);
}

// ───────────────────────────── profile ─────────────────────────────

type Profile = {
  id: string;
  name: string;
  title: string;
  reputationXp: number;
  reputationLevel: number;
  career: { name: string; role: string } | null;
  home: { district: string; tier: string };
  netWorthPence: number;
  badges: string[];
  friendsCount: number;
  online: boolean;
  relation: "self" | "friend" | "incoming" | "outgoing" | "blocked" | "none";
  requestId: string | null;
  friendship: { points: number; title: string; next: number | null; since: string } | null;
};

function ReportForm({ s, id, name, onDone }: { s: State; id: string; name: string; onDone: () => void }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  return (
    <form
      className={soc.socForm}
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason && (await run("ReportPlayer", { characterId: id, reason, note, block }, "report"))) onDone();
      }}
    >
      <strong>Report {name}</strong>
      <span className="tiny">Moderators see the reason, your note and your recent messages with {name}. {name} isn't told who reported them.</span>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        <option value="">Choose a reason…</option>
        {s.social.reportReasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea className="input" maxLength={500} placeholder="Anything moderators should know (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for moderators" />
      <label className={soc.socToggle}>
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        <span>Also block {name}</span>
      </label>
      <div className={styles.quotes}>
        <button type="button" className="btn small secondary" onClick={onDone}>
          Cancel
        </button>
        <button className="btn small danger" disabled={!reason || !!pending}>
          Send report
        </button>
      </div>
    </form>
  );
}

function ProfileView({ s, id }: { s: State; id: string }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setProfile = useSocialUi((x) => x.setProfile);
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "report" | "block" | "unfriend">(null);
  const load = useCallback(async () => {
    try {
      setP(((await fetchSocial("profile", { id })) as { profile: Profile }).profile);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that profile.");
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (type: string, payload: unknown) => {
    await run(type, payload, type);
    setMode(null);
    await load();
  };
  const back = (
    <button className="btn small secondary" onClick={() => setProfile(null)}>
      ← Back
    </button>
  );
  if (error)
    return (
      <>
        {back}
        <p className="muted" style={{ marginTop: 12 }}>
          {error}
        </p>
      </>
    );
  if (!p) return <>{back}<p className="tiny">Loading…</p></>;
  const visitDisabled = !!pending || !!s.journey || !!s.shift || !!s.activity;
  return (
    <>
      {back}
      <div className={soc.socRow} style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 24 }}>{p.name}</h3>
        <div className={styles.chips}>
          <span className="chip">Player</span>
          {p.online && <span className="chip good">Online now</span>}
        </div>
      </div>
      <p className="muted">
        {p.title} · reputation level {p.reputationLevel}
      </p>
      <section className={styles.group} style={{ marginTop: 10 }}>
        <ul className={styles.factors}>
          <li>
            <span>Career</span>
            <strong>{p.career ? `${p.career.role}, ${p.career.name}` : "Not working yet"}</strong>
          </li>
          <li>
            <span>Home</span>
            <strong>
              {p.home.tier}, {p.home.district}
            </strong>
          </li>
          <li>
            <span>Net worth</span>
            <strong>{money(p.netWorthPence)}</strong>
          </li>
          <li>
            <span>Reputation</span>
            <strong>{p.reputationXp} XP</strong>
          </li>
          <li>
            <span>Player friends</span>
            <strong>{p.friendsCount}</strong>
          </li>
        </ul>
      </section>
      {p.badges.length > 0 && (
        <div className={styles.chips} style={{ marginBottom: 12 }}>
          {p.badges.map((b) => (
            <span key={b} className="chip gold">
              {b}
            </span>
          ))}
        </div>
      )}
      {p.friendship && (
        <section className={styles.group}>
          <h3>Friendship · {p.friendship.title}</h3>
          <div className={styles.bar}>
            <span style={{ width: `${p.friendship.next ? Math.min(100, (p.friendship.points / p.friendship.next) * 100) : 100}%` }} />
          </div>
          <p className="tiny">
            {p.friendship.points} points{p.friendship.next ? ` · ${p.friendship.next - p.friendship.points} to the next tier` : ""}. You grow closer on days you both message, gift or
            visit.
          </p>
        </section>
      )}

      {p.relation !== "self" && (
        <div className={styles.quotes} style={{ flexWrap: "wrap" }}>
          {p.relation === "none" && (
            <button className="btn small" disabled={!!pending} onClick={() => act("SendFriendRequest", { characterId: p.id })}>
              Add friend
            </button>
          )}
          {p.relation === "outgoing" && p.requestId && (
            <>
              <span className="chip">Request sent</span>
              <button className="btn small secondary" disabled={!!pending} onClick={() => act("WithdrawFriendRequest", { requestId: p.requestId })}>
                Withdraw
              </button>
            </>
          )}
          {p.relation === "incoming" && p.requestId && (
            <>
              <button className="btn small" disabled={!!pending} onClick={() => act("RespondFriendRequest", { requestId: p.requestId, accept: true })}>
                Accept friend request
              </button>
              <button className="btn small secondary" disabled={!!pending} onClick={() => act("RespondFriendRequest", { requestId: p.requestId, accept: false })}>
                Decline
              </button>
            </>
          )}
          {p.relation === "friend" && (
            <>
              <button className="btn small" onClick={() => openThread(p.id)}>
                Message
              </button>
              <button className="btn small secondary" disabled={visitDisabled} onClick={() => visit(p.id)} title={visitDisabled ? "Finish what you're doing first" : undefined}>
                Visit home
              </button>
              <button className="btn small secondary" onClick={() => setMode("unfriend")}>
                Unfriend
              </button>
            </>
          )}
          {p.relation === "blocked" ? (
            <button className="btn small secondary" disabled={!!pending} onClick={() => act("UnblockPlayer", { characterId: p.id })}>
              Unblock
            </button>
          ) : (
            <button className="btn small danger" onClick={() => setMode("block")}>
              Block
            </button>
          )}
          <button className="btn small danger" onClick={() => setMode("report")}>
            Report
          </button>
        </div>
      )}
      {mode === "block" && (
        <div className={styles.confirm} style={{ marginTop: 10 }}>
          <span>Block {p.name}? They can't message you, send requests, money requests or visit, and any friendship ends. They aren't told.</span>
          <div>
            <button className="btn small secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
            <button className="btn small danger" disabled={!!pending} onClick={() => act("BlockPlayer", { characterId: p.id })}>
              Block {p.name}
            </button>
          </div>
        </div>
      )}
      {mode === "unfriend" && (
        <div className={styles.confirm} style={{ marginTop: 10 }}>
          <span>Stop being friends with {p.name}? Your friendship points are lost and you can't message each other until you're friends again.</span>
          <div>
            <button className="btn small secondary" onClick={() => setMode(null)}>
              Keep friends
            </button>
            <button className="btn small danger" disabled={!!pending} onClick={() => act("Unfriend", { characterId: p.id })}>
              Unfriend
            </button>
          </div>
        </div>
      )}
      {mode === "report" && <ReportForm s={s} id={p.id} name={p.name} onDone={() => (setMode(null), load())} />}
      <p className="tiny" style={{ marginTop: 12 }}>
        Public profile. Email addresses and account details are never shown to other players.
      </p>
    </>
  );
}

// ───────────────────────────── People → Players ─────────────────────────────

type Card = { id: string; name: string; title: string; online: boolean; friend: boolean; blocked: boolean };

function FindPlayers() {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const go = async (op: "search" | "online") => {
    try {
      setError(null);
      const r = (await fetchSocial(op, op === "search" ? { q: q.trim() } : {})) as { players: Card[] };
      setCards(r.players);
      setLabel(op === "online" ? "Online now" : `Results for “${q.trim()}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    }
  };
  return (
    <section className={styles.group}>
      <h3>Find players</h3>
      <form
        className={soc.socSearch}
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go("search");
        }}
      >
        <input className="input" value={q} maxLength={24} onChange={(e) => setQ(e.target.value)} placeholder="Character name" aria-label="Search players by character name" />
        <button className="btn small" disabled={!q.trim()}>
          Search
        </button>
        <button type="button" className="btn small secondary" onClick={() => go("online")}>
          Online now
        </button>
      </form>
      {error && <p className={styles.reason}>{error}</p>}
      {cards && (
        <>
          <span className="tiny">{label}</span>
          {cards.length ? (
            <ul className={styles.list}>
              {cards.map((c) => (
                <li key={c.id} className={styles.action}>
                  <div className={styles.actionMain}>
                    <div className={styles.actionTitle}>
                      <Dot online={c.online} />
                      <NameButton id={c.id} name={c.name} />
                      <span className="chip">Player</span>
                      {c.friend && <span className="chip good">Friend</span>}
                      {c.blocked && <span className="chip bad">Blocked</span>}
                    </div>
                    <span className="tiny">{c.title}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tiny">{label === "Online now" ? "Nobody else is online right now. Locals are always about." : "No players found with that name."}</p>
          )}
        </>
      )}
    </section>
  );
}

function PlayersTab({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const so = s.social;
  const visitDisabled = !!pending || !!s.journey || !!s.shift || !!s.activity;
  return (
    <>
      <p className="tiny">Players are real people on this server. Only friends can message, send money or visit, and you can block or report anyone from their profile.</p>
      {so.visitors.length > 0 && (
        <p className={styles.warning} style={{ background: "#dcebe3", color: "#1d5a45" }}>
          At your home now: {so.visitors.map((v) => v.name).join(", ")}
        </p>
      )}
      {(so.incoming.length > 0 || so.moneyRequests.incoming.length > 0) && (
        <section className={styles.group}>
          <h3>Waiting for you</h3>
          <ul className={styles.list}>
            {so.incoming.map((r) => (
              <li key={r.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <NameButton id={r.characterId} name={r.name} />
                    <span className="chip">Friend request</span>
                  </div>
                  <span className="tiny">Expires {when(r.expiresAt)}</span>
                </div>
                <div className={styles.quotes}>
                  <button className="btn small" disabled={!!pending} onClick={() => run("RespondFriendRequest", { requestId: r.id, accept: true }, "accept")}>
                    Accept
                  </button>
                  <button className="btn small secondary" disabled={!!pending} onClick={() => run("RespondFriendRequest", { requestId: r.id, accept: false }, "decline")}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
            {so.moneyRequests.incoming.map((m) => (
              <li key={m.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <NameButton id={m.characterId} name={m.name} />
                    <span className="chip gold">Asks for {money(m.amountPence)}</span>
                  </div>
                  <span className="tiny">
                    {m.note ? `“${m.note}” · ` : ""}Expires {when(m.expiresAt)}. Nothing is paid unless you choose to.
                  </span>
                </div>
                <div className={styles.quotes}>
                  <button className="btn small" disabled={!!pending || s.wallet.cashPence < m.amountPence} onClick={() => run("RespondMoneyRequest", { transferId: m.id, accept: true }, "pay")}>
                    Pay {money(m.amountPence)}
                  </button>
                  <button className="btn small secondary" disabled={!!pending} onClick={() => run("RespondMoneyRequest", { transferId: m.id, accept: false }, "decline")}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.group}>
        <h3>Friends ({so.friends.length})</h3>
        {so.friends.length ? (
          <ul className={styles.list}>
            {so.friends.map((f) => (
              <li key={f.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <Dot online={f.online} />
                    <NameButton id={f.id} name={f.name} />
                    <span className="chip">Player</span>
                    <span className={`chip ${f.best ? "gold" : f.level >= 1 ? "good" : ""}`}>{f.title}</span>
                  </div>
                  <div className={styles.bar}>
                    <span style={{ width: `${f.next ? Math.min(100, (f.points / f.next) * 100) : 100}%` }} />
                  </div>
                  <span className="tiny">
                    {f.points} points · {f.online ? "online now" : "offline"}
                  </span>
                </div>
                <div className={styles.quotes}>
                  <button className="btn small" onClick={() => openThread(f.id)}>
                    Message
                  </button>
                  <button className="btn small secondary" disabled={visitDisabled} onClick={() => visit(f.id)}>
                    Visit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny">No player friends yet. Find someone below and send a request; they choose whether to accept.</p>
        )}
      </section>

      {(so.outgoing.length > 0 || so.moneyRequests.outgoing.length > 0) && (
        <section className={styles.group}>
          <h3>You asked</h3>
          <ul className={styles.list}>
            {so.outgoing.map((r) => (
              <li key={r.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <NameButton id={r.characterId} name={r.name} />
                    <span className="chip">Request pending</span>
                  </div>
                  <span className="tiny">Expires {when(r.expiresAt)}</span>
                </div>
                <button className="btn small secondary" disabled={!!pending} onClick={() => run("WithdrawFriendRequest", { requestId: r.id }, "withdraw")}>
                  Withdraw
                </button>
              </li>
            ))}
            {so.moneyRequests.outgoing.map((m) => (
              <li key={m.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <NameButton id={m.characterId} name={m.name} />
                    <span className="chip gold">You asked for {money(m.amountPence)}</span>
                  </div>
                  <span className="tiny">Waiting for them · expires {when(m.expiresAt)}</span>
                </div>
                <button className="btn small secondary" disabled={!!pending} onClick={() => run("CancelMoneyRequest", { transferId: m.id }, "cancel")}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FindPlayers />

      {so.blocked.length > 0 && (
        <section className={styles.group}>
          <h3>Blocked</h3>
          <ul className={styles.list}>
            {so.blocked.map((b) => (
              <li key={b.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <strong>{b.name}</strong>
                </div>
                <button className="btn small secondary" disabled={!!pending} onClick={() => run("UnblockPlayer", { characterId: b.id }, "unblock")}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** People app: real players and the named locals (NPCs), kept clearly apart. */
export function PeopleHub({ s, npcs }: { s: State; npcs: ReactNode }) {
  const profile = useProfileReset();
  const [tab, setTab] = useState<"players" | "locals">("players");
  if (profile) return <ProfileView s={s} id={profile} />;
  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={tab === "players"} className={tab === "players" ? styles.tabOn : ""} onClick={() => setTab("players")}>
          Players{s.social.incoming.length ? ` (${s.social.incoming.length})` : ""}
        </button>
        <button role="tab" aria-selected={tab === "locals"} className={tab === "locals" ? styles.tabOn : ""} onClick={() => setTab("locals")}>
          Locals (NPC)
        </button>
      </div>
      {tab === "players" ? <PlayersTab s={s} /> : npcs}
    </>
  );
}

// ───────────────────────────── Messages ─────────────────────────────

type Msg = { id: number; mine: boolean; kind: "text" | "gift" | "money_request" | "system"; body: string; at: string; transfer: { id: string; status: string; youPay: boolean } | null };
type Thread = { characterId: string; name: string; friends: boolean; blocked: boolean; canSend: boolean; messages: Msg[]; readUpTo: number | null; hasOlder: boolean };

const DRAFT_KEY = (id: string) => `ll-draft:${id}`;
function readDraft(id: string) {
  try {
    return localStorage.getItem(DRAFT_KEY(id)) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(id: string, v: string) {
  try {
    if (v) localStorage.setItem(DRAFT_KEY(id), v);
    else localStorage.removeItem(DRAFT_KEY(id));
  } catch {
    /* drafts are a convenience only */
  }
}

function MoneyForm({ s, id, name, kind, onDone }: { s: State; id: string; name: string; kind: "gift" | "request"; onDone: () => void }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [v, setV] = useState("");
  const [note, setNote] = useState("");
  // One id per intended transfer, kept across retries so a lost response can't send twice.
  const clientId = useRef(newId());
  const pence = Math.round(Number(v) * 100);
  const lim = s.social.limits;
  const left = Math.max(0, lim.dailyCapPence - lim.paidTodayPence);
  const max = kind === "gift" ? Math.min(lim.giftMaxPence, left, s.wallet.cashPence) : lim.giftMaxPence;
  const ok = Number.isFinite(pence) && pence >= 1 && pence <= max;
  return (
    <form
      className={soc.socForm}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        const r = await run(kind === "gift" ? "SendGift" : "RequestMoney", { characterId: id, amountPence: pence, note, clientId: clientId.current }, kind);
        if (r) {
          clientId.current = newId();
          onDone();
        }
      }}
    >
      <strong>{kind === "gift" ? `Send money to ${name}` : `Ask ${name} for money`}</strong>
      <span className="tiny">
        {kind === "gift"
          ? `Leaves your wallet now. Up to ${money(lim.giftMaxPence)} at once and ${money(lim.dailyCapPence)} a day (${money(left)} left today). Game money only.`
          : `Nothing moves unless ${name} accepts. Requests expire after three days. Game money only.`}
      </span>
      <div className={styles.quotes}>
        <input className="input" style={{ width: 110 }} inputMode="decimal" placeholder="£0.00" value={v} onChange={(e) => setV(e.target.value)} aria-label="Amount in pounds" />
        <input className="input" style={{ flex: 1, minWidth: 0 }} maxLength={lim.noteMax} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      </div>
      <div className={styles.quotes}>
        <button type="button" className="btn small secondary" onClick={onDone}>
          Cancel
        </button>
        <button className="btn small" disabled={!ok || !!pending}>
          {kind === "gift" ? `Send ${ok ? money(pence) : ""}` : `Ask for ${ok ? money(pence) : ""}`}
        </button>
      </div>
    </form>
  );
}

function ThreadView({ s, id }: { s: State; id: string }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setThread = useSocialUi((x) => x.setThread);
  const setProfile = useSocialUi((x) => x.setProfile);
  const [t, setT] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => readDraft(id));
  const [unsent, setUnsent] = useState<{ body: string; clientId: string } | null>(null);
  const [form, setForm] = useState<null | "gift" | "request">(null);
  const box = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = ((await fetchSocial("thread", { id })) as { thread: Thread }).thread;
      setT(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load messages.");
    }
  }, [id]);
  // A lighter poll than the full game state, only while the conversation is open.
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const newest = t?.messages[t.messages.length - 1]?.id ?? 0;
    if (newest > lastId.current && box.current) box.current.scrollTop = box.current.scrollHeight;
    lastId.current = newest;
  }, [t]);
  useEffect(() => writeDraft(id, draft), [id, draft]);

  const send = async (body: string, clientId: string) => {
    setUnsent({ body, clientId });
    const r = await run("SendMessage", { characterId: id, body, clientId }, "message");
    if (r) {
      setUnsent(null);
      await load();
    }
    // On failure the text and its id stay, so "Retry" can't create a second copy.
  };
  const respond = async (transferId: string, accept: boolean) => {
    await run("RespondMoneyRequest", { transferId, accept }, "money");
    await load();
  };
  const cancel = async (transferId: string) => {
    await run("CancelMoneyRequest", { transferId }, "money");
    await load();
  };

  const name = t?.name ?? s.social.friends.find((f) => f.id === id)?.name ?? s.social.conversations.find((c) => c.characterId === id)?.name ?? "Player";
  const lastMine = t ? [...t.messages].reverse().find((m) => m.mine) : null;
  return (
    <>
      <div className={soc.socRow}>
        <button className="btn small secondary" onClick={() => setThread(null)}>
          ← All chats
        </button>
        <button className={soc.socName} onClick={() => setProfile(id)}>
          {name}
        </button>
      </div>
      {error && <p className={styles.reason}>{error}</p>}
      {t?.hasOlder && <p className="tiny">Showing the latest 50 messages.</p>}
      <div className={soc.socThread} ref={box} aria-live="polite">
        {t && !t.messages.length && <p className="tiny">No messages yet. Say hello!</p>}
        {t?.messages.map((m) =>
          m.kind === "text" ? (
            <div key={m.id} className={`${soc.socBubble} ${m.mine ? soc.socMine : soc.socTheirs}`}>
              {m.body}
              <div className={soc.socMeta}>{when(m.at)}</div>
            </div>
          ) : (
            <div key={m.id} className={soc.socMoney}>
              <span>
                <strong>{m.mine ? "You" : name}</strong> {m.body.charAt(0).toLowerCase() + m.body.slice(1)}
              </span>
              <span className="tiny">{when(m.at)}</span>
              {m.transfer && m.transfer.status === "pending" && m.transfer.youPay && (
                <div className={styles.quotes} style={{ justifyContent: "center" }}>
                  <button className="btn small" disabled={!!pending} onClick={() => respond(m.transfer!.id, true)}>
                    Pay
                  </button>
                  <button className="btn small secondary" disabled={!!pending} onClick={() => respond(m.transfer!.id, false)}>
                    Decline
                  </button>
                </div>
              )}
              {m.transfer && m.transfer.status === "pending" && !m.transfer.youPay && (
                <button className="btn small secondary" disabled={!!pending} onClick={() => cancel(m.transfer!.id)}>
                  Cancel request
                </button>
              )}
              {m.transfer && m.transfer.status !== "pending" && <span className="tiny">Request {m.transfer.status}</span>}
            </div>
          ),
        )}
        {t?.readUpTo != null && lastMine && t.readUpTo >= lastMine.id && <span className={soc.socSeen}>Seen</span>}
      </div>
      {unsent && !pending && (
        <div className={soc.socUnsent} role="alert">
          <span>Not sent: “{unsent.body.slice(0, 40)}{unsent.body.length > 40 ? "…" : ""}”</span>
          <span className={styles.quotes}>
            <button className="btn small" onClick={() => send(unsent.body, unsent.clientId)}>
              Retry
            </button>
            <button className="btn small secondary" onClick={() => (setDraft(unsent.body), setUnsent(null))}>
              Edit
            </button>
          </span>
        </div>
      )}
      {t && !t.canSend ? (
        <p className="tiny">{t.blocked ? "You've blocked this player. Unblock them from their profile to talk again." : "You're not friends any more, so new messages can't be sent."}</p>
      ) : (
        <>
          {form && <MoneyForm s={s} id={id} name={name} kind={form} onDone={() => (setForm(null), load())} />}
          <form
            className={soc.socComposer}
            onSubmit={(e) => {
              e.preventDefault();
              const body = draft.trim();
              if (!body || body.length > s.social.limits.messageMax) return;
              setDraft("");
              send(body, newId());
            }}
          >
            <textarea
              value={draft}
              maxLength={s.social.limits.messageMax}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
              placeholder={`Message ${name}`}
              aria-label={`Message ${name}`}
            />
            <div className={soc.socRow}>
              <span className="tiny">
                {draft.length}/{s.social.limits.messageMax}
              </span>
              <span className={styles.quotes}>
                <button type="button" className="btn small secondary" onClick={() => setForm(form === "gift" ? null : "gift")}>
                  Send £
                </button>
                <button type="button" className="btn small secondary" onClick={() => setForm(form === "request" ? null : "request")}>
                  Ask for £
                </button>
                <button className="btn small" disabled={!draft.trim() || !!pending}>
                  Send
                </button>
              </span>
            </div>
          </form>
        </>
      )}
    </>
  );
}

export function MessagesApp({ s }: { s: State }) {
  const profile = useProfileReset();
  const thread = useSocialUi((x) => x.thread);
  const setThread = useSocialUi((x) => x.setThread);
  const [convs, setConvs] = useState<Social["conversations"] | null>(null);
  useEffect(() => () => setThread(null), [setThread]);
  // Light poll for the chat list while Messages is open.
  useEffect(() => {
    if (thread) return;
    let live = true;
    const tick = async () => {
      try {
        const r = (await fetchSocial("pulse")) as { pulse: { conversations: Social["conversations"] } };
        if (live) setConvs(r.pulse.conversations);
      } catch {
        /* the full state poll will catch up */
      }
    };
    tick();
    const timer = setInterval(() => document.visibilityState === "visible" && tick(), 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [thread]);
  if (profile) return <ProfileView s={s} id={profile} />;
  if (thread) return <ThreadView s={s} id={thread} />;
  const list = convs ?? s.social.conversations;
  const withChat = new Set(list.map((c) => c.characterId));
  const others = s.social.friends.filter((f) => !withChat.has(f.id));
  return (
    <>
      <p className="tiny">Private one-to-one chats with player friends. Locals (NPCs) chat in person at their venues.</p>
      {list.length ? (
        <ul className={styles.list}>
          {list.map((c) => (
            <li key={c.characterId}>
              <button className={styles.action} style={{ width: "100%", textAlign: "left" }} onClick={() => setThread(c.characterId)}>
                <div className={styles.actionMain}>
                  <div className={styles.actionTitle}>
                    <Dot online={c.online} />
                    <strong>{c.name}</strong>
                    {c.unread > 0 && <span className={styles.badge}>{c.unread}</span>}
                  </div>
                  <span className="tiny">{c.preview}</span>
                </div>
                <span className="tiny">{when(c.lastMessageAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No conversations yet.</p>
      )}
      {others.length > 0 && (
        <section className={styles.group} style={{ marginTop: 12 }}>
          <h3>Start a chat</h3>
          <div className={styles.chips}>
            {others.map((f) => (
              <button key={f.id} className="btn small secondary" onClick={() => setThread(f.id)}>
                {f.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {!s.social.friends.length && <p className="tiny">Make friends with players in People → Players to start chatting.</p>}
    </>
  );
}

// ───────────────────────────── Rankings ─────────────────────────────

type Board = { top: { id: string; name: string; value: number; rank: number; you: boolean; title?: string }[]; you: { rank: number; value: number } | null };
type Rankings = { updatedAt: string; reputation: Board; netWorth: Board };

export function RankingsApp({ s }: { s: State }) {
  const profile = useProfileReset();
  const [tab, setTab] = useState<"netWorth" | "reputation">("netWorth");
  const [r, setR] = useState<Rankings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setR(((await fetchSocial("rankings")) as { rankings: Rankings }).rankings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load rankings.");
    }
  }, []);
  useEffect(() => {
    if (!profile) load();
  }, [load, profile]);
  if (profile) return <ProfileView s={s} id={profile} />;
  const board = r?.[tab];
  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={tab === "netWorth"} className={tab === "netWorth" ? styles.tabOn : ""} onClick={() => setTab("netWorth")}>
          Net worth
        </button>
        <button role="tab" aria-selected={tab === "reputation"} className={tab === "reputation" ? styles.tabOn : ""} onClick={() => setTab("reputation")}>
          Reputation
        </button>
      </div>
      <p className="tiny">
        {tab === "netWorth"
          ? "Cash + savings + half of what furniture cost + an owned home's price (or rent deposit held) − unpaid bills. The same figure as each player's Bank app and profile."
          : "Reputation earned from missions, check-ins, stories, ambitions and performing."}{" "}
        Real players only.
      </p>
      {error && <p className={styles.reason}>{error}</p>}
      {board && (
        <>
          <ol className={styles.list} style={{ listStyle: "none", padding: 0 }}>
            {board.top.map((x) => (
              <li key={x.id} className={`${soc.socRank} ${x.you ? soc.socRankYou : ""}`}>
                <span className={soc.socRankNo}>{x.rank}</span>
                <span>
                  {x.you ? <strong>{x.name} (you)</strong> : <NameButton id={x.id} name={x.name} />}
                  {x.title && <span className="tiny"> · {x.title}</span>}
                </span>
                <strong>{tab === "netWorth" ? money(x.value) : `${x.value} XP`}</strong>
              </li>
            ))}
          </ol>
          {board.you && board.you.rank > board.top.length && (
            <p className="tiny" style={{ marginTop: 8 }}>
              You: #{board.you.rank} with {tab === "netWorth" ? money(board.you.value) : `${board.you.value} XP`}
            </p>
          )}
        </>
      )}
      <div className={soc.socRow} style={{ marginTop: 10 }}>
        <span className="tiny">{r ? `Updated ${clock(r.updatedAt)}` : "Loading…"}</span>
        <button className="btn small secondary" onClick={load}>
          Refresh
        </button>
      </div>
    </>
  );
}

// ───────────────────────────── City feed ─────────────────────────────

type FeedItem = { id: number; characterId: string; name: string; you: boolean; text: string; type: string; at: string };

export function FeedApp({ s }: { s: State }) {
  const profile = useProfileReset();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (before?: number) => {
    try {
      const f = ((await fetchSocial("feed", { before })) as { feed: { items: FeedItem[]; nextBefore: number | null } }).feed;
      // Pages are keyed by id, so "Load more" never repeats a post.
      setItems((prev) => {
        const base = before ? prev : [];
        const seen = new Set(base.map((x) => x.id));
        return [...base, ...f.items.filter((x) => !seen.has(x.id))];
      });
      setNext(f.nextBefore);
      setLoaded(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the feed.");
    }
  }, []);
  useEffect(() => {
    if (!profile) load();
  }, [load, profile]);
  if (profile) return <ProfileView s={s} id={profile} />;
  return (
    <>
      <p className="tiny">
        Milestones from players who share them: promotions, story endings, treasure finds, new homes and certificates. {s.social.settings.shareFeed ? "Yours are shared" : "Yours are hidden"} ·
        change this in Settings.
      </p>
      {error && <p className={styles.reason}>{error}</p>}
      {loaded && !items.length && <p className="muted">Nothing yet. Big moments from players will appear here.</p>}
      <ul className={styles.list}>
        {items.map((x) => (
          <li key={x.id} className={styles.action}>
            <div className={styles.actionMain}>
              <span>
                {x.you ? <strong>You</strong> : <NameButton id={x.characterId} name={x.name} />} {x.text}
              </span>
              <span className="tiny">{when(x.at)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className={soc.socRow} style={{ marginTop: 10 }}>
        <button className="btn small secondary" onClick={() => load()}>
          Refresh
        </button>
        {next && (
          <button className="btn small secondary" onClick={() => load(next)}>
            Load more
          </button>
        )}
      </div>
    </>
  );
}

// ───────────────────────────── settings & overlay ─────────────────────────────

export function PrivacySettings() {
  const s = useGame((x) => x.state);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  if (!s) return null;
  const st = s.social.settings;
  return (
    <section className={styles.group}>
      <h3>Privacy</h3>
      <label className={soc.socToggle}>
        <input type="checkbox" checked={st.shareFeed} disabled={!!pending} onChange={(e) => run("UpdateSocialSettings", { shareFeed: e.target.checked }, "settings")} />
        <span>
          Share my milestones in the City feed
          <span className="tiny" style={{ display: "block" }}>
            Promotions, story endings, treasure finds, new homes and certificates. Turning this off hides past posts too.
          </span>
        </span>
      </label>
      <label className={soc.socToggle}>
        <input type="checkbox" checked={st.readReceipts} disabled={!!pending} onChange={(e) => run("UpdateSocialSettings", { readReceipts: e.target.checked }, "settings")} />
        <span>
          Read receipts
          <span className="tiny" style={{ display: "block" }}>
            When off, friends don't see when you've read their messages, and you don't see theirs.
          </span>
        </span>
      </label>
    </section>
  );
}

/** Shown over the world while you're visiting a friend's home, or while friends are visiting yours. */
export function VisitBar({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const v = s.social?.visit;
  if (v)
    return (
      <div className={soc.socVisitBar} role="status">
        <strong>
          Visiting {v.hostName}&apos;s {v.home.tierName.toLowerCase()}
        </strong>
        <span className="tiny">
          {v.home.district} · until {clock(v.endsAt)} · {v.hostOnline ? `${v.hostName} is online` : `${v.hostName} isn't online right now`}. Look around; it&apos;s theirs, so nothing can be moved or used.
        </span>
        <button className="btn small" disabled={!!pending} onClick={() => run("LeaveVisit", {}, "leave")}>
          Head home
        </button>
      </div>
    );
  if (s.social?.visitors.length)
    return (
      <div className={soc.socVisitBar} role="status">
        <span>
          <strong>{s.social.visitors.map((x) => x.name).join(", ")}</strong> {s.social.visitors.length > 1 ? "are" : "is"} visiting your home.
        </span>
      </div>
    );
  return null;
}
