import { useState } from "react";
import { Alert, Share } from "react-native";
import { call, errorMessage } from "@/lib/api";
import { registerPush } from "@/lib/push";
import { useStore } from "@/lib/store";
import { Body, Button, Card, Field, Screen, Title } from "@/ui/components";
import { FakeEvents } from "@/ui/FakeEvents";

export default function PartnerScreen() {
  const { state, refresh } = useStore();
  const partner = state?.partner ?? null;
  const [partnerName, setPartnerName] = useState("");
  const [myName, setMyName] = useState(state?.me.display_name ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      Alert.alert("That didn't work", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function share(url: string, name: string) {
    await Share.share({
      message:
        `${name}, I'm using BeSeen to keep myself honest with my phone. Will you be my accountability partner? ` +
        `You'd only get a short alert if I slip, never screenshots or browsing history. Tap to accept: ${url}`,
    });
  }

  async function invite() {
    const name = partnerName.trim();
    if (!name || !myName.trim()) {
      Alert.alert("Two names needed", "Add their first name and yours, so they know who the invite is from.");
      return;
    }
    await run("invite", async () => {
      const { invite_url } = await call<{ invite_url: string }>("partner/invite", { partner_name: name, my_name: myName.trim() });
      await refresh();
      registerPush(true); // so you hear when they accept
      await share(invite_url, name);
    });
  }

  if (!partner) {
    return (
      <Screen>
        <Title>Choose your partner</Title>
        <Body muted>
          Pick someone you trust. They get a short alert when you go over a limit, try to open something you blocked, loosen a
          rule, or switch BeSeen off. Nothing else.
        </Body>
        <Field label="Their first name" value={partnerName} onChangeText={setPartnerName} placeholder="Alex" maxLength={60} />
        <Field label="Your first name (so they know it's you)" value={myName} onChangeText={setMyName} placeholder="Sam" maxLength={60} />
        <Button title="Create invite link" onPress={invite} busy={busy === "invite"} />
        <Body muted>You'll send the link yourself, by text, WhatsApp or anything else. They pick email or app alerts when they open it.</Body>
      </Screen>
    );
  }

  if (partner.status === "invited") {
    return (
      <Screen>
        <Title>Waiting for {partner.name}</Title>
        <Body muted>
          Once {partner.name} opens your link and accepts, they'll start getting your alerts. Until then, nobody sees when you slip.
        </Body>
        <Button
          title="Send the invite again"
          busy={busy === "resend"}
          onPress={() =>
            run("resend", async () => {
              const { invite_url } = await call<{ invite_url: string }>("partner/new-link");
              await share(invite_url, partner.name);
            })
          }
        />
        <Button
          title="Cancel invite"
          kind="secondary"
          busy={busy === "cancel"}
          onPress={() =>
            run("cancel", async () => {
              await call("partner/cancel-invite");
              await refresh();
            })
          }
        />
        <Body muted>A new link replaces the old one. Links last 7 days.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{partner.name} is your partner</Title>
      <Body muted>
        {partner.name} gets your alerts {partner.channel === "email" ? "by email" : "in the BeSeen app"}.
      </Body>
      <Card style={{ paddingVertical: 16, gap: 12 }}>
        <Body>Check that alerts reach {partner.name}:</Body>
        <Button
          title="Send a test alert"
          kind="secondary"
          busy={busy === "test"}
          onPress={() =>
            run("test", async () => {
              await call("partner/test");
              Alert.alert("Sent", `${partner.name} should get a test alert in a moment.`);
            })
          }
        />
      </Card>
      {__DEV__ && <FakeEvents rule={state?.rules[0]} />}
      <Button
        title={`Remove ${partner.name}`}
        kind="danger"
        busy={busy === "remove"}
        onPress={() =>
          Alert.alert(`Remove ${partner.name}?`, `${partner.name} will be told that you removed them.`, [
            { text: "Keep", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () =>
                run("remove", async () => {
                  await call("partner/remove");
                  await refresh();
                }),
            },
          ])
        }
      />
    </Screen>
  );
}
