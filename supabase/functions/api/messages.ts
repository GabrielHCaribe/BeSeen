// Everything a partner ever reads is built here. Keep it to what they need to know:
// no app usage details beyond the rule's own label, never history or screenshots.

export interface RuleShape {
  mode: "block" | "limit";
  limit_minutes: number | null;
}

export interface Message {
  title: string;
  body: string;
}

// deno-lint-ignore no-explicit-any
type Payload = Record<string, any>;

function minutes(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function describeRule(rule: RuleShape): string {
  return rule.mode === "block" ? "blocked" : `${minutes(rule.limit_minutes ?? 0)} a day`;
}

export function formatTime(iso: string, timeZone: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timeZone ?? "UTC" }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(iso));
  }
}

const PERMISSION_TEXT: Record<string, { off: string; on: string }> = {
  screen_time: {
    off: "turned off BeSeen's Screen Time access. Their rules are no longer enforced.",
    on: "turned BeSeen's Screen Time access back on.",
  },
  accessibility: {
    off: "turned off BeSeen's Accessibility access. Their blocks are no longer enforced.",
    on: "turned BeSeen's Accessibility access back on.",
  },
  usage_access: {
    off: "turned off BeSeen's Usage Access. Their time limits are no longer enforced.",
    on: "turned BeSeen's Usage Access back on.",
  },
  adult_filter: {
    off: "turned off the adult-site filter on their phone.",
    on: "turned the adult-site filter back on.",
  },
};

export function renderMessage(type: string, payload: Payload, name: string, timeZone: string | null): Message {
  const label = typeof payload.label === "string" ? payload.label : "an app";
  const when = typeof payload.effective_at === "string" ? formatTime(payload.effective_at, timeZone) : null;

  switch (type) {
    case "limit_exceeded":
      return {
        title: `${name} went over a limit`,
        body: `${name} went over their ${minutes(payload.limit_minutes ?? 0)} daily limit on ${label}.`,
      };
    case "blocked_attempt":
      return { title: `${name} tried to open ${label}`, body: `${name} tried to open ${label}, which they blocked.` };
    case "blocked_summary": {
      const n = payload.count ?? 1;
      return {
        title: `${name} kept trying ${label}`,
        body: `${name} tried to open ${label} ${n} more time${n === 1 ? "" : "s"} in the last hour. It's blocked.`,
      };
    }
    case "rule_added":
      return {
        title: `${name} added a rule`,
        body: `${name} added a rule: ${label} is now ${describeRule(payload.after)}. (Stricter)`,
      };
    case "rule_tightened":
      return {
        title: `${name} tightened a rule`,
        body: `${name} tightened a rule: ${label} went from ${describeRule(payload.before)} to ${
          describeRule(payload.after)
        }. (Stricter)`,
      };
    case "rule_loosened":
      return {
        title: `${name} asked to loosen a rule`,
        body: `${name} asked to loosen a rule: ${label} from ${describeRule(payload.before)} to ${
          describeRule(payload.after)
        }. (Looser) It takes effect ${when}.`,
      };
    case "rule_removed":
      return {
        title: `${name} asked to remove a rule`,
        body: `${name} asked to remove their rule on ${label} (${
          describeRule(payload.before)
        }). (Looser) It takes effect ${when}.`,
      };
    case "change_cancelled":
      return {
        title: `${name} changed their mind`,
        body: `${name} cancelled their request to loosen ${label}. The rule stays as it was.`,
      };
    case "partner_removed":
      return {
        title: `${name} removed you as their partner`,
        body: `${name} removed you as their accountability partner. You won't get any more alerts.`,
      };
    case "partner_welcome":
      return {
        title: `You're ${name}'s accountability partner`,
        body:
          `You're now ${name}'s accountability partner on BeSeen. You'll get a short alert if they slip, change a rule, or switch BeSeen off. Never screenshots or browsing history.`,
      };
    case "permission_revoked": {
      const text = PERMISSION_TEXT[payload.permission]?.off ?? "turned off one of BeSeen's permissions.";
      return { title: `${name} switched part of BeSeen off`, body: `${name} ${text}` };
    }
    case "permission_restored": {
      const text = PERMISSION_TEXT[payload.permission]?.on ?? "turned one of BeSeen's permissions back on.";
      return { title: `${name} switched BeSeen back on`, body: `${name} ${text}` };
    }
    case "uninstall_started":
      return {
        title: `${name} started deleting BeSeen`,
        body: `${name} opened the screen to uninstall BeSeen from their phone.`,
      };
    case "reinstalled":
      return {
        title: `BeSeen was reinstalled`,
        body:
          `BeSeen was deleted and reinstalled on ${name}'s phone. Their app rules were reset and need to be set up again.`,
      };
    case "device_silent":
      return {
        title: `${name}'s phone stopped reporting`,
        body: `BeSeen on ${name}'s phone hasn't checked in for ${
          payload.hours ?? 12
        } hours. The phone may be off or offline, or BeSeen may have been deleted or switched off.`,
      };
    case "device_back":
      return { title: `${name}'s phone is reporting again`, body: `BeSeen on ${name}'s phone is checking in again.` };
    case "test":
      return {
        title: `Test alert from ${name}`,
        body: `This is a test alert from ${name}'s BeSeen. If you got this, alerts work.`,
      };
    default:
      return { title: `Update from ${name}'s BeSeen`, body: `Something changed on ${name}'s BeSeen.` };
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function emailHtml(
  heading: string,
  paragraphs: string[],
  footer: string,
  link?: { href: string; text: string },
) {
  const button = link
    ? `<p style="margin:24px 0"><a href="${
      escapeHtml(link.href)
    }" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${
      escapeHtml(link.text)
    }</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${escapeHtml(p)}</p>`).join("\n")}
${button}
<p style="font-size:13px;line-height:1.5;color:#78716c;margin:24px 0 0">${footer}</p>
</div></body></html>`;
}

export { escapeHtml };
