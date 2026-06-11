@AGENTS.md

# WC26 — FIFA World Cup 2026 Companion App

Dark-first, bilingual (EN/ES) React Native app for the 2026 World Cup
(**48 teams · 12 groups · 16 venues · 104 matches** · USA / Mexico / Canada).
Built with **Expo Router (SDK 56)**, **React 19 + React Compiler**,
**Reanimated 4**, **TanStack Query v5**, **Zustand**, and **Supabase**
(Postgres + Realtime + Edge Functions + Auth: anonymous / email / Apple).

> ⚠️ Expo SDK 56 changed many APIs. Always read the versioned docs at
> <https://docs.expo.dev/versions/v56.0.0/> before writing native/Expo code.

The app runs **fully offline on bundled seed data** out of the box; every data
hook checks `isSupabaseConfigured` and falls back to `data/seed/`. Supabase adds
live scores, multi-user accounts, predictions + a global leaderboard, **1v1
head-to-head challenges**, **in-app notifications**, squads, avatars, push
alerts, and cloud sync. **This is a launch-ready, store-targeted app**
(App Store / Google Play) — see `LAUNCH_CHECKLIST.md` + `STORE_LISTING.md`.

---

## Stack & key versions

| Area | Choice |
|------|--------|
| Runtime | Expo SDK `~56.0.8`, React Native `0.85.3`, React `19.2.3` |
| Navigation | `expo-router ~56.2.8` (typed routes, file-based) |
| Animation | `react-native-reanimated 4.3.1` + `react-native-worklets`, Lottie |
| Data fetching | `@tanstack/react-query ^5` |
| Local state | `zustand ^5` (AsyncStorage-persisted) |
| Backend | `@supabase/supabase-js ^2` (Postgres, Realtime, Edge Functions, Storage, Auth) |
| Auth | anonymous → email upgrade + `expo-apple-authentication` (Sign in with Apple) |
| Media | `expo-image-picker` (avatar upload to Supabase Storage) |
| OTA / build | `expo-updates` (fingerprint runtime), **EAS** (`eas.json`) |
| Dates | `date-fns ^4` + `date-fns-tz` (EN/ES locales) |
| i18n | hand-rolled dictionaries (`i18n-js` present but app uses `src/locales`) |
| Flags | `react-native-country-flag` (ISO-3166 a2) + emoji fallback |
| Glass UI | `expo-blur`, `expo-glass-effect` |
| TypeScript | `~6.0.3`, `strict: true`, path alias `@/* → src/*`, `@/assets/* → assets/*` |

`app.json` highlights: scheme `wc26`, forced dark, bg `#0A0E1A`, bundle/package
`com.portela11.wc26`, EAS `projectId` `9afc5595-…`, owner `alfredgf`,
`runtimeVersion.policy: fingerprint`, EAS Update URL, gold (`#D4AF37`)
notification accent, `UIBackgroundModes: ["remote-notification"]`,
`usesNonExemptEncryption: false`, `expo-image-picker` photos-permission plugin,
experiments `typedRoutes` + `reactCompiler`.

---

## Project layout

