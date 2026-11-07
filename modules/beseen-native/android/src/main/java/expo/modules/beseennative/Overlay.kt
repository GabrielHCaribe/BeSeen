package expo.modules.beseennative

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

// Full-screen block screen drawn by the accessibility service (no "display over other apps" permission needed).
class Overlay(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private var view: View? = null
  var ruleId: String? = null
    private set
  var ownerPackage: String? = null
    private set

  val isShowing get() = view != null

  data class Action(val label: String, val onTap: () -> Unit)

  fun show(ruleId: String, ownerPackage: String, title: String, body: String, primary: Action, secondary: Action? = null) {
    if (this.ruleId == ruleId && view != null) return
    hide()
    val density = service.resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()
    val accent = Color.rgb(69, 92, 219)

    val column = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(32), dp(32), dp(32), dp(32))
    }
    column.addView(TextView(service).apply {
      text = title
      textSize = 26f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    })
    column.addView(TextView(service).apply {
      text = body
      textSize = 17f
      setTextColor(Color.rgb(214, 211, 209))
      gravity = Gravity.CENTER
      setPadding(0, dp(16), 0, dp(32))
    })
    column.addView(Button(service).apply {
      text = primary.label
      isAllCaps = false
      textSize = 17f
      setTextColor(Color.WHITE)
      background = GradientDrawable().apply { setColor(accent); cornerRadius = dp(12).toFloat() }
      setOnClickListener { primary.onTap() }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)))
    if (secondary != null) {
      column.addView(Button(service).apply {
        text = secondary.label
        isAllCaps = false
        textSize = 15f
        setTextColor(Color.rgb(165, 180, 252))
        setBackgroundColor(Color.TRANSPARENT)
        setOnClickListener { secondary.onTap() }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(8) })
    }

    val root = FrameLayout(service).apply {
      setBackgroundColor(Color.argb(250, 17, 24, 39))
      addView(column, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    )
    windowManager.addView(root, params)
    view = root
    this.ruleId = ruleId
    this.ownerPackage = ownerPackage
  }

  fun hide() {
    view?.let { runCatching { windowManager.removeView(it) } }
    view = null
    ruleId = null
    ownerPackage = null
  }
}
