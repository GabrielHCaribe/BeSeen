import type { SettingsScreen } from "@modules/beseen-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Switch } from "react-native";
import { ADULT_DNS_HOST } from "@/lib/constants";
import { BeSeenNative } from "@/lib/native";
import { registerPush } from "@/lib/push";
import { dailyRecapEnabled, setDailyRecap } from "@/lib/reminders";
import { checkIn } from "@/lib/session";
import { useStore } from "@/lib/store";
import { Body, Button, Card, Heading, Row, Screen, StatusPill, Title } from "@/ui/components";
import { useTheme } from "@/ui/theme";

const CONSENT_KEY = "beseen.accessibilityConsent";

export default function Setup() {
  const { status, refreshStatus, state } = useStore();

  // Coming back from Settings: show the new state and report it to the server straight away.
  useFocusEffect(
    useCallback(() => {
      refreshStatus();
      checkIn("setup").catch(() => {});
    }, [refreshStatus]),
  );

  if (!BeSeenNative || !status) {
    return (
      <Screen>
        <Body muted>Permissions need the BeSeen development build on a real phone.</Body>
      </Screen>
    );
  }

  if (status.platform === "ios") {
    const approved = status.screenTime === "approved";
    return (
      <Screen>
        <Title>Screen Time access</Title>
        <Body muted>
          BeSeen uses Apple's Screen Time to block apps and track your daily limits. Apple keeps the list of apps you pick private:
          BeSeen only knows the names you type.
        </Body>
        <Card>
          <Row title="Screen Time" right={<StatusPill ok={approved} label={approved ? "On" : "Off"} />} last />
        </Card>
        {!approved && (
          <Button
            title={status.screenTime === "denied" ? "Open Settings" : "Allow Screen Time access"}
            onPress={async () => {
              if (status.screenTime === "denied") return Linking.openSettings();
              await BeSeenNative?.requestAuthorization?.();
              await refreshStatus();
            }}
          />
        )}
        <Button title="Allow notifications" kind="secondary" onPress={() => registerPush(true)} />
        <DailyRecapToggle />
        {status.monitoringError ? <Body muted>Monitoring error: {status.monitoringError}</Body> : null}
        {status.queued > 0 ? <Body muted>{status.queued} alert(s) waiting to be sent.</Body> : null}
      </Screen>
    );
  }

  return <AndroidSetup hasAdultRule={!!state?.rules.some((r) => r.target_type === "adult_sites")} />;
}

function DailyRecapToggle() {
  const t = useTheme();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    dailyRecapEnabled().then(setOn);
  }, []);
  if (on === null) return null;
  return (
    <Card>
      <Row
        title="Evening recap"
        subtitle="A reminder at 8:30 pm to check your streak"
        right={
          <Switch
            trackColor={{ true: t.success, false: t.subtle }}
            thumbColor={t.surface}
            ios_backgroundColor={t.subtle}
            value={on}
            onValueChange={(next) => {
              setOn(next);
              setDailyRecap(next);
            }}
          />
        }
        last
      />
    </Card>
  );
}

function AndroidSetup({ hasAdultRule }: { hasAdultRule: boolean }) {
  const { status } = useStore();
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(CONSENT_KEY).then((v) => setConsented(v === "yes"));
  }, []);

  if (status?.platform !== "android" || consented === null) return null;
  const open = (screen: SettingsScreen) => BeSeenNative?.openSettings?.(screen);

  // Google Play requires this disclosure, with an explicit "I agree", before asking for Accessibility.
  if (!consented) {
    return (
      <Screen>
        <Title>Before you turn on Accessibility</Title>
        <Card style={{ paddingVertical: 16, gap: 12 }}>
          <Body>BeSeen uses Android's Accessibility service to:</Body>
          <Body>• see which app or website is on screen, so it can block the ones you chose and stop apps at your daily limit;</Body>
          <Body>• notice when the uninstall screen for BeSeen opens.</Body>
          <Body>
            When you slip, BeSeen sends a short alert to the partner you chose, for example "Went over 30 min on Instagram" or
            "Started uninstalling BeSeen". It names only the rule, never what you typed or read.
          </Body>
          <Body>
            BeSeen never records what you type, never takes screenshots, and never sends your browsing history. Nothing is sold or
            shared with anyone else.
          </Body>
        </Card>
        <Button
          title="I agree"
          onPress={async () => {
            await SecureStore.setItemAsync(CONSENT_KEY, "yes");
            setConsented(true);
          }}
        />
        <Button
          title="No thanks"
          kind="plain"
          onPress={() =>
            Alert.alert("BeSeen can't block apps without it", "You can come back to this screen any time from the main screen.")
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Turn on BeSeen</Title>
      <Card>
        <Row
          title="Accessibility"
          subtitle="Settings → Accessibility → BeSeen → On"
          right={<StatusPill ok={status.accessibility} label={status.accessibility ? "On" : "Off"} />}
          onPress={() => open("accessibility")}
        />
        <Row
          title="Usage access"
          subtitle="Needed for daily time limits"
          right={<StatusPill ok={status.usageAccess} label={status.usageAccess ? "On" : "Off"} />}
          onPress={() => open("usage")}
        />
        <Row
          title="Notifications"
          subtitle="Shows that BeSeen is running"
          right={<StatusPill ok={status.notifications} label={status.notifications ? "On" : "Off"} />}
          onPress={async () => {
            if (!(await registerPush(true))) open("notifications");
          }}
          last={!hasAdultRule}
        />
        {hasAdultRule && (
          <Row
            title="Adult-site filter"
            subtitle={`Private DNS: ${ADULT_DNS_HOST}`}
            right={<StatusPill ok={status.adultFilter} label={status.adultFilter ? "On" : "Off"} />}
            onPress={() => open("network")}
            last
          />
        )}
      </Card>

      <Heading>If something's greyed out or stops working</Heading>
      <Card>
        <Row
          title="Allow restricted settings"
          subtitle="If Accessibility is greyed out: App info → ⋮ → Allow restricted settings"
          onPress={() => open("app")}
        />
        <Row
          title="Battery"
          subtitle="Some phones stop BeSeen to save battery. Set BeSeen to Unrestricted."
          onPress={() => open("battery")}
          last
        />
      </Card>
      <Button title="Start status notification" kind="secondary" onPress={() => BeSeenNative?.startMonitorService?.()} />
      <DailyRecapToggle />
      {status.queued > 0 ? <Body muted>{status.queued} alert(s) waiting to be sent.</Body> : null}
    </Screen>
  );
}