```text
src/
  app/                       Expo Router routes
    _layout.tsx              Root: providers + initAuth() bootstrap + push register
    (tabs)/_layout.tsx       6-tab navigator with custom <TabBar/>
    (tabs)/index.tsx         Home — hero countdown/live, your-teams, today
    (tabs)/schedule.tsx      Schedule — day groups, host/stage filters, prediction entry
    (tabs)/groups.tsx        Groups ↔ Bracket segmented view
    (tabs)/teams.tsx         Team grid + search + favorites strip
    (tabs)/leaderboard.tsx   Global leaderboard (prediction + challenge points) + your rank + report-player
    (tabs)/history.tsx       Past editions, titles chart, highest-scoring, modal
    team/[id].tsx            Team detail — gradient header, standing, fixtures, squad, tap match → predict
    user/[id].tsx            Another player's profile + their predictions (upcoming picks hidden until kickoff) + challenge
    profile.tsx              Account modal — sign-in/up, avatar, display name, delete
    challenges.tsx           Your 1v1 challenges hub (accept/decline, outcomes)
    notifications.tsx        In-app inbox (challenge received/accepted/declined) — marks read on open
    legal/privacy.tsx        Privacy Policy (in-app)
    legal/terms.tsx          Terms of Service (in-app)
  components/                MatchCard, BracketTree, GroupTable, Countdown, LiveBadge,
                             TeamFlag, GlassCard, GradientHeader, ScreenHeader, TabBar,
                             PredictionModal, ChallengeModal, GoalOverlay, Avatar,
                             AnimatedBall, HeaderActions, LegalView, LangToggle, States, icons
  hooks/                     useMatches, useMatchRealtime, useFavorites, useNotifications,
                             usePredictions/useSetPrediction, useUserPredictions, useLeaderboard,
                             useChallenges, useInbox, useSquad
  lib/                       supabase, theme, i18n, standings, format, seed, scoring,
                             authActions, legal, apiFootball, queryClient, database.types
  store/                     useAppStore + useTranslation, useAuthStore, useProfileStore
  locales/                   en.ts · es.ts (Translation type)
data/
  legal.json                 bilingual Privacy + Terms source (→ in-app + hosted .txt)
  seed/                      teams.json (48) · venues.json (16) · schedule.json (104)
                             · historical.json (22 editions, 12 matches) · _schedule_raw.json
supabase/
  migrations/                001–011 SQL
  functions/                 sync-scores · notify-dispatcher · import-history ·
                             delete-account (Deno)
  seed.sql                   generated INSERTs (npm run gen:seed)
  config.toml · .temp/       CLI link state (linked project: worldcup26)
scripts/                     gen-schedule · build-schedule · gen-seed-sql · seed.ts ·
                             db-exec · verify · gen-icons · import-squads ·
                             map-footballdata · host-legal
assets/animations/           goal · countdown · trophy (Lottie JSON)
assets/images/               brand icons (generated from fifaimages/shopping.webp)
LAUNCH_CHECKLIST.md          store-submission checklist (✅ code / ⬜ console tasks)
STORE_LISTING.md             copy-paste App Store / Play listing + privacy mapping
eas.json                     EAS build/submit profiles (development/preview/production)
```

---

## Architecture & conventions

- **Offline-first.** `src/lib/supabase.ts` exports `isSupabaseConfigured`
  (true when both `EXPO_PUBLIC_SUPABASE_URL` and `…_ANON_KEY` are set). Every
  hook short-circuits to bundled seed data when false, so the UI never hangs on
  a missing backend. `useMatches` also falls back to seed if the remote table
  is empty.
- **Auth bootstrap.** `initAuth()` (in `useAuthStore`, called once from root
  `_layout`) restores the session, subscribes to `onAuthStateChange`, and signs
  in **anonymously** if there's none — so favorites/predictions work for guests
  and survive an upgrade to a real account (same user id). `useProfileStore`
  holds the public profile (display name + avatar) app-wide so the header avatar
  updates everywhere. `selectIsAnonymous` distinguishes guests from members.
- **Account actions** live in `lib/authActions.ts`: `upgradeWithEmail`
  (anonymous → email, keeps id), `signInWithEmail`, `signInWithApple`,
  `signOut` (returns to a fresh anonymous session), `upsertProfile`,
  `pickAndUploadAvatar` (Storage `avatars/<uid>/avatar.jpg`), `deleteAccount`
  (calls the `delete-account` edge function).
- **Seed data is canonical.** `data/seed/*.json` is the single source of truth,
  consumed three ways: (1) the app via `src/lib/seed.ts`, (2) `supabase/seed.sql`
  via `npm run gen:seed`, (3) `scripts/seed.ts` for remote seeding. `seed.ts`
  builds `teamsById` / `venuesById` O(1) lookup maps and `groupLetters`.
- **Local state vs cloud.** Zustand (`useAppStore`, persisted to AsyncStorage
  under `wc26-app-store`) is the source of truth for language, favorites
  (max 5, `MAX_FAVORITES`), and filters. When Supabase + a user exist,
  favorites/push tokens are mirrored to `user_settings` best-effort.
- **Server state** lives in TanStack Query (`queryClient`). Keys: `['matches']`,
  `['predictions']`, `['leaderboard']`, `['squad', teamId]`, `['challenges']`,
  `['inbox']`, `['user-predictions', userId]`. `useMatchRealtime` patches the
  `['matches']` cache from Realtime UPDATEs and fires `onGoal` on a score-up;
  `useSetPrediction` optimistically updates the predictions cache. The
  leaderboard, challenges, and inbox **poll** (~15–20s, focus + pull-to-refresh)
  for a realtime-ish feel without a live socket; mutating a challenge invalidates
  `['challenges']`, `['inbox']`, and `['leaderboard']`.
