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

### 2026-06-27 — Resolved R32 teams everywhere a match is shown (challenges/notifications/home/team) (OTA)

- **New `useResolveMatch()` hook** centralizes the Schedule's real-time R32 fill
  (`useBracketQualifiers` + `resolveMatchTeams`): `resolve(match)` → `{ match
  (augmented), home/away: { qualified, locked } }`. Drop-in anywhere a match
  renders so a knockout fixture always shows real flags + names + the
  locked/provisional marker instead of "Winner A".
- **Applied across every remaining match surface** (Schedule + the R32-predict
  flow were already done):
  - `ChallengeModal` resolves its `target.match` internally → the accept/create
    sheet always shows real teams (fixes accept opened from notifications /
    challenges, where the match arrived raw).
  - **Notifications**: each challenge notification now embeds a full resolved
    `MatchCard` (flags, names, stage, date/score) below the actor line.
  - **Challenges** screen: each row shows resolved flags + names + date.
  - **Team detail**: a qualified team's R32 fixture shows the real opponent.
  - **Home**: the next-match hero + today cards resolve their teams.
- **JS-only → OTA.** Typecheck clean; no new lint errors (the two ChallengeModal
  lint hits are the pre-existing form-reset `useEffect`). New file
  `hooks/useResolveMatch.ts`; touched `ChallengeModal`, `notifications`,
  `challenges`, `team/[id]`, `(tabs)/index`.

### 2026-06-27 — Player profile: live + played only, challenge moved to header (OTA)

- **Profile predictions list (`/user/[id]`, tapped from the Ranking) now shows
  only LIVE + already-played events** — upcoming/scheduled picks are hidden (they
  were locked/blank anyway). Same timeline order: in-play on top, then finished
  newest-first (`sortedRows` filters `status !== 'scheduled'`; empty-state keys on
  the filtered length so an all-upcoming profile still shows the empty state).
- **Challenges preserved + improved.** The ⚔️ challenge entry used to live on a
  player's upcoming prediction rows (now hidden), so it moved to a **"⚔️ Retar"
  button in the profile header** → opens an upcoming-match **picker** (any
  `scheduled` fixture, soonest first, rendered as tappable `MatchCard`s) →
  selecting one opens the existing `ChallengeModal` in create mode. You can now
  challenge on ANY upcoming match, not only ones the opponent predicted. Removed
  the dead per-row challenge button from `PredItem`.
- **Picker shows resolved R32 teams (follow-up OTA).** The upcoming-match picker
  reuses the Schedule's real-time bracket fill (`useBracketQualifiers` +
  `resolveMatchTeams` + a `pickerCard` helper), so a knockout fixture shows the
  qualified team flags + names (with the locked/provisional marker) instead of
  "Winner A"; the resolved match flows into the `ChallengeModal` so the challenge
  sheet opens on the real teams too.
- **JS-only → OTA.** Typecheck + lint clean. File: `app/user/[id].tsx`.

### 2026-06-27 — Schedule fills R32 with qualified teams + predict them (OTA)

- **Feature:** the **Schedule** tab now drops each securely-qualified group
  winner/runner-up into its R32 (knockout) slot **in real time**, exactly like
  the Bracket view — instead of showing "Winner A" / "Runner-up B" with a blank
  flag. Tapping the card still opens the prediction sheet (predictions were
  already team-agnostic — keyed by `match_id`, RLS-locked at kickoff — so they
  worked on placeholders; the blank flag just made them *look* un-predictable).
- **Shared resolver — `resolveMatchTeams(match, qualifiers)`** (new in
  `lib/qualification.ts`, pure): extracts BracketTree's inline side-resolution
  (server id wins → else the live `useBracketQualifiers` slot → else TBD) so the
  Bracket and Schedule fill slots from ONE source. `BracketTree` refactored to
  call it (verbatim behaviour; `qualification.test.ts` still ALL PASS).
- **`schedule.tsx`:** `useBracketQualifiers(matches)` (same map/cadence as the
  bracket) + a `cardFor(m)` that resolves each match — fills undecided R32 sides
  for DISPLAY (`{...m, home_team_id, away_team_id}`, identity/scores/status/
  kickoff untouched so prediction stays keyed by `match.id`) and passes the
  marker. The `onlyMyTeams` filter resolves sides too, so a favorite that just
  clinched into an R32 slot shows. Best-third (`"3rd …"`) / later-round slots
  stay TBD (not in the map).
- **`MatchCard`:** additive **`qualMark?: {home?,away?}`** prop (default off →
  Home/team/user cards unchanged) rendering the bracket's **solid gold dot**
  (seed locked) / **hollow gold ring** (provisional) next to the resolved team,
  reusing `t.groups.qualified` / `qualifiedProvisional`.
- **JS-only → shipped via OTA** (no migration/server change). Typecheck clean;
  `qualification.test.ts` ALL PASS; lint of touched files clean. Published to
  `production` with `--environment production` (commit `d01fa99`): iOS runtime
  `2c3aa583…` (= live 1.0.1 build → reaches users) group
  `7ec8e515-29bb-4433-aa2b-643d891e22ed`, Android `c50144db…` group
  `a9bc0044-425e-4d79-83d7-92cc719be4d8`. Real Supabase ref verified in the
  `dist/` bundle (2× `xqjupomaqomneqiugbft`, 0 placeholder). Files:
  `lib/qualification.ts`, `app/(tabs)/schedule.tsx`, `components/MatchCard.tsx`,
  `components/BracketTree.tsx`.

