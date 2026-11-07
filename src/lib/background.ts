// Background check-ins. Imported once at startup so the tasks exist before the OS wakes the app.
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { checkIn } from "./session";

const HEARTBEAT_TASK = "beseen-heartbeat";
const PUSH_TASK = "beseen-push";

TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    await checkIn("background");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// The server sends a silent push when a phone has been quiet for a while; answering it avoids a false alarm.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(PUSH_TASK, async () => {
  await checkIn("push").catch(() => {});
});

export async function registerBackgroundTasks() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK))) {
      await BackgroundTask.registerTaskAsync(HEARTBEAT_TASK, { minimumInterval: 60 });
    }
    await Notifications.registerTaskAsync(PUSH_TASK);
  } catch (error) {
    console.warn("Background tasks unavailable", error);
  }
}
