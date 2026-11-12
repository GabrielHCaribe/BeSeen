import * as Notifications from "expo-notifications";

// Earlier versions scheduled an 8:30 pm "check your streak" reminder. The streak is gone, so make sure
// that reminder is cancelled on phones that still have it scheduled.
const ID = "beseen-daily-recap";

export async function syncDailyRecap() {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
  } catch (error) {
    console.warn("Cancelling the daily recap failed", error);
  }
}
