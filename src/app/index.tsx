import { router } from "expo-router";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SCREEN_TIME_BUILD } from "@/lib/api";
import { describeRule, formatWhen, timeUntil } from "@/lib/format";
import { BeSeenNative, missingPermissions } from "@/lib/native";
import { useStore } from "@/lib/store";
import type { Rule } from "@/lib/types";
import { Body, Button, Card, Heading, Row, Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

export default function Home() {
  const { state, status, error, loading } = useStore();
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

  return (
    <Screen>
      {partner?.status !== "active" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/partner")}
          style={[styles.banner, { backgroundColor: t.warning }]}
        >
          <Text style={[styles.bannerTitle, { color: t.warningText }]}>You don't have a partner yet.</Text>
          <Text style={[styles.bannerBody, { color: t.warningText }]}>Nobody will see when you slip.</Text>
        </Pressable>
      )}

      {error && (
        <Card>
          <Body style={{ paddingVertical: 12, color: t.danger }}>{error}</Body>
        </Card>
      )}

      {(!BeSeenNative || (Platform.OS === "ios" && !SCREEN_TIME_BUILD)) && (
        <Card>
          <Body muted style={{ paddingVertical: 12 }}>
            {BeSeenNative
              ? "This test build doesn't include Screen Time (Apple hasn't approved it yet), so rules are saved but not enforced."
              : "Running without BeSeen's native code (Expo Go), so rules are saved but not enforced on this phone."}
          </Body>
        </Card>
      )}

      {missing.length > 0 && (
        <Card>
          <Row
            title={`Turn on ${missing.join(" and ")}`}
            subtitle="BeSeen can't enforce your rules until you do."
            onPress={() => router.push("/setup")}
            last
          />
        </Card>
      )}

      <Heading>Partner</Heading>
      <Card>
        <Row
          title={partner ? partner.name : "Add a partner"}
          subtitle={
            !partner
              ? "Someone who gets told when you slip"
              : partner.status === "invited"
                ? "Invite sent. Waiting for them to accept."
                : partner.channel === "email"
                  ? "Gets your alerts by email"
                  : "Gets your alerts in the BeSeen app"
          }
          onPress={() => router.push("/partner")}
          last
        />
      </Card>

      <Heading>Your rules</Heading>
      <Card>
        {state?.rules.length ? (
          state.rules.map((rule, i) => <RuleRow key={rule.id} rule={rule} last={i === state.rules.length - 1} />)
        ) : (
          <Body muted style={{ paddingVertical: 14 }}>
            No rules yet. Add the apps or websites you want to keep in check.
          </Body>
        )}
      </Card>
      <Button title="Add a rule" onPress={() => router.push("/add-rule")} />

      {state?.partner_of.map((p) => (
        <View key={p.id} style={{ gap: 16 }}>
          <Heading>You're {p.user_name}'s partner</Heading>
          <Card>
            {p.alerts.length ? (
              p.alerts.slice(0, 5).map((a, i) => (
                <Row key={a.created_at + i} title={a.body} subtitle={formatWhen(a.created_at)} last={i === Math.min(4, p.alerts.length - 1)} />
              ))
            ) : (
              <Body muted style={{ paddingVertical: 14 }}>
                No alerts. You'll get a notification if {p.user_name} slips.
              </Body>
            )}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

function RuleRow({ rule, last }: { rule: Rule; last: boolean }) {
  const pending = rule.pending;
  const subtitle = pending
    ? `${describeRule(rule)} · ${pending.kind === "remove" ? "Removed" : `Becomes ${describeRule(pending.after!).toLowerCase()}`} in ${timeUntil(pending.effective_at)}`
    : describeRule(rule);
  return <Row title={rule.label} subtitle={subtitle} onPress={() => router.push({ pathname: "/rule/[id]", params: { id: rule.id } })} last={last} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: { borderRadius: 16, padding: 20, gap: 4 },
  bannerTitle: { fontSize: 22, fontWeight: "800" },
  bannerBody: { fontSize: 18, fontWeight: "500" },
});
