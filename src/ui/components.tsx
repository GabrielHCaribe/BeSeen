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
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.muted} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow }, style]}>
      {children}
    </View>
  );
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
  const filled = kind === "primary";
  const color = kind === "danger" ? t.danger : filled ? t.accentText : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        filled && { backgroundColor: t.accent },
        kind === "secondary" && { borderColor: t.border, borderWidth: 1, backgroundColor: t.surface },
        kind === "danger" && { backgroundColor: t.dangerSoft },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
        disabled && { opacity: 0.5 },
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
        pressed && { opacity: 0.6 },
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

function toneColors(t: Theme, tone: Tone) {
  switch (tone) {
    case "success":
      return { fg: t.success, bg: t.successSoft };
    case "warning":
      return { fg: t.warning, bg: t.warningSoft };
    case "danger":
      return { fg: t.danger, bg: t.dangerSoft };
    case "muted":
      return { fg: t.muted, bg: t.background };
    default:
      return { fg: t.accent, bg: t.subtle };
  }
}

// A round tinted badge holding a symbol or a letter, used at the start of rows.
export function IconBadge({ glyph, tone = "accent", size = 36 }: { glyph: string; tone?: Tone; size?: number }) {
  const t = useTheme();
  const { fg, bg } = toneColors(t, tone);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: size * 0.45, fontWeight: "700" }}>{glyph}</Text>
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
        { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.subtle : t.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ color: selected ? t.accent : t.text, fontWeight: selected ? "700" : "500", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }, style]}
        {...rest}
      />
    </View>
  );
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const t = useTheme();
  const { fg, bg } = toneColors(t, ok ? "success" : "danger");
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </View>
  );
}

// 0–1. Animates whenever the value changes.
export function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  const [width] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(width, { toValue: Math.max(0, Math.min(1, value)), duration: 700, useNativeDriver: false }).start();
  }, [value, width]);
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
        ]}
      />
    </View>
  );
}

// Fades and lifts its children in when first shown.
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 56 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4, marginBottom: -6, marginLeft: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 23 },
  button: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonText: { fontSize: 17, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  rowSubtitle: { fontSize: 14, marginTop: 2, lineHeight: 19 },
  chevron: { fontSize: 26, marginTop: -2 },
  badge: { alignItems: "center", justifyContent: "center" },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
