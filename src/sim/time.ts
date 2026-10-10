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
