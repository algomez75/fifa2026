import { StyleSheet, Text, View } from 'react-native';

import { useTopScorers } from '@/hooks/useTopScorers';
import { teamsById } from '@/lib/seed';
import { palette } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';
import { TeamFlag } from './TeamFlag';

/** Golden-boot leaderboard: rank · player avatar · name · flag · goals. */
export function TopScorersCard({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation();
  const { data } = useTopScorers();
  const scorers = (data ?? []).slice(0, limit);
  if (!scorers.length) return null;

  return (
    <GlassCard accent={palette.gold}>
      <View style={{ gap: 12 }}>
        {scorers.map((s) => {
          const team = s.team_id ? teamsById[s.team_id] : undefined;
          return (
            <View key={s.rank} style={styles.row}>
              <Text style={[styles.rank, s.rank === 1 && styles.rankGold]}>{s.rank}</Text>
              <Avatar url={s.player_photo} name={s.player_name} size={30} ring={s.rank === 1} />
              <Text style={styles.name} numberOfLines={1}>
                {s.player_name}
              </Text>
              <TeamFlag team={team} size={18} showName={false} />
              <Text style={styles.goals}>
                {s.goals}
                <Text style={styles.goalsLabel}> {t.home.goalsShort}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    color: palette.textTertiary,
    fontSize: 13,
    fontWeight: '900',
    width: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rankGold: { color: palette.gold },
  name: { color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 },
  goals: {
    color: palette.gold,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  goalsLabel: { color: palette.textTertiary, fontSize: 11, fontWeight: '700' },
});
