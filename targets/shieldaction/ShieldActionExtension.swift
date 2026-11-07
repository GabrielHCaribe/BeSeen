import Foundation
import ManagedSettings

class ShieldActionExtension: ShieldActionDelegate {
  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(to: action, rule: BeSeenCore.rule(forApp: application) ?? BeSeenCore.onlyCategoryRule(), completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(to: action, rule: BeSeenCore.rule(forWeb: webDomain), completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(to: action, rule: BeSeenCore.rule(forCategory: category), completionHandler)
  }

  private func respond(
    to action: ShieldAction,
    rule: CoreRule?,
    _ completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    guard let rule else { return completionHandler(.close) }
    let done = Completion(completionHandler)

    switch action {
    case .primaryButtonPressed:
      // Close. On a blocked app this is the "tried to open it" signal; on a limit it means they stopped.
      if rule.mode == "block" { BeSeenCore.recordAttempt(rule.id) }
      BeSeenCore.flush { done.call(.close) }
    case .secondaryButtonPressed:
      guard rule.mode == "limit" else { return completionHandler(.close) }
      // Keep going: lift the shield until midnight and tell the partner.
      BeSeenCore.setLimitState(rule.id, "overridden")
      BeSeenCore.unshield(rule.id)
      BeSeenCore.enqueue("limit_exceeded", ruleId: rule.id)
      BeSeenCore.flush { done.call(.defer) }
    @unknown default:
      completionHandler(.close)
    }
  }
}

// Lets the non-Sendable completion handler cross into URLSession's callback.
private final class Completion: @unchecked Sendable {
  private let handler: (ShieldActionResponse) -> Void
  init(_ handler: @escaping (ShieldActionResponse) -> Void) { self.handler = handler }
  func call(_ response: ShieldActionResponse) { DispatchQueue.main.async { self.handler(response) } }
}
