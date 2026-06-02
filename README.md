# WC26 — FIFA World Cup 2026 Companion App

A dark-first, bilingual (EN/ES) React Native app for the 2026 World Cup
(48 teams · 12 groups · 16 venues · 104 matches · USA / Mexico / Canada).
Built with **Expo Router (SDK 56)**, **React 19 + React Compiler**, **Reanimated 4**,
**TanStack Query**, **Zustand**, and **Supabase**
(Postgres + Realtime + Edge Functions + Storage + Auth).

The app runs **fully offline on bundled seed data** out of the box — Supabase adds
live scores, accounts, predictions, a global leaderboard, **1v1 challenges**,
**in-app notifications**, squads, avatars, and push. Real Dec-2025 group draw, the
16 host venues, the full 104-match schedule, and all 22 past editions (1930–2022)
ship in `data/seed/`.

> This is a **launch-ready, store-targeted** app. See `LAUNCH_CHECKLIST.md` and
> `STORE_LISTING.md` for App Store / Google Play submission.

## Features

- **Schedule** — all 104 matches grouped by day, in local time, with host/stage filters.
- **Live scores** — real-time updates via Supabase Realtime + a breathing "LIVE" badge
  and goal animation.
- **Groups & bracket** — 12 group tables (FIFA tiebreak) and the full knockout tree.
- **Teams & squads** — all 48 nations, full squads by position, crests, and coaches.
- **Predictions & leaderboard** — predict scores before kickoff; **exact = 3 pts,
  correct result = 1 pt**; climb a global leaderboard (prediction + challenge points).
- **1v1 challenges** — challenge another player on a match (pick a side + goal margin);
  they accept or decline, both locked at kickoff; the closer pick wins **+3** (tie +1).
- **In-app notifications** — a soccer-ball inbox badge alerts you when a challenge is
  received, accepted, or declined; tap a leaderboard row to see a player's picks
  (their upcoming picks stay hidden until kickoff).
- **Accounts** — play as a guest (anonymous) or upgrade in-place to email / **Sign in
  with Apple**; avatar + display name; sync across devices; **in-app account deletion**.
- **Favorites** — pin up to 5 teams; their matches surface on Home.
- **Alerts** — optional kickoff / goal / full-time push notifications.
- **Bilingual** EN/ES, dark, no ads, no tracking.

## Run the app

```bash
npm install
npm start            # Expo dev server → press i / a, or scan in Expo Go
```

> Push, Reanimated, Lottie, Apple Sign-In, and avatar upload need a **dev client**
> build (`npx expo run:ios` / `run:android`, or an EAS build). Most UI works in Expo Go.

Type-check: `npx tsc --noEmit`

## Project layout

```text
src/
  app/                     Expo Router routes
    (tabs)/                Home · Schedule · Groups/Bracket · Teams · Leaderboard · History
    team/[id].tsx          Team detail (standing, fixtures, squad; tap a match to predict)
    user/[id].tsx          A player's profile + their predictions (+ challenge them)
    profile.tsx            Account modal (sign-in/up, avatar, delete)
    challenges.tsx         Your 1v1 challenges hub · notifications.tsx  In-app inbox
    legal/                 privacy.tsx · terms.tsx
  components/              MatchCard, BracketTree, GroupTable, Countdown, LiveBadge,
                           TeamFlag, GlassCard, TabBar, PredictionModal, ChallengeModal,
                           GoalOverlay, Avatar, AnimatedBall, HeaderActions, LegalView, …
  hooks/                   useMatches, useMatchRealtime, useFavorites, useNotifications,
                           usePredictions, useUserPredictions, useLeaderboard,
                           useChallenges, useInbox, useSquad
  lib/                     supabase, theme, i18n, standings, format, seed, scoring,
                           authActions, legal, apiFootball, queryClient, database.types
  store/                   useAppStore · useAuthStore · useProfileStore (Zustand)
  locales/                 en.ts · es.ts
data/
  legal.json               bilingual Privacy + Terms source
  seed/                    teams.json · venues.json · schedule.json · historical.json
supabase/
  migrations/              001–013 SQL
  functions/               sync-scores · notify-dispatcher · import-history · delete-account
  seed.sql                 generated INSERTs (npm run gen:seed)
scripts/                   gen-schedule · build-schedule · gen-seed-sql · seed.ts ·
                           import-squads · map-footballdata · host-legal · db-exec · verify
assets/animations/         goal · countdown · trophy (Lottie)
eas.json                   EAS build/submit profiles
```

## Connect Supabase (when ready)

