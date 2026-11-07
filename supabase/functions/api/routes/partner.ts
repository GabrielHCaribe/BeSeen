import { env } from "../lib/env.ts";
import { authDevice, db, getAccount, livePartner, must, type Partner } from "../lib/db.ts";
import { HttpError, json, readJson, requireString } from "../lib/http.ts";
import { hmacSha256, randomToken, safeEqual, sha256, verifySignedToken } from "../lib/crypto.ts";
import { notifyOwner, recordEvent, sendConfirmEmail } from "../notify.ts";

const INVITE_DAYS = 7;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function inviteUrl(token: string) {
  return `${env.webBaseUrl}/invite?t=${encodeURIComponent(token)}`;
}

async function newInviteToken() {
  const token = randomToken(24);
  return {
    token,
    fields: {
      invite_hash: await sha256(token),
      invite_expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    },
  };
}

async function partnerByInvite(token: unknown): Promise<Partner> {
  if (typeof token !== "string" || token.length < 16) throw new HttpError(400, "Missing invite token");
  const partner = must(
    await db.from("partners").select("*").eq("invite_hash", await sha256(token)).eq("status", "invited").maybeSingle(),
  ) as Partner | null;
  if (!partner || !partner.invite_expires_at || Date.parse(partner.invite_expires_at) < Date.now()) {
    throw new HttpError(404, "This invite has expired or was already used. Ask for a new link.");
  }
  return partner;
}

async function endPartnership(id: string, reason: string) {
  must(
    await db.from("partners").update({
      status: "ended",
      end_reason: reason,
      ended_at: new Date().toISOString(),
      invite_hash: null,
      email_confirm_hash: null,
    }).eq("id", id),
  );
}

async function activate(partner: Partner, fields: Record<string, unknown>) {
  const activated = must(
    await db.from("partners").update({
      status: "active",
      accepted_at: new Date().toISOString(),
      invite_hash: null,
      email_confirm_hash: null,
      ...fields,
    }).eq("id", partner.id).select("*").single(),
  ) as Partner;
  await recordEvent(partner.account_id, null, "partner_welcome", {}, { partner: activated });
  await notifyOwner(
    partner.account_id,
    `${partner.name} is now your partner`,
    `${partner.name} accepted. From now on they'll hear about it if you slip.`,
  );
}

// ---- Called by the BeSeen user's app ----

export async function invite(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ partner_name?: string; my_name?: string }>(req);
  const partnerName = requireString(body.partner_name, "Partner's name", 60);
  const myName = requireString(body.my_name, "Your name", 60);

  const existing = await livePartner(device.account_id);
  if (existing?.status === "active") {
    throw new HttpError(409, "Remove your current partner before inviting someone new.");
  }
  if (existing) await endPartnership(existing.id, "replaced");

  must(await db.from("accounts").update({ display_name: myName }).eq("id", device.account_id));
  const { token, fields } = await newInviteToken();
  must(
    await db.from("partners").insert({
      account_id: device.account_id,
      name: partnerName,
      status: "invited",
      ...fields,
    }),
  );
  return json({ invite_url: inviteUrl(token) });
}

// Tokens are stored hashed, so "share again" issues a fresh link.
export async function newLink(req: Request) {
  const device = await authDevice(req);
  const partner = await livePartner(device.account_id);
  if (partner?.status !== "invited") throw new HttpError(409, "There's no pending invite.");
  const { token, fields } = await newInviteToken();
  must(await db.from("partners").update(fields).eq("id", partner.id));
  return json({ invite_url: inviteUrl(token) });
}

export async function cancelInvite(req: Request) {
  const device = await authDevice(req);
  const partner = await livePartner(device.account_id);
  if (partner?.status !== "invited") throw new HttpError(409, "There's no pending invite.");
  await endPartnership(partner.id, "removed"); // they never accepted, so there's nobody to tell
  return json({ ok: true });
}

export async function remove(req: Request) {
  const device = await authDevice(req);
  const partner = await livePartner(device.account_id);
  if (partner?.status !== "active") throw new HttpError(409, "You don't have a partner.");
  await endPartnership(partner.id, "removed");
  // Removing the partner is never silent: they get one last message.
  await recordEvent(device.account_id, device.id, "partner_removed", {}, { partner });
  return json({ ok: true });
}

export async function test(req: Request) {
  const device = await authDevice(req);
  const partner = await livePartner(device.account_id);
  if (partner?.status !== "active") throw new HttpError(409, "Your partner hasn't accepted yet.");
  await recordEvent(device.account_id, device.id, "test", {});
  return json({ ok: true });
}

// ---- Called by the partner's app (if they installed BeSeen) ----

export async function acceptInApp(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ token?: string }>(req);
  const partner = await partnerByInvite(body.token);
  if (partner.account_id === device.account_id) {
    throw new HttpError(400, "You can't be your own accountability partner.");
  }
  await activate(partner, { channel: "push", partner_account_id: device.account_id });
  const user = await getAccount(partner.account_id);
  return json({ user_name: user.display_name ?? "your friend" });
}

