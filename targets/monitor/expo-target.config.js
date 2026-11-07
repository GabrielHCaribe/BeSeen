// Wakes up at the start of each day, every 3 hours (heartbeat), and when a daily limit is reached.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "device-activity-monitor",
  name: "BeSeenMonitor",
  bundleIdentifier: ".monitor",
  deploymentTarget: "16.4",
  entitlements: {
    "com.apple.developer.family-controls": true,
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