1. Create a project, then fill `.env` (copy from `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
2. Apply schema + seed:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                       # runs migrations 001–013
   psql "$DATABASE_URL" -f supabase/seed.sql     # or:
   EXPO_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
   FOOTBALLDATA_TOKEN=... node scripts/import-squads.mjs   # players + crests + coaches
   ```
3. Deploy edge functions:
   ```bash
   supabase functions deploy sync-scores notify-dispatcher import-history delete-account
   ```
4. Enable the cron jobs: edit `supabase/migrations/006_cron.sql` (uncomment, set
   `<REF>`) and apply it. `sync-scores` self-throttles — it only calls the upstream
   API when a match is in its in-progress window.

Realtime is enabled on `matches` (migration 005); the client subscribes in
`useMatchRealtime` and triggers the goal animation on score changes. Matches are
**read-only for users** since migration 008 — only the live-sync cron writes scores.

## Accounts, predictions, challenges & leaderboard

- **Auth bootstrap.** On launch `useAuthStore.initAuth()` restores the session or
  signs in **anonymously**, so guests can predict and favorite immediately. From
  Profile they upgrade to email or **Apple** in-place (same user id ⇒ data survives).
- **Predictions** are owner-only and **locked at kickoff** by RLS (and the UI);
  scoring lives in `src/lib/scoring.ts` (3 / 1 / 0). Read another player's picks via
  `get_user_predictions()` — their not-yet-kicked-off picks return NULL (fair play).
- **Challenges (1v1).** Challenge a player on a match with a side + goal-margin pick
  (`challenges` table, migration 013); they accept/decline, both locked at kickoff by
  RLS. The closer pick (`ch_dist`) wins **+3**, a tie **+1**; `on_challenge_change`
  writes an in-app `notifications` row, surfaced by the inbox ball in every header.
- **Leaderboard** is computed by the `get_leaderboard()` `SECURITY DEFINER` RPC —
  **prediction + challenge** totals + public profile fields only, never anyone's
  individual picks. Leaderboard/challenges/inbox poll (~15–20s) for live-ish updates.
- **Avatars** upload to the public `avatars` bucket under `avatars/<uid>/` (owner-only
  folder RLS). **Account deletion** calls the `delete-account` function (Apple 5.1.1(v)).

## Push notifications (EAS)

Push tokens can't be minted in Expo Go; you need a dev-client build and an EAS project.
`eas.json` + `expo.extra.eas.projectId` are wired and `useNotifications` reads the id.

```bash
npm i -g eas-cli
eas login
eas build --profile development --platform ios   # or android
```

Install the dev build on a real device, run `npx expo start --dev-client`, and the app
registers a push token → `user_settings.expo_push_token`. The deployed
`notify-dispatcher` (every minute via pg_cron) sends kickoff-soon, goal, and full-time
alerts to subscribed devices.

## Live data & cron (already wired)

- Live scores come from **football-data.org** (free tier covers the FIFA World Cup).
  `sync-scores` + `notify-dispatcher` run every minute via `pg_cron`.
- Each of the 104 matches links to its football-data id via
  `matches.api_football_fixture_id` (populated by `scripts/map-footballdata.mjs`).
  `sync-scores` self-throttles — only calls the API when a match is in-progress, then
  updates score/minute/status; Supabase Realtime broadcasts to the app.
- Re-map ids:
  `FOOTBALLDATA_TOKEN=... SUPABASE_ACCESS_TOKEN=... SUPABASE_REF=... node scripts/map-footballdata.mjs`
- Disable a job: `SELECT cron.unschedule('wc26-sync-scores');`

> API-Football's free plan does NOT cover season 2026, which is why live data uses
> football-data.org. `src/lib/apiFootball.ts` is retained but unused.

## Legal & store assets

- In-app Privacy/Terms render from `data/legal.json` (`legal/privacy`, `legal/terms`).
- `node scripts/host-legal.mjs` publishes plain-text Privacy/Terms to the public `legal`
  Storage bucket → real URLs for App Store Connect / Play Console.
- `STORE_LISTING.md` (copy-paste listing + privacy mapping) and `LAUNCH_CHECKLIST.md`
  (✅ code / ⬜ console tasks) carry the rest.

## Regenerate seed data

```bash
npm run gen:schedule   # rebuild data/seed/schedule.json (asserts 104 matches)
npm run gen:seed       # rebuild supabase/seed.sql from the JSON
```

## Notes / decisions

- **Expo Router** + **managed workflow + dev client + EAS** (not bare) — no Mac needed.
- **Anonymous-first auth:** signing out returns to a *new* anonymous session; upgrading
  email keeps the same user id (favorites/predictions survive).
- **Matches are read-only for users** (migration 008) — never add client writes to scores.
- **Predictions & challenges lock at kickoff** in both the UI and RLS; challenge points
  are scored server-side (`ch_dist`) — don't compute them on the client.
- **Challenge notifications are in-app only** (the `on_challenge_change` trigger →
  `notifications`, polled by `useInbox`); push isn't wired into `notify-dispatcher` yet.
- England/Scotland use ISO `GB` for flag images (emoji sub-region flags in data).
- Knockout matches seed with placeholder labels ("Winner Group A") until results decide them.
- App declares **non-affiliation with FIFA**; predictions are entertainment only (no
  real-money) — keep both statements in Terms + listing.
