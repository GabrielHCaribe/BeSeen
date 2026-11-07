import ManagedSettings
import ManagedSettingsUI
import UIKit

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    build(BeSeenCore.rule(forApp: application.token) ?? BeSeenCore.onlyCategoryRule(), name: application.localizedDisplayName)
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    build(
      BeSeenCore.rule(forApp: application.token) ?? BeSeenCore.rule(forCategory: category.token),
      name: application.localizedDisplayName
    )
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    build(BeSeenCore.rule(forWeb: webDomain.token), name: webDomain.domain)
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    build(BeSeenCore.rule(forWeb: webDomain.token) ?? BeSeenCore.rule(forCategory: category.token), name: webDomain.domain)
  }

  private func build(_ rule: CoreRule?, name: String?) -> ShieldConfiguration {
    let partner = BeSeenCore.loadConfig()?.partnerName
    let thing = name ?? rule?.label ?? "This"
    let accent = UIColor(red: 0.27, green: 0.36, blue: 0.86, alpha: 1)

    if rule?.mode == "limit", let minutes = rule?.limitMinutes {
      let tell = partner.map { " If you keep going, \($0) will be told." } ?? ""
      return ShieldConfiguration(
        backgroundBlurStyle: .systemThickMaterial,
        title: .init(text: "Time's up for today", color: .label),
        subtitle: .init(text: "You've used your \(minutes) minutes on \(rule?.label ?? thing).\(tell)", color: .secondaryLabel),
        primaryButtonLabel: .init(text: "Close", color: .white),
        primaryButtonBackgroundColor: accent,
        secondaryButtonLabel: .init(text: partner.map { "Keep going (\($0) will be told)" } ?? "Keep going", color: accent)
      )
    }

    let tell = partner.map { " \($0) is told when you try to open it." } ?? ""
    return ShieldConfiguration(
      backgroundBlurStyle: .systemThickMaterial,
      title: .init(text: "\(thing) is blocked", color: .label),
      subtitle: .init(text: "You chose to block this with BeSeen.\(tell)", color: .secondaryLabel),
      primaryButtonLabel: .init(text: "Close", color: .white),
      primaryButtonBackgroundColor: accent
    )
  }
}
