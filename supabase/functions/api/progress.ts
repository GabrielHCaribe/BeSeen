import { db, must } from "./lib/db.ts";

// Events that break a streak. A blocked attempt doesn't: closing the shield is the user holding the line.
const SLIPS = ["limit_exceeded", "rule_loosened", "rule_removed", "permission_revoked", "uninstall_started"];
const DAY_MS = 86_400_000;

export interface Progress {
  started_at: string;
  streak_days: number; // days kept in a row, counting today unless today has a slip
  best_days: number;
  slipped_today: boolean;
  resisted_today: number;
  resisted_total: number;
  week: { date: string; state: "kept" | "slipped" | "today" | "before" }[]; // oldest first, ends today
}

// Calendar date ("2026-11-08") in the phone's time zone, so a day ends at the user's midnight.
function localDate(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export async function progress(accountId: string, startedAt: string, zone: string | null): Promise<Progress> {
  let timeZone = zone ?? "UTC";
  try {
    localDate(new Date(), timeZone);
  } catch {
    timeZone = "UTC";
  }

  // Two days of attempts covers "today" in every time zone; only the ones on the user's today are counted.
  const [slipRows, recentAttempts, attemptsTotal] = await Promise.all([
    db.from("events").select("occurred_at").eq("account_id", accountId).in("type", SLIPS)
      .order("occurred_at", { ascending: false }).limit(500),
    db.from("events").select("occurred_at").eq("account_id", accountId).eq("type", "blocked_attempt")
      .gte("occurred_at", new Date(Date.now() - 2 * DAY_MS).toISOString()).limit(1000),
    db.from("events").select("id", { count: "exact", head: true }).eq("account_id", accountId)
      .eq("type", "blocked_attempt"),
  ]);
  if (attemptsTotal.error) throw new Error(attemptsTotal.error.message);

  const today = localDate(new Date(), timeZone);
  const start = localDate(startedAt, timeZone);
  const slipDays = [...new Set(must(slipRows).map((r: { occurred_at: string }) => localDate(r.occurred_at, timeZone)))];
  const slipped = new Set(slipDays);

  const resistedToday = must(recentAttempts).filter((r: { occurred_at: string }) =>
    localDate(r.occurred_at, timeZone) === today
  ).length;

  // A run is the kept days after one slip up to the next; the first run starts on (and includes) day one.
  const streak = slipDays.length ? daysBetween(slipDays[0], today) : daysBetween(start, today) + 1;
  let best = streak;
  let previous: string | null = null;
  for (const day of [...slipDays].reverse()) {
    best = Math.max(best, previous ? daysBetween(previous, day) - 1 : daysBetween(start, day));
    previous = day;
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(today, i - 6);
    const state = slipped.has(date) ? "slipped" : date === today ? "today" : date < start ? "before" : "kept";
    return { date, state } as Progress["week"][number];
  });

  return {
    started_at: startedAt,
    streak_days: streak,
    best_days: best,
    slipped_today: slipped.has(today),
    resisted_today: resistedToday,
    resisted_total: attemptsTotal.count ?? 0,
    week,
  };
}
