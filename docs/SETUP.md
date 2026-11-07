# Setting up BeSeen

Everything here is free except the Apple Developer Program (you have it), a domain (~$10–15/year), and
Google Play ($25 once, only when you publish). Do the steps in order; each one gives you a value a later step needs.

## What to sign up for

| Service | Why | Cost |
|---|---|---|
| [Expo](https://expo.dev/signup) | Cloud builds (EAS) and push notifications | Free: 15 iOS + 15 Android builds a month |
| [Supabase](https://supabase.com) | Database, the `api` Edge Function, the 10-minute cron job | Free (2 projects; pauses after 7 days with no traffic) |
| A domain, e.g. from [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/), Porkbun or Namecheap | Email has to come from a domain you own | ~$10–15/year |
| [Resend](https://resend.com) | Sends partner emails | Free: 100/day, 3,000/month |
| [Cloudflare](https://dash.cloudflare.com/sign-up) | Hosts the invite / confirm / stop / privacy pages (Pages) | Free |
| [Firebase](https://console.firebase.google.com) | Android push notifications (FCM). Optional: email alerts work without it | Free |
| Apple Developer Program | iPhone builds, Screen Time entitlement | $99/year (you have it) |
| [Google Play Console](https://play.google.com/console/signup) | Only when you publish on Android | $25 once |

## 1. Pick your bundle IDs (5 minutes, do this first)

Open `app.config.ts`. The IDs default to `com.gabrielhcaribe.beseen`. Change them now if you want something else:
Apple approves the Family Controls entitlement for exact IDs, so changing them later means asking again.

The iOS app plus its three extensions use these four IDs:

```
com.gabrielhcaribe.beseen
com.gabrielhcaribe.beseen.monitor
com.gabrielhcaribe.beseen.shieldconfig
com.gabrielhcaribe.beseen.shieldaction
```

## 2. Apple: Team ID and the Family Controls request (start now, it can take weeks)

1. developer.apple.com → Account → Membership details → copy the **Team ID** into `APPLE_TEAM_ID` in `app.config.ts`.
2. Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App. Register all four IDs above
   (explicit Bundle ID). For each one tick **App Groups** and **Family Controls (Development)**.
3. Identifiers → filter "App Groups" → **+** → `group.com.gabrielhcaribe.beseen`. Then edit each of the four App IDs →
   App Groups → Configure → tick that group.
4. Submit the Family Controls distribution request **once per ID (4 times)** while signed in as the Account Holder:
   <https://developer.apple.com/contact/request/family-controls-distribution>.
   Describe it plainly: "BeSeen is a self-accountability app. The user blocks or time-limits apps on their own phone
   with FamilyControls (.individual authorization). When they break their own rule, the app notifies one person they
   chose. App identities never leave the device; the partner sees only a name the user typed."
5. Until all four are approved, use the `development-basic` build profile on iPhone (no Screen Time). Everything else works.

## 3. Expo / EAS

```sh
npx eas-cli@latest login
npx eas-cli@latest init          # prints a project ID
```

Paste the project ID into `EAS_PROJECT_ID` in `app.config.ts` (the config is a `.ts` file, so EAS can't write it for you).

Register your iPhone for test builds:

```sh
npx eas-cli@latest device:create   # open the link on the iPhone and install the profile
```

On the iPhone: Settings → Privacy & Security → **Developer Mode** → On (restart when asked).

## 4. Supabase (backend)

1. Create a project at supabase.com (pick the region closest to you). Note the **project ref**, the
   `xxxxxxxx` in `https://xxxxxxxx.supabase.co`.
2. Generate two random secrets (run twice, keep both):
   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. From the repo folder:
   ```sh
   npx supabase@latest login
   npx supabase@latest link --project-ref YOUR-PROJECT-REF
   npx supabase@latest db push
   npx supabase@latest secrets set TOKEN_SECRET=<first secret> CRON_SECRET=<second secret>
   npx supabase@latest functions deploy api --no-verify-jwt
   ```
   If the deploy complains about Docker, add `--use-api`.
4. Supabase dashboard → SQL Editor → paste `supabase/setup_cron.sql`, replace `YOUR-PROJECT-REF` and
   `YOUR-CRON-SECRET` (the second secret), run it.
5. Put the API URL in **both** `app.config.ts` (`API_URL`) and `web/config.js`:
   `https://YOUR-PROJECT-REF.supabase.co/functions/v1/api`

Check it: `curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/api/public/invite-info -d "{}"`
should answer `{"error":"Missing invite token"}`.

## 5. Web pages (Cloudflare Pages)

```sh
npx wrangler@latest pages deploy web --project-name beseen
```

The first run asks you to log in and creates the project. Note the URL it prints (e.g. `https://beseen.pages.dev`,
or add a custom domain like `beseen.yourdomain.com` in the Cloudflare dashboard). Then:

```sh
npx supabase@latest secrets set WEB_BASE_URL=https://beseen.pages.dev
```

Re-run the `pages deploy` command whenever you change something in `web/`. Update the contact email in
`web/privacy.html` before you publish.

## 6. Email (domain + Resend)

1. Buy the domain.
2. Resend → Domains → Add domain. Using a subdomain like `mail.yourdomain.com` keeps BeSeen's sending reputation
   separate from anything else you do with the domain. Add the DNS records Resend shows at your registrar and wait for
   "Verified".
3. Resend → API Keys → create one with sending access.
4. ```sh
   npx supabase@latest secrets set RESEND_API_KEY=re_xxx "EMAIL_FROM=BeSeen <alerts@mail.yourdomain.com>"
   ```
5. Optional but recommended (bounces and spam reports end the partnership and tell the user): Resend → Webhooks →
   add `https://YOUR-PROJECT-REF.supabase.co/functions/v1/api/webhooks/resend` for `email.bounced` and
   `email.complained`, then:
   ```sh
   npx supabase@latest secrets set RESEND_WEBHOOK_SECRET=whsec_xxx
   ```

## 7. Android push (optional, Firebase)

Only needed for partners who use the BeSeen app on Android and for "Alex accepted" notices on Android.

1. Firebase console → create a project → Add app → Android → package `com.gabrielhcaribe.beseen`.
2. Download `google-services.json` into the repo root. `app.config.ts` picks it up automatically.
3. Firebase → Project settings → Service accounts → Generate new private key (JSON).
4. `npx eas-cli@latest credentials -p android` → your build profile → Google Service Account →
   "Push Notifications (FCM V1)" → upload that JSON.

iOS push needs no extra setup: EAS offers to create the push key during your first iOS build. Say yes.

## Settings you can change later (Supabase secrets)

| Secret | Default | Meaning |
|---|---|---|
| `COOLDOWN_HOURS` | 24 | Wait before a looser rule takes effect |
| `SILENCE_HOURS` | 12 | Hours without a check-in before the partner hears "stopped reporting" |
| `EXPO_ACCESS_TOKEN` | – | Only if you turn on Expo's "enhanced push security" |

Set any of them with `npx supabase@latest secrets set NAME=value`. No redeploy needed.
