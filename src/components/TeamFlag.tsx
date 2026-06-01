import CountryFlag from 'react-native-country-flag';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { Team } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

interface Props {
  team?: Team;
  size?: number;
  showName?: boolean;
  nameStyle?: object;
  reverse?: boolean; // flag after name (for away side, right-aligned)
  style?: ViewStyle;
}

/** Country flag (image) + optional localized team name. */
export function TeamFlag({
  team,
  size = 28,
  showName = true,
  nameStyle,
  reverse = false,
  style,
}: Props) {
  const { language } = useTranslation();
  const iso = team?.iso2;
  const flagHeight = Math.round(size * 0.72);

  const flag = iso ? (
    <View style={[styles.flagWrap, { borderRadius: 4 }]}>
      <CountryFlag isoCode={iso} size={size} />
    </View>
  ) : (
    <View
      style={[
        styles.placeholder,
        { width: size, height: flagHeight },
      ]}>
      <Text style={{ fontSize: size * 0.5 }}>{team?.flag_emoji ?? '🏳️'}</Text>
    </View>
  );

  return (
    <View style={[styles.row, reverse && styles.reverse, style]}>
      {flag}
      {showName ? (
        <Text
          numberOfLines={1}
          style={[styles.name, nameStyle]}>
          {teamName(team, language)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  reverse: { flexDirection: 'row-reverse' },
  flagWrap: { overflow: 'hidden', borderRadius: 4 },
  placeholder: {
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: palette.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
