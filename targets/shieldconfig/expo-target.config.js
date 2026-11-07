// Draws BeSeen's block screen in place of a blocked app or site.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "shield-config",
  name: "BeSeenShieldConfig",
  bundleIdentifier: ".shieldconfig",
  deploymentTarget: "16.4",
  entitlements: {
    "com.apple.developer.family-controls": true,
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
