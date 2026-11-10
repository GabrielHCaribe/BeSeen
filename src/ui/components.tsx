import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { type Theme, useTheme } from "./theme";

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      indicatorStyle="white"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.muted} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.heading, { color: t.muted }]}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

type ButtonKind = "primary" | "secondary" | "danger" | "plain";

export function Button({
  title,
  onPress,
  kind = "primary",
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  busy?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = kind === "primary" ? t.primaryText : kind === "danger" ? t.danger : kind === "plain" ? t.muted : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" && { backgroundColor: t.primary },
        kind === "secondary" && { borderColor: t.border, borderWidth: 1 },
        kind === "danger" && { borderColor: t.dangerSoft, borderWidth: 1, backgroundColor: t.dangerSoft },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {busy ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function Row({
  title,
  subtitle,
  icon,
  right,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.55 },
      ]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={[styles.chevron, { color: t.muted }]}>›</Text> : null}
    </Pressable>
  );
}

type Tone = "accent" | "success" | "warning" | "danger" | "muted";

function toneColor(t: Theme, tone: Tone) {
  switch (tone) {
    case "success":
      return t.success;
    case "warning":
      return t.warning;
    case "danger":
      return t.danger;
    case "muted":
      return t.muted;
    default:
      return t.accent;
  }
}

// A thin outlined circle holding a symbol or a letter, used at the start of rows.
export function IconBadge({ glyph, tone = "accent", size = 36 }: { glyph: string; tone?: Tone; size?: number }) {
  const t = useTheme();
  const fg = toneColor(t, tone);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, borderColor: t.border }]}>
      <Text style={{ color: fg, fontSize: size * 0.42, fontWeight: "500" }}>{glyph}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : "transparent" },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ color: selected ? t.primaryText : t.text, fontWeight: selected ? "600" : "400", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        selectionColor={t.accent}
        keyboardAppearance="dark"
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }, style]}
        {...rest}
      />
    </View>
  );
}

// A small glowing dot and a word.
export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const t = useTheme();
  const color = ok ? t.success : t.danger;
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: color, boxShadow: `0px 0px 6px ${color}` }]} />
      <Text style={{ color: t.text, fontWeight: "500", fontSize: 14 }}>{label}</Text>
    </View>
  );
}

// 0–1, a thin line with a soft glow. Animates whenever the value changes.
export function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  const [width] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(width, { toValue: Math.max(0, Math.min(1, value)), duration: 900, useNativeDriver: false }).start();
  }, [value, width]);
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            boxShadow: `0px 0px 8px ${color}`,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

// Fades and lifts its children in when first shown.
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 600, delay, useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 12, gap: 16, paddingBottom: 64 },
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 2 },
  heading: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 2, marginTop: 14, marginBottom: -4, marginLeft: 2 },
  title: { fontSize: 30, fontWeight: "300", letterSpacing: -0.8, lineHeight: 36 },
  body: { fontSize: 16, lineHeight: 24 },
  button: { minHeight: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  buttonText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 15, gap: 14 },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSubtitle: { fontSize: 14, marginTop: 3, lineHeight: 19 },
  chevron: { fontSize: 22, fontWeight: "300", marginTop: -2 },
  badge: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  fieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 2 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  track: { height: 3, borderRadius: 2 },
  fill: { height: 3, borderRadius: 2 },
});