export async function leave(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ partner_id?: string }>(req);
  const partner = must(
    await db.from("partners").select("*").eq("id", String(body.partner_id ?? "")).eq(
      "partner_account_id",
      device.account_id,
    )
      .eq("status", "active").maybeSingle(),
  ) as Partner | null;
  if (!partner) throw new HttpError(404, "Not found");
  await endPartnership(partner.id, "left");
  await notifyOwner(
    partner.account_id,
    `${partner.name} stopped your alerts`,
    `${partner.name} is no longer your partner. Nobody will see when you slip.`,
  );
  return json({ ok: true });
}

// ---- Public web pages (no app, no account) ----

export async function inviteInfo(req: Request) {
  const body = await readJson<{ token?: string }>(req);
  const partner = await partnerByInvite(body.token);
  const user = await getAccount(partner.account_id);
  return json({ user_name: user.display_name ?? "Your friend", partner_name: partner.name });
}

export async function acceptByEmail(req: Request) {
  const body = await readJson<{ token?: string; email?: string }>(req);
  const partner = await partnerByInvite(body.token);
  const email = requireString(body.email, "Email", 254).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, "That email address doesn't look right.");

  const confirmToken = randomToken(24);
  must(
    await db.from("partners").update({
      email_pending: email,
      email_confirm_hash: await sha256(confirmToken),
      email_confirm_expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    }).eq("id", partner.id),
  );
  const user = await getAccount(partner.account_id);
  const sent = await sendConfirmEmail(
    email,
    user.display_name ?? "Your friend",
    `${env.webBaseUrl}/confirm?t=${encodeURIComponent(confirmToken)}`,
  );
  if (!sent) throw new HttpError(502, "We couldn't send the email. Try again in a minute.");
  return json({ ok: true });
}

export async function confirmEmail(req: Request) {
  const body = await readJson<{ token?: string }>(req);
  if (typeof body.token !== "string") throw new HttpError(400, "Missing token");
  const partner = must(
    await db.from("partners").select("*").eq("email_confirm_hash", await sha256(body.token)).eq("status", "invited")
      .maybeSingle(),
  ) as (Partner & { email_confirm_expires_at: string | null }) | null;
  if (!partner || !partner.email_pending || Date.parse(partner.email_confirm_expires_at ?? "") < Date.now()) {
    throw new HttpError(404, "This link has expired or was already used.");
  }
  await activate(partner, { channel: "email", email: partner.email_pending, email_pending: null });
  const user = await getAccount(partner.account_id);
  return json({ user_name: user.display_name ?? "your friend" });
}

// Used by the "Stop these alerts" page and by mail apps' one-click unsubscribe (token in the query string).
export async function stop(req: Request, url: URL) {
  let token = url.searchParams.get("t");
  if (!token && req.headers.get("content-type")?.includes("application/json")) {
    token = (await readJson<{ token?: string }>(req)).token ?? null;
  }
  const partnerId = token ? await verifySignedToken("stop", token) : null;
  if (!partnerId) throw new HttpError(400, "Invalid link");
  const partner = must(await db.from("partners").select("*").eq("id", partnerId).maybeSingle()) as Partner | null;
  if (partner?.status === "active") {
    await endPartnership(partner.id, "unsubscribed");
    await notifyOwner(
      partner.account_id,
      `${partner.name} stopped your alerts`,
      `${partner.name} is no longer your partner. Nobody will see when you slip.`,
    );
  }
  return json({ ok: true });
}

// Resend reports bounces and spam complaints here (signed with Svix).
export async function resendWebhook(req: Request) {
  const raw = await req.text();
  if (!env.resendWebhookSecret) throw new HttpError(503, "Webhook secret not configured");
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signatures = (req.headers.get("svix-signature") ?? "").split(" ");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new HttpError(401, "Stale webhook");
  const key = Uint8Array.from(atob(env.resendWebhookSecret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const expected = btoa(String.fromCharCode(...await hmacSha256(key, `${id}.${timestamp}.${raw}`)));
  if (!signatures.some((s) => safeEqual(s.replace(/^v1,/, ""), expected))) throw new HttpError(401, "Bad signature");

  const event = JSON.parse(raw) as { type?: string; data?: { to?: string[] } };
  const reason = event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : null;
  if (!reason) return json({ ok: true });

  for (const address of event.data?.to ?? []) {
    const partners = must(
      await db.from("partners").select("*").eq("email", address.toLowerCase()).eq("status", "active"),
    ) as Partner[];
    for (const partner of partners) {
      await endPartnership(partner.id, reason);
      await notifyOwner(
        partner.account_id,
        reason === "bounced" ? `Alerts to ${partner.name} bounced` : `${partner.name} stopped your alerts`,
        reason === "bounced"
          ? `Emails to ${partner.name} can't be delivered, so you don't have a partner right now. Invite them again.`
          : `${partner.name} is no longer your partner. Nobody will see when you slip.`,
      );
    }
  }
  return json({ ok: true });
}
