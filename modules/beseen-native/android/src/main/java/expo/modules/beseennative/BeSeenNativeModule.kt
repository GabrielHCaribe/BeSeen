package expo.modules.beseennative

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import androidx.core.graphics.drawable.toBitmap
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

class BeSeenNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BeSeenNative")

    AsyncFunction("configure") { config: Map<String, Any?> ->
      Core.saveConfig(context, JSONObject(config))
      HeartbeatWorker.schedule(context)
      MonitorService.refresh(context)
    }

    AsyncFunction("getStatus") {
      val flags = Core.statusFlags(context)
      mapOf(
        "platform" to "android",
        "accessibility" to flags["accessibility"],
        "accessibilityRunning" to flags["accessibility_running"],
        "usageAccess" to flags["usage_access"],
        "notifications" to flags["notifications"],
        "adultFilter" to (flags["adult_filter"] ?: false),
        "privateDnsHost" to Core.privateDnsHost(context),
        "queued" to Core.queuedCount(context),
      )
    }

    AsyncFunction("applyRules") { rules: List<Map<String, Any?>> ->
      Core.saveRules(context, JSONArray(rules.map { JSONObject(it) }))
      BlockerService.instance?.rulesChanged()
    }

    AsyncFunction("checkIn") { source: String ->
      Core.checkIn(context, source)
    }

    // Android wipes everything on uninstall, so this only matters on iOS; kept for a uniform API.
    AsyncFunction("consumeFreshInstall") {
      val prefs = Core.prefs(context)
      val fresh = !prefs.getBoolean("installMarker", false)
      if (fresh) prefs.edit().putBoolean("installMarker", true).apply()
      fresh
    }

    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val activities = if (Build.VERSION.SDK_INT >= 33) {
        pm.queryIntentActivities(launcher, PackageManager.ResolveInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(launcher, 0)
      }
      activities
        .map { it.activityInfo.packageName }
        .distinct()
        .filter { it != context.packageName }
        .mapNotNull { pkg ->
          runCatching {
            val info = pm.getApplicationInfo(pkg, 0)
            mapOf("packageName" to pkg, "label" to pm.getApplicationLabel(info).toString(), "icon" to iconBase64(pm, pkg))
          }.getOrNull()
        }
        .sortedBy { (it["label"] as String).lowercase() }
    }

    AsyncFunction("openSettings") { which: String ->
      val pkgUri = Uri.parse("package:${context.packageName}")
      val intent = when (which) {
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "usage" -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        "app" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri)
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        "network" -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else -> Intent(Settings.ACTION_SETTINGS)
      }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (e: Exception) {
        context.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    AsyncFunction("startMonitorService") {
      MonitorService.start(context)
    }
  }

  private fun iconBase64(pm: PackageManager, pkg: String): String? = runCatching {
    val bitmap = pm.getApplicationIcon(pkg).toBitmap(96, 96, Bitmap.Config.ARGB_8888)
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }.getOrNull()
}