- **Predictions & scoring.** `lib/scoring.ts` = **exact 3 / correct result 1 /
  miss 0**. Predictions are locked at kickoff both in UI (`PredictionModal`) and
  by RLS (insert/update only allowed while `kickoff_utc > NOW()`). The
  leaderboard is computed server-side by the `get_leaderboard()` RPC and now sums
  **prediction points + challenge points** (migration 013).
- **Challenges (1v1).** A challenger picks a winner-**side** (`home`/`away`/`draw`)
  plus a goal **margin** for a match; the opponent accepts with their own pick (or
  declines), both locked at kickoff by RLS. When the match finishes the closer
  pick (`ch_dist` distance to the real result; wrong winner always loses to any
  correct winner) wins **+3**, a tie **+1**. `get_my_challenges()` returns each
  challenge from the caller's POV (role/outcome); `ChallengeModal` drives
  create/accept. Started from a player's profile (`/user/[id]`) on upcoming matches.
- **In-app notifications.** A `notifications` row is written by the
  `on_challenge_change` trigger when a challenge is received/accepted/declined.
  `useInbox` polls them and exposes `unread`; `AnimatedBall` (the soccer-ball
  badge in `HeaderActions`) bounces while unread and rolls on arrival, tapping
  through to `/notifications`, which marks all read on open. Push delivery for
  challenges isn't wired into `notify-dispatcher` yet — these are in-app only.
- **i18n.** `useTranslation()` returns `{ t, language }`. Device default via
  `expo-localization`, toggled with `<LangToggle/>`. Team names use `name_es`
  fallback; stage labels live in `theme.ts` `stageMeta`.
- **Design system** in `src/lib/theme.ts`: dark `palette`, `hostColors`
  (USA blue / Mexico green / Canada red), `confederationColor`, `radius`,
  `spacing`, `font`, `stageMeta`. Brand = black / white / gold `#D4AF37`.
- **Header pattern.** `HeaderActions` (EN/ES toggle + notification `AnimatedBall`
  → `/notifications` + tappable avatar → `/profile`) is the shared header-right
  cluster, so the account entry point and the inbox are reachable from every screen.
- **Path alias** `@/` → `src/`. Scripts and edge functions are excluded from the
  app tsconfig.

---

## Data model (Supabase / `database.types.ts`)

- `teams` — 48 rows, PK text id (e.g. `usa`, `bra`), `group_letter`,
  `host_country`, `confederation`, `iso2`, `api_football_id`; **+ `crest_url`,
  `coach`, `fd_team_id`** (football-data.org metadata, migration 010).
- `venues` — 16 host venues, `country` (USA/Mexico/Canada), `capacity`,
  `lat`/`lng`, `color` (city brand color for gradient headers — app-only field
  via `SeedVenue`).
- `matches` — 104 rows, PK text id (`GS-A1`, `R32-1`, `FINAL-1`). Stages:
  `group`(72) · `r32`(16) · `r16`(8) · `qf`(4) · `sf`(2) · `third`(1) ·
  `final`(1). Knockout slots carry `home_placeholder`/`away_placeholder`
  ("Winner Group A") until decided. `set_updated_at` trigger; in the
  `supabase_realtime` publication. **Read-only for users** (only the service-role
  cron writes scores, migration 008).
- `players` — squads, ~26/team, `position` (Goalkeeper/Defence/Midfield/Offence),
  `shirt_number`, `date_of_birth`, `nationality`, `fd_player_id`; public-read
  (migration 010).
- `profiles` — public per-user `display_name`, `avatar_url`, `country`;
  public-read (for the leaderboard), owner-write (migration 008).
- `predictions` — PK (`user_id`,`match_id`), `home_pred`/`away_pred` (0–30).
  Owner-only read/write, **write blocked after kickoff** by RLS (migration 011).
