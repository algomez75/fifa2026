import { StyleSheet, Text, View } from 'react-native';

import type { Match } from '@/lib/database.types';
import { formatKickoffTime, matchDayLabel } from '@/lib/format';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/**
 * Amber pill for a non-normal timing state (delayed / postponed / suspended /
 * cancelled). For postponed/delayed it also shows the (already-refreshed) new
 * kickoff time so the card never displays a stale time. Renders nothing when
 * the match has no `delay_status`. Cause = the provider status (no free-text).
 */
export function DelayBadge({ match, showTime = true }: { match: Match; showTime?: boolean }) {
  const { t, language } = useTranslation();
  const ds = match.delay_status;
  if (!ds) return null;

  const label =
    ds === 'postponed'
      ? t.common.postponed
      : ds === 'suspended'
        ? t.common.suspended
        : ds === 'cancelled'
          ? t.common.cancelled
          : t.common.delayed;
  const danger = ds === 'cancelled';
  // A suspended match is mid-play (score is shown by the live branch); a
  // postponed/delayed one shows its new kickoff time.
  const withTime = showTime && (ds === 'postponed' || ds === 'delayed');

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, danger ? styles.pillDanger : styles.pillWarn]}>
        <Text style={[styles.dot, danger ? styles.dotDanger : styles.dotWarn]}>●</Text>
        <Text style={[styles.text, danger ? styles.textDanger : styles.textWarn]}>{label}</Text>
      </View>
      {withTime ? (
        <Text style={styles.time} numberOfLines={1}>
          {matchDayLabel(match.kickoff_utc, language, t.common.today)}{'  '}
          {formatKickoffTime(match.kickoff_utc, language)}
        </Text>
      ) : null}
    </View>
  );
}

const AMBER = '#E0A800';

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 3 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillWarn: { backgroundColor: 'rgba(224,168,0,0.14)', borderColor: AMBER },
  pillDanger: { backgroundColor: palette.liveDim, borderColor: palette.live },
  dot: { fontSize: 8, marginTop: -1 },
  dotWarn: { color: AMBER },
  dotDanger: { color: palette.live },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  textWarn: { color: AMBER },
  textDanger: { color: palette.live },
  time: { color: palette.gold, fontSize: 12.5, fontWeight: '800' },
});
