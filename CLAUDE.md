@AGENTS.md

# WC26 — FIFA World Cup 2026 Companion App

Dark-first, bilingual (EN/ES) React Native app for the 2026 World Cup
(**48 teams · 12 groups · 16 venues · 104 matches** · USA / Mexico / Canada).
Built with **Expo Router (SDK 56)**, **React 19 + React Compiler**,
**Reanimated 4**, **TanStack Query v5**, **Zustand**, and **Supabase**
(Postgres + Realtime + Edge Functions + anonymous auth).

> ⚠️ Expo SDK 56 changed many APIs. Always read the versioned docs at
> <https://docs.expo.dev/versions/v56.0.0/> before writing native/Expo code.

The app runs **fully offline on bundled seed data** out of the box; every data
hook checks `isSupabaseConfigured` and falls back to `data/seed/`. Supabase only
adds live sync, cloud persistence of favorites/push tokens, and push alerts.

---

## Stack & key versions

| Area | Choice |
|------|--------|
| Runtime | Expo SDK `~56.0.8`, React Native `0.85.3`, React `19.2.3` |
| Navigation | `expo-router ~56.2.8` (typed routes, file-based) |
| Animation | `react-native-reanimated 4.3.1` + `react-native-worklets`, Lottie |
| Data fetching | `@tanstack/react-query ^5` |
| Local state | `zustand ^5` (AsyncStorage-persisted) |
| Backend | `@supabase/supabase-js ^2` (Postgres, Realtime, Edge Functions, anon auth) |
| Dates | `date-fns ^4` + `date-fns-tz` (EN/ES locales) |
| i18n | hand-rolled dictionaries (`i18n-js` present but app uses `src/locales`) |
| Flags | `react-native-country-flag` (ISO-3166 a2) + emoji fallback |
| Glass UI | `expo-blur`, `expo-glass-effect` |
| TypeScript | `~6.0.3`, `strict: true`, path alias `@/* → src/*`, `@/assets/* → assets/*` |

`app.json` highlights: scheme `wc26`, forced dark `userInterfaceStyle`, bg
`#0A0E1A`, bundle id `com.portela11.wc26`, gold (`#D4AF37`) notification accent,
`UIBackgroundModes: ["remote-notification"]`, experiments `typedRoutes` +
`reactCompiler` enabled.

---

## Project layout

```text
src/
  app/                       Expo Router routes
    _layout.tsx              Root: providers + anon auth + push registration
    (tabs)/_layout.tsx       Tab navigator with custom <TabBar/>
    (tabs)/index.tsx         Home — hero countdown/live, your-teams, today
    (tabs)/schedule.tsx      Schedule — day groups, host/stage filters, manual scoring
    (tabs)/groups.tsx        Groups ↔ Bracket segmented view
    (tabs)/teams.tsx         Team grid + search + favorites strip
    (tabs)/history.tsx       Past editions, titles chart, highest-scoring, modal
    team/[id].tsx            Team detail — gradient header, standing, fixtures
  components/                MatchCard, BracketTree, GroupTable, Countdown, LiveBadge,
                             TeamFlag, GlassCard, GradientHeader, ScreenHeader, TabBar,
                             ScoreModal, GoalOverlay, LangToggle, States, icons
  hooks/                     useMatches/useUpdateScore, useMatchRealtime, useFavorites,
                             useNotifications, useAnonAuth
  lib/                       supabase, theme, i18n, standings, format, seed,
                             apiFootball, queryClient, database.types
  store/                     useAppStore (Zustand) + useTranslation
  locales/                   en.ts · es.ts (Translation type)
data/seed/                   teams.json (48) · venues.json (16) · schedule.json (104)
                             · historical.json (22 editions, 12 matches)
supabase/
  migrations/                001–007 SQL
  functions/                 sync-scores · notify-dispatcher · import-history (Deno)
  seed.sql                   generated INSERTs (npm run gen:seed)
  config.toml · .temp/       CLI link state (linked project: worldcup26)
scripts/                     gen-schedule · gen-seed-sql · seed.ts · db-exec · verify · gen-icons
assets/animations/           goal · countdown · trophy (Lottie JSON)
assets/images/               brand icons (generated from fifaimages/shopping.webp)
```

---

## Architecture & conventions

