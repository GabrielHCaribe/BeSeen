import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { call, setCredentials } from "./api";
import { BeSeenNative } from "./native";
import type { Credentials } from "./types";

const KEY = "beseen.device";
// Readable after the first unlock so background check-ins work while the phone is locked.
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export function timezone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? "UTC";
}

export async function storedCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY, STORE_OPTIONS);
  return raw ? (JSON.parse(raw) as Credentials) : null;
}

// No sign-up: the first launch quietly creates an anonymous identity for this phone.
export async function loadOrRegister(): Promise<Credentials> {
  const freshInstall = (await BeSeenNative?.consumeFreshInstall().catch(() => false)) ?? false;
  const stored = await storedCredentials();

  if (stored) {
    setCredentials(stored);
    // iOS keeps the Keychain after BeSeen is deleted, so old credentials on a fresh install mean a reinstall.
    if (freshInstall && Platform.OS === "ios") {
      await call("device/events", {
        events: [{ id: Crypto.randomUUID(), type: "reinstalled", occurred_at: new Date().toISOString(), payload: {} }],
      }).catch(() => {});
    }
    return stored;
  }

  const result = await call<{ device_id: string; device_secret: string }>("register", {
    platform: Platform.OS,
    name: Device.modelName,
    app_version: Application.nativeApplicationVersion,
    timezone: timezone(),
  });
  const credentials = { deviceId: result.device_id, deviceSecret: result.device_secret };
  await SecureStore.setItemAsync(KEY, JSON.stringify(credentials), STORE_OPTIONS);
  setCredentials(credentials);
  return credentials;
}

// Tells the server this phone is alive. The native side also sends anything queued by the
// extensions / accessibility service (blocked attempts, limits exceeded).
export async function checkIn(source: string) {
  if (BeSeenNative) {
    await BeSeenNative.checkIn(source);
    return;
  }
  const credentials = await storedCredentials();
  if (!credentials) return;
  setCredentials(credentials);
  await call("device/heartbeat", {
    source,
    status: {},
    app_version: Application.nativeApplicationVersion,
    timezone: timezone(),
  });
}
