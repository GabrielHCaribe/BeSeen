import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Alert } from "react-native";
import { call, errorMessage } from "@/lib/api";
import type { Rule } from "@/lib/types";
import { Body, Button, Card } from "./components";

// Development builds only: sends the same events the blocking code sends, so the whole alert path
// (server, throttling, email/push) can be tested before Screen Time or Accessibility is working.
export function FakeEvents({ rule }: { rule: Rule | undefined }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function send(type: string) {
    setBusy(type);
    try {
      const result = await call<{ accepted: number }>("device/events", {
        events: [
          {
            id: Crypto.randomUUID(),
            type,
            occurred_at: new Date().toISOString(),
            payload: rule ? { rule_id: rule.id } : {},
          },
        ],
      });
      Alert.alert("Sent", result.accepted ? "Check your partner's inbox or phone." : "The server ignored it (duplicate).");
    } catch (e) {
      Alert.alert("Failed", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ paddingVertical: 16, gap: 10 }}>
      <Body muted>Developer: fake events{rule ? ` (using rule "${rule.label}")` : " (add a rule first for named alerts)"}</Body>
      <Button title="Went over a limit" kind="secondary" busy={busy === "limit_exceeded"} onPress={() => send("limit_exceeded")} />
      <Button title="Tried to open a blocked app" kind="secondary" busy={busy === "blocked_attempt"} onPress={() => send("blocked_attempt")} />
      <Button title="Started uninstalling" kind="secondary" busy={busy === "uninstall_started"} onPress={() => send("uninstall_started")} />
    </Card>
  );
}
