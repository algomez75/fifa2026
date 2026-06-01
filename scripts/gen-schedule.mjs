// Generates data/seed/schedule.json — the full 104-match WC2026 structure.
// 72 group matches (12 groups × 6) + 32 knockout = 104.
// Group pairings are real (team ids); knockout slots use placeholder labels
// (e.g. "Winner Group A") with null team ids until results decide them.
//
// Run:  node scripts/gen-schedule.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'data', 'seed');

const teams = JSON.parse(readFileSync(join(seedDir, 'teams.json'), 'utf8'));
const venues = JSON.parse(readFileSync(join(seedDir, 'venues.json'), 'utf8'));
const venueIds = venues.map((v) => v.id);

const groups = {};
for (const t of teams) {
  (groups[t.group_letter] ??= []).push(t.id);
}
const letters = Object.keys(groups).sort(); // A..L

// Round-robin order for 4 teams (by seed index): standard FIFA matchday layout.
const RR = [
  [0, 1], // MD1
  [2, 3], // MD1
  [0, 2], // MD2
  [3, 1], // MD2
  [3, 0], // MD3 (simultaneous final round)
  [1, 2], // MD3
];

const matches = [];
let n = 0;
const iso = (d) => d.toISOString().replace('.000Z', 'Z');

// Helper: build a UTC kickoff Date for a given calendar day + hour (UTC).
function kickoff(month, day, hourUtc) {
  return new Date(Date.UTC(2026, month - 1, day, hourUtc, 0, 0));
}

// ---- GROUP STAGE (June 11–27) ----
// Spread matchdays across the group window; rotate venues; opener is fixed.
let venueCursor = 0;
const nextVenue = () => venueIds[venueCursor++ % venueIds.length];

// Matchday calendar: each MD pair maps to a day offset block.
// 12 groups, 3 matchdays, 2 matches each → distribute over the window.
const mdDays = {
  0: [11, 12, 13], // MD1 days (June)
  1: [17, 18, 19],
  2: [24, 25, 26],
};
const mdHours = [16, 19, 22, 0]; // UTC kickoff slots

letters.forEach((L, gi) => {
  const ids = groups[L];
  RR.forEach((pair, mi) => {
    n += 1;
    const md = Math.floor(mi / 2); // 0,0,1,1,2,2
    const dayList = mdDays[md];
    const day = dayList[gi % dayList.length];
    const hour = mdHours[(gi + mi) % mdHours.length];
    // Opening match: Mexico (Group A, first pairing) at Azteca, June 11 16:00Z.
    const isOpener = L === 'A' && mi === 0;
    matches.push({
      id: `GS-${L}${mi + 1}`,
      stage: 'group',
      group_letter: L,
      match_number: n,
      home_team_id: ids[pair[0]],
      away_team_id: ids[pair[1]],
      home_placeholder: null,
      away_placeholder: null,
      home_score: null,
      away_score: null,
      home_score_penalties: null,
      away_score_penalties: null,
      status: 'scheduled',
      kickoff_utc: iso(isOpener ? kickoff(6, 11, 16) : kickoff(6, day, hour)),
      venue_id: isOpener ? 'mex' : nextVenue(),
      api_football_fixture_id: null,
      minute: null,
    });
  });
});

// ---- KNOCKOUT STAGE ----
// Placeholder labels; team ids null until decided.
function ko(idPrefix, stage, count, startDay, endDay, marquee) {
  const out = [];
  const span = Math.max(1, endDay - startDay);
  for (let i = 0; i < count; i++) {
    n += 1;
    const day = startDay + Math.round((i / Math.max(1, count - 1)) * span);
    const hour = mdHours[i % mdHours.length];
    out.push({
      id: `${idPrefix}-${i + 1}`,
      stage,
      group_letter: null,
      match_number: n,
      home_team_id: null,
      away_team_id: null,
      home_placeholder: `${stage.toUpperCase()} Slot ${i * 2 + 1}`,
      away_placeholder: `${stage.toUpperCase()} Slot ${i * 2 + 2}`,
      home_score: null,
      away_score: null,
      home_score_penalties: null,
      away_score_penalties: null,
      status: 'scheduled',
      kickoff_utc: iso(kickoff(month(startDay), dayOfMonth(startDay, day), hour)),
      venue_id: marquee ? marquee(i) : nextVenue(),
      api_football_fixture_id: null,
      minute: null,
    });
  }
  return out;
}

// Days here are absolute "June day numbers" that may roll into July (>30).
const month = (d) => (d > 30 ? 7 : 6);
const dayOfMonth = (_start, d) => (d > 30 ? d - 30 : d);

// R32: June 28 – July 3  (days 28..33)
matches.push(...ko('R32', 'r32', 16, 28, 33));
// R16: July 4–7 (days 34..37)
matches.push(...ko('R16', 'r16', 8, 34, 37));
// QF: July 9–11 (days 39..41)
matches.push(...ko('QF', 'qf', 4, 39, 41));
// SF: July 14–15 (days 44..45)
matches.push(...ko('SF', 'sf', 2, 44, 45));
// Third place: July 18 (day 48) at Miami
const third = ko('3RD', 'third', 1, 48, 48, () => 'mia');
third[0].home_placeholder = 'Loser SF1';
third[0].away_placeholder = 'Loser SF2';
matches.push(...third);
// Final: July 19 (day 49) at MetLife (NYC)
const fin = ko('FINAL', 'final', 1, 49, 49, () => 'nyc');
fin[0].home_placeholder = 'Winner SF1';
fin[0].away_placeholder = 'Winner SF2';
fin[0].kickoff_utc = iso(kickoff(7, 19, 19));
matches.push(...fin);

// ---- validate ----
const counts = matches.reduce((a, m) => ((a[m.stage] = (a[m.stage] || 0) + 1), a), {});
if (matches.length !== 104) throw new Error(`Expected 104 matches, got ${matches.length}`);
if (counts.group !== 72) throw new Error(`Expected 72 group matches, got ${counts.group}`);

writeFileSync(join(seedDir, 'schedule.json'), JSON.stringify(matches, null, 2) + '\n');
console.log(`✅ schedule.json written: ${matches.length} matches`, counts);
