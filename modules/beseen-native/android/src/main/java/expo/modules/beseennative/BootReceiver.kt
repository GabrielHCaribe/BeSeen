package expo.modules.beseennative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (Core.loadConfig(context) == null) return
    HeartbeatWorker.schedule(context)
    MonitorService.start(context)
    Core.checkInAsync(context, "boot")
  }
}
