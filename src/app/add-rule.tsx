import type { InstalledApp, PickedCounts } from "@modules/beseen-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, View } from "react-native";
import { call, errorMessage, SCREEN_TIME_BUILD } from "@/lib/api";
import { ADULT_DNS_HOST, LIMIT_CHOICES } from "@/lib/constants";
import { DOMAIN_PATTERN, minutesLabel, normalizeDomain } from "@/lib/format";
import { BeSeenNative } from "@/lib/native";
import { useStore } from "@/lib/store";
import type { RuleMode, TargetType } from "@/lib/types";
import { Body, Button, Card, Chip, Field, Heading, Row, Screen } from "@/ui/components";
import { useTheme } from "@/ui/theme";

const KINDS: Record<"ios" | "android", { kind: TargetType; title: string; subtitle: string }[]> = {
  ios: [
    { kind: "selection", title: "Apps and websites", subtitle: "Pick from your iPhone's list" },
    { kind: "site", title: "A website", subtitle: "Type an address to block" },
    { kind: "adult_sites", title: "All adult websites", subtitle: "Uses Apple's built-in filter" },
  ],
  android: [
    { kind: "app", title: "An app", subtitle: "Pick from the apps on this phone" },
    { kind: "site", title: "A website", subtitle: "Type an address to block or limit" },
    { kind: "adult_sites", title: "All adult websites", subtitle: "Uses a family-safe DNS filter" },
  ],
};

