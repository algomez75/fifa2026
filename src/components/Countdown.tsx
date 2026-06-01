import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { countdownTo, type CountdownParts } from '@/lib/format';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

interface Props {
  /** ISO kickoff target. */
  target: string;
  onComplete?: () => void;
  compact?: boolean;
}

/** Live ticking countdown rendered as D · H · M · S boxes. */
export function Countdown({ target, onComplete, compact }: Props) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(target));

  useEffect(() => {
    const id = setInterval(() => {
      const next = countdownTo(target);
      setParts(next);
      if (next.total <= 0) {
        clearInterval(id);
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onComplete]);

  const units: { value: number; label: string }[] = [
    { value: parts.days, label: t.countdown.days },
    { value: parts.hours, label: t.countdown.hours },
    { value: parts.minutes, label: t.countdown.mins },
    { value: parts.seconds, label: t.countdown.secs },
  ];

  return (
    <View style={styles.row}>
      {units.map((u, i) => (
        <View key={u.label} style={styles.unitWrap}>
          <View style={[styles.box, compact && styles.boxCompact]}>
            <Text style={[styles.value, compact && styles.valueCompact]}>
              {String(u.value).padStart(2, '0')}
            </Text>
          </View>
          <Text style={styles.label}>{u.label}</Text>
          {i < units.length - 1 && !compact ? (
            <Text style={styles.colon}>:</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  unitWrap: { alignItems: 'center', position: 'relative' },
  box: {
    backgroundColor: palette.card,
    borderColor: palette.border2,
    borderWidth: 1,
    borderRadius: radius.md,
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  boxCompact: { minWidth: 40, paddingVertical: 6 },
  value: {
    color: palette.gold,
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  valueCompact: { fontSize: 20 },
  label: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  colon: {
    position: 'absolute',
    right: -8,
    top: 12,
    color: palette.textTertiary,
    fontSize: 22,
    fontWeight: '800',
  },
});
