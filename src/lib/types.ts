import type { RuleMode, TargetType } from "@modules/beseen-native";

export type { RuleMode, TargetType };

export interface RuleShape {
  mode: RuleMode;
  limit_minutes: number | null;
}

export interface PendingChange {
  id: string;
  kind: "change" | "remove";
  after: RuleShape | null;
  effective_at: string;
}

export interface Rule extends RuleShape {
  id: string;
  label: string;
  target_type: TargetType;
  target: string | null;
  pending: PendingChange | null;
}

export interface PartnerInfo {
  id: string;
  name: string;
  status: "invited" | "active";
  channel: "email" | "push" | null;
  invite_expires_at: string | null;
}

export interface Alert {
  title: string;
  body: string;
  created_at: string;
}

export interface Supporting {
  id: string;
  user_name: string;
  alerts: Alert[];
}

export interface ServerState {
  server_time: string;
  cooldown_hours: number;
  me: { display_name: string | null };
  partner: PartnerInfo | null;
  rules: Rule[];
  partner_of: Supporting[];
}

export interface Credentials {
  deviceId: string;
  deviceSecret: string;
}
