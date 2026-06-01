# WC26 — FIFA World Cup 2026 Companion App

A dark-first, bilingual (EN/ES) React Native app for the 2026 World Cup
(48 teams · 12 groups · 104 matches · USA / Mexico / Canada).
Built with **Expo Router (SDK 56)**, **Reanimated 3/4**, **TanStack Query**,
**Zustand**, and **Supabase** (Postgres + Realtime + Edge Functions).

The app runs **fully offline on bundled seed data** out of the box — Supabase
only adds live sync, persistence, and push. Real Dec-2025 group draw, the 16 host
venues, the full 104-match schedule, and all 22 past editions (1930–2022) ship in
`data/seed/`.

## Run the app

```bash
npm install
npm start            # Expo dev server → press i / a, or scan in Expo Go
```

> Push notifications, Reanimated, and Lottie require a **dev client** build
> (`npx expo run:ios` / `run:android`, or an EAS build). Most UI works in Expo Go.

Type-check: `npx tsc --noEmit`

## Project layout

```
src/
  app/                     Expo Router routes
    (tabs)/                Home · Schedule · Groups/Bracket · Teams · History
    team/[id].tsx          Team detail
  components/              MatchCard, BracketTree, GroupTable, Countdown, LiveBadge,
                           TeamFlag, GlassCard, TabBar, ScoreModal, GoalOverlay, …
  hooks/                   useMatches, useMatchRealtime, useFavorites, useNotifications
  lib/                     supabase, theme, i18n, standings, format, seed, apiFootball
  store/                   useAppStore (Zustand, AsyncStorage-persisted)
  locales/                 en.ts · es.ts
data/seed/                 teams.json · venues.json · schedule.json · historical.json
supabase/
  migrations/              001–006 SQL
  functions/               sync-scores · notify-dispatcher · import-history (Deno)
  seed.sql                 generated INSERTs (npm run gen:seed)
scripts/                   gen-schedule.mjs · gen-seed-sql.mjs · seed.ts
assets/animations/         goal · countdown · trophy (Lottie)
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
   supabase db push                       # runs migrations 001–005
   psql "$DATABASE_URL" -f supabase/seed.sql     # or:
   EXPO_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
   ```
3. Deploy edge functions:
   ```bash
   supabase functions deploy sync-scores notify-dispatcher import-history
   supabase secrets set APIFOOTBALL_KEY=xxxx          # optional, enables live sync
   ```
4. Enable the cron jobs: edit `supabase/migrations/006_cron.sql` (uncomment, set
   `<REF>`) and apply it. `sync-scores` self-throttles — it only calls API-Football
   when a match is live, protecting the 100 req/day free tier.

Realtime is enabled on `matches` (migration 005); the client subscribes in
`useMatchRealtime` and triggers the goal animation on score changes.

## Regenerate seed data

```bash
npm run gen:schedule   # rebuild data/seed/schedule.json (asserts 104 matches)
npm run gen:seed       # rebuild supabase/seed.sql from the JSON
```

## Notes / decisions

- **Expo Router** (built on React Navigation v6) instead of bare RN navigation.
- **Managed workflow + dev client** (not bare) — builds via EAS, no Mac needed.
- Live API-Football sync is written but **inert until `APIFOOTBALL_KEY` is set**.
- England/Scotland use ISO `GB` for flag images (emoji sub-region flags in data).
- Knockout matches seed with placeholder labels ("R32 Slot 1") until results decide them.
