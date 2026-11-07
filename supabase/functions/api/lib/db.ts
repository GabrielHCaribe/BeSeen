import { createClient } from "@supabase/supabase-js";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { safeEqual, sha256 } from "./crypto.ts";

export const db = createClient(env.supabaseUrl, env.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Throws on a database error. supabase-js types every result as nullable; lists are never null on success,
// and callers of maybeSingle() still check for a missing row.
export function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

export type Platform = "ios" | "android" | "macos" | "windows" | "linux";

export interface Device {
  id: string;
  account_id: string;
  platform: Platform;
  name: string | null;
  timezone: string | null;
  push_token: string | null;
  status: Record<string, boolean>;
  last_seen_at: string;
  silent_alerted_at: string | null;
}

export interface Account {
  id: string;
  display_name: string | null;
}

export interface Partner {
  id: string;
  account_id: string;
  name: string;
  status: "invited" | "active" | "ended";
  channel: "email" | "push" | null;
  email: string | null;
  email_pending: string | null;
  partner_account_id: string | null;
  invite_expires_at: string | null;
}

export interface Rule {
  id: string;
  account_id: string;
  device_id: string;
  label: string;
  target_type: "selection" | "app" | "site" | "adult_sites";
  target: string | null;
  mode: "block" | "limit";
  limit_minutes: number | null;
  removed_at: string | null;
}

// The app and its native parts send "x-beseen-device: <device id>.<secret>".
export async function authDevice(req: Request): Promise<Device> {
  const header = req.headers.get("x-beseen-device") ?? "";
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/i.exec(header);
  if (!match) throw new HttpError(401, "Missing device credentials");
  const row = must(await db.from("devices").select("*").eq("id", match[1].toLowerCase()).maybeSingle());
  if (!row || !safeEqual(row.secret_hash, await sha256(match[2]))) throw new HttpError(401, "Unknown device");
  return row as Device;
}

export async function getAccount(id: string): Promise<Account> {
  return must(await db.from("accounts").select("id, display_name").eq("id", id).single()) as Account;
}

export async function livePartner(accountId: string): Promise<Partner | null> {
  return must(
    await db.from("partners").select("*").eq("account_id", accountId).in("status", ["invited", "active"]).maybeSingle(),
  ) as Partner | null;
}
