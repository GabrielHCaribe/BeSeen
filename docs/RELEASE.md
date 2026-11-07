# Releasing BeSeen

## Apple (App Store and TestFlight)

1. **Family Controls (Distribution) approved for all four IDs** (see SETUP step 2). Without it, neither TestFlight
   nor the App Store will accept the build.
2. `npx eas-cli@latest build -p ios --profile production`, then `npx eas-cli@latest submit -p ios`.
3. App Store Connect:
   - Privacy policy URL: `https://<your pages domain>/privacy` (update the contact email in `web/privacy.html` first).
   - App Privacy ("nutrition label"): **Identifiers** (device ID), **Usage Data** (product interaction: rules and
     events), **Contact Info** (the partner's email, entered by the partner). All for App Functionality, not tracking.
   - Review notes: explain that it's self-accountability, that the user picks apps with Apple's picker, that app
     identities never leave the device, and that the partner sees only names the user typed. Give the reviewer a way
     to see an alert (e.g. "add yourself as partner by email from a second address").

## Google Play

The Accessibility API and the "monitoring" policy are the two release risks; plan for review back-and-forth.

1. Play Console account ($25). **New personal accounts must run a closed test with at least 12 testers for 14 days**
   before they can publish to production (organization accounts are exempt). Start that early.
2. `npx eas-cli@latest build -p android --profile production` (an `.aab`), upload to a testing track.
3. Declarations in Play Console:
   - **Accessibility API declaration** with a video showing: opening the app; the disclosure screen (Permissions →
     "Before you turn on Accessibility") with all text visible; tapping I agree and turning Accessibility on; declining
     and how to get back to the disclosure; and a block screen appearing. BeSeen is **not** an accessibility tool
     (`isAccessibilityTool` is not set).
   - **Foreground service: special use**: the permanent "BeSeen is on" notification
     (`modules/beseen-native/android/.../MonitorService.kt`). Explain it's there so the user always knows monitoring
     is active.
   - **Data safety**: device ID; app activity (rule events); email address (partner's, entered by the partner);
     shared with one person the user chose; not sold; encrypted in transit.
   - **Privacy policy** URL.
4. **Monitoring apps policy.** The manifest declares `isMonitoringTool="other"`. Google's stalkerware policy allows
   monitoring only for parental control and enterprise use and says such apps can't be used to track another adult
   "even with their knowledge and permission". BeSeen is different: people install it on their own phone to report
   on themselves. Make that unmistakable:
   - Store listing: "You install BeSeen on your own phone and choose who gets alerts about your own rules."
     Also disclose the alerts and what they contain.
   - The permanent notification and the clear app icon/name (already done).
   - Never market it as a way to watch someone else.

   Approval is still Google's judgment call. Accountability apps of this kind (e.g. Covenant Eyes) are on Play.
5. Google updated its Accessibility policy on October 29, 2026. Re-read
   <https://support.google.com/googleplay/android-developer/answer/10964491> before submitting.

## Sideloaded test builds (no Play Store)

- Android 13+ marks Accessibility as a "restricted setting" for apps installed from a file. Testers need App info →
  ⋮ → Allow restricted settings (the Permissions screen links there).
- In Brazil, Indonesia, Singapore and Thailand, Google now requires apps installed outside the Play Store to come from a
  verified developer. Install with `adb install`, or register for Google's free hobbyist developer account
  (up to 20 devices).
