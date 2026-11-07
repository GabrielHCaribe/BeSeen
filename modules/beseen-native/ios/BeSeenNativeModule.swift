import ExpoModulesCore
import FamilyControls
import SwiftUI

public class BeSeenNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BeSeenNative")

    AsyncFunction("configure") { (config: [String: Any]) in
      let data = try JSONSerialization.data(withJSONObject: config)
      BeSeenCore.saveConfig(try JSONDecoder().decode(CoreConfig.self, from: data))
    }

    AsyncFunction("getStatus") { () -> [String: Any] in
      var status: [String: Any] = [
        "platform": "ios",
        "screenTime": Self.authorizationStatus(),
        "queued": BeSeenCore.queuedCount(),
      ]
      if let error = BeSeenCore.defaults.string(forKey: "monitorError") { status["monitoringError"] = error }
      return status
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
      } catch {
        // Declining throws; the status below tells the app what happened.
      }
      return Self.authorizationStatus()
    }

    AsyncFunction("applyRules") { (rules: [[String: Any]]) in
      let data = try JSONSerialization.data(withJSONObject: rules)
      BeSeenCore.apply(try JSONDecoder().decode([CoreRule].self, from: data))
    }

    AsyncFunction("checkIn") { (source: String) in
      BeSeenCore.checkIn(source: source, reportAuthorization: true)
    }

    // The Keychain survives uninstalling on iOS but this flag doesn't, which is how a reinstall is spotted.
    AsyncFunction("consumeFreshInstall") { () -> Bool in
      let key = "beseen.installMarker"
      if UserDefaults.standard.bool(forKey: key) { return false }
      UserDefaults.standard.set(true, forKey: key)
      return true
    }

    // Shows Apple's picker. The choice is stored on the phone under the rule id; BeSeen itself
    // never learns which apps were picked, only how many.
    AsyncFunction("pickActivities") { (ruleId: String, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_NO_VIEW", "Can't show the app picker right now.")
        return
      }
      let initial = BeSeenCore.loadSelection(ruleId) ?? FamilyActivitySelection()
      var controller: UIViewController?
      let sheet = ActivityPickerSheet(initial: initial) { result in
        controller?.dismiss(animated: true)
        guard let result else {
          promise.resolve()
          return
        }
        BeSeenCore.saveSelection(result, for: ruleId)
        promise.resolve([
          "apps": result.applicationTokens.count,
          "categories": result.categoryTokens.count,
          "sites": result.webDomainTokens.count,
        ])
      }
      let hosting = UIHostingController(rootView: sheet)
      hosting.isModalInPresentation = true // swipe-down would leave the promise hanging
      controller = hosting
      presenter.present(hosting, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("discardSelection") { (ruleId: String) in
      BeSeenCore.deleteSelection(ruleId)
    }
  }

  private static func authorizationStatus() -> String {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: return "approved"
    case .denied: return "denied"
    default: return "notDetermined"
    }
  }
}