- `challenges` — 1v1 head-to-head, `match_id`, `challenger_id`/`opponent_id`,
  `challenger_side`/`opponent_side` (`home`/`away`/`draw`) + `*_margin` (0–20),
  `status` (`pending`/`accepted`/`declined`). RLS: participants read; challenger
  creates (before kickoff, can't self-challenge) and may delete while still
  pending; opponent updates (responds) before kickoff (migration 013).
- `notifications` — per-user inbox, `type` (`challenge_received`/`_accepted`/
  `_declined`), `challenge_id`, `actor_id`/`actor_name`, `read`. Owner-only RLS;
  rows are written by the `on_challenge_change` trigger (migration 013).
- `user_settings` — RLS owner-only, favorites array, notify prefs, timezone,
  language, `expo_push_token`.
- `historical_editions` (22, 1930–2022) + `historical_matches` (12).
- **`get_leaderboard()`** — `SECURITY DEFINER` SQL RPC: aggregates each user's
  **prediction points (3/1/0) + challenge points (3/1/0)** into `points`, plus
  `predicted`/`exact`/`total` counts and `challenge_points`, joined to public
  profile fields, **without exposing anyone's individual picks**. Now v3
  (migration 013, was added in 011, extended in 012). Granted to anon + auth.
- **`get_user_predictions(target)`** — `SECURITY DEFINER` RPC for `/user/[id]`:
  a player's predictions with fair-play **reveal** — another user's pick for a
  match that hasn't kicked off is returned NULL (`revealed=false`) so it can't be
  copied; the owner always sees their own (migration 012).
- **`get_my_challenges()`** — `SECURITY DEFINER` RPC: the caller's challenges from
  their POV (`role`, `my_*`/`their_*` picks, computed `outcome` won/lost/tie/
  pending). `ch_side`/`ch_dist` helpers score them (migration 013).
- **Storage:** public `avatars` bucket — anyone reads; a user writes only inside
  their own `avatars/<uid>/` folder (migration 009). `legal` bucket holds the
  hosted Privacy/Terms `.txt` (via `host-legal.mjs`).

**RLS:** every table has RLS on. Tournament data (`teams`/`venues`/`matches`/
`players`/`historical_*`) is public-read; `matches` writes are service-role only.
`profiles` is public-read / owner-write; `predictions`, `user_settings`,
`challenges` (participants), and `notifications` are owner-/participant-scoped.
`ON DELETE CASCADE` from `auth.users` wipes a deleted user's settings, profile,
predictions, challenges, and notifications.

### Migrations

`001_teams` · `002_venues` (+`color`) · `003_matches` (indexes + updated_at
trigger) · `004_user_settings` (RLS + push index) · `005_historical` (+ realtime
publication) · `006_cron` (pg_cron/pg_net invokers, **commented — apply after
deploy**) · `007_read_policies` (public read) · `008_multiuser` (lock matches to
read-only + `profiles` table) · `009_avatars` (Storage bucket + folder RLS) ·
`010_players` (squads + team metadata columns) · `011_predictions` (predictions
table, kickoff-locked RLS, `get_leaderboard()` RPC) · `012_leaderboard_v2`
(`total` count + `get_user_predictions()` fair-play reveal) · `013_challenges`
(`challenges` + `notifications` tables + RLS, `ch_side`/`ch_dist`,
`on_challenge_change` trigger, `get_my_challenges()`, `get_leaderboard()` v3 with
challenge points).

---

## Backend (Edge Functions, Deno)

- **`sync-scores`** — every ~60s via pg_cron. Cheap guard first: only calls the
  upstream API when a match is `live` (or kicks off within 5 min). Maps status →
  `scheduled|live|finished`, upserts by external fixture id. External fixture ids
  are mapped from **football-data.org** (`map-footballdata.mjs`). Inert until the
  upstream key secret is set.
- **`notify-dispatcher`** — every minute. Sends "kickoff soon" (per-user
  `notify_minutes_before` window) and "full time" pushes via the Expo Push API
  (batched 100/req) respecting `notify_favorites`/`notify_all`.
- **`import-history`** — one-shot. POST `historical.json`, or pull openfootball
  as a fallback.
- **`delete-account`** — verifies the caller's JWT and `admin.deleteUser()`s
  them (service role). Required for **App Store guideline 5.1.1(v)** in-app
  account deletion; cascade removes all their rows.

`src/lib/apiFootball.ts` holds typed client helpers + `mapStatus` for a
client-side fallback.

---

## Scripts (`package.json` + `scripts/`)

- `npm start` / `android` / `ios` / `web` — Expo dev server.
- `npm run typecheck` — `tsc --noEmit`. `npm run lint` — `expo lint`.
- `npm run gen:schedule` — rebuild `schedule.json` (asserts 104 matches).
- `npm run gen:seed` — rebuild `supabase/seed.sql` from the JSON.
- `npm run seed:remote` — `tsx scripts/seed.ts` (needs service-role key).
- `build-schedule.mjs` — normalize `_schedule_raw.json` (official dates/venues)
  into `schedule.json` and strictly validate.
- `import-squads.mjs` — import all 48 squads + team metadata (crest, coach) from
  football-data.org (`FOOTBALLDATA_TOKEN`).
- `map-footballdata.mjs` — map football-data WC2026 fixture ids onto our matches.
- `host-legal.mjs` — render bilingual Privacy/Terms `.txt` and upload to the
  public `legal` Storage bucket → store-ready URLs.
- `db-exec.mjs` — run SQL via the Management API (`SUPABASE_ACCESS_TOKEN`+`_REF`).
- `verify.mjs` — end-to-end RLS smoke test.
- `gen-icons.mjs` — regenerate icons from `fifaimages/shopping.webp` via `sharp`.

---

## Backend setup (when wiring a fresh project)

1. Fill `.env` from `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`, `…_ANON_KEY`;
   server-only `SUPABASE_SERVICE_ROLE_KEY`; optional upstream score key,
   `FOOTBALLDATA_TOKEN`).
