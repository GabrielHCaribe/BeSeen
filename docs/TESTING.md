# Testing BeSeen on real phones

Follow `docs/SETUP.md` first. You build in the cloud (EAS) and install on the phone; your PC then serves the
JavaScript, so most code changes show up instantly without a new build.

## Builds you'll use

| Profile | Use it for | Command |
|---|---|---|
| `development-basic` | iPhone **before** Apple approves Family Controls. No blocking, everything else works | `npx eas-cli@latest build -p ios --profile development-basic` |
| `development` | iPhone after approval (all 4 IDs), and Android | `npx eas-cli@latest build -p ios --profile development`<br>`npx eas-cli@latest build -p android --profile development` |

When the build finishes, EAS shows a link and QR code. On the iPhone, open it in the Camera app → Install. On Android,
open the link → download the APK → allow "Install unknown apps" for your browser.

Then on your PC:

```sh
npx expo start --dev-client          # phone and PC on the same Wi-Fi
npx expo start --dev-client --tunnel # if they aren't
```

Open BeSeen on the phone; it finds the dev server. You only need a new build when native code
(`modules/`, `targets/`, `app.config.ts`) changes. The free plan includes 15 builds a month per platform.

**Looking at the backend while testing:** Supabase dashboard → Table Editor → `devices` (check-ins and permission
status), `events` (everything that happened and whether it was sent), `deliveries` (exactly what the partner received).
Edge Function logs: Supabase → Edge Functions → api → Logs.

**Speeding up the waits:** `npx supabase@latest secrets set COOLDOWN_HOURS=0.05 SILENCE_HOURS=0.5` gives a
3-minute cooldown and a 30-minute silence alert. Set them back to 24 and 12 afterwards.

---

## Milestone A: app shell, main screen, no-partner banner

Works on `development-basic` (iPhone) and `development` (Android).

- [ ] The app opens straight into the main screen. No sign-up, no login.
- [ ] A big orange banner at the top: "You don't have a partner yet. Nobody will see when you slip."
- [ ] Supabase → `devices` has a new row for your phone (an anonymous identity).
- [ ] Add a rule → "A website" → `example.com` → Block → Save. It appears in "Your rules".
- [ ] Close the app completely and reopen it: same rules, no new row in `devices`.
- [ ] Airplane mode → reopen → a clear "Can't reach BeSeen" message, no crash.

## Milestone B: partner invite and alerts (with fake events)

Needs Supabase, the web pages, Resend and your domain set up. Use a second email address (or a second phone) as the partner.

**Invite by email**
- [ ] Partner → names → "Create invite link" → share it to yourself (email or Notes app works).
- [ ] Open the link in a browser: "Sam wants you as their accountability partner".
- [ ] Enter the partner email → "Check your inbox" → open the email → **Confirm**.
- [ ] Partner inbox: "You're Sam's accountability partner".
- [ ] Your phone: a "Alex is now your partner" notification (if you allowed notifications).
- [ ] Back in BeSeen (reopen or switch apps): the banner is gone and the partner row says "Gets your alerts by email".
      Nothing else on the screen changed.

**Alerts**
- [ ] Partner → "Send a test alert" → the email arrives.
- [ ] Partner → Developer: fake events → each button produces the right email. A second "Tried to open" within an hour
      is held back and arrives later as "tried … N more times in the last hour" (a cron run happens every 10 minutes).
- [ ] Tighten a rule (e.g. limit 60 → 30 min) → email says "(Stricter)", applies right away.
- [ ] Loosen a rule → the app warns first → email says "(Looser)" with the time it takes effect. The rule shows
      "Becomes … in 23 h 59 min". Cancel it → "cancelled their request" email.
- [ ] Remove a rule → "(Looser)" email; the rule stays until the cooldown ends, then disappears next time you open the app.
- [ ] Remove the partner → they get "removed you as their partner"; the banner comes back.
- [ ] In any alert email, "Stop these alerts" → Stop → your phone gets "Alex stopped your alerts"; the banner comes back.

