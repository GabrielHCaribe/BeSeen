import "@/lib/background";
import "@/lib/push";
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider } from "@/lib/store";
import { fonts, useTheme } from "@/ui/theme";

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    [fonts.pixel]: PressStart2P_400Regular,
    [fonts.text]: VT323_400Regular,
  });

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.accent,
            headerTitleStyle: { color: t.text, fontFamily: fonts.pixel, fontSize: 13 },
            headerLargeTitleStyle: { color: t.text, fontFamily: fonts.pixel, fontSize: 24 },
            headerBackTitleStyle: { fontFamily: fonts.text, fontSize: 20 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "BeSeen", headerLargeTitle: true }} />
          <Stack.Screen name="add-rule" options={{ title: "New rule", presentation: "modal" }} />
          <Stack.Screen name="rule/[id]" options={{ title: "Rule" }} />
          <Stack.Screen name="partner" options={{ title: "Partner" }} />
          <Stack.Screen name="setup" options={{ title: "Permissions" }} />
          <Stack.Screen name="accept" options={{ title: "Be a partner", presentation: "modal" }} />
        </Stack>
        {/* Cover the screens for the moment the fonts take to load; on failure, system fonts show instead. */}
        {fontsLoaded || fontError ? null : (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.background }} />
        )}
      </StoreProvider>
    </SafeAreaProvider>
  );
}
