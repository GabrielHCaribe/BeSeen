import { existsSync } from "fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

// ---------------------------------------------------------------------------------------------
// Fill these in once (see docs/SETUP.md). Bundle IDs must be final before you ask Apple for the
// Family Controls entitlement, because Apple approves each exact ID.
const IOS_BUNDLE_ID = "com.gabrielhcaribe.beseen";
const ANDROID_PACKAGE = "com.gabrielhcaribe.beseen";
const APPLE_TEAM_ID = ""; // 10 characters, developer.apple.com → Account → Membership details
const EAS_PROJECT_ID = ""; // printed by `npx eas-cli init`
const API_URL = "https://YOUR-PROJECT-REF.supabase.co/functions/v1/api";
// ---------------------------------------------------------------------------------------------

// Apple must approve Family Controls before any iPhone build that includes it can be installed.
// Until then, the "development-basic" EAS profile sets this to "off": no Screen Time, no extensions,
// everything else (main screen, partner, alerts, heartbeat) works.
const SCREEN_TIME = process.env.BESEEN_SCREEN_TIME !== "off";

const APP_GROUP = `group.${IOS_BUNDLE_ID}`;
// Android push needs Firebase; without this file the app still works, just without push on Android.
const GOOGLE_SERVICES = "./google-services.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "BeSeen",
  slug: "beseen",
  scheme: "beseen",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    appleTeamId: APPLE_TEAM_ID || undefined,
    supportsTablet: false,
    entitlements: {
      ...(SCREEN_TIME ? { "com.apple.developer.family-controls": true } : {}),
      "com.apple.security.application-groups": [APP_GROUP],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    googleServicesFile: existsSync(GOOGLE_SERVICES) ? GOOGLE_SERVICES : undefined,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-background-task",
    "expo-localization",
    ["expo-notifications", { enableBackgroundRemoteNotifications: true }],
    ...(SCREEN_TIME ? ["@bacons/apple-targets", "./plugins/withBeSeenExtensions"] : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: API_URL,
    screenTime: SCREEN_TIME,
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
  },
});
