import { env } from "./lib/env.ts";
import { db, getAccount, must, type Partner } from "./lib/db.ts";
import { signedToken } from "./lib/crypto.ts";
import { emailHtml, escapeHtml, type Message, renderMessage } from "./messages.ts";

// deno-lint-ignore no-explicit-any
type Payload = Record<string, any>;

export interface EventRow {
  id: string;
  account_id: string;
  device_id: string | null;
  type: string;
  payload: Payload;
  received_at: string;
}

// Repeated attempts on the same blocked app: first alert right away, then one summary an hour (see cron).
// limit_exceeded only needs protection from duplicates; the phone already sends it once per rule per day.
const THROTTLE_MINUTES: Record<string, number> = { blocked_attempt: 60, limit_exceeded: 60 };

export async function recordEvent(
  accountId: string,
  deviceId: string | null,
  type: string,
  payload: Payload,
  options: { clientEventId?: string; occurredAt?: string; partner?: Partner } = {},
): Promise<EventRow | null> {
  const row = {
    account_id: accountId,
    device_id: deviceId,
    type,
    payload,
    client_event_id: options.clientEventId ?? null,
    occurred_at: options.occurredAt ?? new Date().toISOString(),
  };
  const inserted = must(
    await db
      .from("events")
      .upsert(row, { onConflict: "device_id,client_event_id", ignoreDuplicates: true })
      .select("id, account_id, device_id, type, payload, received_at"),
  ) as EventRow[];
  if (!inserted.length) return null; // duplicate from a retried upload
  await dispatch(inserted[0], options.partner);
  return inserted[0];
}

async function setStatus(eventId: string, status: string) {
  must(await db.from("events").update({ notify_status: status }).eq("id", eventId));
}

async function sentRecently(event: EventRow, types: string[], windowMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const rows = must(
    await db
      .from("events")
      .select("id")
      .eq("account_id", event.account_id)
      .in("type", types)
      .eq("payload->>rule_id", String(event.payload.rule_id ?? ""))
      .eq("notify_status", "sent")
      .gte("received_at", since)
      .neq("id", event.id)
      .limit(1),
  );
  return rows.length > 0;
}

async function timezoneFor(event: EventRow): Promise<string | null> {
  const query = db.from("devices").select("timezone").eq("account_id", event.account_id);
  const rows = must(
    await (event.device_id ? query.eq("id", event.device_id) : query.order("last_seen_at", { ascending: false })).limit(
      1,
    ),
  );
  return rows[0]?.timezone ?? null;
}

export async function dispatch(event: EventRow, partnerOverride?: Partner): Promise<void> {
  const partner = partnerOverride ??
    (must(
      await db.from("partners").select("*").eq("account_id", event.account_id).eq("status", "active").maybeSingle(),
    ) as Partner | null);
  if (!partner) return setStatus(event.id, "no_partner");

  const window = THROTTLE_MINUTES[event.type];
  if (window && event.payload.rule_id) {
    const related = event.type === "blocked_attempt" ? ["blocked_attempt", "blocked_summary"] : [event.type];
    if (await sentRecently(event, related, window)) {
      return setStatus(event.id, event.type === "blocked_attempt" ? "suppressed" : "skipped");
    }
  }

  const account = await getAccount(event.account_id);
  const message = renderMessage(
    event.type,
    event.payload,
    account.display_name ?? "Your friend",
    await timezoneFor(event),
  );
  const ok = await deliver(partner, message, account.display_name ?? "Your friend", event.id);
  await setStatus(event.id, ok ? "sent" : "failed");
}

