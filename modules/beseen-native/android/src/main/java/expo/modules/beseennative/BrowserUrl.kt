package expo.modules.beseennative

import android.view.accessibility.AccessibilityNodeInfo

// Reads the address bar of common browsers. In-app browsers (e.g. links opened inside Instagram)
// and unknown browsers aren't covered.
object BrowserUrl {
  private val ADDRESS_BAR_IDS = mapOf(
    "com.android.chrome" to listOf("url_bar"),
    "com.chrome.beta" to listOf("url_bar"),
    "com.chrome.dev" to listOf("url_bar"),
    "com.chrome.canary" to listOf("url_bar"),
    "com.google.android.apps.chrome" to listOf("url_bar"),
    "com.microsoft.emmx" to listOf("url_bar"),
    "com.brave.browser" to listOf("url_bar"),
    "com.vivaldi.browser" to listOf("url_bar"),
    "com.kiwibrowser.browser" to listOf("url_bar"),
    "com.sec.android.app.sbrowser" to listOf("location_bar_edit_text", "url_bar_text"),
    "org.mozilla.firefox" to listOf("mozac_browser_toolbar_url_view", "url_bar_title"),
    "org.mozilla.firefox_beta" to listOf("mozac_browser_toolbar_url_view", "url_bar_title"),
    "org.mozilla.focus" to listOf("display_url", "mozac_browser_toolbar_url_view"),
    "com.opera.browser" to listOf("url_field"),
    "com.opera.mini.native" to listOf("url_field"),
    "com.duckduckgo.mobile.android" to listOf("omnibarTextInput"),
  )

  val packages: Set<String> = ADDRESS_BAR_IDS.keys

  fun read(root: AccessibilityNodeInfo, packageName: String): String? {
    val ids = ADDRESS_BAR_IDS[packageName] ?: return null
    for (id in ids) {
      val nodes = root.findAccessibilityNodeInfosByViewId("$packageName:id/$id")
      val text = nodes.firstNotNullOfOrNull { it.text?.toString()?.trim()?.takeIf(String::isNotEmpty) }
      if (text != null) return text
    }
    return null
  }

  fun host(text: String): String? {
    val withoutScheme = text.lowercase().substringAfter("://")
    val host = withoutScheme.substringBefore('/').substringBefore('?').substringBefore(':').removePrefix("www.")
    return host.takeIf { it.contains('.') && !it.contains(' ') }
  }

  fun matches(host: String, domain: String): Boolean = host == domain || host.endsWith(".$domain")
}
