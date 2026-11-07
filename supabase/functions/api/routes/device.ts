import { env } from "../lib/env.ts";
import { authDevice, db, type Device, getAccount, livePartner, must, type Platform } from "../lib/db.ts";
import { HttpError, json, readJson, requireString } from "../lib/http.ts";
import { randomToken, sha256 } from "../lib/crypto.ts";
import { recordEvent } from "../notify.ts";

const PLATFORMS: Platform[] = ["ios", "android", "macos", "windows", "linux"];

// Permissions whose loss means rules stop being enforced. Turning one off tells the partner.
const CRITICAL: Record<Platform, string[]> = {
  ios: ["screen_time"],
  android: ["accessibility", "usage_access"],
  macos: [],
  windows: [],
  linux: [],
};

// No sign-up: the first launch creates an anonymous account and a device secret.
export async function register(req: Request) {
  const body = await readJson<{ platform?: string; name?: string; app_version?: string; timezone?: string }>(req);
  if (!PLATFORMS.includes(body.platform as Platform)) throw new HttpError(400, "Unknown platform");
  const account = must(await db.from("accounts").insert({}).select("id").single());
  const secret = randomToken(32);
  const device = must(
    await db
      .from("devices")
      .insert({
        account_id: account.id,
        secret_hash: await sha256(secret),
        platform: body.platform,
        name: typeof body.name === "string" ? body.name.slice(0, 80) : null,
        app_version: typeof body.app_version === "string" ? body.app_version.slice(0, 40) : null,
        timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null,
      })
      .select("id")
      .single(),
  );
  return json({ account_id: account.id, device_id: device.id, device_secret: secret });
}

export async function state(req: Request) {
  const device = await authDevice(req);
  must(await db.rpc("apply_due_rule_changes", { p_account: device.account_id }));

  const [account, partner, rules, pending, partnerOf] = await Promise.all([
    getAccount(device.account_id),
    livePartner(device.account_id),
    db.from("rules").select("*").eq("device_id", device.id).is("removed_at", null).order("created_at"),
    db.from("rule_changes").select("*").eq("account_id", device.account_id).is("applied_at", null).is(
      "cancelled_at",
      null,
    ),
    db.from("partners").select("id, account_id").eq("partner_account_id", device.account_id).eq("status", "active"),
  ]);

  const pendingByRule = new Map(must(pending).map((c: { rule_id: string }) => [c.rule_id, c]));
  const supporting = await Promise.all(
    must(partnerOf).map(async (p: { id: string; account_id: string }) => {
      const [user, alerts] = await Promise.all([
        getAccount(p.account_id),
        db.from("deliveries").select("title, body, created_at").eq("partner_id", p.id).order("created_at", {
          ascending: false,
        }).limit(20),
      ]);
      return { id: p.id, user_name: user.display_name ?? "Someone", alerts: must(alerts) };
    }),
  );

  return json({
    server_time: new Date().toISOString(),
    cooldown_hours: env.cooldownHours,
    me: { display_name: account.display_name },
    partner: partner
      ? {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        channel: partner.channel,
        invite_expires_at: partner.invite_expires_at,
      }
      : null,
    rules: must(rules).map((r: Record<string, unknown>) => {
      const change = pendingByRule.get(r.id as string) as Record<string, unknown> | undefined;
      return {
        id: r.id,
        label: r.label,
        target_type: r.target_type,
        target: r.target,
        mode: r.mode,
        limit_minutes: r.limit_minutes,
        pending: change
          ? { id: change.id, kind: change.kind, after: change.after, effective_at: change.effective_at }
          : null,
      };
    }),
    partner_of: supporting,
  });
}

function cleanStatus(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "boolean" && /^[a-z_]{1,40}$/.test(key)) out[key] = value;
    }
  }
  return out;
}

async function hasActiveAdultRule(device: Device) {
  const rows = must(
    await db.from("rules").select("id").eq("device_id", device.id).eq("target_type", "adult_sites").is(
      "removed_at",
      null,
    ).limit(1),
  );
  return rows.length > 0;
}

export async function heartbeat(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ status?: unknown; source?: string; app_version?: string; timezone?: string }>(req);
  const previous = device.status ?? {};
  const next = cleanStatus(body.status);

  const update: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    status: { ...previous, ...next },
    ping_sent_at: null,
  };
  if (typeof body.app_version === "string") update.app_version = body.app_version.slice(0, 40);
  if (typeof body.timezone === "string") update.timezone = body.timezone.slice(0, 64);
  if (device.silent_alerted_at) update.silent_alerted_at = null;
  must(await db.from("devices").update(update).eq("id", device.id));

  if (device.silent_alerted_at) {
    await recordEvent(device.account_id, device.id, "device_back", { silent_since: device.silent_alerted_at });
  }

  const watched = [...CRITICAL[device.platform]];
  if (device.platform === "android" && (await hasActiveAdultRule(device))) watched.push("adult_filter");
  for (const permission of watched) {
    if (previous[permission] === true && next[permission] === false) {
      await recordEvent(device.account_id, device.id, "permission_revoked", { permission });
    } else if (previous[permission] === false && next[permission] === true) {
      await recordEvent(device.account_id, device.id, "permission_restored", { permission });
    }
  }
  return json({ ok: true });
}

// Events the phone itself detects. Labels and limits are read from the server's copy of the rule,
// so the phone can't change what the partner is told.
const DEVICE_EVENT_TYPES = new Set(["limit_exceeded", "blocked_attempt", "uninstall_started", "reinstalled"]);

interface IncomingEvent {
  id?: string;
  type?: string;
  occurred_at?: string;
  payload?: { rule_id?: string };
}

export async function events(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ events?: IncomingEvent[] }>(req);
  const incoming = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
  let accepted = 0;

  for (const e of incoming) {
    if (typeof e.id !== "string" || !DEVICE_EVENT_TYPES.has(e.type ?? "")) continue;
    const occurredAt = typeof e.occurred_at === "string" && !isNaN(Date.parse(e.occurred_at))
      ? new Date(e.occurred_at).toISOString()
      : undefined;
    const payload: Record<string, unknown> = {};

    const ruleId = e.payload?.rule_id;
    if (typeof ruleId === "string") {
      const rule = must(
        await db.from("rules").select("id, label, limit_minutes").eq("id", ruleId).eq("device_id", device.id)
          .maybeSingle(),
      );
      if (rule) {
        payload.rule_id = rule.id;
        payload.label = rule.label;
        if (rule.limit_minutes) payload.limit_minutes = rule.limit_minutes;
      }
    }

    if (e.type === "reinstalled") {
      // iOS forgets the picked apps on uninstall, so those rules can't be enforced any more.
      const lost = must(
        await db.from("rules").update({ removed_at: new Date().toISOString() }).eq("device_id", device.id)
          .eq("target_type", "selection").is("removed_at", null).select("id"),
      );
      if (lost.length) {
        must(
          await db.from("rule_changes").update({ cancelled_at: new Date().toISOString() })
            .in("rule_id", lost.map((r: { id: string }) => r.id)).is("applied_at", null).is("cancelled_at", null),
        );
      }
      payload.rules_reset = lost.length;
    }

    const row = await recordEvent(device.account_id, device.id, e.type!, payload, {
      clientEventId: e.id.slice(0, 64),
      occurredAt,
    });
    if (row) accepted++;
  }
  return json({ accepted, received: incoming.length });
}

export async function pushToken(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ token?: string | null }>(req);
  const token = body.token === null ? null : requireString(body.token, "token", 300);
  must(await db.from("devices").update({ push_token: token }).eq("id", device.id));
  return json({ ok: true });
}
