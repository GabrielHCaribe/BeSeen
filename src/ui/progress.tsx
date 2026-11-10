import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Progress } from "@/lib/types";
import { Button, Card, FadeIn, IconBadge, ProgressBar, Row } from "./components";
import { useTheme } from "./theme";

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

// A fixed scatter of faint stars and the glow of a planet just off the card's corner.
// Seeded, so the sky looks the same on every render.
const STARS = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 46 }, () => ({
    left: `${rand() * 100}%` as const,
    top: `${rand() * 100}%` as const,
    size: rand() < 0.85 ? 1 : 2,
    opacity: 0.15 + rand() * 0.55,
  }));
})();

function Starfield() {
  const t = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.planet, { boxShadow: `0px 0px 90px 30px ${t.accent}26` }]} />
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{ position: "absolute", left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: 1, opacity: s.opacity, backgroundColor: "#FFFFFF" }}
        />
      ))}
    </View>
  );
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
    <View style={[styles.hero, { backgroundColor: t.hero, borderColor: t.border }]}>
      <Starfield />
      <Text style={[styles.heroLabel, { color: t.heroMuted }]}>Current streak</Text>
      <View style={styles.heroNumberRow}>
        <Text style={[styles.heroNumber, { color: t.heroText }]}>{progress.streak_days}</Text>
        <Text style={[styles.heroUnit, { color: t.heroText }]}>{progress.streak_days === 1 ? "day kept" : "days kept"}</Text>
      </View>
      <Text style={[styles.heroLine, { color: t.heroMuted }]}>{headline(progress)}</Text>

      <WeekStrip week={progress.week} />

      <View style={{ gap: 8 }}>
        <ProgressBar value={fraction} color={t.accent} track={t.heroTrack} />
        <Text style={[styles.heroSmall, { color: t.heroMuted }]}>
          {days(next - progress.streak_days)} to your {next}-day milestone
        </Text>
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
            ? { backgroundColor: t.heroText, boxShadow: `0px 0px 10px ${t.heroText}66` }
            : d.state === "slipped"
              ? { borderWidth: 1, borderColor: t.danger }
              : d.state === "today"
                ? { borderWidth: 1, borderColor: t.accent }
                : { borderWidth: 1, borderColor: t.heroTrack };
        return (
          <View key={d.date} style={styles.day} accessibilityLabel={`${d.date}: ${d.state}`}>
            <View style={[styles.dot, dot]}>
              {d.state === "kept" ? <Text style={{ color: t.hero, fontWeight: "700", fontSize: 11 }}>✓</Text> : null}
              {d.state === "slipped" ? <Text style={{ color: t.danger, fontSize: 10 }}>✕</Text> : null}
            </View>
            <Text style={[styles.dayLetter, { color: d.state === "today" ? t.accent : t.heroMuted }]}>{letter}</Text>
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
      <Text style={{ color: t.text, fontSize: 34, fontWeight: "200", letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{label}</Text>
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
      <Card style={{ paddingVertical: 24, paddingHorizontal: 20, gap: 12, alignItems: "center", borderColor: t.accent + "55" }}>
        <Text style={{ color: t.accent, fontSize: 11, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase" }}>Milestone</Text>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: "300", letterSpacing: -0.6, textAlign: "center" }}>{days(streak)} kept</Text>
        <Text style={{ color: t.muted, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 6 }}>
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
    <Card style={{ paddingTop: 18, gap: 4 }}>
      <View style={{ gap: 10, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "500" }}>Finish setting up</Text>
          <Text style={{ color: t.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
            {done} of {items.length}
          </Text>
        </View>
        <ProgressBar value={done / items.length} color={t.accent} track={t.border} />
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
  hero: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 20, overflow: "hidden" },
  planet: { position: "absolute", width: 140, height: 140, borderRadius: 70, top: -70, right: -50, backgroundColor: "#0D1422" },
  heroLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 2, marginBottom: -16 },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  heroNumber: { fontSize: 88, fontWeight: "200", letterSpacing: -4, fontVariant: ["tabular-nums"] },
  heroUnit: { fontSize: 17, fontWeight: "400" },
  heroLine: { fontSize: 15, lineHeight: 21, marginTop: -14 },
  heroSmall: { fontSize: 13 },
  week: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  day: { alignItems: "center", gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dayLetter: { fontSize: 11, fontWeight: "500" },
});