### 2026-06-26 — Fix stale group standings (W-D-L didn't match results) (OTA)

- **Bug:** Group D showed USA `W2 D1 L0 / 7pts` and Turkey `W0 D1 L2 / 1pt`, but
  TUR–USA actually finished **3–2** (USA lost). The `matches` table was correct
  (the schedule showed 3–2); the **official `standings` table was frozen on an
  earlier 2–2** scoreline (before Turkey's 90' winner), counting that match as a
  draw for both.
- **Root cause:** the `standings` table is a snapshot of football-data's
  standings endpoint, which lags the live scores; `sync-scores` only refreshes it
  on a score/status change, so once the match finished nothing re-synced it and
  the stale row stuck. `GroupTable` + `useBracketQualifiers` trusted that table
  whenever it existed.
- **Fix — `reconcileStandings(official, teamIds, matches)`** in `lib/standings.ts`:
  recompute the table from the actual finished matches (always the source of
  truth) and use the official rows **only when their per-team played / points /
  GF / GA agree** with it; on any mismatch fall back to the match-derived table.
  Self-healing — the official rows are used again (for their correct FIFA H2H
  tiebreaks) the moment the upstream sync catches up. `GroupTable` and
  `useBracketQualifiers` both call it (no more blind `officialRows.length ? …`).
- **Validated** in `scripts/qualification.test.ts`: the real stale Group D
  snapshot reconciles to USA `6pts`/1 loss, Turkey `3pts`/1 win, USA GA `4`; a
  consistent official table is kept as-is.
- **JS-only → OTA** (iOS `2c3aa583…` = live 1.0.1 build, Android `c50144db…`;
  real Supabase ref verified in `dist/`). No server/migration change — the stale
  DB row is now simply ignored by the app. Files: `lib/standings.ts`,
  `components/GroupTable.tsx`, `hooks/useBracketQualifiers.ts`,
  `scripts/qualification.test.ts`.

### 2026-06-24 — Bracket clinch v2: scenario enumeration (shows every clinched team) (OTA)

- **Why:** the v1 clinch (`resolveGroupSlots`, points-bound) counted each chaser
  independently, missing that two of a leader's chasers play EACH OTHER (so they
  can't both catch it). It failed to show clearly-qualified leaders — the user
  expected USA / Germany / Argentina / Mexico to already be in the bracket.
- **Fix — `resolveGroupQualifiers(orderedRows, groupMatches)`** (rewrote
  `lib/qualification.ts`): **enumerates every possible outcome of the group's
  remaining fixtures** (`3^n`, n≤6 → ≤729, ×12, memoized — trivial) and marks a
  team `advances` only if it's top-2 in EVERY scenario. Ranks each scenario by
  **points only, treating an equal-points pair as ambiguous** (a tie GD/H2H could
  break either way) → tiebreakers are irrelevant to clinching, so it **never
  shows a team that isn't truly through**, while honouring the fixture graph.
  Also returns `lockedFirst`/`lockedSecond` (seed mathematically fixed). Finished
  group → trust the standings order (mandatory branch: points-only enumeration
  would drop a tied runner-up).
- **Real-time placement (`useBracketQualifiers` → `Map<string, BracketSlot>` =
  `{teamId, locked}`):** at most two teams advance per group; placed by current
  standings order (1st→`Winner L`, 2nd→`Runner-up L`), recomputed on every
  results/standings change so a team snaps in the moment it clinches and the slot
  swaps live if the order flips. `BracketTree` shows a **solid gold dot** for a
  locked seed, a **hollow gold ring** for a qualified-but-provisional seed
  (`groups.qualifiedProvisional`, en/es). Server `team_id` still always wins.
- **Validated** against the real group state (`scripts/qualification.test.ts`,
  `npx tsx`): exactly `{mex,usa,ger,arg,fra,nor}` clinch now (none with a locked
  seed yet), CAN/BRA/POR/ENG/ESP/NED/EGY correctly excluded; + edge units
  (finished-group 2nd-place tie still yields a runner-up, null team id skipped).
- **JS-only → OTA** (iOS `2c3aa583…` = live 1.0.1 build, Android `c50144db…`;
  real Supabase ref + new strings verified in `dist/`). Files: `lib/qualification.ts`,
  `hooks/useBracketQualifiers.ts`, `components/BracketTree.tsx`, `en.ts`/`es.ts`,
  `scripts/qualification.test.ts`.

### 2026-06-24 — Bracket fills in qualified teams in real time (OTA)

- **Feature (Apple-Sports style):** the Groups → Bracket view now drops each
  **securely-qualified** group winner / runner-up into its R32 slot live, instead
  of always showing "Winner A" / "Runner-up B" until the server decides the
  fixture. Flags now render in every bracket cell.
