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

export interface Progress {
  started_at: string;
  streak_days: number; // days kept in a row, counting today unless today has a slip
  best_days: number;
  slipped_today: boolean;
  resisted_today: number;
  resisted_total: number;
  week: { date: string; state: "kept" | "slipped" | "today" | "before" }[]; // oldest first, ends today
}

export interface ServerState {
  server_time: string;
  cooldown_hours: number;
  me: { display_name: string | null };
  progress?: Progress; // missing from servers older than the progress card
  partner: PartnerInfo | null;
  rules: Rule[];
  partner_of: Supporting[];
}

export interface Credentials {
  deviceId: string;
  deviceSecret: string;
}
