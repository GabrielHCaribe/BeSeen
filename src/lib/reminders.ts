import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const ID = "beseen-daily-recap";
const OFF_KEY = "beseen.dailyRecapOff";

// An evening nudge to open BeSeen and see the day. On by default once notifications are allowed.
export async function dailyRecapEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(OFF_KEY)) !== "yes";
}

export async function setDailyRecap(on: boolean) {
  await SecureStore.setItemAsync(OFF_KEY, on ? "no" : "yes");
  await syncDailyRecap();
}

export async function syncDailyRecap() {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" || !(await dailyRecapEnabled())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: "How did today go?", body: "Open BeSeen to see your streak and how often you held the line." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 30 },
    });
  } catch (error) {
    console.warn("Daily recap scheduling failed", error);
  }
}
