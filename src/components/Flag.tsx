import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

/**
 * Country flag image with persistent **disk caching** (expo-image). A pixel-exact
 * drop-in for `react-native-country-flag` — same flagcdn URL and
 * `width: size*1.6, height: size` — but cached on disk, so the ~48 team flags
 * (rendered in every MatchCard, the Teams grid, the favorites rail, host chips)
 * don't re-download from flagcdn on every cold start and survive memory pressure.
 *
 * England/Scotland carry the flagcdn **subdivision** codes (`gb-eng` / `gb-sct`)
 * in `iso2`, so they render their own flag rather than the Union Jack.
 */
export function Flag({
  isoCode,
  size,
  style,
}: {
  isoCode: string;
  size: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={`https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`}
      style={[{ width: size * 1.6, height: size }, style]}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={0}
    />
  );
}
