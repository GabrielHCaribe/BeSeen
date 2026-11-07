package expo.modules.beseennative

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

// Checks in every 15 minutes (Android may stretch this in Doze). If check-ins stop, the server tells the partner.
class HeartbeatWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    Core.checkIn(applicationContext, "worker")
    return Result.success()
  }

  companion object {
    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context.applicationContext)
        .enqueueUniquePeriodicWork("beseen-heartbeat", ExistingPeriodicWorkPolicy.KEEP, request)
    }
  }
}
