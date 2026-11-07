import "@/lib/background";
import "@/lib/push";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider } from "@/lib/store";
import { useTheme } from "@/ui/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.accent,
            headerTitleStyle: { color: t.text },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "BeSeen" }} />
          <Stack.Screen name="add-rule" options={{ title: "New rule", presentation: "modal" }} />
          <Stack.Screen name="rule/[id]" options={{ title: "Rule" }} />
          <Stack.Screen name="partner" options={{ title: "Partner" }} />
          <Stack.Screen name="setup" options={{ title: "Permissions" }} />
          <Stack.Screen name="accept" options={{ title: "Be a partner", presentation: "modal" }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
