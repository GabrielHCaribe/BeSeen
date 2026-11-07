package expo.modules.beseennative

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.util.Calendar

// Today's foreground time per app, from the same data Digital Wellbeing uses.
object UsageTracker {
  fun startOfDay(): Long = Calendar.getInstance().apply {
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  fun todayMinutes(context: Context, packageName: String): Long {
    if (!Core.hasUsageAccess(context)) return 0
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val events = manager.queryEvents(startOfDay(), now)
    val event = UsageEvents.Event()
    var total = 0L
    var resumedAt = -1L
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.packageName != packageName) continue
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> if (resumedAt < 0) resumedAt = event.timeStamp
        UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> if (resumedAt >= 0) {
          total += event.timeStamp - resumedAt
          resumedAt = -1
        }
      }
    }
    if (resumedAt >= 0) total += now - resumedAt
    return total / 60_000
  }
}
