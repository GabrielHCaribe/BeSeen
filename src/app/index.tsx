import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SCREEN_TIME_BUILD } from "@/lib/api";
import { describeRule, formatWhen, timeUntil } from "@/lib/format";
import { BeSeenNative, missingPermissions } from "@/lib/native";
import { useStore } from "@/lib/store";
import type { Rule } from "@/lib/types";
import { Body, Button, Card, FadeIn, Heading, IconBadge, Row, Screen } from "@/ui/components";
import { MilestoneCelebration, SetupChecklist, StatsRow, StreakCard } from "@/ui/progress";
import { useTheme } from "@/ui/theme";

export default function Home() {
  const { state, status, error, loading, refresh } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const t = useTheme();

  if (loading && !state) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const partner = state?.partner ?? null;
  const missing = missingPermissions(status);
  const rules = state?.rules ?? [];
  const progress = state?.progress;
  const name = state?.me.display_name;

  const checklist = [
    ...(BeSeenNative && (Platform.OS !== "ios" || SCREEN_TIME_BUILD)
      ? [
        {
          title: Platform.OS === "ios" ? "Allow Screen Time" : "Turn on BeSeen",
          subtitle: missing.length ? `Needed to enforce your rules: ${missing.join(" and ")}` : "",
          done: missing.length === 0,
          onPress: () => router.push("/setup"),
        },
      ]
      : []),
    {
      title: "Add your first rule",
      subtitle: "Pick an app or site to block or limit",
      done: rules.length > 0,
      onPress: () => router.push("/add-rule"),
    },
    {
      title: partner?.status === "invited" ? `Waiting for ${partner.name}` : "Choose a partner",
      subtitle: partner?.status === "invited" ? "Send the invite again if they missed it" : "Right now nobody sees when you slip",
      done: partner?.status === "active",
      urgent: true,
      onPress: () => router.push("/partner"),
    },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
      }}
    >
      {name ? <Text style={[styles.greeting, { color: t.muted }]}>{greeting()}, {name}</Text> : null}

      {error && (
        <Card style={{ backgroundColor: t.dangerSoft, borderColor: t.dangerSoft }}>
          <Body style={{ paddingVertical: 12, color: t.danger }}>{error}</Body>
        </Card>
      )}

      {(!BeSeenNative || (Platform.OS === "ios" && !SCREEN_TIME_BUILD)) && (
        <Card>
          <Body muted style={{ paddingVertical: 12 }}>
            {BeSeenNative
              ? "This test build doesn't include Screen Time, so rules are saved but not enforced."
              : "Running without BeSeen's native code (Expo Go), so rules are saved but not enforced on this phone."}
          </Body>
        </Card>
      )}

      {progress && <MilestoneCelebration streak={progress.streak_days} />}

      {progress && (
        <FadeIn>
          <StreakCard progress={progress} />
        </FadeIn>
      )}

      <SetupChecklist items={checklist} />

      {progress && (
        <FadeIn delay={120}>
          <StatsRow progress={progress} />
        </FadeIn>
      )}

      <Heading>Your rules</Heading>
      <Card>
        {rules.length ? (
          rules.map((rule, i) => <RuleRow key={rule.id} rule={rule} last={i === rules.length - 1} />)
        ) : (
          <View style={styles.empty}>
            <IconBadge glyph="+" size={44} />
            <Body style={{ fontWeight: "700" }}>Nothing to keep in check yet</Body>
            <Body muted style={{ textAlign: "center" }}>
              Start with the one app that eats your time. You can add more later.
            </Body>
          </View>
        )}
      </Card>
      <Button title={rules.length ? "Add another rule" : "Add your first rule"} onPress={() => router.push("/add-rule")} />

      <Heading>Partner</Heading>
      <Card>
        <Row
          icon={
            <IconBadge
              glyph={partner ? partner.name.charAt(0).toUpperCase() : "?"}
              tone={partner?.status === "active" ? "success" : "warning"}
            />
          }
          title={partner ? partner.name : "No partner yet"}
          subtitle={
            !partner
              ? "Someone who gets told when you slip"
              : partner.status === "invited"
                ? "Invite sent. Waiting for them to accept."
                : partner.channel === "email"
                  ? "Sees your slips by email"
                  : "Sees your slips in the BeSeen app"
          }
          onPress={() => router.push("/partner")}
          last
        />
      </Card>

      {state?.partner_of.map((p) => (
        <View key={p.id} style={{ gap: 16 }}>
          <Heading>Supporting {p.user_name}</Heading>
          <Card>
            {p.alerts.length ? (
              p.alerts.slice(0, 5).map((a, i) => (
                <Row
                  key={a.created_at + i}
                  icon={<IconBadge glyph="!" tone="warning" size={32} />}
                  title={a.body}
                  subtitle={formatWhen(a.created_at)}
                  last={i === Math.min(4, p.alerts.length - 1)}
                />
              ))
            ) : (
              <View style={styles.empty}>
                <IconBadge glyph="✓" tone="success" size={44} />
                <Body muted style={{ textAlign: "center" }}>
                  All quiet. You'll get a notification if {p.user_name} slips.
                </Body>
              </View>
            )}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function RuleRow({ rule, last }: { rule: Rule; last: boolean }) {
  const pending = rule.pending;
  const subtitle = pending
    ? `${describeRule(rule)} · ${pending.kind === "remove" ? "Removed" : `Becomes ${describeRule(pending.after!).toLowerCase()}`} in ${timeUntil(pending.effective_at)}`
    : describeRule(rule);
  return (
    <Row
      icon={<IconBadge glyph={rule.mode === "block" ? "⊘" : "◷"} tone={pending ? "warning" : rule.mode === "block" ? "danger" : "accent"} />}
      title={rule.label}
      subtitle={subtitle}
      onPress={() => router.push({ pathname: "/rule/[id]", params: { id: rule.id } })}
      last={last}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 16, fontWeight: "600", marginBottom: -6, marginLeft: 4 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20, paddingHorizontal: 8 },
});