**Partner using the app instead of email** (needs a second phone with a development build; Android push needs Firebase)
- [ ] Open the invite link on the partner's phone → "Open in BeSeen" → Accept → allow notifications.
- [ ] Test alert → arrives as a push notification. The partner's main screen shows "You're Sam's partner" with the alert.

## Milestone C: iPhone blocking (after Apple approves all 4 IDs)

Build with the `development` profile.

- [ ] Main screen shows "Turn on Screen Time access" → Permissions → Allow → approve with Face ID or passcode.
- [ ] Add rule → "Apps and websites" → pick Instagram (or any app) → Block → name it "Instagram" → Save.
- [ ] Open Instagram: BeSeen's block screen "Instagram is blocked". Tap Close → partner gets "tried to open Instagram".
- [ ] Add a limit on another app at **1 min** (development builds offer 1 and 2 min). Use the app for a minute: the
      "Time's up for today" screen appears. Close → nothing sent. Open the app again → **Keep going** → app unlocks;
      partner gets "went over their 1 min daily limit".
- [ ] "A website" → a domain → Block → Safari shows it as restricted. Try Chrome and note whether it's blocked there too.
- [ ] "All adult websites" → a well-known adult site in Safari is blocked.
- [ ] After midnight, limits reset (the shield is gone the next day until the limit is reached again).

## Milestone D: Android blocking

Build with the `development` profile and install the APK.

- [ ] Permissions → the disclosure screen appears first → I agree.
- [ ] Accessibility → BeSeen → On. If it's greyed out ("Restricted setting"): Permissions → "Allow restricted settings"
      → App info → ⋮ → Allow restricted settings, then try again.
- [ ] Usage access → BeSeen → On. Notifications → allow. A permanent "BeSeen is on" notification appears.
- [ ] Add rule → "An app" → pick an app → Block → open it: full-screen block, Close goes home; partner alerted.
- [ ] Limit an app at 1 min → use it → "Time's up" screen → Keep going → partner alerted.
- [ ] "A website" → a domain → Block → open it in Chrome: blocked. Repeat in Samsung Internet/Firefox if you have them.
- [ ] "A website" → a domain → 1 min limit → stay on it for a minute → "Time's up".
- [ ] "All adult websites" → follow the Private DNS prompt (`family.cloudflare-dns.com`) → Permissions shows
      "Adult-site filter: On". Turn Private DNS off → partner gets "turned off the adult-site filter" within ~15 minutes.

## Milestone E: tamper detection and heartbeat

- [ ] Supabase → `devices.last_seen_at` keeps updating: about every 15 min on Android, every few hours on iPhone
      (more often while you use the app).
- [ ] **Android:** Settings → Accessibility → BeSeen → Off → partner alerted within a minute.
      Usage access → Off → alerted at the next check-in. Turn them back on → "switched BeSeen back on".
- [ ] **Android:** start uninstalling BeSeen (long-press → Uninstall) and **cancel** at the confirm dialog → partner
      still gets "opened the screen to uninstall BeSeen".
- [ ] **Android:** Settings → Apps → BeSeen → Force stop → after `SILENCE_HOURS` the partner gets "stopped reporting".
      Open BeSeen → "reporting again".
- [ ] **iPhone:** remove BeSeen's Screen Time access in Settings (look under Screen Time, or Settings → BeSeen) →
      open BeSeen → partner alerted. If you don't open it, the silence alert covers it.
- [ ] **iPhone:** delete BeSeen → after `SILENCE_HOURS` → "stopped reporting". Reinstall → "was deleted and
      reinstalled … rules were reset"; typed websites survive, picked apps need re-adding.
- [ ] Phone switched off overnight with the default 12 h: no alert. A full day off: the alert says the phone "may be off".
