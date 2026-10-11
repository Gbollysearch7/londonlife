"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import styles from "./ui.module.css";
import soc from "./social.module.css";

/**
 * Family and Invitations phone apps (spec ch. 19): dating and partners with consent, households,
 * visit and party invitations with real players. The server decides every rule; these screens ask and show.
 */

type Family = State["family"];
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Phone badges: requests and invitations waiting for this player's answer. */
export function familyBadge(app: string, s: State): number {
  if (app === "family") return s.family.romanceRequests.incoming.length;
  if (app === "invitations") return s.family.invitations.incoming.filter((i) => i.status === "pending").length;
  return 0;
}

function Confirm({ text, yes, onYes, onNo, disabled }: { text: string; yes: string; onYes: () => void; onNo: () => void; disabled: boolean }) {
  return (
    <div className={styles.confirm}>
      <span>{text}</span>
      <div>
        <button className="btn small secondary" onClick={onNo}>
          Cancel
        </button>
        <button className="btn small" disabled={disabled} onClick={onYes}>
          {yes}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── Family ─────────────────────────────

export function FamilyApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const f: Family = s.family;
  const r = f.romance;
  const friends = s.social.friends;
  const isMember = f.household?.role === "member";
  const memberIds = new Set((f.household?.members ?? []).map((m) => m.id));
  const asked = new Set(f.romanceRequests.outgoing.map((x) => x.characterId));
  const invitedHome = new Set(f.invitations.outgoing.filter((i) => i.kind === "household").map((i) => i.guestId));

  return (
    <>
      <p className="tiny">Relationships with real players need both people to agree. Getting close comes from days spent together: messages, gifts, visits and parties.</p>

      {f.romanceRequests.incoming.map((q) => (
        <section key={q.id} className={styles.workCard} data-testid="romance-incoming">
          <strong>{q.kind === "date" ? `${q.name} would like to date you` : `${q.name} asked you to be partners`}</strong>
          <span className="tiny">Nothing changes unless you say yes. Expires {when(q.expiresAt)}.</span>
          <div className={styles.workRow}>
            <button className="btn small secondary" disabled={!!pending} onClick={() => run("RespondRomance", { requestId: q.id, accept: false }, "romance")}>
              No, thanks
            </button>
            <button className="btn small" disabled={!!pending} onClick={() => run("RespondRomance", { requestId: q.id, accept: true }, "romance")}>
              Yes
            </button>
          </div>
        </section>
      ))}

      <h3 className={styles.subhead}>Relationship</h3>
      {r ? (
        <section className={styles.workCard} data-testid="romance">
          <div className={styles.workRow}>
            <strong>
              {r.status === "partnered" ? "Partners with" : "Dating"} {r.name}
            </strong>
            <span className="chip good">{r.stage}</span>
          </div>
          <div>
            <div className={styles.workRow}>
              <span className="tiny">Relationship</span>
              <span className="tiny">
                {r.value}/{r.max}
              </span>
            </div>
            <div className={styles.bar}>
              <span style={{ width: `${(r.value / r.max) * 100}%` }} />
            </div>
          </div>
          <span className="tiny">
            Together since {when(r.since)}. {r.status === "dating" && !r.canPropose ? `Partners becomes possible at ${f.rules.partnerMinValue}.` : ""}
          </span>
          {r.canPropose && (
            <button className="btn small" disabled={!!pending} onClick={() => run("ProposePartnership", { characterId: r.characterId }, "propose")}>
              Ask {r.name} to be partners
            </button>
          )}
          {confirm === "end" ? (
            <Confirm
              text={`Stop being ${r.status === "partnered" ? "partners" : "dating"} with ${r.name}? You'll still be friends, and nothing else changes: no money, home or household is affected.`}
              yes="End it"
              disabled={!!pending}
              onNo={() => setConfirm(null)}
              onYes={async () => {
                if (await run("EndRelationship", { characterId: r.characterId, confirm: true }, "end")) setConfirm(null);
              }}
            />
          ) : (
            <button className="btn small secondary" onClick={() => setConfirm("end")}>
              End relationship…
            </button>
          )}
        </section>
      ) : (
        <p className="tiny">
          You&apos;re single. Once you and a friend are {f.rules.dateMinTitle}s ({f.rules.dateMinPoints}+ friendship), either of you can ask the other to date.
        </p>
      )}
      {f.romanceRequests.outgoing.map((q) => (
        <div key={q.id} className={styles.workRow}>
          <span className="tiny">
            Waiting for {q.name} ({q.kind === "date" ? "date" : "partners"})
          </span>
          <button className="btn small secondary" disabled={!!pending} onClick={() => run("WithdrawRomance", { requestId: q.id }, "withdraw")}>
            Withdraw
          </button>
        </div>
      ))}

      <h3 className={styles.subhead}>Household</h3>
      {f.household ? (
        <section className={styles.workCard} data-testid="household">
          <strong>{f.household.role === "owner" ? "Your household" : `${f.household.owner.name}'s household`}</strong>
          <span className="tiny">
            Members can visit and use the home&apos;s bed, shower, bathroom and hob with their own groceries. They can never sell or move furniture, spend the owner&apos;s money or read the owner&apos;s messages.
          </span>
          <ul className={styles.list}>
            {f.household.role === "member" && <li className="tiny">Owner: {f.household.owner.name}</li>}
            {f.household.members.map((m) => (
              <li key={m.id} className={styles.workRow}>
                <span>{m.name}</span>
                {f.household!.role === "owner" &&
                  (confirm === `remove:${m.id}` ? (
                    <Confirm
                      text={`Remove ${m.name} from your household? You'll still be friends.`}
                      yes="Remove"
                      disabled={!!pending}
                      onNo={() => setConfirm(null)}
                      onYes={async () => {
                        if (await run("RemoveHouseholdMember", { characterId: m.id }, "remove")) setConfirm(null);
                      }}
                    />
                  ) : (
                    <button className="btn small secondary" onClick={() => setConfirm(`remove:${m.id}`)}>
                      Remove
                    </button>
                  ))}
              </li>
            ))}
          </ul>
          {isMember &&
            (confirm === "leave" ? (
              <Confirm
                text={`Leave ${f.household.owner.name}'s household? You'll still be friends.`}
                yes="Leave"
                disabled={!!pending}
                onNo={() => setConfirm(null)}
                onYes={async () => {
                  if (await run("LeaveHousehold", {}, "leave")) setConfirm(null);
                }}
              />
            ) : (
              <button className="btn small secondary" onClick={() => setConfirm("leave")}>
                Leave household…
              </button>
            ))}
        </section>
      ) : (
        <p className="tiny">
          Invite a partner, or a friend who is at least a {f.rules.householdMinTitle}, to share your home (up to {f.rules.householdMax} members). A household is separate from romance.
        </p>
      )}

      <h3 className={styles.subhead}>Friends</h3>
      {friends.length === 0 && <p className="tiny">Make friends with players from People first.</p>}
      <ul className={styles.list}>
        {friends.map((fr) => {
          const together = r?.characterId === fr.id;
          const canDate = !r && fr.points >= f.rules.dateMinPoints && !asked.has(fr.id);
          const canHouse = !isMember && !memberIds.has(fr.id) && !invitedHome.has(fr.id) && (fr.points >= f.rules.householdMinPoints || together);
          return (
            <li key={fr.id} className={styles.workCard}>
              <div className={styles.workRow}>
                <strong>{fr.name}</strong>
                <span className="chip">
                  {together ? (r!.status === "partnered" ? "Partner" : "Dating") : fr.title} · {fr.points}
                </span>
              </div>
              <div className={styles.workRow}>
                {canDate && (
                  <button className="btn small" disabled={!!pending} onClick={() => run("AskToDate", { characterId: fr.id }, "date")}>
                    Ask to date
                  </button>
                )}
                {canHouse && (
                  <button className="btn small secondary" disabled={!!pending} onClick={() => run("InviteToHousehold", { characterId: fr.id }, "household")}>
                    Invite to household
                  </button>
                )}
                {!canDate && !canHouse && <span className="tiny">{memberIds.has(fr.id) ? "In your household" : "Spend more days together to get closer."}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className={styles.subhead}>Not built yet</h3>
      <ul className={styles.list}>
        {f.notBuilt.map((n) => (
          <li key={n.name} className={`${styles.workCard} ${styles.appLocked}`}>
            <strong>{n.name}</strong>
            <span className="tiny">{n.why}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ───────────────────────────── Invitations ─────────────────────────────

const KIND: Record<string, string> = { visit: "Come round", household: "Join my household", party: "House party" };

export function InvitationsApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const f = s.family;
  const party = f.party.open;
  const busy = !!pending || !!s.journey || !!s.shift || !!s.activity;
  const invitedTo = (kind: string) => new Set(f.invitations.outgoing.filter((i) => i.kind === kind).map((i) => i.guestId));
  const visitInvited = invitedTo("visit");
  const partyInvited = invitedTo("party");

  return (
    <>
      <p className="tiny">Invitations go to friends who are real players. They decide; you can revoke an invitation any time, which also ends a visit it started.</p>

      <h3 className={styles.subhead}>For you</h3>
      {f.invitations.incoming.length === 0 && <p className="tiny">No invitations right now.</p>}
      <ul className={styles.list}>
        {f.invitations.incoming.map((i) => (
          <li key={i.id} className={styles.workCard} data-testid={`invite-${i.kind}`}>
            <div className={styles.workRow}>
              <strong>
                {KIND[i.kind]} · {i.hostName}
              </strong>
              <span className="chip">{i.status === "accepted" ? (i.joined ? "Joined" : "Going") : `until ${clock(i.expiresAt)}`}</span>
            </div>
            {i.kind === "party" && (
              <span className="tiny">
                Join from wherever you are: you&apos;ll pop round to {i.hostName}&apos;s home. First join: Social +{f.party.guestReward.social}, Fun +{f.party.guestReward.fun}. Up to {f.rules.partyCap} guests.
              </span>
            )}
            {i.kind === "household" && <span className="tiny">You could use their bed, shower and hob with your own groceries. You&apos;d never see their money or messages.</span>}
            <div className={styles.workRow}>
              {i.status === "pending" && (
                <button className="btn small secondary" disabled={!!pending} onClick={() => run("RespondInvitation", { invitationId: i.id, accept: false }, "invite")}>
                  Decline
                </button>
              )}
              {i.kind === "party" ? (
                <button className="btn small" disabled={busy} onClick={() => run("JoinParty", { invitationId: i.id }, "join")} title={busy ? "Finish what you're doing first" : undefined}>
                  {i.joined ? "Rejoin party" : "Join party"}
                </button>
              ) : (
                i.status === "pending" && (
                  <button className="btn small" disabled={i.kind === "visit" ? busy : !!pending} onClick={() => run("RespondInvitation", { invitationId: i.id, accept: true }, "invite")}>
                    {i.kind === "visit" ? "Go round" : "Accept"}
                  </button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3 className={styles.subhead}>Your party</h3>
      {party ? (
        <section className={styles.workCard} data-testid="player-party">
          <div className={styles.workRow}>
            <strong>Party open until {clock(party.endsAt)}</strong>
            <span className="chip good">
              {party.guestCount}/{party.capacity} guests
            </span>
          </div>
          {party.guests.length > 0 && <span className="tiny">Here: {party.guests.map((g) => g.name).join(", ")}</span>}
          <button className="btn small secondary" disabled={!!pending} onClick={() => run("EndParty", {}, "party")}>
            End party
          </button>
        </section>
      ) : (
        <section className={styles.workCard}>
          <span className="tiny">Throw a house party at home (tap your speakers), then open it so friends can join from anywhere.</span>
          <button className="btn small" disabled={!!pending || !f.party.canOpen} onClick={() => run("OpenParty", {}, "party")}>
            Open my party to friends
          </button>
          {!f.party.canOpen && f.party.reason && <p className={styles.reason}>{f.party.reason}</p>}
        </section>
      )}

      <h3 className={styles.subhead}>Invite friends</h3>
      {s.social.friends.length === 0 && <p className="tiny">Make friends with players from People first.</p>}
      <ul className={styles.list}>
        {s.social.friends.map((fr) => (
          <li key={fr.id} className={styles.workRow}>
            <span>
              <span className={`${soc.socDot} ${fr.online ? soc.socOnline : ""}`} aria-label={fr.online ? "Online now" : "Offline"} /> {fr.name}
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="btn small secondary" disabled={!!pending || visitInvited.has(fr.id)} onClick={() => run("InviteToVisit", { characterId: fr.id }, "invite")}>
                {visitInvited.has(fr.id) ? "Invited round" : "Invite round"}
              </button>
              {party && (
                <button className="btn small" disabled={!!pending || partyInvited.has(fr.id)} onClick={() => run("InviteToParty", { characterId: fr.id }, "invite")}>
                  {partyInvited.has(fr.id) ? "Invited" : "Invite to party"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {f.invitations.outgoing.length > 0 && (
        <>
          <h3 className={styles.subhead}>Sent</h3>
          <ul className={styles.list}>
            {f.invitations.outgoing.map((i) => (
              <li key={i.id} className={styles.workRow}>
                <span className="tiny">
                  {KIND[i.kind]} → {i.guestName} · {i.status === "accepted" ? (i.kind === "party" ? (i.joined ? "joined" : "going") : "visiting now") : `until ${clock(i.expiresAt)}`}
                </span>
                {!(i.kind === "household" && i.status === "accepted") && (
                  <button className="btn small secondary" disabled={!!pending} onClick={() => run("RevokeInvitation", { invitationId: i.id }, "revoke")}>
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {s.social.visitors.length > 0 && (
        <>
          <h3 className={styles.subhead}>At your home now</h3>
          <ul className={styles.list}>
            {s.social.visitors.map((v) => (
              <li key={v.id} className={styles.workRow}>
                <span>{v.name}</span>
                <button className="btn small secondary" disabled={!!pending} onClick={() => run("EndGuestVisit", { characterId: v.id }, "visit")}>
                  Ask to leave
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ───────────────────────────── visit extras ─────────────────────────────

/** Shown under the visit bar: what a household member may use at the owner's home. */
export function HostHomePanel({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const h = s.family?.hostHome;
  if (!h || s.social?.visit?.hostId !== h.hostId) return null;
  return (
    <div className={soc.socVisitBar} role="region" aria-label={`Use ${h.hostName}'s home`}>
      <strong>Household: use {h.hostName}&apos;s home</strong>
      <span className="tiny">Your own groceries, energy and wallet; their appliances.</span>
      {h.actions.filter((a) => a.available || !a.id.startsWith("cook_")).map((a) => (
        <button
          key={a.id}
          className="btn small secondary"
          disabled={!!pending || !a.available}
          title={a.reason ?? undefined}
          onClick={() => run("UseHostHome", { activityId: a.id }, "use")}
        >
          {a.label} · {a.minutes} min
        </button>
      ))}
    </div>
  );
}
