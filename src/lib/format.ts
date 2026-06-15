import { format, formatDistanceStrict, isSameDay, isToday } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';

import type { Language } from './i18n';
import type { Match, Team } from './database.types';
import { teamsById } from './seed';

const locales = { en: enUS, es: esLocale };

export function dateLocale(lang: Language) {
  return locales[lang] ?? enUS;
}

/** "Sat, Jun 13" style header for a kickoff day. */
export function formatMatchDay(iso: string, lang: Language): string {
  const d = new Date(iso);
  return format(d, 'EEE, MMM d', { locale: dateLocale(lang) });
}

/** Like `formatMatchDay`, but collapses to "Today"/"Hoy" when it's today. */
export function matchDayLabel(iso: string, lang: Language, todayLabel: string): string {
  return isToday(new Date(iso)) ? todayLabel : formatMatchDay(iso, lang);
}

/** "16:00" local kickoff time. */
export function formatKickoffTime(iso: string, lang: Language): string {
  return format(new Date(iso), 'HH:mm', { locale: dateLocale(lang) });
}

/** Day key (YYYY-MM-DD in local tz) for grouping matches by date. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isMatchToday(iso: string): boolean {
  return isToday(new Date(iso));
}

export function isSameDayIso(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}

/** "in 3 days" / "in 2 hours" relative phrase. */
export function kickoffDistance(iso: string, lang: Language): string {
  return formatDistanceStrict(new Date(iso), new Date(), {
    locale: dateLocale(lang),
    addSuffix: false,
  });
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // ms remaining (clamped at 0)
}

export function countdownTo(iso: string, now: number = Date.now()): CountdownParts {
  const total = Math.max(0, new Date(iso).getTime() - now);
  const sec = Math.floor(total / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    total,
  };
}

/** Resolve display name for a match side, falling back to placeholder label. */
export function sideName(
  teamId: string | null,
  placeholder: string | null,
  lang: Language,
): string {
  if (teamId && teamsById[teamId]) {
    const t = teamsById[teamId];
    return (lang === 'es' && t.name_es) || t.name;
  }
  return placeholder ?? 'TBD';
}

export function teamName(team: Team | undefined, lang: Language): string {
  if (!team) return 'TBD';
  return (lang === 'es' && team.name_es) || team.name;
}

/** FIFA-style 3-letter uppercase code (e.g. "USA", "BIH", "KOR"). Used as the
 *  no-ellipsis fallback for long names — see the <TeamName/> component. */
export function teamAbbr(team: Team | undefined): string {
  return (team?.id ?? 'TBD').toUpperCase();
}

/** Next upcoming (scheduled) match by kickoff, or the first live one. */
export function nextMatch(matches: Match[]): Match | undefined {
  const live = matches.find((m) => m.status === 'live');
  if (live) return live;
  const now = Date.now();
  return [...matches]
    .filter((m) => new Date(m.kickoff_utc).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
    )[0];
}
