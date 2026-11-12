import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type HostInstance,
  type ScrollViewInstance,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { type Theme, useTheme } from "./theme";

// Lets a text field inside a Screen ask to be scrolled above the keyboard.
const KeyboardReveal = createContext<((field: HostInstance | null) => void) | null>(null);

// Space kept between the bottom of a focused field and the top of the keyboard.
const KEYBOARD_GAP = 24;

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
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const focused = useRef<HostInstance | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Scroll just enough that the focused field sits above the keyboard. Measured on screen, so it
  // works the same on iOS and Android, in sheets and full screens.
  function reveal(field: HostInstance | null) {
    const top = keyboardTop.current;
    if (!field || top === null) return;
    field.measureInWindow((_x, y, _w, height) => {
      const overlap = y + height + KEYBOARD_GAP - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
    });
    // Reveal once the keyboard is fully up and the extra bottom space below has been laid out.
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setTimeout(() => reveal(focused.current), 100);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      shown.remove();
      hide.remove();
    };
  }, []);

  function onFieldFocus(field: HostInstance | null) {
    focused.current = field;
    // Moving between fields with the keyboard already up: no keyboard event follows, so reveal now.
    if (keyboardTop.current !== null) setTimeout(() => reveal(field), 100);
  }

  return (
    <KeyboardReveal.Provider value={onFieldFocus}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: t.background }}
        // Extra room under the content while the keyboard is up, so everything can scroll above it.
        contentContainerStyle={[styles.screen, { paddingBottom: styles.screen.paddingBottom + keyboardHeight }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        indicatorStyle="white"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.muted} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardReveal.Provider>
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

// Two or three mutually exclusive options in one bar, like the iOS segmented control.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.border, backgroundColor: t.surface }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: t.raised, borderColor: t.borderStrong },
              pressed && !selected && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.segmentText, { color: selected ? t.text : t.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// "45" over "min", "1½" over "hours": the number carries the tile, the unit stays quiet.
function splitMinutes(m: number): [string, string] {
  const hours = Math.floor(m / 60);
  if (m >= 60 && m % 60 === 0) return [String(hours), hours === 1 ? "hour" : "hours"];
  if (m >= 60 && m % 30 === 0) return [`${hours}½`, "hours"];
  return [String(m), "min"];
}

// A grid of daily-limit choices. Three to a row.
export function TimeGrid({ choices, value, onChange }: { choices: number[]; value: number | null; onChange: (m: number) => void }) {
  const t = useTheme();
  return (
    <View style={styles.timeGrid}>
      {choices.map((m) => {
        const selected = m === value;
        const [num, unit] = splitMinutes(m);
        return (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityLabel={`${num} ${unit}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(m)}
            style={({ pressed }) => [
              styles.timeTile,
              { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.subtle : t.surface },
              pressed && !selected && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.timeNumber, { color: selected ? t.accent : t.text }]}>{num}</Text>
            <Text style={[styles.timeUnit, { color: selected ? t.accent : t.muted }]}>{unit}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const reveal = useContext(KeyboardReveal);
  const ref = useRef<HostInstance>(null);
  const { label, style, onFocus, ...rest } = props;
  return (
    <View ref={ref} style={{ gap: 10 }}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        selectionColor={t.accent}
        keyboardAppearance="dark"
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }, style]}
        onFocus={(e) => {
          reveal?.(ref.current);
          onFocus?.(e);
        }}
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
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 11, borderWidth: 1, borderColor: "transparent" },
  segmentText: { fontSize: 15, fontWeight: "500" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeTile: { flexBasis: "30%", flexGrow: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 2 },
  timeNumber: { fontSize: 26, fontWeight: "300", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  timeUnit: { fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 2 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  track: { height: 3, borderRadius: 2 },
  fill: { height: 3, borderRadius: 2 },
});
