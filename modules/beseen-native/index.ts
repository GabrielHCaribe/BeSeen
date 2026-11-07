import { requireOptionalNativeModule } from "expo";

export type RuleMode = "block" | "limit";
export type TargetType = "selection" | "app" | "site" | "adult_sites";

// Nulls are left out before crossing to native code (see src/lib/native.ts).
export interface NativeRule {
  id: string;
  label: string;
  mode: RuleMode;
  limitMinutes?: number;
  targetType: TargetType;
  target?: string;
}

export interface NativeConfig {
  apiBase: string;
  deviceId: string;
  deviceSecret: string;
  partnerName?: string;
}

export type ScreenTimeStatus = "approved" | "denied" | "notDetermined";

export interface IosStatus {
  platform: "ios";
  screenTime: ScreenTimeStatus;
  monitoringError?: string;
  queued: number;
}

export interface AndroidStatus {
  platform: "android";
  accessibility: boolean;
  accessibilityRunning: boolean;
  usageAccess: boolean;
  notifications: boolean;
  adultFilter: boolean;
  privateDnsHost: string | null;
  queued: number;
}

export type NativeStatus = IosStatus | AndroidStatus;

export interface PickedCounts {
  apps: number;
  categories: number;
  sites: number;
}

export interface InstalledApp {
  packageName: string;
  label: string;
  icon: string | null; // base64 PNG
}

export type SettingsScreen = "accessibility" | "usage" | "app" | "battery" | "network" | "notifications";

interface BeSeenNativeModule {
  configure(config: NativeConfig): Promise<void>;
  getStatus(): Promise<NativeStatus>;
  applyRules(rules: NativeRule[]): Promise<void>;
  checkIn(source: string): Promise<void>;
  consumeFreshInstall(): Promise<boolean>;
  // iOS only
  requestAuthorization?(): Promise<ScreenTimeStatus>;
  pickActivities?(ruleId: string): Promise<PickedCounts | null>;
  discardSelection?(ruleId: string): Promise<void>;
  // Android only
  getInstalledApps?(): Promise<InstalledApp[]>;
  openSettings?(screen: SettingsScreen): Promise<void>;
  startMonitorService?(): Promise<void>;
}

// Null in Expo Go, where custom native code isn't available. The app still runs, without blocking.
export const BeSeenNative = requireOptionalNativeModule<BeSeenNativeModule>("BeSeenNative");