- **`lib/qualification.ts`** (new, pure + unit-checked): `parseGroupSlot`
  (`"Winner A"`→pos 1 / `"Runner-up B"`→pos 2; best-third `"3rd …"` and
  later-round `"Winner R32-1"` refs are left TBD) and `resolveGroupSlots(rows,
  finished)`. Finished group → trust the standings order. In-progress → only
  resolve a **mathematically clinched** position (never shows a team that could
  still drop): 1st = no other team can even match the leader's points; 2nd = 1st
  already clinched AND at most that leader can finish above the team. Conservative
  on ties (a team that can only draw level counts as a threat) → resolves a touch
  late, never wrongly.
- **`hooks/useBracketQualifiers.ts`** (new): builds the live placeholder→teamId
  map, recomputing on every results/standings change. Uses the **official**
  football-data standings (correct FIFA tiebreaks — same source as `GroupTable`)
  with a `computeStandings` fallback so it still works offline/pre-sync.
- **`BracketTree.tsx`:** resolves `home/away_placeholder` through the map (a
  server-set `team_id` always wins), renders `TeamFlag` + name, marks a clinched-
  but-not-yet-official team with a small gold dot (`t.groups.qualified`), and pops
  it in via a keyed `FadeIn` the moment it resolves. Columns stagger in
  (`FadeInDown`), cells use `LinearTransition` for smooth reflow; tighter spacing.
- **JS-only → OTA** (iOS runtime `2c3aa583…` = live 1.0.1 build, Android
  `c50144db…`; real Supabase ref verified in `dist/`). Files: `lib/qualification.ts`,
  `hooks/useBracketQualifiers.ts`, `components/BracketTree.tsx` (+ existing
  `groups.qualified` locale string).

### 2026-06-22 — Synchronized live clock across every screen (OTA)

