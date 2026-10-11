"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import { useFx } from "@/client/fx";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

type Active = NonNullable<State["stories"]["active"]>;

/** The story as a graph: where you've been, where you are, and the shape of what's left. */
export function StoryGraph({ a }: { a: Active }) {
  const nodes = a.graph.nodes;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const W = 340;
  const H = Math.max(120, (maxY - minY + 1) * 46 + 20);
  const px = (x: number) => 26 + (x / Math.max(1, maxX)) * (W - 52);
  const py = (y: number) => 20 + ((y - minY) / Math.max(1, maxY - minY)) * (H - 40 || 1) + (maxY === minY ? (H - 40) / 2 : 0);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const onPath = (from: string, to: string) => a.graph.path.some((id, i) => id === from && a.graph.path[i + 1] === to);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.storyGraph} role="img" aria-label={`Story map: ${a.graph.path.length} scenes visited`}>
      {a.graph.edges.map(([f, t], i) => {
        const A = byId[f];
        const B = byId[t];
        if (!A || !B) return null;
        const taken = onPath(f, t);
        const known = A.visited || A.current;
        return (
          <line
            key={i}
            x1={px(A.x)}
            y1={py(A.y)}
            x2={px(B.x)}
            y2={py(B.y)}
            stroke={taken ? "#c69c58" : known ? "#7b858c" : "#d5cfc4"}
            strokeWidth={taken ? 3.5 : 1.5}
            strokeDasharray={taken ? undefined : "4 4"}
          />
        );
      })}
      {nodes.map((n) => {
        const known = n.visited || n.current;
        const r = n.current ? 11 : 8;
        return (
          <g key={n.id} transform={`translate(${px(n.x)} ${py(n.y)})`}>
            {n.current && <circle r={17} fill="none" stroke="#bc3d3b" strokeWidth={2} className={styles.pulse} />}
            {n.ending ? (
              <polygon points="0,-10 3,-3 10,-3 4.5,2 6.5,9.5 0,5 -6.5,9.5 -4.5,2 -10,-3 -3,-3" fill={known ? "#c69c58" : "#e6e0d4"} stroke="#17232b" strokeWidth={0.8} />
            ) : (
              <circle r={r} fill={n.current ? "#bc3d3b" : n.visited ? "#234c42" : "#e6e0d4"} stroke="#17232b" strokeWidth={0.8} />
            )}
            {!known && !n.ending && (
              <text y={4} fontSize={10} textAnchor="middle" fill="#7b858c">
                ?
              </text>
            )}
            {known && n.place && (
              <text y={-15} fontSize={8.5} textAnchor="middle" fill="#4a5761">
                {n.place.replace("Common Table Food Hall", "Food Hall").replace("Public Reading Library", "Library").replace("Borough Street Market", "Market").replace("South Bank Promenade", "South Bank")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function StoriesApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const setMapFocus = useGame((x) => x.setMapFocus);
  const [leaving, setLeaving] = useState(false);
  const a = s.stories.active;
  return (
    <>
      {a ? (
        <section className={styles.storyCard}>
          <div className={styles.workRow}>
            <span className="tiny">Now playing</span>
            {leaving ? (
              <span className={styles.quotes}>
                <button className="btn small danger" onClick={async () => (await run("LeaveStory", {}, "leave"), setLeaving(false))}>
                  Leave story
                </button>
                <button className="btn small secondary" onClick={() => setLeaving(false)}>
                  Stay
                </button>
              </span>
            ) : (
              <button className={styles.linkBtn} onClick={() => setLeaving(true)}>
                Leave
              </button>
            )}
          </div>
          <h3 style={{ fontSize: 22 }}>{a.title}</h3>
          <StoryGraph a={a} />
          <p className={styles.storyText}>{a.text}</p>
          {!a.here ? (
            <div className={styles.storyGo}>
              <span>
                This scene happens at <strong>{a.locationName}</strong>.
              </span>
              <button
                className="btn small"
                disabled={!!s.journey}
                onClick={() => {
                  setMapFocus(a.location);
                  setSheet("map");
                }}
              >
                {s.journey ? "On your way…" : "Go there"}
              </button>
            </div>
          ) : (
            <ul className={styles.list}>
              {a.choices.map((c) => (
                <li key={c.id}>
                  <button
                    className={styles.storyChoice}
                    disabled={!!c.reason || !!pending || !!s.journey}
                    onClick={async () => {
                      const r = await run("ChooseStory", { choiceId: c.id, nodeId: a.nodeId }, "story");
                      const ending = r && (r as { ending?: string }).ending;
                      if (ending) useFx.getState().push([], [{ title: ending, sub: `You finished “${a.title}”.`, icon: "✦" }]);
                    }}
                  >
                    <strong>{c.label}</strong>
                    <span className={styles.chips}>
                      {c.costPence > 0 && <span className="chip bad">Costs {money(c.costPence)}</span>}
                      {c.chance !== null && (
                        <span className="chip gold">
                          {c.chance}% chance{c.chanceSkill ? ` · ${c.chanceSkill} helps` : ""}
                        </span>
                      )}
                      {c.xp && (
                        <span className="chip">
                          {c.xp.skill} +{c.xp.amount} XP
                        </span>
                      )}
                    </span>
                    {c.reason && <span className={styles.reason}>{c.reason}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="muted">Stories are short adventures across London. Choices matter, some need skills, and every ending pays once.</p>
      )}
      <h3 className={styles.subhead}>Stories</h3>
      <ul className={styles.list}>
        {s.stories.catalogue.map((st) => (
          <li key={st.id} className={styles.workCard}>
            <div className={styles.workRow}>
              <strong>{st.title}</strong>
              {st.completed ? <span className="chip good">✓ {st.endingTitle}</span> : <span className="chip gold">Up to +{st.maxRep} rep · {st.maxStars} ✦</span>}
            </div>
            <p className={styles.actionDesc}>{st.blurb}</p>
            <div className={styles.workRow}>
              <span className="tiny">
                {st.endings} endings{st.completed ? " · replays don't pay again" : ""}
              </span>
              {a?.storyId !== st.id && (
                <button className="btn small" disabled={!!a || !!pending} onClick={() => run("StartStory", { storyId: st.id }, "story")}>
                  {st.completed ? "Replay" : "Start"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {a && <p className="tiny">One story at a time. Closing the phone doesn't end your story.</p>}
    </>
  );
}

export function TreasureApp({ s }: { s: State }) {
  const t = s.treasure;
  return (
    <div className={styles.help}>
      <div className={styles.treasure}>
        <span className={styles.gem} aria-hidden>
          ◆
        </span>
        <div>
          <span className="tiny">Today's clue</span>
          <p className={styles.storyText} style={{ margin: "4px 0" }}>
            “{t.clue}”
          </p>
          <span className="tiny">Hint: somewhere in {t.district}.</span>
        </div>
      </div>
      {t.found ? (
        <p>
          <strong>You found it!</strong> Finder #{t.rank} · {money(t.rewardPence ?? 0)}.
        </p>
      ) : (
        <p className="muted">Travel to the right place and look for the sparkle. The next finder earns {money(t.nextReward)}.</p>
      )}
      <p className="tiny">
        {t.totalFinders} {t.totalFinders === 1 ? "Londoner has" : "Londoners have"} found it today. First finders: {t.firstFinders.length ? t.firstFinders.map((f) => `#${f.rank} ${f.name}`).join(", ") : "nobody yet"}.
      </p>
      <p className="tiny">Rewards: first £50 · 2nd–3rd £25 · 4th–10th £10 · then £3. A new clue appears at midnight, London time.</p>
    </div>
  );
}

/** Small reminder on the main screen while a story is in progress. */
export function StoryPill({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setApp = useGame((x) => x.setPhoneApp);
  const a = s.stories.active;
  if (!a) return null;
  return (
    <button
      className={styles.storyPill}
      onClick={() => {
        setApp("stories");
        setSheet("phone");
      }}
    >
      <span className="tiny">Story · {a.title}</span>
      <strong>{a.here ? "Your move — choose what happens" : `Go to ${a.locationName}`}</strong>
    </button>
  );
}
