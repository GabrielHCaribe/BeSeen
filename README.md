# BeSeen

Set your own phone rules while you feel in control. If you break one, you can't do it silently: the accountability
partner you chose is told.

- **Setup (accounts, keys, deploy):** [docs/SETUP.md](docs/SETUP.md)
- **Running on real phones and what to test:** [docs/TESTING.md](docs/TESTING.md)
- **How it works, decisions, limitations:** [docs/PLAN.md](docs/PLAN.md)
- **App Store / Google Play requirements:** [docs/RELEASE.md](docs/RELEASE.md)

## Layout

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router): main, add rule, rule, partner, permissions, accept invite |
| `src/lib/` | API client, anonymous identity, state, push, background check-ins |
| `modules/beseen-native/` | Native module: Swift (Screen Time) and Kotlin (Accessibility, usage, check-ins) |
| `modules/beseen-native/ios/BeSeenCore.swift` | Shared iOS core; copied into each extension at prebuild |
| `targets/` | iOS extensions: activity monitor, block screen, block screen buttons |
| `plugins/` | Config plugin that copies the shared iOS core into the extensions |
| `supabase/` | Database migration, the `api` Edge Function, cron setup |
| `web/` | Partner pages for Cloudflare Pages (invite, confirm, stop alerts, privacy) |

## Commands

```sh
npm install
npx expo start --dev-client   # serve JS to a development build on your phone
npm run typecheck
npm run lint
npm run check:functions       # type-check the Edge Function with Deno
```
