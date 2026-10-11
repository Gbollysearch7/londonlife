/** London calendar helpers. Timers use UTC instants; daily periods use Europe/London dates. */

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Period key for the London calendar day containing `at`, e.g. "2026-10-10". */
export function londonDayKey(at: Date): string {
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function londonClock(at: Date): string {
  return at.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
}

export function londonHour(at: Date): number {
  return Number(at.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })) % 24;
}

/**
 * Development-only acceleration of activity and journey durations (spec 7.2).
 * Ignored in production so a demo setting can never ship.
 */
export function timeScale(): number {
  // The standalone test build sets this explicitly at build time and labels it in the UI.
  const testBuild = Number(process.env.LL_TEST_BUILD_TIME_SCALE ?? "");
  if (testBuild >= 1) return testBuild;
  if (process.env.NODE_ENV === "production") return 1;
  const v = Number(process.env.LL_TIME_SCALE ?? "1");
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

export function durationMs(minutes: number, scale = timeScale()): number {
  return Math.round((minutes * 60_000) / scale);
}

/** Minutes that London is ahead of UTC at an instant (0 in winter, 60 in summer). */
function londonOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** The instant of `hour`:00 London time on a London calendar day ("YYYY-MM-DD"). DST-safe. */
export function londonInstant(dayKey: string, hour: number): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour));
  return new Date(guess.getTime() - londonOffsetMinutes(guess) * 60000);
}

/** The first `isoWeekday` (1 = Monday) at `hour`:00 London time strictly after `after`. */
export function nextLondonWeekly(after: Date, isoWeekday: number, hour: number): Date {
  for (let i = 0; i <= 8; i++) {
    const day = londonDayKey(new Date(after.getTime() + i * 86_400_000));
    const at = londonInstant(day, hour);
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
    if (wd === isoWeekday && at.getTime() > after.getTime()) return at;
  }
  throw new Error("unreachable");
}
