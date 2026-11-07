package expo.modules.beseennative

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import androidx.core.content.ContextCompat

class BlockerService : AccessibilityService() {
  companion object {
    @Volatile
    var instance: BlockerService? = null
      private set

    private val IGNORED = setOf("com.android.systemui")
    private val INSTALLERS = setOf(
      "com.google.android.packageinstaller",
      "com.android.packageinstaller",
      "com.samsung.android.packageinstaller",
      "com.miui.packageinstaller",
    )
    private const val TICK_MS = 15_000L
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var overlay: Overlay
  private var foreground: String? = null
  private var site: SiteSession? = null
  private var lastBrowserCheck = 0L
  private var lastUninstallReport = 0L
  private var keyboards: Set<String> = emptySet()

  private data class SiteSession(val ruleId: String, val since: Long)

  private val tick = object : Runnable {
    override fun run() {
      evaluate()
      handler.postDelayed(this, TICK_MS)
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == Intent.ACTION_SCREEN_OFF) {
        closeSite()
        foreground = null
      }
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    overlay = Overlay(this)
    keyboards = runCatching {
      getSystemService(InputMethodManager::class.java).enabledInputMethodList.map { it.packageName }.toSet()
    }.getOrDefault(emptySet())
    ContextCompat.registerReceiver(this, screenReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
    handler.post(tick)
    MonitorService.start(this)
    HeartbeatWorker.schedule(this)
    Core.checkInAsync(this, "accessibility_on")
  }

  // Called when the user switches BeSeen off in Accessibility settings: report it right away.
  // The check-in reads the real setting, so an unbind caused by an app update isn't reported as "switched off".
  override fun onUnbind(intent: Intent?): Boolean {
    shutdown()
    Core.checkInAsync(applicationContext, "accessibility_unbind")
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun shutdown() {
    if (instance == null) return
    instance = null
    handler.removeCallbacks(tick)
    runCatching { unregisterReceiver(screenReceiver) }
    if (::overlay.isInitialized) overlay.hide()
    closeSite()
  }

  override fun onInterrupt() {}

  fun rulesChanged() {
    handler.post { evaluate() }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (!::overlay.isInitialized) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg in INSTALLERS) checkUninstall(event)
    if (pkg in IGNORED || pkg in keyboards) return
    if (pkg == packageName && overlay.isShowing) return // events from our own block screen

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        if (pkg != foreground) {
          closeSite()
          foreground = pkg
          if (overlay.isShowing && overlay.ownerPackage != pkg) overlay.hide()
        }
        evaluate()
      }
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        // Address bars change as pages load; check at most once a second.
        val now = System.currentTimeMillis()
        if (pkg == foreground && pkg in BrowserUrl.packages && now - lastBrowserCheck > 1_000) {
          lastBrowserCheck = now
          evaluate()
        }
      }
    }
  }

  private fun evaluate() {
    val pkg = foreground ?: return
    val rules = Core.loadRules(this)

    rules.firstOrNull { it.targetType == "app" && it.target == pkg }?.let { rule ->
      if (rule.mode == "block") showBlock(rule, pkg)
      else if (Core.limitState(this, rule.id) != "overridden" &&
        UsageTracker.todayMinutes(this, pkg) >= (rule.limitMinutes ?: Int.MAX_VALUE)
      ) showLimit(rule, pkg)
      return
    }

    if (pkg !in BrowserUrl.packages) return
    val host = rootInActiveWindow?.let { BrowserUrl.read(it, pkg) }?.let(BrowserUrl::host)
    val rule = host?.let { h -> rules.firstOrNull { it.targetType == "site" && it.target != null && BrowserUrl.matches(h, it.target) } }
    if (rule?.id != site?.ruleId) {
      closeSite()
      if (rule != null) site = SiteSession(rule.id, System.currentTimeMillis())
    }
    if (rule == null) {
      if (overlay.isShowing && overlay.ownerPackage == pkg) overlay.hide()
      return
    }
    if (rule.mode == "block") {
      showBlock(rule, pkg)
    } else if (Core.limitState(this, rule.id) != "overridden") {
      val used = Core.siteSeconds(this, rule.id) + (System.currentTimeMillis() - (site?.since ?: 0)) / 1000
      if (used >= (rule.limitMinutes ?: Int.MAX_VALUE) * 60L) showLimit(rule, pkg)
    }
  }

  // Websites have no system usage stats, so BeSeen counts the time itself.
  private fun closeSite() {
    val session = site ?: return
    site = null
    Core.addSiteSeconds(this, session.ruleId, (System.currentTimeMillis() - session.since) / 1000)
  }

  private fun goHome() {
    overlay.hide()
    closeSite()
    performGlobalAction(GLOBAL_ACTION_HOME)
  }

  private fun showBlock(rule: Rule, pkg: String) {
    if (overlay.ruleId == rule.id) return
    val partner = Core.partnerName(this)
    overlay.show(
      rule.id,
      pkg,
      "${rule.label} is blocked",
      "You chose to block this with BeSeen." + (partner?.let { " $it is told when you try to open it." } ?: ""),
      Overlay.Action("Close") { goHome() },
    )
    Core.recordAttempt(this, rule.id)
  }

  private fun showLimit(rule: Rule, pkg: String) {
    if (overlay.ruleId == rule.id) return
    val partner = Core.partnerName(this)
    overlay.show(
      rule.id,
      pkg,
      "Time's up for today",
      "You've used your ${rule.limitMinutes} minutes on ${rule.label}." + (partner?.let { " If you keep going, $it will be told." } ?: ""),
      Overlay.Action("Close") { goHome() },
      Overlay.Action(partner?.let { "Keep going ($it will be told)" } ?: "Keep going") {
        Core.setLimitState(this, rule.id, "overridden")
        Core.enqueue(this, "limit_exceeded", rule.id)
        Core.checkInAsync(this, "limit_exceeded")
        overlay.hide()
      },
    )
  }

  // The system uninstall dialog for BeSeen: tell the partner before the user confirms.
  private fun checkUninstall(event: AccessibilityEvent) {
    val now = System.currentTimeMillis()
    if (now - lastUninstallReport < 120_000) return
    val root = rootInActiveWindow ?: return
    val label = applicationInfo.loadLabel(packageManager).toString()
    if (root.findAccessibilityNodeInfosByText(label).isEmpty()) return
    val looksLikeUninstall = event.className?.toString()?.contains("Uninstall", ignoreCase = true) == true ||
      root.findAccessibilityNodeInfosByText("uninstall").isNotEmpty()
    if (!looksLikeUninstall) return
    lastUninstallReport = now
    Core.enqueue(this, "uninstall_started", null)
    Core.checkInAsync(this, "uninstall")
  }
}
