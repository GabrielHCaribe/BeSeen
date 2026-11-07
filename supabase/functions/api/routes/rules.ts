import { env } from "../lib/env.ts";
import { authDevice, db, type Device, must, type Rule } from "../lib/db.ts";
import { HttpError, json, readJson, requireString, requireUuid } from "../lib/http.ts";
import { recordEvent } from "../notify.ts";
import type { RuleShape } from "../messages.ts";

const TARGETS_BY_PLATFORM: Record<string, string[]> = {
  ios: ["selection", "site", "adult_sites"],
  android: ["app", "site", "adult_sites"],
};

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function direction(before: RuleShape, after: RuleShape): "stricter" | "looser" | "same" {
  if (before.mode !== after.mode) return after.mode === "block" ? "stricter" : "looser";
  if (before.mode === "block") return "same";
  if (after.limit_minutes! < before.limit_minutes!) return "stricter";
  if (after.limit_minutes! > before.limit_minutes!) return "looser";
  return "same";
}

// iOS can only time-limit apps and sites picked in Apple's picker; typed sites and the adult filter are block-only.
function blockOnly(device: Device, targetType: string) {
  return targetType === "adult_sites" || (device.platform === "ios" && targetType === "site");
}

function parseShape(body: { mode?: string; limit_minutes?: number | null }): RuleShape {
  if (body.mode === "block") return { mode: "block", limit_minutes: null };
  if (body.mode === "limit") {
    const n = Number(body.limit_minutes);
    if (!Number.isInteger(n) || n < 1 || n > 1440) throw new HttpError(400, "Limit must be 1–1440 minutes");
    return { mode: "limit", limit_minutes: n };
  }
  throw new HttpError(400, "Mode must be block or limit");
}

function shapeOf(rule: Rule): RuleShape {
  return { mode: rule.mode, limit_minutes: rule.limit_minutes };
}

async function ownRule(device: Device, ruleId: string): Promise<Rule> {
  must(await db.rpc("apply_due_rule_changes", { p_account: device.account_id }));
  const rule = must(
    await db.from("rules").select("*").eq("id", ruleId).eq("device_id", device.id).is("removed_at", null).maybeSingle(),
  );
  if (!rule) throw new HttpError(404, "Rule not found");
  return rule as Rule;
}

async function pendingChange(ruleId: string) {
  return must(
    await db.from("rule_changes").select("id").eq("rule_id", ruleId).is("applied_at", null).is("cancelled_at", null)
      .maybeSingle(),
  );
}

function effectiveAt(): string {
  return new Date(Date.now() + env.cooldownHours * 3_600_000).toISOString();
}

export async function create(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{
    id?: string;
    label?: string;
    target_type?: string;
    target?: string | null;
    mode?: string;
    limit_minutes?: number | null;
  }>(req);
  const id = requireUuid(body.id, "id");
  const label = requireString(body.label, "label", 60);
  const targetType = body.target_type ?? "";
  if (!(TARGETS_BY_PLATFORM[device.platform] ?? []).includes(targetType)) {
    throw new HttpError(400, "That kind of rule isn't supported on this device");
  }

  let target: string | null = null;
  if (targetType === "site") {
    target =
      requireString(body.target, "website", 253).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(
        "/",
      )[0];
    if (!DOMAIN.test(target)) throw new HttpError(400, "That doesn't look like a website address");
  } else if (targetType === "app") {
    target = requireString(body.target, "app", 200);
    if (!PACKAGE.test(target)) throw new HttpError(400, "Unknown app");
  }

  const shape = parseShape(body);
  if (shape.mode === "limit" && blockOnly(device, targetType)) {
    throw new HttpError(400, "This can only be blocked, not limited");
  }

  const existing = must(await db.from("rules").select("id, device_id").eq("id", id).maybeSingle());
  if (existing) {
    if (existing.device_id !== device.id) throw new HttpError(409, "Rule id already used");
    return json({ ok: true }); // retried request
  }

  must(
    await db.from("rules").insert({
      id,
      account_id: device.account_id,
      device_id: device.id,
      label,
      target_type: targetType,
      target,
      mode: shape.mode,
      limit_minutes: shape.limit_minutes,
    }),
  );
  await recordEvent(device.account_id, device.id, "rule_added", { rule_id: id, label, after: shape });
  return json({ ok: true });
}

export async function change(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ rule_id?: string; mode?: string; limit_minutes?: number | null }>(req);
  const rule = await ownRule(device, requireUuid(body.rule_id, "rule_id"));
  if (await pendingChange(rule.id)) {
    throw new HttpError(409, "This rule already has a change waiting. Cancel it first.");
  }

  const before = shapeOf(rule);
  const after = parseShape(body);
  if (after.mode === "limit" && blockOnly(device, rule.target_type)) {
    throw new HttpError(400, "This can only be blocked, not limited");
  }

  const dir = direction(before, after);
  if (dir === "same") return json({ ok: true, direction: dir });

  if (dir === "stricter") {
    must(
      await db.from("rules").update({ ...after, updated_at: new Date().toISOString() }).eq("id", rule.id),
    );
    await recordEvent(device.account_id, device.id, "rule_tightened", {
      rule_id: rule.id,
      label: rule.label,
      before,
      after,
    });
    return json({ ok: true, direction: dir });
  }

  const effective = effectiveAt();
  must(
    await db.from("rule_changes").insert({
      rule_id: rule.id,
      account_id: device.account_id,
      kind: "change",
      before,
      after,
      effective_at: effective,
    }),
  );
  await recordEvent(device.account_id, device.id, "rule_loosened", {
    rule_id: rule.id,
    label: rule.label,
    before,
    after,
    effective_at: effective,
  });
  return json({ ok: true, direction: dir, effective_at: effective });
}

export async function remove(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ rule_id?: string }>(req);
  const rule = await ownRule(device, requireUuid(body.rule_id, "rule_id"));
  if (await pendingChange(rule.id)) {
    throw new HttpError(409, "This rule already has a change waiting. Cancel it first.");
  }

  const before = shapeOf(rule);
  const effective = effectiveAt();
  must(
    await db.from("rule_changes").insert({
      rule_id: rule.id,
      account_id: device.account_id,
      kind: "remove",
      before,
      after: null,
      effective_at: effective,
    }),
  );
  await recordEvent(device.account_id, device.id, "rule_removed", {
    rule_id: rule.id,
    label: rule.label,
    before,
    effective_at: effective,
  });
  return json({ ok: true, effective_at: effective });
}

export async function cancel(req: Request) {
  const device = await authDevice(req);
  const body = await readJson<{ change_id?: string }>(req);
  const changeId = requireUuid(body.change_id, "change_id");
  const pending = must(
    await db.from("rule_changes").select("id, rule_id, kind").eq("id", changeId).eq("account_id", device.account_id)
      .is("applied_at", null).is("cancelled_at", null).maybeSingle(),
  );
  if (!pending) throw new HttpError(404, "That change already happened or was cancelled");
  const rule = await ownRule(device, pending.rule_id);

  must(await db.from("rule_changes").update({ cancelled_at: new Date().toISOString() }).eq("id", pending.id));
  await recordEvent(device.account_id, device.id, "change_cancelled", {
    rule_id: rule.id,
    label: rule.label,
    kind: pending.kind,
  });
  return json({ ok: true });
}