- **Bug:** the same live match showed a DIFFERENT ticking minute on different
  surfaces (Home hero, Home/Schedule cards, a player's predictions, match detail).
  Each `LiveBadge` mounts its own `useLiveClock`, and each instance recorded its
  own `seenAt` (a per-instance `useRef`) = the moment THAT card first saw the
  current server minute. A card mounted 40s ago and one just mounted computed
  different drift → 67:40 vs 67:00 for the same match.
- **Fix — shared state at module level** in `useLiveClock.ts`: (1) a **shared
  anchor** `Map<matchId,{key,seenAt}>` so every instance of a match measures
  drift from the SAME first-seen instant (a fresh card reads the instant an older
  one already recorded); (2) a **shared 1s ticker** via `useSyncExternalStore`
  (one module `setInterval` drives all live clocks in lockstep — no per-instance
  interval phase drift; the interval only runs while ≥1 LiveBadge is mounted and
  refreshes `tickNow` on (re)start so the first render isn't stale); (3) the
  monotonic anti-backward-jump floor is now **shared too** (`Map<matchId,
  {period,minute}>`) — a per-instance guard would itself desync (a fresh card has
  no history). Still skew-proof (device-elapsed since the shared receipt, never
  device-vs-server clock diffing). All injury-time-cap / HT / ET / PEN behaviour
  from the prior entry is preserved.
- **One central fix covers every screen** (all go through `LiveBadge →
  useLiveClock`: `LiveHero`, `MatchCard`, `match/[id]`). JS-only → **OTA** (iOS
  runtime `2c3aa583…` = live 1.0.1 build, Android `c50144db…`; real Supabase ref
  verified in `dist/`). File: `src/hooks/useLiveClock.ts`.

### 2026-06-22 — Live clock true to the real match (freeze on pauses) + faster full-time (028, server + OTA)

- **Problem:** the on-device clock (`useLiveClock`) interpolated minutes forward
  unbounded, so it invented stoppage ("90+7" when the board said "+4") and kept
  ticking a few seconds INTO a real pause before the half-time signal propagated.
  The fix data already arrived every ~5s but was unused.
- **Source = the same cheap LIST.** football-data's `/competitions/WC/matches`
  already carries `injuryTime` (announced added minutes) every tick; it was only
  landing (stale) in `match_details` via the gated DETAIL fetch. **Migration 028**
  adds `matches.injury_time int` (nullable; already in the realtime publication,
  public-read) and `sync-scores` now writes it from the LIST loop (added to the
  `noChange` guard so it doesn't churn — it changes only when the board goes up).
- **Client (OTA) — never invents time, freezes real.** `useLiveClock` caps the
  running minute at `boundary + injury_time` (boundary 45/90/105/120 by period);
  with no board yet (`injury_time` null) it holds at the boundary. Once it would
  overrun, it freezes at the cap minute's final second instead of ticking fantasy
  stoppage — which also kills the overrun into a pause. Added **ET** handling
  (`105+n` / `120+n`) and a clean **PEN** state (`isPenalties` → badge
  "Penalties"/"Penales", no clock); `LiveBadge` treats HT+PEN as the steady amber
  "paused" pill. Anchor key changed from `id:minute:updated_at` → **`id:minute`**
  (the `set_updated_at` trigger bumps `updated_at` on every write incl.
  injury_time, which would reset the ticking seconds); added a monotonic guard so
  a provider minute correction can't step the clock backward within a period.
  Kept the skew-proof device-elapsed design (never diffs device vs server clock).
- **Faster full-time push.** FT lived only in `notify-dispatcher` (~30s). Added a
  `'fulltime'` transition to `sync-scores` (live→finished, known prior live state)
  so it fires on the 5s path; dedupe **reuses `matches.result_pushed`** (claimed
  atomically after send) so the dispatcher backstop never re-sends. Kickoff / HT /
  2nd-half pushes unchanged.
- **Shipped:** migration 028 applied via `db-exec.mjs` (Management API,
  `SUPABASE_ACCESS_TOKEN` in `.env` + `SUPABASE_REF=xqjupomaqomneqiugbft`);
  `sync-scores` deployed (`supabase functions deploy … --project-ref
  xqjupomaqomneqiugbft`, smoke-tested clean `inWindow:2`) → reaches all users
  instantly; client via **OTA** (iOS runtime `2c3aa583…` matches the live 1.0.1
  build, Android `c50144db…`), real Supabase ref + new code
  (`injury_time`/`Penales`) verified in the `dist/` bundle. Files:
  `useLiveClock.ts`, `LiveBadge.tsx`, `database.types.ts`, `en.ts`/`es.ts`,
  `sync-scores/index.ts`, migration `028_match_injury_time.sql`.

### 2026-06-22 — Duplicate goal pushes: the REAL fix (in-place reconciliation, server-only)

- **Still re-firing live** (confirmed by the user on GS-I3 France: the 3rd goal
  re-sent pushes for goals 1·2·3). The earlier "computed running score" fix (v20)
  was deployed and correct, but it wasn't the root cause. **Hard evidence:** all
  three GS-I3 goal rows shared one identical `created_at` though scored at min
  14/54/66 → they were **deleted and re-inserted fresh in one shot**, resetting
  `pushed=false`, then the atomic claim re-pushed them all.
- **Root cause = the `delete-all + reinsert` reconciliation pattern**, defeated by
  the new ~5s cadence: (1) the 5s pg_cron is fire-and-forget, so a slow goal-tick
  (forced detail + reconciliation + scorers + standings, **two** matches live)
  overruns 5s and the next invocation starts mid `delete→insert`, sees a partial
  goal set, and reinserts everything as brand-new; (2) a transient short
  `/matches/{id}` `goals[]` likewise let `delete-all` wipe good rows. Single-thread
  the old code was correct (worked at 20s); the 5s overlap broke it.
- **Fix — reconcile `match_events` goals IN PLACE** (`sync-scores` v21): no more
  delete-all. **UPSERT by the existing `(match_id,seq)`** key, with the payload
  deliberately omitting `pushed`/`created_at`/`id` — so an ON CONFLICT *update*
  preserves them (no re-push, no re-celebrate) and an *insert* takes the column
  defaults (`false`/`now()`). Only NEW or genuinely-CHANGED rows are written (no
  churn on identical ticks). Annulment **deletes are gated by the authoritative
  score** (`expectedGoalsByMatch` = `ft.home+ft.away` from the LIST): a tail row is
  removed only when `goals.length === expected`, so a transient short fetch can't
  delete good rows (a real VAR annulment drops the score too, so counts agree).
- **Why it's race-proof now:** there's no window where goals don't exist → a
  concurrent invocation sees them and writes nothing; two invocations observing the
  same new goal both upsert the **same seq** (conflict → update, no dup row, no
  `pushed` reset); the existing **atomic claim** (`UPDATE…SET pushed=true WHERE
  pushed=false RETURNING`) still guarantees exactly one push. No migration, no OTA —
  reuses the `UNIQUE(match_id,seq)` constraint and `pushed`/`created_at` defaults.
- **Server-only**, deployed via `supabase functions deploy sync-scores` (v21,
  `--project-ref xqjupomaqomneqiugbft` + `sbp_` token — CLI is on the wrong
  account). Reaches every user immediately. Rollback = redeploy v20. Verify on a
  live match: goal N's `created_at` stays fixed when goal N+1 lands, `pushed` flips
  once, and each goal fires exactly one device push.

### 2026-06-22 — Near-real-time live sync: ~5s cadence + half-time pushes (server + OTA)

- **sync-scores → ~5s** (migration 026, `cron.alter_job '5 seconds'`). Made the
  high-frequency path CHEAP so cadence ≠ API cost: the one `/competitions/WC/matches`
  LIST call carries score+minute+period+HT for every match and drives the
  clock/score/half-time every ~5s; rows are written **only when something changed**
  (no per-tick churn on finished matches — the old loop re-wrote them all every
  tick). The expensive per-match `/matches/{id}` DETAIL is **gated** (on a score
  change/kickoff, while a scorer is still unattributed ≤60s, or every
  DETAIL_FLOOR — 20s live / 60s idle, tracked via `match_details.updated_at`,
  which we now always advance even pre-lineup) so detail cost doesn't scale with
  cadence; **player paging is lazy** (only when a detail fetch will run); scorers
  refresh on `events>0`, standings on score/status change (not every minute tick).
  `fd()` is now **429/5xx-aware** (one bounded retry; a long Retry-After sheds the
  detail loop) and the response reports `rate429`/`detailFetches`/`transitions`.
- **Goal dedupe — live fix:** football-data leaves `goals[].score` **null during
  live play** (backfilled later), so `goalId` fell back to natKey and re-fired
  every prior goal's push when the scorer landed (re-confirmed live on
  GS-J3 Argentina). Fix: the running score is now **computed from the goals[]
  order** (each goal +1 to its team) so the identity is `s|<h>-<a>|<team>` from the
  first insert and never flips. Atomic claim still → exactly one push per goal.
- **New live-moment pushes** (user-requested): **🔴 kickoff (actual)**, **⏸️
  half-time + HT score**, **▶️ second half** — emitted from sync-scores (only place
  with prior+new period in one tick), deduped per device via `push_sent` new types
  `kickoff_live`/`halftime`/`secondhalf`, fired **only from a known prior live
  state** so deploying mid-match can't false-fire. Respect the existing
  `notify_all`/favorite opt-in. App taps already deep-link via `matchId`.
- **notify-dispatcher → ~30s** (migration 027) + goal backstop age **45s→25s**
  (sync-scores now claims within seconds, so 25s never races it). Every push type
  stays idempotently deduped, so the faster cadence can't double-send.
- **Client (OTA):** `useLiveClock` is now **skew-proof** — it counts device-seconds
  elapsed since each server patch arrived (never diffs device vs server clock) and
  **caps drift at 180s** so a dead socket freezes the minute instead of inventing
  90+40. Tighter fallbacks: matches poll 20→10s, events 15→8s, detail 15→8s, goal
  grace 3500→2500ms, realtime reconnect 2000→1000ms/cap 15s, `eventsPerSecond` 5→8.
- **Server-only parts reach everyone instantly; client parts via OTA** (iOS runtime
  `2c3aa583…`). Rollback is one `cron.alter_job` back to `'20 seconds'` / `'* * * * *'`.
  Rate math at 5s ≈ today's req/min (only the cheap LIST rose 3→12/min). Verify on a
  live match: `matches.minute/period` advance ~5s, `match_events` fill the scorer
  ~5-15s `pushed` once, `push_sent` shows one kickoff/halftime/secondhalf per device.

### 2026-06-22 — Minimalist flag carousel for favourites (Home + Teams, OTA)

- Replaced the full-width favourite-team `MatchCard`s on Home with a new
  `FavoriteTeamsRail` — a horizontal, edge-to-edge carousel of **circular team
  flags** (gold ring + soft glow) that **slide in staggered** (`FadeInRight`) and
  **spring-scale on press**. Each chip deep-links to `/team/[id]` (group standing
  + results). Empty state keeps the "choose teams" CTA; "Today's matches" below is
  unchanged. Dropped the now-unused `favMatches` derivation in `(tabs)/index.tsx`.
- **Reused on the Teams tab:** the "My Favorites" strip now renders the same
  `FavoriteTeamsRail` (replaced the boxed `favCard`s) so both surfaces match.
- **Shipped via OTA** to `production` (iOS runtime `2c3aa583…` → reaches the live
  1.0.1 build, Android `c50144db…`). Real Supabase ref verified in `dist/`.

### 2026-06-22 — England & Scotland flags (own flag, not Union Jack — OTA)

- **Bug:** England and Scotland rendered the blue **Union Jack** instead of the
  St George's Cross / Saltire. `react-native-country-flag` builds
  `https://flagcdn.com/w80/<iso2>.png`, and both teams had `iso2 = 'GB'` → `gb.png`.
- **Fix:** flagcdn serves UK **subdivision** flags, so `iso2` is now `gb-eng`
  (England) / `gb-sct` (Scotland) → their own flag, cross-platform image (the
  `flag_emoji` sub-region glyph stays as the no-`iso2` fallback). Nothing else
  depends on `iso2` being a strict 2-letter code (only flag render + team search).
- **Key gotcha:** team display data (name, `iso2`, `flag_emoji`) is read **only
  from the bundled seed** (`src/lib/seed.ts` → `teamsById`), NEVER from Supabase —
  the only `teams` column the app queries live is `coach` (useSquad). So the DB
  `UPDATE teams` did nothing on its own; the operative fix is `data/seed/teams.json`
  (+ regenerated `supabase/seed.sql`), which reaches users **via OTA**. The DB was
  updated too, only to keep it consistent.
- **Shipped via OTA** to `production`: iOS runtime `2c3aa583…` (matches the live
  1.0.1 build → reaches users), Android `c50144db…`. Real Supabase ref verified in
  the `dist/` bundle (no placeholder) before finishing — see
  `feedback_eas_update_environment`.

### 2026-06-22 — Fix duplicated goal pushes (server-only, no OTA)

- **Bug:** every new goal re-fired the push notifications for all prior goals
  (goal 4 → re-notified 1·2·3·4). **Root cause** in `sync-scores`: goal identity
  used `natKey = minute|team|scorer`, but football-data reports a goal first with
  `scorer = null` and **attributes the name seconds later**. When the name landed
  the natKey flipped, so an already-pushed goal looked brand-new — and the full
  delete+reinsert reconciliation reset `pushed=false` on every still-settling
  goal, re-queuing them all for a push. (Confirmed against live data: GS-H3
  Spain×Saudi sent `1-0`/`2-0`/`3-0` two-three times each.)
- **Fix 1 — stable identity.** Decoupled **push dedupe / row preservation** from
  **display identity**. Preservation now keys on `goalId = s|<h>-<a>|<team>` (the
  cumulative score after the goal + scoring team) — unique per goal within a match
  and immune to the scorer/minute being refined later (falls back to natKey only
  when the feed omits the running score). `team_id` disambiguates the real feed
  glitch where two goals carry the same running score (GS-I2 reported `1-4` for
  both sides) so they don't collapse onto one identity (which would drop a push
  and clash on the row `id`); a `consumed` guard also prevents reusing an `id`.
  natKey still drives `setChanged` so the correct scorer name still rewrites the
  row in place (VAR annulment unchanged). A goal whose scorer was just attributed
  keeps `id`/`created_at`/`pushed=true` → no duplicate push, no re-celebrate.
- **Fix 2 — atomic claim.** The inline push no longer sends from an in-memory
  list then marks pushed; it does `UPDATE match_events SET pushed=true WHERE
  pushed=false … RETURNING` and pushes **only the claimed rows**. The atomic
  flip-and-return means two overlapping `sync-scores` invocations (or the
  dispatcher) can never both grab the same goal — the loser's predicate no longer
  matches. Claims are scoped to matches actually processed this run (a goal whose
  detail fetch failed stays unpushed for the backstop) and only when devices exist.
- **Hardened the dual-pipeline race:** `notify-dispatcher`'s goal **backstop** now
  only fires for goals unpushed for **≥45s** (`created_at < now-45s`), so it never
  competes with `sync-scores`' inline send (every 20s) — it only catches goals
  `sync-scores` genuinely missed.
- **Edge-function-only change** (`sync-scores` + `notify-dispatcher`) — **NOT an
  OTA**. Deployed server-side via `supabase functions deploy` (sync-scores now
  v17). Reaches every user immediately regardless of app version, no build/review.
  (CLI must be logged into the `worldcup26` owner account, or use an `sbp_` access
  token with `--project-ref xqjupomaqomneqiugbft` — see `reference_supabase_project`.)

### 2026-06-17 — Share my ranking (Leaderboard, OTA)

- **Minimalist share affordance on the Ranking tab.** The "Your score" card now
  shows a small gold share chip (new `ShareIcon`, iOS-style glyph) next to your
  rank/points — visible only when you're ranked. Tapping opens the device's
  **native share sheet** (`react-native` `Share`) with a bilingual, personalized
  message ("🏆 I'm #4 of N on 11 Gol with 27 pts predicting the 2026 World Cup.
  Can you beat me? ⚽" / ES) plus the **App Store link**
  (`apps.apple.com/app/11-gol/id6775887761`, kept in sync with `landing/script.js`)
  so recipients can install the app. The URL lives inside the message text (no
  separate `url` arg) to avoid iOS link duplication. New `leaderboard.share` /
  `shareTitle` strings (en/es).
- **Shipped via OTA** to `production`. JS-only → iOS runtime `2c3aa583…` matches
  the live 1.0.1 build, so it reaches users; Android runtime `c50144db…`.
  Published with `--environment production` (real Supabase ref verified in the
  `dist/` bundle before announcing — see `feedback_eas_update_environment`).

### 2026-06-16 — Personalized engagement pushes (predict reminders + leaderboard)

Two new `notify-dispatcher` notification types to pull users back in, both
**personalized by display name** (`profiles.display_name`):

- **🔮 Prediction reminder.** ~30-180 min before kickoff, each user who **hasn't
  predicted** that match (checked against `predictions`) gets one personalized
  nudge ("{name}, you haven't predicted X vs Y — do it before kickoff!").
  Gated by the existing `wants()` notify prefs, deduped once per
  `(token, match, 'predict')` in `push_sent`. The dispatcher horizon widened
  90→180 min to cover the window. Tapping opens `/match/[id]`, which now has a
  **"Make / Edit my prediction" CTA** on the scheduled scoreboard (opens
  `PredictionModal`).
- **🏆 Leaderboard nudge.** When a match finished in the last ~2h, each opted-in
  device gets a nudge built from `get_leaderboard()` — personalized with the
  user's **rank + the current leader** ("you're #4, {leader} leads with N pts —
  catch up!", or a "join the ranking" line for the unranked, or "defend your
  crown" for #1). Throttled to ~twice a day via a synthetic `push_sent` key
  (`lb-<date>-AM|PM`). Tapping deep-links to the leaderboard tab.
- App (OTA): `useNotifications` routes `type:'leaderboard'` → `/leaderboard` and
  `type:'predict'` → the match; new `NotifData` types. Server-only otherwise
  (no schema change — reuses `push_sent` with non-FK text keys).

### 2026-06-16 — Faster, self-correcting live pushes + MM:SS clock (025)

Reworked the live/notification pipeline after late + sometimes-wrong pushes
(a VAR-annulled goal kept showing the scorer).

- **VAR-annulled goals fixed (server).** `sync-scores` wrote `match_events` with
  `ignoreDuplicates:true` on `(match_id, seq)` → insert-only, so an annulled goal
  lingered forever. Now it **reconciles** goal events to mirror the upstream
  `goals[]`: diff by a stable natural key (`minute|team|scorer`), preserve
  `id`/`pushed`/`created_at` for goals that persist (no re-push, no re-celebrate),
  delete the ones VAR removed, and **write nothing when the set is unchanged** (no
  realtime churn). Cards stay insert-only.
- **Near-instant goal pushes (server).** `sync-scores` now sends the "⚽ GOAL"
  Expo push **inline** the moment it detects a new goal — no waiting for the
  separate `notify-dispatcher` cron — and the cron cadence dropped from 60s to
  **20s** (migration 025, `cron.alter_job` → `'20 seconds'`; the function
  self-guards so off-window cost is one cheap query). Latency ~2 min → ~10-20s.
  `notify-dispatcher` keeps kickoff/lineup/full-time/challenges + is the goal
  backstop; `match_events.pushed` dedupes across both. Shared push logic extracted
  to `supabase/functions/_shared/push.ts` (`sendExpoPush`/`loadDevices`/`wants`/
  `dedupe`).
- **App reflects corrections + self-heals (OTA).** `useMatchRealtime` now handles
  `match_events` **UPDATE & DELETE** (annulled scorer disappears in place) and
  **refetches on socket reconnect** (not just on foreground). `useMatchEvents`
  gained a **~15s live poll** fallback (matches poll tightened 30s→20s) so a missed
  realtime event still self-corrects — "repeat the search" without a manual reload.
- **Progressive MM:SS live clock (OTA).** `useLiveClock` now interpolates seconds
  from the server anchor + drift and exposes `clock` ("67:23", "45+2:13");
  `LiveBadge` shows the ticking seconds everywhere (cards, hero, detail). Re-anchors
  on every realtime patch; half-time still shows "Half Time".
- Ships as an **OTA** at version 1.0.1 (runtime `2c3aa583`, matches the live build).

### 2026-06-16 — Lineup polish: shorter pitch + Apple-Sports avatars (OTA)

- **`LineupPitch` refined** toward the Apple-Sports reference: field height
  `~78% → ~70%` of the screen (a touch shorter, still large; positions unchanged
  via the existing `flex` + `space-between`), and player avatars `56 → 54` on a
  **white circle + subtle ring** so the cut-out api-sports headshots pop instead
  of blending into the green (they were rendering on the dark `palette.surface`).
- **`Avatar` gained two optional, backward-compatible props** — `bg` (photo
  background; applied only to the `<Image>`, so the ~9 photoless players keep the
  gold-initial-on-dark fallback) and `ringColor` (default gold). Header/leaderboard
  avatars are unchanged by the defaults.
- **Shipped via OTA** — JS-only, so it reaches the live build directly. The
  current store build is **1.0.1 / build 10 (runtime `2c3aa583`)**; keeping
  `expo.version` at **1.0.1** makes the update fingerprint match, so the OTA lands
  on every 1.0.1 device (no new build/review needed). This is the first OTA that
  actually reaches users since the runtime finally matches the installed build —
  see `project_ota_runtime_fingerprint` memory. (A version bump would re-break the
  match, so it was reverted.)

### 2026-06-15 — Self-hosted player photos + modular lineup pitch (024)

- **Every player photo is now self-hosted** (migration **024**: public
  `player-photos` Storage bucket). Photos used to be hotlinked to
  `media.api-sports.io` (1130/1249) with 119 missing. `scripts/host-player-photos.mjs`
  downloads every photo into `player-photos/<id>.jpg` and repoints
  `players.photo_url` at our own CDN — permanent, no third-party dependency, and
  it survives squad re-imports (`import-squads.mjs`/`sync-scores` never touch
  `photo_url`). Result: **1240/1249 self-hosted, 0 still on api-sports**, only 9
  fringe players left (clean gold-initial avatar fallback).
- **Multi-source gap fill** (119 → 9 missing). Per player, the script resolves an
  image in priority order: (1) existing api-sports URL → re-host; (2) **match by
  shirt number** within the team against the API-Football squad (unique key —
  recovered **89** gap players where name-matching had failed); (3) **Wikidata /
  Wikimedia Commons** for the rest (all of DR Congo — API-Football returns 0
  squads for them — plus single-name players), gated on occupation = association
  football player (Q937857) so a namesake/team photo is never attached, with an
  English-Wikipedia full-text fallback for mononyms ("Martinelli" → Gabriel
  Martinelli). 21 filled via Wikidata. Resumable checkpoint
  (`scripts/.host-photos.json`), idempotent (`--refresh` to re-pull).
- **Modular `LineupPitch` component** (`src/components/LineupPitch.tsx`). The
  formation pitch was inline in `match/[id].tsx`; extracted into one reusable
  component so every lineup surface (live, finished/past results, future) renders
  **identically**. Made **taller + real-pitch-shaped** (`aspectRatio 0.64`, rows
  distributed evenly down the field via `flex` + `space-between`) — bigger and
  more elongated than the old content-hugging layout. `shortName` moved to
  `lib/format.ts` (shared by the pitch + bench/subs). JS-only → OTA.

### 2026-06-13 — More coverage from the paid tier (023)

All sourced from data football-data already returns (no new paid add-on):

- **Extra match stats** in the detail screen: added `shots_off_goal`,
  `free_kicks`, `goal_kicks`, `throw_ins` rows (already stored in
  `match_details.{home,away}_stats`, just unrendered).
- **Half-time score** — migration 023 adds `matches.home_score_ht`/
  `away_score_ht`; `sync-scores` writes `score.halfTime` in the list loop (so it
  self-backfills every finished match). Shown as "HT 1–0" under the scoreboard.
- **Full referee crew** — `match_details.referees` jsonb (main + assistants +
  nationality); detail header shows the referee + nationality and an assistants
  line. Backfilled for past matches.
- **Official standings** — new `standings` table (public-read) synced from
  `/competitions/WC/standings` (correct FIFA tiebreaks + `form`). `useStandings`
  hook; `GroupTable` uses it when present, else falls back to client-side
  `computeStandings`.
- **Assists** in the Golden Boot card (`top_scorers.assists` was already synced).
- **Not done (needs another paid activation):** betting odds (Odds-Package
  add-on) and xG (football-data has no xG — Sportmonks/API-Football territory).
  Penalty-shootout sequence deferred until knockouts (array is empty in groups).

### 2026-06-13 — Stats-Package live: team stats on every match

- **football-data Stats-Package add-on activated** → `detail.{home,away}Team.
  statistics` now returns real `ball_possession`/`shots`/`shots_on_goal`/
  `corner_kicks`/`fouls`/`offsides`/`saves`/cards (was a `{msg:"Subscribe…"}`
  placeholder). `sync-scores` already stored it in `match_details.home_stats`/
  `away_stats`, so the match-detail StatBars now light up with the real bars.
  (Evaluated API-Football & Sportmonks free tiers first — **both exclude the
  2026 World Cup season**, so staying on football-data was the zero-code path.)
- **Backfill** `scripts/backfill-stats.mjs`: finished matches synced before the
  add-on had null stats (sync-scores never re-fetches a finished+scored match).
  One-time re-fetch merges stats into `match_details` (lineups preserved via
  on-conflict). Ran for all 6 finished matches.
- **sync-scores guard** now also re-fetches a match for ~1.5h after full-time so
  the FINAL stats (finalized a few min after FINISHED) land automatically — no
  future manual backfill needed.
- **`useMatchDetail` adaptive polling:** ~15s while live (stats feel real-time),
  60s pre-kickoff, off once finished.

### 2026-06-13 — UI polish: live clock, half-time, home cards (022, OTA-only)

- **Live clock that ticks on-device.** New `useLiveClock(match)` anchors on the
  server `minute` (re-anchored every Realtime patch) and adds the minutes
  elapsed locally since `updated_at`, so `LiveBadge` counts up every second
  instead of freezing between ~60s syncs; stoppage shows "45+2" / "90+3".
  `LiveBadge` now takes the whole `match` (was `minute`).
- **Half-time.** Migration **022** adds `matches.period` (`1H`/`2H`/`HT`/`ET`/
  `PEN`/null); `sync-scores` derives it from football-data status (PAUSED → HT)
  plus `score.duration`. `status` stays `live`, so every live filter is unchanged —
  the badge just flips to an amber **"Half Time" / "Medio Tiempo"** (HT/MT
  compact) with a steady dot.
- **Home cards (Apple-Sports).** Compact Today/Upcoming cards rebuilt as a
  vertical stack (full team names + exact day·time, "Today/Hoy" when today).
  Next-match hero now shows the **stadium** (`📍 venue · city`) and is tappable →
  `/match/[id]` (the same lineups/detail screen the lineup push opens). Match
  detail header shows the kickoff "Today · 16:00" for scheduled matches.

### 2026-06-12 — Stats: cards, golden boot, lineups, match detail screen (016–019)

- **016 `players.photo_url`** + `scripts/import-player-photos.mjs` (API-Football
  squads, free-plan paced, checkpointed, men's-team aware, token-set name
  matching): 1130/1249 players with circular photo avatars; full squads
  re-imported from football-data (1249 players, complete rosters + shirt nums).
- **017 `match_events.player_id`** resolved by sync-scores per goal → scorer
  photos everywhere. **PostgREST gotcha:** responses cap at 1000 rows — page
  any full-players fetch (bit both the import script and sync-scores).
- **018 `top_scorers`** (golden boot, refreshed from `/competitions/WC/scorers`)
  and cards synced from `bookings[]` as match_events type `yellow`/`red` (seq
  namespace 1000+). UI: red cards by name on match cards + LiveHero chips,
  yellows as per-side counts, `TopScorersCard` widget on home.
- **019 `match_details`** (formations, lineups+bench with player_id/photos,
  substitutions, referee, attendance, stats jsonb) synced in a 90-min
  pre-kickoff window. New **`match/[id]` detail screen**: stat bars
  (possession/shots light up automatically if the football-data
  **Stats-Package add-on** is purchased; goals+cards bars meanwhile) + a
  formation pitch with photo avatars and goal/card badges. Live/finished
  cards navigate to it; scheduled cards keep the prediction sheet.
- Schedule: Upcoming/Results segmented control, live pinned on top, results
  newest-first by day. Home: upcoming strip + golden boot.
- **`eas update` rule:** `--environment` ignores local `.env` — env vars now
  live in EAS environments (production+preview); ALWAYS verify the uploaded
  bundle in `dist/` contains the real Supabase ref before announcing an OTA.

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
- England/Scotland use the flagcdn **subdivision** codes `gb-eng` / `gb-sct` as
  their `iso2` (not `GB`), so `react-native-country-flag` renders their own flag
  (St George's Cross / Saltire) instead of the Union Jack. `flag_emoji` keeps the
  sub-region emoji as the no-`iso2` fallback. (Data-only fix — DB + seed.)
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
