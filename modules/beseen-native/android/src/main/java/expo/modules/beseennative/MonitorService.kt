package expo.modules.beseennative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

// Google Play requires apps that report activity to another person to show a notification
// the whole time they run. This service exists only to keep that notification up.
class MonitorService : Service() {
  companion object {
    private const val CHANNEL = "beseen_status"
    private const val ID = 4242

    fun start(context: Context) {
      try {
        ContextCompat.startForegroundService(context, Intent(context, MonitorService::class.java))
      } catch (e: Exception) {
        // Android blocks starting it from the background; it starts next time the app or service runs.
        Log.w("BeSeen", "Couldn't start status notification: ${e.message}")
      }
    }

    fun refresh(context: Context) {
      if (Core.loadConfig(context) == null) return
      context.getSystemService(NotificationManager::class.java)?.notify(ID, build(context))
    }

    private fun build(context: Context): Notification {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager?.getNotificationChannel(CHANNEL) == null) {
        manager?.createNotificationChannel(
          NotificationChannel(CHANNEL, "BeSeen is on", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows while BeSeen is enforcing your rules"
            setShowBadge(false)
          },
        )
      }
      val partner = Core.partnerName(context)
      val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
      }
      return NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.beseen_notification)
        .setContentTitle("BeSeen is on")
        .setContentText(partner?.let { "$it gets an alert if you slip or switch BeSeen off." } ?: "Add a partner so someone sees when you slip.")
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setContentIntent(open)
        .build()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
    try {
      ServiceCompat.startForeground(this, ID, build(this), type)
    } catch (e: Exception) {
      Log.w("BeSeen", "startForeground failed: ${e.message}")
      stopSelf()
    }
    return START_STICKY
  }
}