- **Offline-first.** `src/lib/supabase.ts` exports `isSupabaseConfigured`
  (true when both `EXPO_PUBLIC_SUPABASE_URL` and `…_ANON_KEY` are set). Every
  hook short-circuits to bundled seed data when false, so the UI never hangs on
  a missing backend. `useMatches` also falls back to seed if the remote table
  is empty.
- **Seed data is canonical.** `data/seed/*.json` is the single source of truth,
  consumed three ways: (1) the app via `src/lib/seed.ts`, (2) `supabase/seed.sql`
  via `npm run gen:seed`, (3) `scripts/seed.ts` for remote seeding. `seed.ts`
  builds `teamsById` / `venuesById` O(1) lookup maps and `groupLetters`.
- **Local state vs cloud.** Zustand (`useAppStore`, persisted to AsyncStorage
  under `wc26-app-store`) is the source of truth for language, favorites
  (max 5, `MAX_FAVORITES`), and filters. When Supabase + an anon user exist,
  favorites/push tokens are mirrored to `user_settings` best-effort.
- **Server state** lives in TanStack Query (`queryClient`), key `['matches']`.
  `useUpdateScore` does optimistic cache updates with rollback; `useMatchRealtime`
  patches the same cache from Realtime UPDATEs and fires `onGoal` on score-up.
- **i18n.** `useTranslation()` returns `{ t, language }`. Device default via
  `expo-localization`, toggled with `<LangToggle/>`. Team names use `name_es`
  fallback; stage labels live in `theme.ts` `stageMeta`.
- **Design system** in `src/lib/theme.ts`: dark `palette`, `hostColors`
  (USA blue / Mexico green / Canada red), `confederationColor`, `radius`,
  `spacing`, `font`, `stageMeta`. Brand = black / white / gold `#D4AF37`.
- **Path alias** `@/` → `src/`. Scripts and edge functions are excluded from the
  app tsconfig.

---

## Data model (Supabase / `database.types.ts`)

- `teams` — 48 rows, PK text id (e.g. `usa`, `bra`), `group_letter`,
  `host_country`, `confederation`, `iso2`, `api_football_id`.
- `venues` — 16 host venues, `country` (USA/Mexico/Canada), `capacity`,
  `lat`/`lng`, `color` (city brand color for gradient headers — app-only field
  via `SeedVenue`).
- `matches` — 104 rows, PK text id (`GS-A1`, `R32-1`, `FINAL-1`). Stages:
  `group`(72) · `r32`(16) · `r16`(8) · `qf`(4) · `sf`(2) · `third`(1) ·
  `final`(1). Knockout slots carry `home_placeholder`/`away_placeholder`
  ("Winner Group A") until decided. `set_updated_at` trigger keeps `updated_at`
  fresh; added to the `supabase_realtime` publication.
- `user_settings` — RLS owner-only (`auth.uid() = user_id`), favorites array,
  notify prefs (`notify_favorites`/`notify_all`/`notify_minutes_before`),
  timezone, language, `expo_push_token`.
- `historical_editions` (22, 1930–2022) + `historical_matches` (12).

**RLS:** every table has RLS on. `teams`/`venues`/`matches`/`historical_*` have
public `SELECT` policies; `matches` also allows authenticated (incl. anonymous)
UPDATE for manual score edits; `user_settings` stays owner-scoped (migration 007).

### Migrations

`001_teams` · `002_venues` (+`color`) · `003_matches` (+ indexes & updated_at
trigger) · `004_user_settings` (RLS + push index) · `005_historical` (+ realtime
publication) · `006_cron` (pg_cron/pg_net invokers, **commented — apply after
deploy**) · `007_read_policies` (public read + authenticated match-update).

---

## Backend (Edge Functions, Deno)

- **`sync-scores`** — intended every 60s via pg_cron. Cheap guard first: only
  calls API-Football when a match is `live` (or kicks off within 5 min),
  protecting the 100 req/day free tier. Maps API status → `scheduled|live|finished`,
  upserts by `api_football_fixture_id`. **Inert until `APIFOOTBALL_KEY` secret is set.**
- **`notify-dispatcher`** — every minute. Sends "kickoff soon" (per-user
  `notify_minutes_before` window) and "full time" pushes via the Expo Push API
  (batched 100/req) to subscribed tokens respecting `notify_favorites`/`notify_all`.
- **`import-history`** — one-shot. POST `historical.json` body, or with no body
  pulls openfootball's World Cup history as a fallback.

