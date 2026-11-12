import { Text, View } from "react-native";
import { Card, IconBadge, ProgressBar, Row } from "./components";
import { useTheme } from "./theme";

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
