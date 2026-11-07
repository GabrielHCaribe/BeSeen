// Shared by the app's native module and all three Screen Time extensions.
// This is the only copy to edit: plugins/withBeSeenExtensions.js copies it into each
// targets/<extension>/ folder at prebuild time.
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

struct CoreRule: Codable, Equatable {
  let id: String
  let label: String
  let mode: String // "block" | "limit"
  let limitMinutes: Int?
  let targetType: String // "selection" | "site" | "adult_sites"
  let target: String?
}

struct CoreConfig: Codable {
  var apiBase: String
  var deviceId: String
  var deviceSecret: String
  var partnerName: String?
}

struct QueuedEvent: Codable {
  let id: String
  let type: String
  let occurredAt: String
  let ruleId: String?
}

enum BeSeenCore {
  // com.x.beseen and com.x.beseen.<extension> all share group.com.x.beseen.
  static let appGroup: String = {
    let id = Bundle.main.bundleIdentifier ?? ""
    let isExtension = Bundle.main.bundleURL.pathExtension == "appex"
    let appId = isExtension ? id.split(separator: ".").dropLast().joined(separator: ".") : id
    return "group.\(appId)"
  }()

  static let dailyActivity = DeviceActivityName("beseen.daily")
  static let heartbeatCount = 8 // every 3 hours; Apple allows 20 monitored activities in total

  static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

  // MARK: - Storage