async function deliver(partner: Partner, message: Message, userName: string, eventId: string | null): Promise<boolean> {
  let ok = false;
  let error: string | null = null;
  try {
    if (partner.channel === "email" && partner.email) {
      const stopUrl = `${env.webBaseUrl}/stop?t=${encodeURIComponent(await signedToken("stop", partner.id))}`;
      const html = emailHtml(
        message.title,
        [message.body],
        `You get these because ${escapeHtml(userName)} chose you as their accountability partner on BeSeen. ` +
          `<a href="${escapeHtml(stopUrl)}" style="color:#78716c">Stop these alerts</a>`,
      );
      ok = await sendEmail(
        partner.email,
        message.title,
        html,
        `${message.body}\n\nStop these alerts: ${stopUrl}`,
        partner.id,
      );
    } else if (partner.channel === "push" && partner.partner_account_id) {
      ok = await pushToAccount(partner.partner_account_id, message, { type: "alert" });
    } else {
      error = "Partner has no delivery channel";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  must(
    await db.from("deliveries").insert({
      event_id: eventId,
      partner_id: partner.id,
      channel: partner.channel ?? "push",
      title: message.title,
      body: message.body,
      status: ok ? "sent" : "failed",
      error: ok ? null : error ?? "Delivery failed",
    }),
  );
  return ok;
}

export async function sendEmail(to: string, subject: string, html: string, text: string, stopPartnerId?: string) {
  if (!env.resendKey || !env.emailFrom) {
    console.warn("RESEND_API_KEY or EMAIL_FROM not set; email skipped");
    return false;
  }
  const headers: Record<string, string> = {};
  if (stopPartnerId) {
    // One-click unsubscribe (RFC 8058) so mail apps show "Unsubscribe" instead of people hitting "Report spam".
    headers["List-Unsubscribe"] = `<${env.apiBaseUrl}/public/stop?t=${
      encodeURIComponent(await signedToken("stop", stopPartnerId))
    }>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text, headers }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}

interface PushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Payload;
  sound?: string;
  priority?: "default" | "normal" | "high";
  _contentAvailable?: boolean;
}

async function sendPush(deviceRows: { id: string; push_token: string }[], build: (token: string) => PushMessage) {
  if (!deviceRows.length) return false;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
    },
    body: JSON.stringify(deviceRows.map((d) => build(d.push_token))),
  });
  if (!res.ok) {
    console.error("Expo push error", res.status, await res.text());
    return false;
  }
  const tickets: { status: string; details?: { error?: string } }[] = (await res.json()).data ?? [];
  let anyOk = false;
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i].status === "ok") anyOk = true;
    else if (tickets[i].details?.error === "DeviceNotRegistered") {
      await db.from("devices").update({ push_token: null }).eq("id", deviceRows[i].id);
    }
  }
  return anyOk;
}

async function pushTargets(accountId: string) {
  return must(
    await db.from("devices").select("id, push_token").eq("account_id", accountId).not("push_token", "is", null),
  ) as { id: string; push_token: string }[];
}

export async function pushToAccount(accountId: string, message: Message, data: Payload): Promise<boolean> {
  return sendPush(await pushTargets(accountId), (to) => ({
    to,
    title: message.title,
    body: message.body,
    data,
    sound: "default",
    priority: "high",
  }));
}

// Messages for the BeSeen user themself (not their partner), e.g. "Alex accepted".
export async function notifyOwner(accountId: string, title: string, body: string) {
  await pushToAccount(accountId, { title, body }, { type: "owner" });
}

// A silent push that wakes the app so it can check in before we tell anyone it went quiet.
export function sendPing(device: { id: string; push_token: string }) {
  return sendPush([device], (to) => ({ to, data: { type: "ping" }, _contentAvailable: true, priority: "normal" }));
}

export function sendConfirmEmail(to: string, userName: string, confirmUrl: string) {
  const title = `Confirm you'll be ${userName}'s accountability partner`;
  const paragraphs = [
    `${userName} asked you to be their accountability partner on BeSeen, an app that helps people stick to phone limits they set for themselves.`,
    `If you confirm, you'll get a short email when ${userName} goes over a limit, tries to open something they blocked, loosens a rule, or switches BeSeen off. Never screenshots or browsing history.`,
  ];
  const html = emailHtml(title, paragraphs, "If you didn't expect this, ignore this email and nothing will happen.", {
    href: confirmUrl,
    text: "Confirm",
  });
  return sendEmail(to, title, html, `${paragraphs.join("\n\n")}\n\nConfirm: ${confirmUrl}`);
}
