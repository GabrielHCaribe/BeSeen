import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { call, errorMessage } from "@/lib/api";
import { registerPush } from "@/lib/push";
import { useStore } from "@/lib/store";
import { Body, Button, Screen, Title } from "@/ui/components";
import { useTheme } from "@/ui/theme";

// Opened from the invite web page ("I have BeSeen") via beseen://accept?t=<token>.
export default function Accept() {
  const t = useTheme();
  const { t: token } = useLocalSearchParams<{ t?: string }>();
  const { refresh } = useStore();
  const [info, setInfo] = useState<{ user_name: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const error = token ? loadError : "This invite link is incomplete.";

  useEffect(() => {
    if (!token) return;
    call<{ user_name: string }>("public/invite-info", { token })
      .then(setInfo)
      .catch((e) => setLoadError(errorMessage(e)));
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      const allowed = await registerPush(true);
      if (!allowed) {
        Alert.alert(
          "Notifications are off",
          "You won't see alerts until you allow notifications for BeSeen in Settings. You can still accept now.",
        );
      }
      await call("partner/accept", { token });
      await refresh();
      setDone(true);
    } catch (e) {
      Alert.alert("Couldn't accept", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Screen>
        <Title>Invite not found</Title>
        <Body muted>{error}</Body>
        <Button title="Close" kind="secondary" onPress={() => router.replace("/")} />
      </Screen>
    );
  }
  if (!info) {
    return (
      <Screen>
        <ActivityIndicator color={t.muted} />
      </Screen>
    );
  }
  if (done) {
    return (
      <Screen>
        <Title>You're {info.user_name}'s partner</Title>
        <Body muted>You'll get a notification if they slip. Their alerts also show on BeSeen's main screen.</Body>
        <Button title="Done" onPress={() => router.replace("/")} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Title>{info.user_name} wants you as their accountability partner</Title>
      <Body>
        You'll get a short notification when {info.user_name} goes over a limit, tries to open something they blocked, loosens a
        rule, or switches BeSeen off. Never screenshots or browsing history.
      </Body>
      <Button title="Accept" onPress={accept} busy={busy} />
      <Button title="Not now" kind="plain" onPress={() => router.replace("/")} />
    </Screen>
  );
}
