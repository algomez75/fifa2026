import type { Team } from './database.types';

/** Lowercase + strip diacritics so "sudafrica" matches "Sudáfrica", "japon"
 *  matches "Japón", "mexico" matches "México", etc. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’.]/g, '')
    .trim();
}

/**
 * Extra search aliases per team id — only the alternate names that aren't
 * already reachable via the team's English name, Spanish name, 3-letter id, or
 * ISO-2 code. Each entry is matched accent-insensitively as a substring/prefix.
 */
const TEAM_ALIASES: Record<string, string[]> = {
  usa: ['usa', 'us', 'eeuu', 'ee uu', 'america', 'usmnt', 'stars and stripes'],
  ned: ['holland', 'holanda', 'oranje'],
  kor: ['korea', 'corea', 'rok'],
  rsa: ['safrica', 'bafana'],
  ksa: ['saudi', 'arabia', 'ksa'],
  eng: ['uk', 'britain', 'great britain', 'three lions'],
  cze: ['czech', 'czech republic', 'republica checa'],
  civ: ['cote', 'ivoire', 'cote divoire', 'elephants'],
  bih: ['bosnia', 'herzegovina'],
  nzl: ['kiwis', 'all whites'],
  cuw: ['curacao'],
  qat: ['catar'],
  uae: ['emirates'],
};

/** All searchable words/codes for a team, normalized. */
function searchWords(team: Team): string[] {
  const text = normalizeText(
    [team.name, team.name_es ?? '', ...(TEAM_ALIASES[team.id] ?? [])].join(' '),
  );
  const words = text.split(/[\s-]+/).filter(Boolean);
  words.push(team.id.toLowerCase());
  if (team.iso2) words.push(team.iso2.toLowerCase());
  return words;
}

/**
 * Comprehensive, user-friendly team match. Returns true when the query matches
 * by: exact 3-letter code / ISO-2 / group letter; a full-name substring
 * (e.g. "united sta", "del sur"); or any name word / code **prefix**
 * (e.g. "usa", "us", "kor", "esta", "sudaf"). Accent-insensitive throughout.
 */
export function teamMatchesQuery(team: Team, rawQuery: string): boolean {
  const q = normalizeText(rawQuery);
  if (!q) return true;

  // Exact short codes & group letter (keeps 1–3 char queries precise).
  if (team.id.toLowerCase() === q) return true;
  if ((team.iso2 ?? '').toLowerCase() === q) return true;
  if ((team.group_letter ?? '').toLowerCase() === q) return true;

  // Full-name substring — handles multi-word queries like "united sta".
  // Gated to 2+ chars so a lone letter doesn't match every name's interior.
  if (q.length >= 2) {
    const names = normalizeText(
      [team.name, team.name_es ?? '', ...(TEAM_ALIASES[team.id] ?? [])].join(' '),
    );
    if (names.includes(q)) return true;
  }

  // Word / code prefix — "us" → USA, "kor" → Korea, "esta" → Estados Unidos.
  return searchWords(team).some((w) => w.startsWith(q));
}
