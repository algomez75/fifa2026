import type { Match } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { teamsById } from '@/lib/seed';
import { useCelebration } from '@/store/useCelebration';
import { useTranslation } from '@/store/useAppStore';
import { type MatchEvent, useMatchRealtime } from './useMatchRealtime';

/**
 * Root-level bridge: turns live `matches` / `match_events` Realtime events into
 * app-wide celebration overlays (goal burst with the scorer's name when known,
 * trophy on a final result). Mounted once from the root layout.
 */
export function useLiveEvents() {
  const { t, language } = useTranslation();
  const celebrate = useCelebration((s) => s.celebrate);

  const scoreLabel = (m: Match, h?: number | null, a?: number | null) => {
    const home = m.home_team_id ? teamsById[m.home_team_id] : undefined;
    const away = m.away_team_id ? teamsById[m.away_team_id] : undefined;
    return `${teamName(home, language)} ${h ?? m.home_score ?? 0}–${a ?? m.away_score ?? 0} ${teamName(away, language)}`.trim();
  };

  useMatchRealtime({
    onGoal: (e: MatchEvent) => {
      const h = e.goal?.scoreHome ?? e.match.home_score;
      const a = e.goal?.scoreAway ?? e.match.away_score;
      // "Raúl Jiménez 67′ · Mexico 2–0 South Africa" when the scorer is known.
      const scorer = e.goal?.playerName
        ? `${e.goal.playerName}${e.goal.minute != null ? ` ${e.goal.minute}′` : ''} · `
        : '';
      celebrate({
        kind: 'goal',
        title: t.celebrate.goal,
        label: `${scorer}${scoreLabel(e.match, h, a)}`,
        key: `goal:${e.matchId}:${h ?? 0}-${a ?? 0}`,
      });
    },
    onResult: (e: MatchEvent) =>
      celebrate({
        kind: 'result',
        title: t.celebrate.fullTime,
        label: scoreLabel(e.match),
        key: `result:${e.matchId}`,
      }),
  });
}
