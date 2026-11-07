import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { call, errorMessage } from "@/lib/api";
import { LIMIT_CHOICES } from "@/lib/constants";
import { describeRule, direction, formatWhen, minutesLabel, timeUntil } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { RuleShape } from "@/lib/types";
import { Body, Button, Card, Chip, Heading, Screen, Title } from "@/ui/components";

export default function RuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refresh } = useStore();
  const rule = state?.rules.find((r) => r.id === id);
  const [draft, setDraft] = useState<RuleShape | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!state || !rule) {
    return (
      <Screen>
        <Body muted>This rule no longer exists.</Body>
      </Screen>
    );
  }

  const partnerName = state.partner?.status === "active" ? state.partner.name : null;
  const cooldown = `${state.cooldown_hours} hours`;
  const blockOnly = rule.target_type === "adult_sites" || (rule.target_type === "site" && Platform.OS === "ios");
  const current: RuleShape = { mode: rule.mode, limit_minutes: rule.limit_minutes };
  const next = draft ?? current;
  const dir = direction(current, next);

  async function run(key: string, route: string, body: object) {
    setBusy(key);
    try {
      await call(route, body);
      await refresh();
      setDraft(null);
      return true;
    } catch (e) {
      Alert.alert("That didn't work", errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  function looserWarning(action: string) {
    return (
      `${action} is looser, so it waits ${cooldown} before it takes effect.` +
      (partnerName ? ` ${partnerName} will be told now.` : " You don't have a partner, so nobody will be told.")
    );
  }

  function saveChange() {
    const submit = () => run("change", "rules/change", { rule_id: rule!.id, ...next });
    if (dir === "stricter") return submit();
    Alert.alert("Loosen this rule?", looserWarning("This change"), [
      { text: "Keep my rule", style: "cancel" },
      { text: "Loosen", style: "destructive", onPress: submit },
    ]);
  }

  function removeRule() {
    Alert.alert("Remove this rule?", looserWarning("Removing a rule"), [
      { text: "Keep my rule", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => run("remove", "rules/remove", { rule_id: rule!.id }),
      },
    ]);
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Title>{rule.label}</Title>
        <Body muted>{describeRule(rule)}</Body>
      </View>

      {rule.pending ? (
        <Card style={{ paddingVertical: 16, gap: 12 }}>
          <Body>
            {rule.pending.kind === "remove"
              ? "This rule will be removed"
              : `This rule becomes ${describeRule(rule.pending.after!).toLowerCase()}`}{" "}
            in {timeUntil(rule.pending.effective_at)} ({formatWhen(rule.pending.effective_at)}).
          </Body>
          <Body muted>Changed your mind? Cancelling keeps the rule as it is{partnerName ? ` and tells ${partnerName}` : ""}.</Body>
          <Button
            title="Cancel the change"
            kind="secondary"
            busy={busy === "cancel"}
            onPress={() => run("cancel", "rules/cancel", { change_id: rule.pending!.id })}
          />
        </Card>
      ) : (
        <>
          <Heading>Change rule</Heading>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Block completely" selected={next.mode === "block"} onPress={() => setDraft({ mode: "block", limit_minutes: null })} />
            {!blockOnly && (
              <Chip
                label="Daily time limit"
                selected={next.mode === "limit"}
                onPress={() => setDraft({ mode: "limit", limit_minutes: rule.limit_minutes ?? 30 })}
              />
            )}
          </View>
          {next.mode === "limit" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {LIMIT_CHOICES.map((m) => (
                <Chip key={m} label={minutesLabel(m)} selected={next.limit_minutes === m} onPress={() => setDraft({ mode: "limit", limit_minutes: m })} />
              ))}
            </View>
          )}
          {dir !== "same" && (
            <>
              <Body muted>
                {dir === "stricter"
                  ? `Stricter: applies right away${partnerName ? ` and ${partnerName} is told` : ""}.`
                  : `Looser: takes effect in ${cooldown}${partnerName ? `, and ${partnerName} is told now` : ""}.`}
              </Body>
              <Button title="Save change" onPress={saveChange} busy={busy === "change"} />
            </>
          )}

          <View style={{ height: 8 }} />
          <Button title="Remove rule" kind="danger" onPress={removeRule} busy={busy === "remove"} />
          <Body muted>To change which apps are in this rule, remove it and add a new one.</Body>
        </>
      )}

      <Button title="Back" kind="plain" onPress={() => router.back()} />
    </Screen>
  );
}
