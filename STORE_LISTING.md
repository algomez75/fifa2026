# 11 Gol — App Store / Google Play listing

Copy-paste ready. Publisher: **Portela 11 LLC** · Support: **info@portela11.com**
Bundle/Package id: **com.portela11.wc26**

## Hosted legal URLs (live)
- Privacy Policy: `https://xqjupomaqomneqiugbft.supabase.co/storage/v1/object/public/legal/privacy.txt`
- Terms of Service: `https://xqjupomaqomneqiugbft.supabase.co/storage/v1/object/public/legal/terms.txt`

---

## Names & text

> ⚠️ Guideline 5.2.1 (IP): keep ALL metadata free of "FIFA", "World Cup", "Mundial",
> "Copa Mundial". Present 11 Gol as an independent, generic football app for 2026.

**App name (≤30):** `11 Gol`
**Subtitle / short description (≤30):** `Scores, squads & predictions`
**Promotional text (≤170):** `Follow every match of the 2026 tournament — live scores, full schedule, group tables, squads, and a prediction game with friends. Free, dark, bilingual.`

**Keywords (≤100):**
EN (English U.S.):
`soccer,football,2026,fixtures,schedule,scores,predictions,bracket,teams,groups,futbol,quiniela`
ES (Spanish MX / ES localization, if enabled):
`futbol,2026,calendario,marcadores,resultados,quiniela,porra,predicciones,grupos,equipos`
> Never include: FIFA, World Cup, Mundial, Copa Mundial, WC. "quiniela"/"porra" are
> generic prediction-pool terms with high search volume and zero trademark risk.

**Category:** Sports · **Secondary:** Entertainment

### Description (English)
```
11 Gol is your companion for the 2026 international football tournament across the USA, Mexico & Canada.

⚽ FULL SCHEDULE — All 104 matches with dates in your local time, venues, and live status.
📊 LIVE SCORES — Real-time score updates and a breathing "LIVE" indicator during matches.
🏆 GROUPS & BRACKET — All 12 group tables and the full knockout bracket.
🧑‍🤝‍🧑 TEAMS & SQUADS — All 48 nations, full squads by position, and coaches.
🎯 PREDICTIONS — Predict match scores and climb the global leaderboard. Exact score = 3 pts, correct result = 1 pt.
❤️ YOUR TEAMS — Favorite up to 5 teams and get their matches front and center.
🔔 ALERTS — Optional kickoff, goal, and full-time notifications.
🌎 BILINGUAL — Full English & Spanish.

Dark, fast, and privacy-friendly: no ads, no tracking. Play as a guest or create an account to sync across devices.

11 Gol is an independent app. It is not affiliated with, endorsed by, or sponsored by any football organization, association, team, or competition. All team names are the property of their respective owners.
```

### Description (Español)
```
11 Gol es tu app para el torneo internacional de fútbol 2026 en Estados Unidos, México y Canadá.

⚽ CALENDARIO COMPLETO — Los 104 partidos con fecha en tu hora local, sedes y estado en vivo.
📊 MARCADORES EN VIVO — Actualización en tiempo real e indicador "EN VIVO".
🏆 GRUPOS Y LLAVE — Las 12 tablas de grupos y la llave eliminatoria completa.
🧑‍🤝‍🧑 EQUIPOS Y PLANTILLAS — Las 48 selecciones, plantillas por posición y entrenadores.
🎯 PREDICCIONES — Predice marcadores y sube en el ranking global. Exacto = 3 pts, resultado = 1 pt.
❤️ TUS EQUIPOS — Marca hasta 5 favoritos y tenlos al frente.
🔔 ALERTAS — Notificaciones opcionales de inicio, gol y final.
🌎 BILINGÜE — Inglés y español.

Oscura, rápida y respetuosa con tu privacidad: sin anuncios ni rastreo. Juega como invitado o crea una cuenta para sincronizar.

11 Gol es una app independiente. No está afiliada, avalada ni patrocinada por ninguna organización, asociación, equipo o competición de fútbol. Los nombres de las selecciones son propiedad de sus respectivos dueños.
```

---

## App Privacy (Apple "nutrition labels")

Tracking: **No** (we do NOT track across apps/sites).

Data collected & **linked to the user** (NOT used for tracking):
| Data type | Purpose | Notes |
| --- | --- | --- |
| Email Address | App Functionality, Account | Only if the user creates an account |
| Name (display name) | App Functionality | Optional; shown on leaderboard |
| Photos (avatar) | App Functionality / User Content | Only the photo the user picks |
| User ID | App Functionality | Account / anonymous id |
| Product Interaction | App Functionality | Predictions, favorites |
| Device ID (push token) | App Functionality | Only if notifications enabled |

Data NOT collected: location, contacts, browsing history, financial info, health, ads data.

## Google Play — Data safety (mirror of the above)
- Data is **encrypted in transit**. ✅
- Users **can request deletion** in-app (Profile → Delete account). ✅
- No data shared with third parties for advertising. ✅
- Collected: email, name, photos (user content), app activity (predictions/favorites), device id (push) — all for app functionality, optional.

---

## Age rating
- Apple: **4+** (no objectionable content).
- Google: **Everyone**.
- ⚠️ The app has **user-generated content** (display names + avatars visible on the leaderboard).
  See LAUNCH_CHECKLIST.md → "UGC moderation" — Apple guideline 1.2 requires a way to
  report/block. 11 Gol includes a "Report player" action on the leaderboard + account deletion.

## URLs to enter in the console
- Support URL: an `https://` page (Apple often rejects `mailto:`) — e.g. your site or a simple support page.
- Marketing URL (optional): your site — make sure it has NO "FIFA / World Cup / Mundial" either.
- Privacy Policy URL: (privacy.txt link above) — required in both stores. Re-host after editing
  `data/legal.json` with `node scripts/host-legal.mjs`.

## Screenshots (Guideline 5.2.1)
- Re-capture from the NEW build — they must show "11 GOL", never "WORLD CUP".
- Replace all sizes (6.7" + 6.1" iPhone, iPad if offered). The old screenshots showed "WORLD CUP".

## Reply to App Review (paste in the resolution thread)
```
Hello,
Thank you for the review. We removed all third-party content and trademarks from the app and its metadata:
- Removed every reference to "FIFA" and "World Cup" from the UI, app name, description, keywords, and the Privacy Policy / Terms.
- The app is presented as "11 Gol", an independent football companion for the 2026 tournament.
- It only displays factual match data (dates, venues, national team names, scores) plus a score-prediction game. No official emblem, logo, trophy, mascot, or trademarked name is used.
- Added a clear statement that 11 Gol is independent and not affiliated with, endorsed by, or sponsored by any football organization, association, team, or competition.
A new build and updated screenshots/metadata reflecting these changes have been submitted.
```
