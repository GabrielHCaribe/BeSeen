import type { RuleShape } from "./types";

export function minutesLabel(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function describeRule(rule: RuleShape): string {
  return rule.mode === "block" ? "Blocked" : `${minutesLabel(rule.limit_minutes ?? 0)} a day`;
}

// Mirrors the server's rule (supabase/functions/api/routes/rules.ts), which is the one that counts.
export function direction(before: RuleShape, after: RuleShape): "stricter" | "looser" | "same" {
  if (before.mode !== after.mode) return after.mode === "block" ? "stricter" : "looser";
  if (before.mode === "block") return "same";
  if ((after.limit_minutes ?? 0) < (before.limit_minutes ?? 0)) return "stricter";
  if ((after.limit_minutes ?? 0) > (before.limit_minutes ?? 0)) return "looser";
  return "same";
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeUntil(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  if (hours === 0) return `${minutes} min`;
  return minutes === 60 ? `${hours + 1} h` : `${hours} h ${minutes} min`;
}

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

export const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
