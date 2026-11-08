import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { call, EAS_PROJECT_ID } from "./api";
import { syncDailyRecap } from "./reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Partners who install BeSeen get alerts by push; the user also gets "Alex accepted" style notices.
// `ask` shows the permission prompt; otherwise only an existing permission is used.
export async function registerPush(ask: boolean): Promise<boolean> {
  if (!Device.isDevice || !EAS_PROJECT_ID) return false;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
  syncDailyRecap();
  try {
    // iOS hands out a token even without permission, which still allows silent "are you alive?" pings.
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
    await call("device/push-token", { token });
  } catch (error) {
    console.warn("Push registration failed", error);
    return false;
  }
  return status === "granted";
}