2. `supabase db push` (runs 001–011), then seed via `supabase/seed.sql`,
   `scripts/seed.ts`, or `db-exec.mjs`; `import-squads.mjs` for players.
3. `supabase functions deploy sync-scores notify-dispatcher import-history
   delete-account`; set score-sync secret to enable live sync.
4. Uncomment + apply `006_cron.sql` (set `<REF>`) to schedule the cron jobs.
5. `node scripts/host-legal.mjs` to publish the legal URLs for the store consoles.

Push notifications, Reanimated, Lottie, Apple Sign-In, and avatar upload require
a **dev client** / real device (`npx expo run:ios|android` or EAS) — most UI
works in Expo Go. Builds go through **EAS** (`eas.json`: development /
development-simulator / preview / production profiles).

---

## Change log

> Newest first. Keep this updated when shipping features or schema changes.

### 2026-06-11 — Live scores fixed + goal pushes with scorer names (migration 015)

- **Root causes of "no live scores" on opening day:** (1) football-data.org's
  free tier publishes `score.fullTime` minutes AFTER `FINISHED` — and the
  sync-scores guard excluded `finished` rows, so GS-A1 got written as
  `finished` + null scores once and was never re-fetched; (2) free tier carries
  no in-play scores at all (user upgraded to the paid tier for live data).
- **sync-scores v2:** guard now also re-syncs `finished AND home_score IS NULL`
  (12h backfill window); fetches `/v4/matches/{id}` detail for every in-window
  match and upserts its `goals[]` (scorer, minute, running score) into the new
  **`match_events`** table (idempotent on `(match_id, seq)`); honest
  updated-row accounting + error reporting.
- **Migration 015:** `match_events` (public-read RLS, service-role-only write,
  in the `supabase_realtime` publication) + `matches.result_pushed` (robust
  full-time push dedupe, replacing the fragile 90s `updated_at` window that
  pushed "null–null" for GS-A1 and would re-fire on backfills; pre-set true for
  already-finished matches so nothing retro-pushes).
- **notify-dispatcher v2:** new GOAL push from unpushed `match_events`
  ("⚽ GOAL! Raúl Jiménez 67' — Mexico 2–0 South Africa", respects
  notify_all/favorites); full-time push now requires non-null scores +
  `result_pushed=false`.
- **App (JS-only → shipped via OTA):** `useMatchRealtime` also subscribes to
  `match_events` INSERTs; rich goal events (scorer + minute) win over the
  score-diff fallback (3.5s grace, deduped); celebrations show
  "Player 67′ · Team 2–0 Team"; foreground goal pushes feed the same overlay;
  `MatchEventRow` type added. Standings already guarded null scores.
- Group standings need no work: computed client-side from `matches`, they
  update automatically as Realtime patches the cache.

### 2026-06-10 — Fixed the release-build white screen (app-name Swift module bug)

