import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/lib/theme';
import { UserIcon } from './icons';

interface Props {
  url?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}

/** Circular avatar: photo if present, else initial, else a user glyph. */
export function Avatar({ url, name, size = 38, ring = true }: Props) {
  const initial = name?.trim()?.[0]?.toUpperCase();
  const border = ring
    ? { borderWidth: 1.5, borderColor: palette.gold }
    : null;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.img, { width: size, height: size, borderRadius: size / 2 }, border]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
        border,
      ]}>
      {initial ? (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
      ) : (
        <UserIcon color={palette.text} size={size * 0.55} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: palette.surface },
  fallback: {
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: palette.gold, fontWeight: '900' },
});
