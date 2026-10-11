import crypto from "node:crypto";
import { JOB_TEMPLATES, PLAYER_JOBS, jobTemplate } from "@/content/market";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

/**
 * Player jobs board (spec ch. 18). Lifecycle, each step taken by the player whose consent it needs:
 *   posted (poster funds escrow) → applied (worker offers) → hired (poster accepts the worker)
 *   → submitted (worker says it's done) → completed (poster approves; escrow released to the worker).
 * The poster can cancel before hiring (full refund); the worker can withdraw before submitting.
 * Unspent escrow returns to the poster at the deadline; a submitted job the poster ignores is
 * approved automatically after the response window. Escrow only ever moves money that was held.
 */

const OPEN = ["posted", "applied", "hired"];

/**
 * Locks another player's character for a money transfer. Only the id, name and cash are needed by `moveMoney`.
 * Callers lock the other character before any shared row (listing, job) so a transfer can't deadlock
 * against a cancel or withdraw by that player.
 */
export async function lockOtherCharacter(tx: Tx, characterId: string): Promise<CharRow> {
  const r = await tx.query("SELECT id, account_id, name, cash_pence FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
  if (!r.rowCount) throw new GameError("gone", "That player is no longer in London.");
  return { id: r.rows[0].id, account_id: r.rows[0].account_id, name: r.rows[0].name, cash_pence: Number(r.rows[0].cash_pence) } as CharRow;
}

async function jobFor(tx: Tx, jobId: unknown, lock = true) {
  if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new GameError("not_found", "That job doesn't exist.");
  const r = await tx.query(`SELECT * FROM player_jobs WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [jobId]);
  if (!r.rowCount) throw new GameError("not_found", "That job doesn't exist.");
  return r.rows[0];
}

const title = (templateId: string) => jobTemplate(templateId)?.title ?? "A job";

async function refund(tx: Tx, job: Record<string, any>, poster: CharRow, status: "cancelled" | "expired", now: Date) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const e = await tx.query("UPDATE escrow_holds SET status = 'refunded', settled_at = $2 WHERE job_id = $1 AND status = 'held' RETURNING amount_pence", [job.id, now]);
  await tx.query("UPDATE player_jobs SET status = $2, closed_at = $3 WHERE id = $1", [job.id, status, now]);
  if (!e.rowCount) return 0;
  const amount = Number(e.rows[0].amount_pence);
  await moveMoney(tx, poster, amount, "escrow", `Escrow returned: ${title(job.template_id)} (${status})`, { type: "player_job", id: job.id });
  return amount;
}

async function release(tx: Tx, job: Record<string, any>, worker: CharRow, now: Date, auto: boolean) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const e = await tx.query(
    "UPDATE escrow_holds SET status = 'released', payee_id = $3, settled_at = $2 WHERE job_id = $1 AND status = 'held' RETURNING amount_pence",
    [job.id, now, worker.id],
  );
  if (!e.rowCount) throw new GameError("not_held", "That job's payment has already been settled.");
  await tx.query("UPDATE player_jobs SET status = 'completed', closed_at = $2 WHERE id = $1", [job.id, now]);
  const amount = Number(e.rows[0].amount_pence);
  await moveMoney(tx, worker, amount, "player_work", `Paid for: ${title(job.template_id)}${auto ? " (approved automatically)" : ""}`, { type: "player_job", id: job.id });
  await emit(tx, worker.id, "player_job_paid", { template: job.template_id }, now);
  return amount;
}

/** Settles only money owed to this (already locked) character, so no other player's row is ever locked here. */
export async function settleOwnJobs(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const expired = await tx.query(
    "SELECT * FROM player_jobs WHERE poster_id = $1 AND status = ANY($2) AND deadline_at <= $3 ORDER BY created_at FOR UPDATE",
    [c.id, OPEN, now],
  );
  for (const job of expired.rows) {
    const amount = await refund(tx, job, c, "expired", now);
    if (amount) notices.push(`Your job “${title(job.template_id)}” passed its deadline; ${fmtMoney(amount)} came back from escrow.`);
  }
  const responseMs = PLAYER_JOBS.responseHours * 3_600_000;
  const due = await tx.query(
    "SELECT * FROM player_jobs WHERE worker_id = $1 AND status = 'submitted' AND submitted_at <= $2 ORDER BY created_at FOR UPDATE",
    [c.id, new Date(now.getTime() - responseMs)],
  );
  for (const job of due.rows) {
    const amount = await release(tx, job, c, now, true);
    notices.push(`“${title(job.template_id)}” was approved automatically: ${fmtMoney(amount)} paid to you.`);
  }
  return notices;
}

export async function postJob(tx: Tx, accountId: string, p: { templateId: string; payPence: number; hours: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const t = jobTemplate(p.templateId);
  if (!t) throw new GameError("bad_template", "Choose what you need help with.");
  const pay = Number(p.payPence);
  if (!Number.isInteger(pay) || pay < PLAYER_JOBS.minPayPence || pay > PLAYER_JOBS.maxPayPence) {
    throw new GameError("bad_pay", `Offer between ${fmtMoney(PLAYER_JOBS.minPayPence)} and ${fmtMoney(PLAYER_JOBS.maxPayPence)}.`);
  }
  const hours = Number(p.hours);
  if (!(PLAYER_JOBS.deadlineHours as readonly number[]).includes(hours)) throw new GameError("bad_deadline", "Choose how long the job stays open.");
  const open = Number((await tx.query("SELECT count(*) AS n FROM player_jobs WHERE poster_id = $1 AND status IN ('posted','applied','hired','submitted')", [c.id])).rows[0].n);
  if (open >= PLAYER_JOBS.maxOpenPosted) throw new GameError("too_many", `You can have up to ${PLAYER_JOBS.maxOpenPosted} open jobs at once.`);
  const id = crypto.randomUUID();
  await moveMoney(tx, c, -pay, "escrow", `Escrow held: ${t.title}`, { type: "player_job", id });
  await tx.query("INSERT INTO player_jobs (id, poster_id, template_id, pay_pence, status, deadline_at, created_at) VALUES ($1,$2,$3,$4,'posted',$5,$6)", [
    id,
    c.id,
    t.id,
    pay,
    new Date(now.getTime() + hours * 3_600_000),
    now,
  ]);
  await tx.query("INSERT INTO escrow_holds (job_id, payer_id, amount_pence, status, created_at) VALUES ($1,$2,$3,'held',$4)", [id, c.id, pay, now]);
  await emit(tx, c.id, "player_job_posted", { template: t.id }, now);
  return { message: `Posted “${t.title}” for ${fmtMoney(pay)}. The money is held in escrow until you approve the work, or comes back if you cancel or nobody finishes it.`, jobId: id };
}

function open(job: Record<string, any>, now: Date) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (new Date(job.deadline_at) <= now) throw new GameError("expired", "That job's deadline has passed.");
}

export async function applyJob(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.poster_id === c.id) throw new GameError("own_job", "You can't take your own job.");
  open(job, now);
  if (job.status !== "posted") throw new GameError("taken", "Someone has already offered to do that job.");
  const mine = Number((await tx.query("SELECT count(*) AS n FROM player_jobs WHERE worker_id = $1 AND status IN ('applied','hired','submitted')", [c.id])).rows[0].n);
  if (mine >= 3) throw new GameError("too_many", "Finish one of your current jobs first (up to 3 at once).");
  await tx.query("UPDATE player_jobs SET status = 'applied', worker_id = $2 WHERE id = $1", [job.id, c.id]);
  return { message: `You offered to do “${title(job.template_id)}”. The poster needs to accept you before you start.` };
}

export async function hireApplicant(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.poster_id !== c.id) throw new GameError("not_yours", "Only the person who posted the job can accept a worker.");
  open(job, now);
  if (job.status !== "applied") throw new GameError("no_applicant", "Nobody is waiting to be accepted for that job.");
  await tx.query("UPDATE player_jobs SET status = 'hired' WHERE id = $1", [job.id]);
  return { message: `Accepted. They can start “${title(job.template_id)}” now.` };
}

export async function declineApplicant(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.poster_id !== c.id) throw new GameError("not_yours", "Only the person who posted the job can do that.");
  if (job.status !== "applied") throw new GameError("no_applicant", "Nobody is waiting to be accepted for that job.");
  await tx.query("UPDATE player_jobs SET status = 'posted', worker_id = NULL WHERE id = $1", [job.id]);
  return { message: "Declined. The job is open again." };
}

export async function withdrawJob(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.worker_id !== c.id || !["applied", "hired"].includes(job.status)) throw new GameError("not_yours", "You're not doing that job, or it's already been handed in.");
  await tx.query("UPDATE player_jobs SET status = 'posted', worker_id = NULL WHERE id = $1", [job.id]);
  return { message: `You stepped away from “${title(job.template_id)}”. Nothing was paid.` };
}

export async function submitJob(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.worker_id !== c.id) throw new GameError("not_yours", "You're not doing that job.");
  if (job.status !== "hired") throw new GameError("not_hired", job.status === "applied" ? "Wait for the poster to accept you first." : "That job can't be handed in now.");
  open(job, now);
  await tx.query("UPDATE player_jobs SET status = 'submitted', submitted_at = $2 WHERE id = $1", [job.id, now]);
  return { message: `Marked as done. The poster has ${PLAYER_JOBS.responseHours} hours to approve; after that it's approved automatically.` };
}

export async function completeJob(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const peek = await jobFor(tx, p.jobId, false);
  if (peek.poster_id !== c.id) throw new GameError("not_yours", "Only the person who posted the job can approve it.");
  if (peek.status !== "submitted" || !peek.worker_id) throw new GameError("not_submitted", "The worker hasn't marked that job as done yet.");
  // Lock the worker before the job row (same order as the worker's own commands) so the two can't deadlock.
  const worker = await lockOtherCharacter(tx, peek.worker_id);
  const job = await jobFor(tx, p.jobId);
  if (job.status !== "submitted" || job.worker_id !== worker.id) throw new GameError("not_submitted", "That job has already been settled.");
  const amount = await release(tx, job, worker, now, false);
  return { message: `Approved. ${fmtMoney(amount)} released from escrow to ${worker.name}.` };
}

export async function cancelJob(tx: Tx, accountId: string, p: { jobId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const job = await jobFor(tx, p.jobId);
  if (job.poster_id !== c.id) throw new GameError("not_yours", "Only the person who posted the job can cancel it.");
  if (!["posted", "applied"].includes(job.status)) {
    throw new GameError("in_progress", job.status === "hired" || job.status === "submitted" ? "You've accepted a worker, so the job can't be cancelled now. They can step away, or it ends at the deadline." : "That job is already closed.");
  }
  const amount = await refund(tx, job, c, "cancelled", now);
  return { message: `Job cancelled. ${fmtMoney(amount)} returned from escrow.` };
}

export async function playerJobsView(tx: Tx, c: CharRow, now: Date) {
  const map = (r: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: String(r.id),
    templateId: String(r.template_id),
    title: title(r.template_id),
    blurb: jobTemplate(r.template_id)?.blurb ?? "",
    payPence: Number(r.pay_pence),
    status: String(r.status) as "posted" | "applied" | "hired" | "submitted" | "completed" | "cancelled" | "expired",
    poster: String(r.poster_name ?? ""),
    worker: r.worker_name ? String(r.worker_name) : null,
    deadlineAt: new Date(r.deadline_at).toISOString(),
    autoApproveAt: r.submitted_at ? new Date(new Date(r.submitted_at).getTime() + PLAYER_JOBS.responseHours * 3_600_000).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  });
  const base = `SELECT j.*, p.name AS poster_name, w.name AS worker_name FROM player_jobs j
    JOIN characters p ON p.id = j.poster_id LEFT JOIN characters w ON w.id = j.worker_id`;
  const board = (await tx.query(`${base} WHERE j.status = 'posted' AND j.deadline_at > $2 AND j.poster_id <> $1 ORDER BY j.created_at DESC LIMIT 30`, [c.id, now])).rows.map(map);
  const posted = (await tx.query(`${base} WHERE j.poster_id = $1 ORDER BY (j.status IN ('posted','applied','hired','submitted')) DESC, j.created_at DESC LIMIT 15`, [c.id])).rows.map(map);
  const working = (await tx.query(`${base} WHERE j.worker_id = $1 ORDER BY (j.status IN ('applied','hired','submitted')) DESC, j.created_at DESC LIMIT 15`, [c.id])).rows.map(map);
  const held = Number((await tx.query("SELECT COALESCE(SUM(amount_pence),0) AS s FROM escrow_holds WHERE payer_id = $1 AND status = 'held'", [c.id])).rows[0].s);
  return {
    playerJobs: {
      templates: JOB_TEMPLATES.map((t) => ({ ...t })),
      deadlineHours: [...PLAYER_JOBS.deadlineHours],
      minPayPence: PLAYER_JOBS.minPayPence,
      maxPayPence: PLAYER_JOBS.maxPayPence,
      responseHours: PLAYER_JOBS.responseHours,
      escrowHeldPence: held,
      board,
      posted,
      working,
    },
  };
}
