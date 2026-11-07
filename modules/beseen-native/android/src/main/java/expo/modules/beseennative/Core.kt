package expo.modules.beseennative

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import kotlin.concurrent.thread

data class Rule(
  val id: String,
  val label: String,
  val mode: String, // "block" | "limit"
  val limitMinutes: Int?,
  val targetType: String, // "app" | "site" | "adult_sites"
  val target: String?,
)

// Shared state for the module, the accessibility service, the heartbeat worker and the boot receiver.
object Core {
  private const val TAG = "BeSeen"
  private val queueLock = Any()

  // Family-filter DNS resolvers; the "All adult websites" rule on Android relies on Private DNS set to one of these.
  private val FAMILY_DNS = listOf(
    "family.cloudflare-dns.com",
    "family-filter-dns.cleanbrowsing.org",
    "adult-filter-dns.cleanbrowsing.org",
    "family.adguard-dns.com",
  )

  fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences("beseen", Context.MODE_PRIVATE)

  fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  // ---- Config and rules ----

  fun saveConfig(context: Context, config: JSONObject) {
    prefs(context).edit().putString("config", config.toString()).apply()
  }

  fun loadConfig(context: Context): JSONObject? =
    prefs(context).getString("config", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun partnerName(context: Context): String? =
    loadConfig(context)?.let { if (it.isNull("partnerName")) null else it.optString("partnerName").ifBlank { null } }

  fun saveRules(context: Context, rules: JSONArray) {
    prefs(context).edit().putString("rules", rules.toString()).apply()
  }

  fun loadRules(context: Context): List<Rule> {
    val raw = prefs(context).getString("rules", null) ?: return emptyList()
    val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
    return (0 until array.length()).mapNotNull { i ->
      val o = array.optJSONObject(i) ?: return@mapNotNull null
      Rule(
        id = o.optString("id"),
        label = o.optString("label"),
        mode = o.optString("mode"),
        limitMinutes = if (o.has("limitMinutes") && !o.isNull("limitMinutes")) o.optInt("limitMinutes") else null,
        targetType = o.optString("targetType"),
        target = if (o.has("target") && !o.isNull("target")) o.optString("target") else null,
      )
    }
  }

  // ---- Daily state: limit shields and per-site minutes reset at midnight ----

  fun resetDayIfNeeded(context: Context) {
    val p = prefs(context)
    if (p.getString("day", null) == today()) return
    val editor = p.edit().putString("day", today())
    p.all.keys.filter { it.startsWith("limit.") || it.startsWith("site.") }.forEach { editor.remove(it) }
    editor.apply()
  }

  fun limitState(context: Context, ruleId: String): String? {
    resetDayIfNeeded(context)
    return prefs(context).getString("limit.$ruleId", null)
  }

  fun setLimitState(context: Context, ruleId: String, state: String) {
    resetDayIfNeeded(context)
    prefs(context).edit().putString("limit.$ruleId", state).apply()
  }

  fun siteSeconds(context: Context, ruleId: String): Long {
    resetDayIfNeeded(context)
    return prefs(context).getLong("site.$ruleId", 0)
  }

  fun addSiteSeconds(context: Context, ruleId: String, seconds: Long) {
    if (seconds <= 0) return
    prefs(context).edit().putLong("site.$ruleId", siteSeconds(context, ruleId) + seconds).apply()
  }

  // ---- Event queue ----

  fun enqueue(context: Context, type: String, ruleId: String?) {
    synchronized(queueLock) {
      val queue = loadQueue(context)
      queue.put(JSONObject().apply {
        put("id", UUID.randomUUID().toString())
        put("type", type)
        put("occurred_at", isoNow())
        put("payload", JSONObject().apply { if (ruleId != null) put("rule_id", ruleId) })
      })
      val trimmed = if (queue.length() > 500) JSONArray((queue.length() - 500 until queue.length()).map { queue.get(it) }) else queue
      prefs(context).edit().putString("queue", trimmed.toString()).apply()
    }
  }

  // One alert a minute at most for the same blocked app.
  fun recordAttempt(context: Context, ruleId: String) {
    val key = "attempt.$ruleId"
    val now = System.currentTimeMillis()
    if (now - prefs(context).getLong(key, 0) < 60_000) return
    prefs(context).edit().putLong(key, now).apply()
    enqueue(context, "blocked_attempt", ruleId)
    checkInAsync(context, "attempt")
  }

  private fun loadQueue(context: Context): JSONArray =
    prefs(context).getString("queue", null)?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()

  fun queuedCount(context: Context): Int = loadQueue(context).length()

  // ---- Network (blocking: call from a background thread) ----

  private fun post(context: Context, path: String, body: JSONObject): Boolean {
    val config = loadConfig(context) ?: return false
    return try {
      val connection = URL("${config.getString("apiBase")}/$path").openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.connectTimeout = 10_000
      connection.readTimeout = 10_000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("x-beseen-device", "${config.getString("deviceId")}.${config.getString("deviceSecret")}")
      connection.outputStream.use { it.write(body.toString().toByteArray()) }
      val ok = connection.responseCode in 200..299
      connection.disconnect()
      ok
    } catch (e: Exception) {
      Log.w(TAG, "POST $path failed: ${e.message}")
      false
    }
  }

  fun flush(context: Context) {
    val (batch, ids) = synchronized(queueLock) {
      val queue = loadQueue(context)
      val batch = JSONArray((0 until minOf(queue.length(), 100)).map { queue.get(it) })
      batch to (0 until batch.length()).map { batch.getJSONObject(it).getString("id") }.toSet()
    }
    if (batch.length() == 0) return
    if (!post(context, "device/events", JSONObject().put("events", batch))) return
    synchronized(queueLock) {
      val queue = loadQueue(context)
      val remaining = JSONArray((0 until queue.length()).map { queue.getJSONObject(it) }.filter { it.getString("id") !in ids })
      prefs(context).edit().putString("queue", remaining.toString()).apply()
    }
  }

  fun heartbeat(context: Context, source: String, overrides: Map<String, Boolean> = emptyMap()) {
    val status = JSONObject()
    statusFlags(context).forEach { (key, value) -> status.put(key, value) }
    overrides.forEach { (key, value) -> status.put(key, value) }
    post(context, "device/heartbeat", JSONObject().apply {
      put("source", source)
      put("status", status)
      put("timezone", TimeZone.getDefault().id)
      put("app_version", runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
      }.getOrNull() ?: "")
    })
  }

