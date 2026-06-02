import type { Match } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { teamsById } from '@/lib/seed';
import { useCelebration } from '@/store/useCelebration';
import { useTranslation } from '@/store/useAppStore';
import { type MatchEvent, useMatchRealtime } from './useMatchRealtime';

/**
 * Root-level bridge: turns live `matches` Realtime events into app-wide
 * celebration overlays (goal burst on a score, trophy on a final result).
 * Mounted once from the root layout.
 */
export function useLiveEvents() {
  const { t, language } = useTranslation();
  const celebrate = useCelebration((s) => s.celebrate);

  const scoreLabel = (m: Match) => {
    const home = m.home_team_id ? teamsById[m.home_team_id] : undefined;
    const away = m.away_team_id ? teamsById[m.away_team_id] : undefined;
    return `${teamName(home, language)} ${m.home_score ?? 0}–${m.away_score ?? 0} ${teamName(away, language)}`.trim();
  };

  useMatchRealtime({
    onGoal: (e: MatchEvent) =>
      celebrate({
        kind: 'goal',
        title: t.celebrate.goal,
        label: scoreLabel(e.match),
        key: `goal:${e.matchId}:${e.match.home_score}-${e.match.away_score}`,
      }),
    onResult: (e: MatchEvent) =>
      celebrate({
        kind: 'result',
        title: t.celebrate.fullTime,
        label: scoreLabel(e.match),
        key: `result:${e.matchId}`,
      }),
  });
}
