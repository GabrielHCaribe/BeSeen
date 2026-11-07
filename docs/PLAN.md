# BeSeen: how it works

BeSeen does three things: lets you block or time-limit apps and websites, lets you add one accountability partner,
and tells that partner when you slip, loosen a rule, remove them, or switch BeSeen off. Nothing else.

## Decisions (change later)

| Decision | Where it lives |
|---|---|
| At a daily limit, a block screen offers **Close** or **Keep going (partner is told)** | iOS `targets/shieldconfig`, `targets/shieldaction`; Android `BlockerService.kt` |
| Looser changes (loosen, remove) wait **24 h**; stricter ones apply immediately | `COOLDOWN_HOURS` secret |
| The partner must accept an invite ("tell them now" only; "don't tell them" not built) | `supabase/functions/api/routes/partner.ts` |
| Removing the partner is immediate, and they're told | `partner.ts` → `remove` |
| "Stopped reporting" after **12 h** of silence | `SILENCE_HOURS` secret |
| Repeated attempts on the same blocked thing: 1 alert, then one summary an hour | `notify.ts`, `routes/cron.ts` |
| One partner at a time; partner can be email or the BeSeen app | `partners` table (`partners_one_live` index) |

## Architecture

```
Phone ─ React Native UI (src/app) ─ native module (modules/beseen-native)
   │      iOS: FamilyControls/ManagedSettings/DeviceActivity + 3 extensions (targets/)
   │      Android: AccessibilityService + UsageStats + WorkManager + status notification
   │  HTTPS, header x-beseen-device: <device id>.<secret>
   ▼
Supabase Edge Function `api` (supabase/functions/api) ── Postgres (RLS on, no client access)
   ├─ Expo Push → APNs/FCM   (partner uses the app)
   ├─ Resend email           (partner uses email)
   └─ pg_cron every 10 min → /cron/tick: silent pings, "stopped reporting", attempt summaries
Cloudflare Pages (web/): invite, confirm, stop alerts, privacy
```

- **No sign-up.** First launch calls `/register`, which creates an anonymous account and a device secret, stored in
  the Keychain/Keystore. A laptop later is just another `devices` row on the same account.
- **The server decides what counts as looser or stricter**, and every rule or partner change goes through it.
  The phone can't change rules silently, and it can't choose what the partner reads: alert text is built on the server
  from the server's copy of the rule.
- **The phone enforces.** The app hands the rule list to native code, which keeps it in shared storage (App Group on
  iOS, SharedPreferences on Android) so extensions and services can enforce it with the app closed.
- **Offline:** detected events queue on the phone and send later. Looser changes need the server, so offline means
  the stricter rule stays.

## Data model (`supabase/migrations`)

| Table | Holds |
|---|---|
| `accounts` | Anonymous user id, first name (asked when inviting a partner) |
| `devices` | Platform, secret hash, push token, permission status, last check-in, silence flags |
| `rules` | Label, target type (`selection` iOS picker / `app` / `site` / `adult_sites`), target, block or limit, minutes |
| `rule_changes` | Pending looser changes: before, after, effective time, applied or cancelled |
| `partners` | Name, status (`invited` → `active` → `ended`), channel, email, partner's account, hashed invite token |
| `events` | Every event, with its client id (dedupe) and what happened to the alert |
| `deliveries` | Exactly what each partner was sent, and whether it went through |

## Events

Sent by the phone: `limit_exceeded`, `blocked_attempt`, `uninstall_started` (Android), `reinstalled` (iOS).

Made by the server: `rule_added`, `rule_tightened`, `rule_loosened`, `rule_removed`, `change_cancelled`,
`partner_removed`, `partner_welcome`, `permission_revoked`, `permission_restored` (from check-in status changes),
`device_silent`, `device_back`, `blocked_summary`, `test`.

Alert wording for every type: `supabase/functions/api/messages.ts`.

## Detection

**iPhone**
- The user picks apps in Apple's picker. iOS never tells BeSeen which apps were picked, so the user types the name the
  partner sees.
- Blocks use one Screen Time store per rule. Limits use one daily `DeviceActivity` schedule with a threshold per rule.
- Typed websites and "All adult websites" use Apple's web content filter.
- Attempts are logged when a block-screen button is tapped.
- Check-ins happen every ~3 h through 8 repeating schedules that wake the monitor extension, plus on app launch,
  background refresh, and silent push.

**Android**
- The Accessibility service sees the foreground app and reads the address bar of major browsers.
- Blocked or over-limit apps get a full-screen overlay. App time comes from `UsageStatsManager`; BeSeen counts site time itself.
- When BeSeen's uninstall dialog opens, an alert is sent before the user confirms.
- "All adult websites" works through Private DNS (`family.cloudflare-dns.com`), and turning it off is reported.
- Check-ins every 15 min (WorkManager). A permanent notification shows while BeSeen runs (required by Google Play).

## Known limitations

- **iPhone**
  - Real device only.
  - An attempt counts only if a block-screen button is tapped (swiping away isn't visible).
  - Typed-site blocking is confirmed for Safari only.
  - Turning off Screen Time access removes all blocks instantly. BeSeen can report it, not stop it.
  - Check-ins are hours apart.
- **Android**
  - In-app browsers and unknown browsers aren't checked.
  - Aggressive battery savers can kill the service (false "stopped reporting").
  - Other user profiles aren't covered.
  - Chrome or Firefox set to their own secure DNS bypass the adult filter.
  - No app categories.
- **Both**
  - Another device or a factory reset escapes everything.
  - A partner invite could be accepted with a throwaway email by the user themself.
  - A phone that's off for longer than `SILENCE_HOURS` triggers "stopped reporting". The message says it may just be off.