- **Root cause:** the Jun-4 rename "WC26" → **"11 Gol"** silently killed every EAS
  release build (TestFlight builds 4–8 opened to a blank screen). A project name
  starting with a digit makes Xcode sanitize the Swift module to `_11Gol`, but
  ExpoModulesCore resolves the generated provider via
  `NSClassFromString("\(CFBundleName).ExpoModulesProvider")` with the raw name —
  not found → **silently falls back to an empty modules provider** → zero native
  modules → the standard SDK 56 eager startup chain throws
  `Cannot find native module 'ExpoAsset'` before any app code runs. Dev client /
  Expo Go / Metro were unaffected (no prebuild), which is why it only broke
  standalone builds.
- **Fix:** `expo.name` is now **`OnceGol`** (valid identifier). Users still see
  **"11 Gol"**: iOS via `ios.infoPlist.CFBundleDisplayName`, Android via
  `plugins/withAndroidAppName.js` (sets `app_name` in strings.xml).
- **Hardening kept:** `expo-asset` as a direct dependency + config plugin; SDK
  patches aligned (`npx expo install --fix`, expo-doctor 21/21); custom entry
  `index.js` loads the app inside try/catch and renders any startup error as
  selectable text via bare `AppRegistry` (no expo imports); `expo-asset-guard.js`
  stubs `ExpoAsset.downloadAsync` if the registry ever misses it again.
- **Lesson on OTAs:** a build that fatals at JS startup also never completes an
  expo-updates check — OTA updates cannot rescue a launch-crashing binary.

### 2026-06-01 — Social: 1v1 challenges, notifications, player profiles

- **Leaderboard v2 + player profiles (Phase 4, migration 012):** `get_leaderboard()`
  now also returns `total` (all predictions made, any status); new
  `get_user_predictions(target)` RPC powers the `/user/[id]` screen — tap a
  leaderboard row to see another player's picks, with **fair-play reveal**
  (their upcoming picks stay hidden until kickoff). `useUserPredictions` hook.
  Leaderboard/challenges/inbox **poll** (~15–20s + focus + pull-to-refresh) for a
  realtime-ish feel; team detail now opens `PredictionModal` on a match tap.
- **1v1 challenges + in-app notifications (Phase 5, migration 013):** `challenges`
  table (pick = side + margin, RLS owner/opponent, locked at kickoff, cancel while
  pending), `notifications` table + owner RLS, `on_challenge_change` trigger,
  `ch_side`/`ch_dist` scoring helpers, `get_my_challenges()`, and
  `get_leaderboard()` **v3** which adds challenge points (3 win / 1 tie / 0) to
  the total. New UI: `ChallengeModal`, `AnimatedBall` (soccer-ball inbox badge in
  `HeaderActions`, bounces unread / rolls on arrival), `/challenges` hub,
  `/notifications` inbox; `useChallenges`/`useCreateChallenge`/`useRespondChallenge`,
  `useInbox`/`useMarkRead`. Create a challenge from a player's `/user/[id]` profile.

### 2026-06-01 — Launch-ready: accounts, predictions, squads, legal, EAS

- **Multi-user auth (Phase 1, migration 008):** anonymous sessions that upgrade
  in-place to email or **Sign in with Apple**; `useAuthStore.initAuth()` bootstrap,
  `useProfileStore`, `lib/authActions.ts`, and a `profile.tsx` account modal
  (avatar, display name, sign out, **delete account**). Matches are now
  **read-only for users** (only the service-role cron writes scores) — the old
  manual `ScoreModal` was removed.
- **Profiles + avatars (008, 009):** public `profiles` table + public `avatars`
  Storage bucket with per-folder owner RLS; `pickAndUploadAvatar` via
  `expo-image-picker`; shared `Avatar` + `HeaderActions` (account entry on every
  screen).
- **Squads (Phase, migration 010):** `players` table (26/team) + `crest_url`/
  `coach`/`fd_team_id` on `teams`, sourced from **football-data.org**
  (`import-squads.mjs`, `map-footballdata.mjs`); `useSquad` + squad UI on team
  detail.
- **Predictions + leaderboard (Phase 2, migration 011):** `predictions` table
  (kickoff-locked RLS), `lib/scoring.ts` (3/1/0), `PredictionModal`,
  `usePredictions`/`useSetPrediction`, the new **Leaderboard tab** + your-rank
  card + long-press report-player, backed by the `get_leaderboard()` RPC.