`src/lib/apiFootball.ts` holds typed client helpers + `mapStatus` (league 1 =
World Cup, season 2026) for a future client-side fallback.

---

## Scripts (`package.json`)

- `npm start` / `android` / `ios` / `web` — Expo dev server.
- `npm run typecheck` — `tsc --noEmit`. `npm run lint` — `expo lint`.
- `npm run gen:schedule` — rebuild `data/seed/schedule.json` (asserts 104 matches).
- `npm run gen:seed` — rebuild `supabase/seed.sql` from the JSON.
- `npm run seed:remote` — `tsx scripts/seed.ts` (needs service-role key).
- `scripts/db-exec.mjs` — run SQL files via the Supabase Management API
  (`SUPABASE_ACCESS_TOKEN` + `SUPABASE_REF`).
- `scripts/verify.mjs` — end-to-end RLS smoke test (public read, anon sign-in,
  favorites round-trip, RLS isolation, score write-back + reset).
- `scripts/gen-icons.mjs` — regenerate app/splash/favicon/adaptive icons from
  `assets/images/fifaimages/shopping.webp` via `sharp`.

---

## Backend setup (when wiring a fresh project)

1. Fill `.env` from `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`,
   `…_ANON_KEY`; optional `EXPO_PUBLIC_APIFOOTBALL_KEY`; server-only
   `SUPABASE_SERVICE_ROLE_KEY`).
2. `supabase db push` (runs 001–007), then seed via `supabase/seed.sql`,
   `scripts/seed.ts`, or `scripts/db-exec.mjs`.
3. `supabase functions deploy sync-scores notify-dispatcher import-history`;
   `supabase secrets set APIFOOTBALL_KEY=…` to enable live sync.
4. Uncomment + apply `006_cron.sql` (set `<REF>`) to schedule the cron jobs.

Push notifications, Reanimated, and Lottie require a **dev client** build
(`npx expo run:ios|android` or EAS); most UI works in Expo Go. A token needs an
EAS `projectId`.

---

## Change log

> Newest first. Keep this updated when shipping features or schema changes.

### 2026-06-01 — Supabase live backend wired + brand icons

- Linked Supabase project **`worldcup26`** (ref `xqjupomaqomneqiugbft`); `.env`
  populated so the app now runs against the live backend (still seed-safe).
- Added **migration 007** (`007_read_policies.sql`): RLS enabled on all tables
  with public-read policies for tournament data + authenticated match-update,
  keeping `user_settings` owner-only.
- Added tooling: `scripts/db-exec.mjs` (Management-API SQL runner),
  `scripts/verify.mjs` (RLS/auth/favorites/score-write smoke test),
  `scripts/gen-icons.mjs` (brand icon generator via `sharp`).
- Generated WC26 brand app icon / splash / favicon / Android adaptive icons from
  `fifaimages/shopping.webp`; updated `app.json` icon config and `package.json`
  (`sharp` devDependency).

### Initial build — full app

- Expo Router SDK 56 app, React 19 + React Compiler, 5 tabs + team detail.
- Offline-first data layer (seed JSON ↔ Supabase) with TanStack Query +
  Zustand; favorites (max 5), bilingual EN/ES, host/stage filters.
- Components: glass `TabBar`, animated `MatchCard` (live glow), `BracketTree`,
  `GroupTable` (FIFA tiebreak standings), `Countdown`, `GoalOverlay`,
  `ScoreModal`, gradient team header.
- Supabase schema 001–006, three Deno edge functions, anon auth, Realtime score
  push + goal animation, Expo push dispatcher.
- Seed data: 48 teams / 16 venues / 104 matches (real Dec-2025 draw) / 22 past
  editions; generators (`gen-schedule`, `gen-seed-sql`) + remote `seed.ts`.

---

## Gotchas / decisions

- **Managed workflow + dev client** (not bare) — EAS builds, no Mac needed.
- Live API-Football sync is written but **inert until `APIFOOTBALL_KEY` is set**.
- England/Scotland use ISO `GB` for flag images (emoji sub-region flags in data).
- Knockout matches seed with placeholder labels until results decide them.
- `useMatches` returns seed data if the remote `matches` table is empty — don't
  assume an empty result means "no matches".
- Standings tiebreak is simplified (points → GD → GF → id), not the full FIFA
  head-to-head ruleset.
- Push/Reanimated/Lottie are no-ops in Expo Go & simulators — test on a dev client.
