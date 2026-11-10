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
import { fonts, hardShadow, px, type Theme, useTheme } from "./theme";

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
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

// A bordered window with a hard shadow, like a menu box in an old RPG.
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, hardShadow(t.shadow), style]}>
      {children}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[styles.heading, { color: t.muted }]}>
      <Text style={{ color: t.accent }}>▶ </Text>
      {children}
    </Text>
  );
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
  const plain = kind === "plain";
  const background = kind === "primary" ? t.accent : kind === "danger" ? t.danger : t.surface;
  const color = kind === "primary" ? t.accentText : kind === "danger" ? "#FFFFFF" : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        plain
          ? { borderColor: "transparent" }
          : [{ backgroundColor: background, borderColor: t.border }, !pressed && hardShadow(t.shadow)],
        // Pressing pushes the button down into its own shadow.
        pressed && !plain && { transform: [{ translateX: px.shadow }, { translateY: px.shadow }] },
        pressed && plain && { opacity: 0.6 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={plain ? t.accent : color} />
      ) : (
        <Text style={[styles.buttonText, { color: plain ? t.accent : color }]}>{title}</Text>
      )}
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
        !last && { borderBottomColor: t.border, borderBottomWidth: px.thin },
        pressed && { backgroundColor: t.subtle },
      ]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={[styles.chevron, { color: t.accent }]}>▶</Text> : null}
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

// The pixel font only has plain letters and digits; symbols fall back to the system font.
const PIXEL_GLYPH = /^[A-Za-z0-9?!+]$/;

// A square tinted tile holding a symbol or a letter, used at the start of rows.
export function IconBadge({ glyph, tone = "accent", size = 36 }: { glyph: string; tone?: Tone; size?: number }) {
  const t = useTheme();
  const { fg, bg } = toneColors(t, tone);
  const pixel = PIXEL_GLYPH.test(glyph);
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: bg, borderColor: fg }]}>
      <Text
        style={
          pixel
            ? { color: fg, fontFamily: fonts.pixel, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.5) }
            : { color: fg, fontSize: size * 0.48, fontWeight: "900" }
        }
      >
        {glyph}
      </Text>
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
        { borderColor: t.border, backgroundColor: selected ? t.accent : t.surface },
        selected ? { transform: [{ translateX: px.thin }, { translateY: px.thin }] } : hardShadow(t.shadow, px.thin),
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? t.accentText : t.text }]}>
        {selected ? "▶ " : ""}
        {label}
      </Text>
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
        selectionColor={t.accent}
        style={[
          styles.input,
          // Inset: dark edge top-left, so the box looks sunk into the page.
          { color: t.text, borderColor: t.border, backgroundColor: t.surface, boxShadow: `inset ${px.thin}px ${px.thin}px 0px 0px ${t.subtle}` },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const t = useTheme();
  const { fg, bg } = toneColors(t, ok ? "success" : "danger");
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const SEGMENTS = 10;

// 0–1, drawn as a segmented health bar. Animates whenever the value changes.
export function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  const t = useTheme();
  const [width] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(width, { toValue: Math.max(0, Math.min(1, value)), duration: 700, useNativeDriver: false }).start();
  }, [value, width]);
  return (
    <View style={[styles.track, { backgroundColor: track, borderColor: t.border }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
        ]}
      />
      <View style={styles.segments} pointerEvents="none">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View key={i} style={[styles.segment, i < SEGMENTS - 1 && { borderRightColor: track, borderRightWidth: px.thin }]} />
        ))}
      </View>
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
  screen: { padding: 16, gap: 18, paddingBottom: 56 },
  card: {
    borderRadius: 0,
    borderWidth: px.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginRight: px.shadow,
  },
  heading: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 16, textTransform: "uppercase", letterSpacing: 1, marginTop: 6, marginBottom: -6 },
  title: { fontFamily: fonts.pixel, fontSize: 17, lineHeight: 28 },
  body: { fontFamily: fonts.text, fontSize: 21, lineHeight: 24 },
  button: {
    minHeight: 54,
    borderRadius: 0,
    borderWidth: px.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginRight: px.shadow,
    marginBottom: px.shadow,
  },
  buttonText: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 18, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, marginHorizontal: -14, paddingHorizontal: 14 },
  rowTitle: { fontFamily: fonts.text, fontSize: 23, lineHeight: 25 },
  rowSubtitle: { fontFamily: fonts.text, fontSize: 18, marginTop: 2, lineHeight: 20 },
  chevron: { fontSize: 12 },
  badge: { alignItems: "center", justifyContent: "center", borderWidth: px.thin },
  chip: { borderWidth: px.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 7, marginRight: px.thin, marginBottom: px.thin },
  chipText: { fontFamily: fonts.text, fontSize: 21, lineHeight: 22 },
  fieldLabel: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 16 },
  input: { borderWidth: px.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10, fontSize: 23, fontFamily: fonts.text },
  pill: { borderRadius: 0, borderWidth: px.thin, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 16 },
  track: { height: 18, borderWidth: px.thin, overflow: "hidden" },
  fill: { height: "100%" },
  segments: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  segment: { flex: 1 },
});