export default function AddRule() {
  const { refresh, refreshStatus } = useStore();
  const t = useTheme();
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const [ruleId] = useState(() => Crypto.randomUUID());
  const [kind, setKind] = useState<TargetType | null>(null);
  const [picked, setPicked] = useState<PickedCounts | null>(null);
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [search, setSearch] = useState("");
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [site, setSite] = useState("");
  const [mode, setMode] = useState<RuleMode>("block");
  const [minutes, setMinutes] = useState(30);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const saved = useRef(false);

  // iOS stores the picked apps before the rule exists; throw them away if the rule is never saved.
  useEffect(() => () => {
    if (!saved.current) BeSeenNative?.discardSelection?.(ruleId).catch(() => {});
  }, [ruleId]);

  const blockOnly = kind === "adult_sites" || (platform === "ios" && kind === "site");
  const effectiveMode: RuleMode = blockOnly ? "block" : mode;

  async function choose(next: TargetType) {
    setKind(next);
    if (next === "adult_sites") setLabel("Adult websites");
    if (next === "selection") await pickOnIos();
    if (next === "app" && !apps) {
      setApps((await BeSeenNative?.getInstalledApps?.().catch(() => [])) ?? []);
    }
  }

  async function pickOnIos() {
    if (!BeSeenNative?.pickActivities || !BeSeenNative.requestAuthorization || !SCREEN_TIME_BUILD) {
      Alert.alert(
        "Not available in this build",
        "Picking apps needs a BeSeen build with Screen Time, which Apple has to approve first. You can still add a website.",
      );
      return;
    }
    const auth = await BeSeenNative.requestAuthorization();
    await refreshStatus();
    if (auth !== "approved") {
      Alert.alert("Screen Time access needed", "BeSeen uses Screen Time to block apps. Allow it, then try again.");
      return;
    }
    try {
      const result = await BeSeenNative.pickActivities(ruleId);
      if (result) setPicked(result);
    } catch (e) {
      Alert.alert("Couldn't open the picker", errorMessage(e));
    }
  }

  const matchingApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (apps ?? []).filter((a) => !q || a.label.toLowerCase().includes(q)).slice(0, 60);
  }, [apps, search]);

  const domain = normalizeDomain(site);
  const targetChosen =
    (kind === "selection" && picked) ||
    (kind === "app" && app) ||
    (kind === "site" && DOMAIN_PATTERN.test(domain)) ||
    kind === "adult_sites";
  const finalLabel = label.trim() || (kind === "app" ? app?.label : kind === "site" ? domain : "") || "";

  async function save() {
    if (!kind || !targetChosen) return;
    if (!finalLabel) {
      Alert.alert("Add a name", "Type the name your partner should see, like \"Instagram\".");
      return;
    }
    setSaving(true);
    try {
      await call("rules/create", {
        id: ruleId,
        label: finalLabel,
        target_type: kind,
        target: kind === "app" ? app!.packageName : kind === "site" ? domain : null,
        mode: effectiveMode,
        limit_minutes: effectiveMode === "limit" ? minutes : null,
      });
      saved.current = true;
      await refresh();
      router.back();
      if (kind === "adult_sites" && platform === "android") {
        Alert.alert(
          "One more step",
          `On Android this works through Private DNS. In Settings, open Network → Private DNS, choose "Private DNS provider hostname" and enter ${ADULT_DNS_HOST}. BeSeen will tell your partner if it's ever switched off.`,
          [{ text: "Later" }, { text: "Open Settings", onPress: () => BeSeenNative?.openSettings?.("network") }],
        );
      }
    } catch (e) {
      Alert.alert("Couldn't save the rule", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Heading>What do you want to keep in check?</Heading>
      <Card>
        {KINDS[platform].map((option, i) => (
          <Row
            key={option.kind}
            title={option.title}
            subtitle={
              option.kind === "selection" && kind === "selection" && picked
                ? `${describeCounts(picked)} chosen. Tap to change.`
                : option.subtitle
            }
            right={kind === option.kind ? <Body style={{ color: t.accent, fontWeight: "700" }}>✓</Body> : undefined}
            onPress={() => choose(option.kind)}
            last={i === KINDS[platform].length - 1}
          />
        ))}
      </Card>

      {kind === "app" && (
        <>
          <Field label="Find an app" value={search} onChangeText={setSearch} placeholder="Search" autoCorrect={false} />
          <Card>
            {apps === null ? (
              <ActivityIndicator style={{ paddingVertical: 16 }} color={t.accent} />
            ) : (
              matchingApps.map((a, i) => (
                <Row
                  key={a.packageName}
                  title={a.label}
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {app?.packageName === a.packageName && <Body style={{ color: t.accent, fontWeight: "700" }}>✓</Body>}
                      {a.icon ? <Image source={{ uri: `data:image/png;base64,${a.icon}` }} style={{ width: 28, height: 28 }} /> : null}
                    </View>
                  }
                  onPress={() => {
                    setApp(a);
                    setLabel(a.label);
                  }}
                  last={i === matchingApps.length - 1}
                />
              ))
            )}
          </Card>
        </>
      )}

      {kind === "site" && (
        <Field
          label="Website"
          value={site}
          onChangeText={(v) => {
            setSite(v);
            setLabel(normalizeDomain(v));
          }}
          placeholder="example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      )}

      {kind && targetChosen && (
        <>
          <Heading>Rule</Heading>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Block completely" selected={effectiveMode === "block"} onPress={() => setMode("block")} />
            {!blockOnly && <Chip label="Daily time limit" selected={effectiveMode === "limit"} onPress={() => setMode("limit")} />}
          </View>
          {effectiveMode === "limit" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {LIMIT_CHOICES.map((m) => (
                <Chip key={m} label={minutesLabel(m)} selected={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </View>
          )}
          {blockOnly && platform === "ios" && kind === "site" && (
            <Body muted>To set a time limit on a website, add it with "Apps and websites" instead.</Body>
          )}

          <Field
            label="Name your partner will see"
            value={label}
            onChangeText={setLabel}
            placeholder={kind === "selection" ? "e.g. Instagram" : finalLabel}
            maxLength={60}
          />
          {kind === "selection" && (
            <Body muted>iOS doesn't tell BeSeen which apps you picked, so this name is what your partner sees.</Body>
          )}

          <Button title="Save rule" onPress={save} busy={saving} />
        </>
      )}
    </Screen>
  );
}

function describeCounts(c: PickedCounts): string {
  const parts = [
    c.apps && `${c.apps} app${c.apps === 1 ? "" : "s"}`,
    c.categories && `${c.categories} categor${c.categories === 1 ? "y" : "ies"}`,
    c.sites && `${c.sites} site${c.sites === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.join(", ");
}
