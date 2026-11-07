import DeviceActivity
import Foundation

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  // Fires at midnight (daily schedule) and every 3 hours (heartbeat schedules), even if the app was force-quit.
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    BeSeenCore.resetDayIfNeeded()
    BeSeenCore.checkIn(source: "monitor")
  }

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    guard let ruleId = BeSeenCore.ruleId(from: event),
          let rule = BeSeenCore.loadRules().first(where: { $0.id == ruleId }),
          BeSeenCore.limitState()[ruleId] == nil
    else { return }
    // Limit reached: put the shield up. The partner is only told if they tap "Keep going" (see ShieldAction).
    BeSeenCore.setLimitState(ruleId, "reached")
    BeSeenCore.shield(rule)
  }
}
