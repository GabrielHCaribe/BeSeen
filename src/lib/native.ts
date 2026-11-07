import { BeSeenNative, type NativeRule, type NativeStatus } from "@modules/beseen-native";
import { API_URL, SCREEN_TIME_BUILD } from "./api";
import type { Credentials, Rule, ServerState } from "./types";

export { BeSeenNative };

// Native code gets plain values only; nulls are dropped rather than sent.
function toNativeRule(rule: Rule): NativeRule {
  return {
    id: rule.id,
    label: rule.label,
    mode: rule.mode,
    targetType: rule.target_type,
    ...(rule.limit_minutes != null ? { limitMinutes: rule.limit_minutes } : {}),
    ...(rule.target != null ? { target: rule.target } : {}),
  };
}

// Hands the server's view of the rules to the native side, which enforces them.
export async function syncNative(state: ServerState, credentials: Credentials) {
  if (!BeSeenNative) return;
  const partnerName = state.partner?.status === "active" ? state.partner.name : undefined;
  await BeSeenNative.configure({
    apiBase: API_URL,
    deviceId: credentials.deviceId,
    deviceSecret: credentials.deviceSecret,
    ...(partnerName ? { partnerName } : {}),
  });
  await BeSeenNative.applyRules(state.rules.map(toNativeRule));
  // Android: the "BeSeen is on" notification can only be started while the app is in the foreground.
  await BeSeenNative.startMonitorService?.();
}

export async function nativeStatus(): Promise<NativeStatus | null> {
  try {
    return (await BeSeenNative?.getStatus()) ?? null;
  } catch {
    return null;
  }
}

// What still needs switching on before rules can be enforced.
export function missingPermissions(status: NativeStatus | null): string[] {
  if (!status) return [];
  if (status.platform === "ios") {
    return status.screenTime === "approved" || !SCREEN_TIME_BUILD ? [] : ["Screen Time access"];
  }
  const missing: string[] = [];
  if (!status.accessibility) missing.push("Accessibility");
  if (!status.usageAccess) missing.push("Usage access");
  return missing;
}
