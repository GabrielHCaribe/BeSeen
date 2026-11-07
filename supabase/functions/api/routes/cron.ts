import { env } from "../lib/env.ts";
import { db, must } from "../lib/db.ts";
import { HttpError, json } from "../lib/http.ts";
import { safeEqual } from "../lib/crypto.ts";
import { recordEvent, sendPing } from "../notify.ts";

// Called every 10 minutes by pg_cron (see supabase/setup_cron.sql).
export async function tick(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!env.cronSecret || !safeEqual(secret, env.cronSecret)) throw new HttpError(401, "Unauthorized");

  const pinged = await pingQuietDevices();
  const silent = await alertSilentDevices();
  const summaries = await summarizeAttempts();
  return json({ pinged, silent, summaries });
}

// Halfway to the silence threshold, wake the app with a silent push so a sleeping-but-healthy phone checks in.
async function pingQuietDevices() {
  const cutoff = new Date(Date.now() - (env.silenceHours / 2) * 3_600_000).toISOString();
  const devices = must(
    await db.from("devices").select("id, push_token").lt("last_seen_at", cutoff).is("ping_sent_at", null)
      .is("silent_alerted_at", null).not("push_token", "is", null).limit(200),
  ) as { id: string; push_token: string }[];
  for (const device of devices) {
    await sendPing(device);
    must(await db.from("devices").update({ ping_sent_at: new Date().toISOString() }).eq("id", device.id));
  }
  return devices.length;
}

// The dead man's switch: an app can't report its own deletion, so silence is the signal.
async function alertSilentDevices() {
  const cutoff = new Date(Date.now() - env.silenceHours * 3_600_000).toISOString();
  const devices = must(
    await db.from("devices").select("id, account_id, last_seen_at").lt("last_seen_at", cutoff)
      .is("silent_alerted_at", null).limit(200),
  ) as { id: string; account_id: string; last_seen_at: string }[];
  for (const device of devices) {
    // Mark first so a slow delivery can't cause a second alert on the next tick.
    must(await db.from("devices").update({ silent_alerted_at: new Date().toISOString() }).eq("id", device.id));
    const hours = Math.floor((Date.now() - Date.parse(device.last_seen_at)) / 3_600_000);
    await recordEvent(device.account_id, device.id, "device_silent", { hours, last_seen_at: device.last_seen_at });
  }
  return devices.length;
}

// Throttled attempts become one "tried N more times" message once the hour since the last alert has passed.
async function summarizeAttempts() {
  const waiting = must(
    await db.from("events").select("id, account_id, device_id, payload").eq("type", "blocked_attempt")
      .eq("notify_status", "suppressed").limit(1000),
  ) as { id: string; account_id: string; device_id: string | null; payload: { rule_id?: string; label?: string } }[];

  const groups = new Map<string, typeof waiting>();
  for (const e of waiting) {
    const key = `${e.account_id}|${e.payload.rule_id ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  let sent = 0;
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  for (const events of groups.values()) {
    const first = events[0];
    const recent = must(
      await db.from("events").select("id").eq("account_id", first.account_id).in("type", [
        "blocked_attempt",
        "blocked_summary",
      ])
        .eq("payload->>rule_id", first.payload.rule_id ?? "").eq("notify_status", "sent").gte("received_at", hourAgo)
        .limit(1),
    );
    if (recent.length) continue;
    must(await db.from("events").update({ notify_status: "summarized" }).in("id", events.map((e) => e.id)));
    await recordEvent(first.account_id, first.device_id, "blocked_summary", {
      rule_id: first.payload.rule_id,
      label: first.payload.label,
      count: events.length,
    });
    sent++;
  }
  return sent;
}