  private static func load<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
    guard let data = defaults.data(forKey: key) else { return nil }
    return try? JSONDecoder().decode(type, from: data)
  }

  private static func save<T: Encodable>(_ value: T, _ key: String) {
    if let data = try? JSONEncoder().encode(value) { defaults.set(data, forKey: key) }
  }

  static func loadConfig() -> CoreConfig? { load(CoreConfig.self, "config") }
  static func saveConfig(_ config: CoreConfig) { save(config, "config") }

  static func loadRules() -> [CoreRule] { load([CoreRule].self, "rules") ?? [] }
  static func saveRules(_ rules: [CoreRule]) { save(rules, "rules") }

  static func loadSelection(_ ruleId: String) -> FamilyActivitySelection? {
    load(FamilyActivitySelection.self, "sel.\(ruleId)")
  }

  static func saveSelection(_ selection: FamilyActivitySelection, for ruleId: String) {
    save(selection, "sel.\(ruleId)")
  }

  static func deleteSelection(_ ruleId: String) { defaults.removeObject(forKey: "sel.\(ruleId)") }

  static func today() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  static func isoNow() -> String { ISO8601DateFormatter().string(from: Date()) }

  // MARK: - Daily limit state ("reached" = shield up, "overridden" = they chose to keep going)

  static func limitState() -> [String: String] {
    guard defaults.string(forKey: "limitDay") == today() else { return [:] }
    return defaults.dictionary(forKey: "limitState") as? [String: String] ?? [:]
  }

  static func setLimitState(_ ruleId: String, _ value: String?) {
    resetDayIfNeeded()
    var state = limitState()
    state[ruleId] = value
    defaults.set(state, forKey: "limitState")
    defaults.set(today(), forKey: "limitDay")
  }

  // At the first run of a new day, lift yesterday's limit shields.
  static func resetDayIfNeeded() {
    guard defaults.string(forKey: "limitDay") != today() else { return }
    for rule in loadRules() where rule.mode == "limit" { unshield(rule.id) }
    defaults.set([String: String](), forKey: "limitState")
    defaults.set(today(), forKey: "limitDay")
  }

  // MARK: - Shields

  private static func ruleStore(_ ruleId: String) -> ManagedSettingsStore {
    ManagedSettingsStore(named: ManagedSettingsStore.Name("rule.\(ruleId)"))
  }

  static func shield(_ rule: CoreRule) {
    guard let selection = loadSelection(rule.id) else { return }
    let store = ruleStore(rule.id)
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
  }

  static func unshield(_ ruleId: String) { ruleStore(ruleId).clearAllSettings() }

  // Typed websites and the adult-site preset go through Apple's web content filter.
  private static func applyWebFilter(_ rules: [CoreRule]) {
    let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("web"))
    let domains = Set(rules.filter { $0.targetType == "site" }.compactMap(\.target).map { WebDomain(domain: $0) })
    if rules.contains(where: { $0.targetType == "adult_sites" }) {
      store.webContent.blockedByFilter = .auto(domains, except: [])
    } else if !domains.isEmpty {
      store.webContent.blockedByFilter = .specific(domains)
    } else {
      store.webContent.blockedByFilter = nil
    }
  }

  // Called by the app whenever the rules from the server change.
  static func apply(_ rules: [CoreRule]) {
    saveRules(rules)
    // Without Screen Time access (or in a build without the entitlement) there's nothing to enforce yet;
    // the next call after access is granted applies everything.
    guard AuthorizationCenter.shared.authorizationStatus == .approved else { return }
    let previous = Set(defaults.stringArray(forKey: "appliedIds") ?? [])
    let current = Set(rules.map(\.id))
    for gone in previous.subtracting(current) {
      unshield(gone)
      deleteSelection(gone)
    }
    resetDayIfNeeded()

    let state = limitState()
    for rule in rules where rule.targetType == "selection" {
      if rule.mode == "block" || state[rule.id] == "reached" { shield(rule) } else { unshield(rule.id) }
    }
    applyWebFilter(rules)
    startMonitoring(rules)
    defaults.set(Array(current), forKey: "appliedIds")
  }

  // MARK: - Device Activity (limits + heartbeat wake-ups)

  static func eventName(_ ruleId: String) -> DeviceActivityEvent.Name { DeviceActivityEvent.Name("limit.\(ruleId)") }

  static func ruleId(from event: DeviceActivityEvent.Name) -> String? {
    event.rawValue.hasPrefix("limit.") ? String(event.rawValue.dropFirst("limit.".count)) : nil
  }

  private static func startMonitoring(_ rules: [CoreRule]) {
    let center = DeviceActivityCenter()
    let limits = rules.filter { $0.mode == "limit" && $0.targetType == "selection" && $0.limitMinutes != nil }
    var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
    for rule in limits {
      guard let selection = loadSelection(rule.id), let minutes = rule.limitMinutes else { continue }
      events[eventName(rule.id)] = DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: DateComponents(hour: minutes / 60, minute: minutes % 60)
      )
    }

    // Restarting monitoring is rate limited by iOS, so only do it when the limits actually changed.
    let signature = limits.map { "\($0.id):\($0.limitMinutes ?? 0)" }.sorted().joined(separator: ",")
    let active = Set(center.activities)
    if signature != defaults.string(forKey: "monitorSignature") || !active.contains(dailyActivity) {
      center.stopMonitoring([dailyActivity])
      do {
        try center.startMonitoring(
          dailyActivity,
          during: DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
          ),
          events: events
        )
        defaults.set(signature, forKey: "monitorSignature")
        defaults.removeObject(forKey: "monitorError")
      } catch {
        defaults.set("\(error)", forKey: "monitorError")
      }
    }

    // Each window start wakes the monitor extension, which checks in with the server.
    for i in 0 ..< heartbeatCount {
      let name = DeviceActivityName("beseen.hb.\(i)")
      if active.contains(name) { continue }
      let start = i * 3
      do {
        try center.startMonitoring(
          name,
          during: DeviceActivitySchedule(
            intervalStart: DateComponents(hour: start, minute: 0),
            intervalEnd: DateComponents(hour: start + 2, minute: 45),
            repeats: true
          )
        )
      } catch {
        defaults.set("\(error)", forKey: "monitorError")
      }
    }
  }

  // MARK: - Finding the rule behind a shield

  // Only rules that are currently shielding can be behind a shield; blocks win over limits.
  private static func shieldingRules() -> [(CoreRule, FamilyActivitySelection)] {
    let state = limitState()
    let active = loadRules().filter { $0.targetType == "selection" && ($0.mode == "block" || state[$0.id] == "reached") }
    return (active.filter { $0.mode == "block" } + active.filter { $0.mode == "limit" })
      .compactMap { rule in loadSelection(rule.id).map { (rule, $0) } }
  }

  static func rule(forApp token: ApplicationToken?) -> CoreRule? {
    guard let token else { return nil }
    return shieldingRules().first { $0.1.applicationTokens.contains(token) }?.0
  }

  static func rule(forWeb token: WebDomainToken?) -> CoreRule? {
    guard let token else { return nil }
    return shieldingRules().first { $0.1.webDomainTokens.contains(token) }?.0
  }

  static func rule(forCategory token: ActivityCategoryToken?) -> CoreRule? {
    guard let token else { return nil }
    return shieldingRules().first { $0.1.categoryTokens.contains(token) }?.0
  }

  // An app blocked through a whole category arrives with only its own token. If exactly one
  // shielding rule uses categories, it must be that one.
  static func onlyCategoryRule() -> CoreRule? {
    let withCategories = shieldingRules().filter { !$0.1.categoryTokens.isEmpty }
    return withCategories.count == 1 ? withCategories[0].0 : nil
  }

  // MARK: - Events queue (sent to the server; survives being offline)

  private static let queueLock = NSLock()

  static func enqueue(_ type: String, ruleId: String?) {
    queueLock.lock()
    defer { queueLock.unlock() }
    var queue = load([QueuedEvent].self, "queue") ?? []
    queue.append(QueuedEvent(id: UUID().uuidString, type: type, occurredAt: isoNow(), ruleId: ruleId))
    if queue.count > 500 { queue.removeFirst(queue.count - 500) }
    save(queue, "queue")
  }

  static func queuedCount() -> Int { (load([QueuedEvent].self, "queue") ?? []).count }

  private static func dequeue(_ ids: Set<String>) {
    queueLock.lock()
    defer { queueLock.unlock() }
    let queue = (load([QueuedEvent].self, "queue") ?? []).filter { !ids.contains($0.id) }
    save(queue, "queue")
  }

  // One alert per minute at most for repeated taps on the same shield.
  static func recordAttempt(_ ruleId: String) {
    let key = "attempt.\(ruleId)"
    let now = Date().timeIntervalSince1970
    if now - defaults.double(forKey: key) < 60 { return }
    defaults.set(now, forKey: key)
    enqueue("blocked_attempt", ruleId: ruleId)
  }

  // MARK: - Network

  private static func makeRequest(_ path: String, _ body: [String: Any]) -> URLRequest? {
    guard let config = loadConfig(), let url = URL(string: "\(config.apiBase)/\(path)") else { return nil }
    var request = URLRequest(url: url, timeoutInterval: 8)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("\(config.deviceId).\(config.deviceSecret)", forHTTPHeaderField: "x-beseen-device")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    return request
  }

  private static func send(_ path: String, _ body: [String: Any], completion: @escaping @Sendable (Bool) -> Void) {
    guard let request = makeRequest(path, body) else { return completion(false) }
    URLSession.shared.dataTask(with: request) { _, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      completion((200 ..< 300).contains(status))
    }.resume()
  }

  // Extensions are killed as soon as their callback returns, so they wait for the request to finish.
  private static func sendAndWait(_ path: String, _ body: [String: Any]) -> Bool {
    let semaphore = DispatchSemaphore(value: 0)
    let result = ResultBox()
    send(path, body) { ok in
      result.ok = ok
      semaphore.signal()
    }
    _ = semaphore.wait(timeout: .now() + 9)
    return result.ok
  }

  private final class ResultBox: @unchecked Sendable { var ok = false }

  private static func eventsBody() -> ([String: Any], Set<String>)? {
    let queue = load([QueuedEvent].self, "queue") ?? []
    if queue.isEmpty { return nil }
    let events: [[String: Any]] = queue.prefix(100).map { event in
      var payload: [String: Any] = [:]
      if let ruleId = event.ruleId { payload["rule_id"] = ruleId }
      return ["id": event.id, "type": event.type, "occurred_at": event.occurredAt, "payload": payload]
    }
    return (["events": events], Set(queue.prefix(100).map(\.id)))
  }

  static func flushAndWait() {
    guard let (body, ids) = eventsBody() else { return }
    if sendAndWait("device/events", body) { dequeue(ids) }
  }

  static func flush(completion: @escaping @Sendable () -> Void) {
    guard let (body, ids) = eventsBody() else { return completion() }
    send("device/events", body) { ok in
      if ok { dequeue(ids) }
      completion()
    }
  }

  // The status can read "not determined" for a moment after launch. A wrong "false" would tell the
  // partner that Screen Time was switched off, so give it a few seconds to settle first.
  private static func screenTimeApproved() -> Bool {
    for _ in 0 ..< 6 {
      if AuthorizationCenter.shared.authorizationStatus == .approved { return true }
      Thread.sleep(forTimeInterval: 0.5)
    }
    return false
  }

  // Extensions only run while Screen Time access is on, so only the app reports that flag.
  static func checkIn(source: String, reportAuthorization: Bool = false) {
    flushAndWait()
    var status: [String: Any] = [:]
    if reportAuthorization { status["screen_time"] = screenTimeApproved() }
    _ = sendAndWait("device/heartbeat", [
      "source": source,
      "status": status,
      "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
      "timezone": TimeZone.current.identifier,
    ])
  }
}
