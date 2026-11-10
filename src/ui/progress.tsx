import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Progress } from "@/lib/types";
import { Button, Card, FadeIn, IconBadge, ProgressBar, Row } from "./components";
import { fonts, hardShadow, px, useTheme } from "./theme";

const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];
const CELEBRATED_KEY = "beseen.celebratedMilestone";

function days(n: number) {
  return `${n} day${n === 1 ? "" : "s"}`;
}

function nextMilestone(streak: number) {
  const next = MILESTONES.find((m) => m > streak) ?? Math.ceil((streak + 1) / 365) * 365;
  const previous = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  return { next, fraction: (streak - previous) / (next - previous) };
}

// One line under the big number. Never shames a slip: the point is to come back tomorrow.
function headline(p: Progress) {
  if (p.slipped_today) return "Today had a slip. Tomorrow starts a fresh streak.";
  if (p.streak_days === 1 && p.best_days <= 1) return "Day one. Every streak starts here.";
  if (p.streak_days >= p.best_days && p.streak_days >= 3) return "Your best streak yet. Keep it going.";
  return `Your best is ${days(p.best_days)}.`;
}

export function StreakCard({ progress }: { progress: Progress }) {
  const t = useTheme();
  const { next, fraction } = nextMilestone(progress.streak_days);
  return (
    <View style={[styles.hero, { backgroundColor: t.hero, borderColor: t.border }, hardShadow(t.shadow)]}>
      <View style={[styles.heroInner, { borderColor: t.heroFrame }]}>
        <Text style={[styles.heroLabel, { color: t.heroMuted }]}>Current streak</Text>
        <View style={styles.heroNumberRow}>
          <Text style={[styles.heroNumber, { color: t.heroText }]}>{progress.streak_days}</Text>
          <Text style={[styles.heroUnit, { color: t.heroText }]}>{progress.streak_days === 1 ? "day kept" : "days kept"}</Text>
        </View>
        <Text style={[styles.heroLine, { color: t.heroMuted }]}>{headline(progress)}</Text>

        <WeekStrip week={progress.week} />

        <View style={{ gap: 8 }}>
          <ProgressBar value={fraction} color={t.gold} track={t.heroTrack} />
          <Text style={[styles.heroSmall, { color: t.heroMuted }]}>
            {days(next - progress.streak_days)} to your {next}-day milestone
          </Text>
        </View>
      </View>
    </View>
  );
}

function WeekStrip({ week }: { week: Progress["week"] }) {
  const t = useTheme();
  return (
    <View style={styles.week}>
      {week.map((d) => {
        const letter = new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
        const dot =
          d.state === "kept"
            ? { backgroundColor: t.gold, borderColor: t.heroTrack }
            : d.state === "slipped"
              ? { backgroundColor: "transparent", borderColor: t.heroMuted }
              : d.state === "today"
                ? { backgroundColor: t.heroTrack, borderColor: t.heroText }
                : { backgroundColor: t.heroTrack, borderColor: t.heroTrack };
        return (
          <View key={d.date} style={styles.day} accessibilityLabel={`${d.date}: ${d.state}`}>
            <View style={[styles.dot, dot]}>
              {d.state === "kept" ? <Text style={{ color: t.heroTrack, fontWeight: "900", fontSize: 14 }}>✓</Text> : null}
              {d.state === "slipped" ? <Text style={{ color: t.heroMuted, fontWeight: "900", fontSize: 13 }}>✕</Text> : null}
            </View>
            <Text style={[styles.dayLetter, { color: d.state === "today" ? t.heroText : t.heroMuted }]}>{letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StatsRow({ progress }: { progress: Progress }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Stat value={progress.resisted_today} label={progress.resisted_today === 1 ? "time you held back today" : "times you held back today"} />
      <Stat value={progress.best_days} label="best streak (days)" />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, paddingVertical: 14, gap: 2 }}>
      <Text style={{ color: t.text, fontFamily: fonts.pixel, fontSize: 22, lineHeight: 34 }}>{value}</Text>
      <Text style={{ color: t.muted, fontFamily: fonts.text, fontSize: 18, lineHeight: 19 }}>{label}</Text>
    </Card>
  );
}

// Shown once when the streak lands on a milestone.
export function MilestoneCelebration({ streak }: { streak: number }) {
  const t = useTheme();
  const [celebrated, setCelebrated] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    SecureStore.getItemAsync(CELEBRATED_KEY).then(setCelebrated).catch(() => setCelebrated(null));
  }, []);

  if (celebrated === undefined || !MILESTONES.includes(streak) || celebrated === String(streak)) return null;

  return (
    <FadeIn>
      <Card style={{ paddingVertical: 18, gap: 12, alignItems: "center", borderColor: t.gold, borderWidth: px.border + 1 }}>
        <Text style={{ fontSize: 40, color: t.gold }}>★</Text>
        <Text style={{ color: t.text, fontFamily: fonts.pixel, fontSize: 16, lineHeight: 26, textAlign: "center" }}>{days(streak)} kept!</Text>
        <Text style={{ color: t.muted, fontFamily: fonts.text, fontSize: 21, textAlign: "center", lineHeight: 23 }}>
          That's a real habit forming. Your next milestone is {nextMilestone(streak).next} days.
        </Text>
        <View style={{ alignSelf: "stretch" }}>
          <Button
            title="Keep going"
            onPress={() => {
              setCelebrated(String(streak));
              SecureStore.setItemAsync(CELEBRATED_KEY, String(streak)).catch(() => {});
            }}
          />
        </View>
      </Card>
    </FadeIn>
  );
}

export interface ChecklistItem {
  title: string;
  subtitle: string;
  done: boolean;
  urgent?: boolean;
  onPress: () => void;
}

// First-run steps. Disappears once everything is done.
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const t = useTheme();
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return (
    <Card style={{ paddingTop: 16, gap: 4 }}>
      <View style={{ gap: 10, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: t.text, fontFamily: fonts.pixel, fontSize: 12, lineHeight: 20 }}>Finish setting up</Text>
          <Text style={{ color: t.muted, fontFamily: fonts.text, fontSize: 20 }}>
            {done} of {items.length}
          </Text>
        </View>
        <ProgressBar value={done / items.length} color={t.success} track={t.subtle} />
      </View>
      {items.map((item, i) => (
        <Row
          key={item.title}
          icon={
            <IconBadge
              glyph={item.done ? "✓" : String(i + 1)}
              tone={item.done ? "success" : item.urgent ? "warning" : "accent"}
              size={32}
            />
          }
          title={item.title}
          subtitle={item.done ? "Done" : item.subtitle}
          onPress={item.done ? undefined : item.onPress}
          last={i === items.length - 1}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 0, borderWidth: px.border, padding: 4, marginRight: px.shadow },
  // Second frame inside the first: the double border of an RPG dialog window.
  heroInner: { borderWidth: px.thin, padding: 16, gap: 16 },
  heroLabel: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 16, textTransform: "uppercase", letterSpacing: 1, marginBottom: -10 },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  heroNumber: { fontFamily: fonts.pixel, fontSize: 48, lineHeight: 64, textShadowColor: "#1A1C2C", textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  heroUnit: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 18 },
  heroLine: { fontFamily: fonts.text, fontSize: 21, lineHeight: 23, marginTop: -10 },
  heroSmall: { fontFamily: fonts.text, fontSize: 19 },
  week: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: 6 },
  dot: { width: 30, height: 30, borderWidth: px.thin, alignItems: "center", justifyContent: "center" },
  dayLetter: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 14 },
});
