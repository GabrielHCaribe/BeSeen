// The three iOS Screen Time extensions need the same core code as the app's native module, but
// CocoaPods can't share source files with extension targets. modules/beseen-native/ios/BeSeenCore.swift
// is the single source; this copies it into each extension folder before the iOS build.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const EXTENSIONS = ["monitor", "shieldconfig", "shieldaction"];

module.exports = function withBeSeenExtensions(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const root = modConfig.modRequest.projectRoot;
      const source = path.join(root, "modules", "beseen-native", "ios", "BeSeenCore.swift");
      for (const name of EXTENSIONS) {
        fs.copyFileSync(source, path.join(root, "targets", name, "BeSeenCore.swift"));
      }
      return modConfig;
    },
  ]);
};