- **Legal & store readiness:** in-app Privacy/Terms (`legal/*`, `LegalView`,
  `lib/legal.ts`, `data/legal.json`) + hosted `.txt` via `host-legal.mjs`;
  `delete-account` edge function (Apple 5.1.1(v)); `STORE_LISTING.md` +
  `LAUNCH_CHECKLIST.md`.
- **Build/release:** `eas.json` (build/submit profiles), `expo-updates` OTA with
  fingerprint `runtimeVersion`, EAS `projectId`/owner, image-picker permission
  plugin, `usesNonExemptEncryption: false`. New deps:
  `expo-apple-authentication`, `expo-image-picker`, `expo-updates`. Tab count 5 → 6.

### 2026-06-01 — Supabase live backend wired + brand icons

- Linked Supabase project **`worldcup26`** (ref `xqjupomaqomneqiugbft`); `.env`
  populated so the app now runs against the live backend (still seed-safe).
- Added **migration 007** (`007_read_policies.sql`): RLS + public-read for
  tournament data, keeping `user_settings` owner-only.
- Tooling: `db-exec.mjs`, `verify.mjs`, `gen-icons.mjs`; generated WC26 brand
  icon / splash / favicon / Android adaptive icons.

### Initial build — full app

- Expo Router SDK 56 app, React 19 + React Compiler, tabs + team detail.
- Offline-first data layer (seed JSON ↔ Supabase) with TanStack Query +
  Zustand; favorites (max 5), bilingual EN/ES, host/stage filters.
- Components: glass `TabBar`, animated `MatchCard` (live glow), `BracketTree`,
  `GroupTable` (FIFA tiebreak standings), `Countdown`, `GoalOverlay`, gradient
  team header.
- Supabase schema 001–006, edge functions, anon auth, Realtime score push +
  goal animation, Expo push dispatcher.
- Seed data: 48 teams / 16 venues / 104 matches (real Dec-2025 draw) / 22 past
  editions; generators + remote `seed.ts`.

---

## Gotchas / decisions

- **`expo.name` must NEVER start with a digit** (`"OnceGol"`, displayed as
  "11 Gol" via `CFBundleDisplayName` + `withAndroidAppName.js`). A leading digit
  silently breaks ExpoModulesCore's provider lookup in release builds → blank
  screen at launch (see 2026-06-10 change-log entry).
- **Managed workflow + dev client + EAS** (not bare) — no Mac needed.
- **Matches are read-only for users** since migration 008 — scores come only from
  the live-sync cron (service role). Don't add client write paths to `matches`.
- **Predictions lock at kickoff** in both UI and RLS — a "set prediction" call
  after `kickoff_utc` will be rejected by the policy, not just the UI.
- **Anonymous-first auth:** signing out returns to a *new* anonymous session (not
  a logged-out void); upgrading email keeps the same user id (favorites/preds
  survive).
- The leaderboard must go through `get_leaderboard()` — individual `predictions`
  rows are owner-only by RLS and can't be read for other users. Likewise read
  another player's picks only via `get_user_predictions()`, which NULLs out their
  not-yet-kicked-off picks (fair play) — don't query `predictions` cross-user.
- **Challenges lock at kickoff** in both UI and RLS (create + respond). Challenge
  points are computed server-side in `get_leaderboard()`/`get_my_challenges()` via
  `ch_dist` (wrong winner always loses to any correct-winner pick) — don't score
  them client-side.
- **Challenge notifications are in-app only** (the `on_challenge_change` trigger →
  `notifications`, polled by `useInbox`). Push delivery isn't wired into
  `notify-dispatcher` yet.
- Live score sync is **inert until the upstream key secret is set**; squads/ids
  use football-data.org (`FOOTBALLDATA_TOKEN`).
- England/Scotland use ISO `GB` for flag images (emoji sub-region flags in data).
- Knockout matches seed with placeholder labels until results decide them.
- `useMatches` returns seed data if the remote `matches` table is empty — an
  empty result ≠ "no matches".
- Standings tiebreak is simplified (points → GD → GF → id), not full FIFA H2H.
- Push/Reanimated/Lottie/Apple-auth/avatar are no-ops in Expo Go & simulators —
  test on a dev client / real device.
- **UGC compliance:** display names + avatars are user content shown publicly —
  keep the report-player action (leaderboard long-press) and account deletion.
- App declares **non-affiliation with FIFA**; predictions are entertainment only
  (no real-money) — keep both statements in Terms + listing.