  fun checkIn(context: Context, source: String, overrides: Map<String, Boolean> = emptyMap()) {
    flush(context)
    heartbeat(context, source, overrides)
  }

  fun checkInAsync(context: Context, source: String, overrides: Map<String, Boolean> = emptyMap()) {
    val app = context.applicationContext
    thread(name = "beseen-checkin") { checkIn(app, source, overrides) }
  }

  // ---- Permission status ----

  fun isAccessibilityEnabled(context: Context): Boolean {
    val expected = ComponentName(context, BlockerService::class.java).flattenToString()
    val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
    return enabled.split(':').any { ComponentName.unflattenFromString(it)?.flattenToString() == expected }
  }

  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  // Null when offline, so a lost connection isn't mistaken for switching the filter off.
  // An empty string means Private DNS is off or automatic.
  fun privateDnsHost(context: Context): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
    val cm = context.getSystemService(ConnectivityManager::class.java) ?: return null
    val network = cm.activeNetwork ?: return null
    return cm.getLinkProperties(network)?.privateDnsServerName ?: ""
  }

  fun isFamilyDns(host: String?): Boolean = host != null && FAMILY_DNS.any { host.equals(it, ignoreCase = true) }

  // Keys match what the server watches (snake_case).
  fun statusFlags(context: Context): Map<String, Boolean> {
    val flags = mutableMapOf(
      "accessibility" to isAccessibilityEnabled(context),
      "accessibility_running" to (BlockerService.instance != null),
      "usage_access" to hasUsageAccess(context),
      "notifications" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
    )
    privateDnsHost(context)?.let { flags["adult_filter"] = isFamilyDns(it) }
    return flags
  }

  private fun isoNow(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
}
