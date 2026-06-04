# 11 Gol — Launch Checklist

Legend: ✅ done in code/backend · ⬜ you must do (account/console/payment)

## 1. Product readiness
- ✅ Multi-user accounts (anonymous + email/Apple upgrade), data synced per user
- ✅ Account deletion in-app (Apple 5.1.1(v)) — Profile → Delete account
- ✅ Scores read-only for users; only the live-sync service writes them (RLS)
- ✅ Predictions + leaderboard (3/1/0 scoring), locked at kickoff
- ✅ Squads, coaches, full 104-match schedule, live scores (football-data.org)
- ✅ Privacy Policy + Terms — in-app (Profile → About) **and** hosted (links below)
- ✅ UGC moderation basics: report-player (long-press on leaderboard) + account deletion
- ✅ No ads, no third-party tracking, encryption in transit
- ⬜ Decide final price (paid app) — set in App Store Connect / Play Console

## 2. Hosted legal URLs (already live — paste into the consoles)
- Privacy: `https://xqjupomaqomneqiugbft.supabase.co/storage/v1/object/public/legal/privacy.txt`
- Terms:   `https://xqjupomaqomneqiugbft.supabase.co/storage/v1/object/public/legal/terms.txt`
- To update later: edit `data/legal.json` → `node scripts/host-legal.mjs`

## 3. Backend → production
- ⬜ **Upgrade Supabase to Pro ($25/mo)** — the Free tier *pauses* the project after
  inactivity and has lower limits; Pro adds daily backups. Do this before public launch.
- ✅ RLS enabled on every user table; public-read only where intended
- ⬜ (Recommended) In Supabase → Advisors, review Security/Performance warnings
- ✅ Cron live-sync + notifications running; SMTP via Resend (no email rate-limit)

## 4. Build & submit (iOS — your priority)
- ⬜ `eas build --profile production --platform ios`
- ⬜ `eas submit --profile production --platform ios` → TestFlight
- ⬜ Internal testers (instant) → external testers (quick Beta App Review)
- ⬜ Fill App Store Connect listing from `STORE_LISTING.md`
- ⬜ Answer **App Privacy** questions (mapping in STORE_LISTING.md)
- ⬜ Upload screenshots (6.7" + 6.1" iPhone required) — capture from the app
- ⬜ Submit for review

## 5. Build & submit (Android — later)
- ⬜ `eas build --profile production --platform android`
- ⬜ `eas submit --platform android` (needs a Play Console account, $25 one-time)
- ⬜ Fill **Data safety** form (mapping in STORE_LISTING.md)

## 6. Assets you still need
- ⬜ Screenshots (per device size) — take from the running app (Home, Schedule, Groups,
  Teams/Squad, Leaderboard). Tip: capture in both EN & ES if you localize the listing.
- ✅ App icon & splash (gold "26" mark) — done
- ⬜ (Optional) App preview video, a marketing URL

## 7. Pre-submit sanity
- ✅ `npx tsc --noEmit` clean · `npx expo-doctor` 21/21
- ⬜ Test the production build on a real device (Apple login, push, avatar upload)
- ⬜ Verify the Privacy URL opens and reads correctly on a phone browser

## Notes
- 11 Gol declares **non-affiliation with FIFA** in the Terms and listing — keep that.
- Predictions are entertainment only (no real-money gambling) — stated in Terms to avoid
  the stores' gambling category.
- If a future EAS build flags a missing iOS *privacy manifest* reason (e.g. for
  UserDefaults via AsyncStorage), add `ios.privacyManifests` in app.json then; Expo's
  bundled modules ship their own manifests, so it usually isn't needed.
