import { StyleSheet, Text, View } from 'react-native';

import type { ChallengeSide, Match, MyChallengeRow } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import type { Language } from '@/lib/i18n';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** "Brazil by 2" / "Draw" — a readable summary of a side + margin pick. */
export function challengePickLabel(
  side: ChallengeSide | null,
  margin: number | null,
  match: Match | undefined,
  t: ReturnType<typeof useTranslation>['t'],
  lang: Language,
): string {
  if (!side) return '—';
  if (side === 'draw') return t.challenge.draw;
  const team = match
    ? side === 'home'
      ? match.home_team_id && teamsById[match.home_team_id]
      : match.away_team_id && teamsById[match.away_team_id]
    : undefined;
  const name = team ? teamName(team, lang) : side;
  return `${name} ${t.challenge.byGoals} ${margin ?? 0}`;
}

/**
 * The agreed terms of a 1v1 challenge — both players' picks (side + margin), the
 * stakes, and the current status/outcome. Rendered identically to BOTH
 * participants (each `MyChallengeRow` is POV-correct: `my_*` = the viewer, so the
 * challenger and the opponent each see "You" vs the other player). Shown on the
 * notifications inbox so accepting a challenge reveals exactly what was pacted.
 */
export function ChallengeDetails({ row, match }: { row: MyChallengeRow; match?: Match }) {
  const { t, language } = useTranslation();

  let badge: { label: string; color: string } | null = null;
  if (row.status === 'declined') badge = { label: t.challenge.declined, color: palette.textTertiary };
  else if (row.outcome === 'won') badge = { label: `${t.challenge.won} +3`, color: palette.gold };
  else if (row.outcome === 'lost') badge = { label: t.challenge.lost, color: palette.textTertiary };
  else if (row.outcome === 'tie') badge = { label: `${t.challenge.tie} +1`, color: palette.success };
  else if (row.status === 'accepted') badge = { label: t.challenge.accepted, color: palette.success };
  else if (row.status === 'pending' && row.role === 'challenger')
    badge = { label: t.challenge.waiting, color: palette.textSecondary };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{t.challenge.termsTitle}</Text>
        {badge ? (
          <Text style={[styles.badge, { color: badge.color, borderColor: badge.color }]}>
            {badge.label}
          </Text>
        ) : null}
      </View>
      {row.my_side ? (
        <Text style={styles.pick} numberOfLines={1}>
          <Text style={styles.who}>{t.challenge.yourPick}: </Text>
          {challengePickLabel(row.my_side, row.my_margin, match, t, language)}
        </Text>
      ) : null}
      {row.their_side ? (
        <Text style={styles.pick} numberOfLines={1}>
          <Text style={styles.who}>{row.other_name}: </Text>
          {challengePickLabel(row.their_side, row.their_margin, match, t, language)}
        </Text>
      ) : null}
      <Text style={styles.stakes}>{t.challenge.stakes}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  pick: { color: palette.text, fontSize: 13.5 },
  who: { color: palette.textSecondary, fontWeight: '700' },
  stakes: { color: palette.textTertiary, fontSize: 11.5, marginTop: 2 },
});
