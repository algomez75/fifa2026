import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text } from 'react-native';

import { palette, radius } from '@/lib/theme';
import { useAppStore } from '@/store/useAppStore';

/** Compact EN / ES language switch for screen headers. */
export function LangToggle() {
  const language = useAppStore((s) => s.language);
  const toggle = useAppStore((s) => s.toggleLanguage);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        toggle();
      }}
      style={styles.pill}
      hitSlop={8}>
      <Text style={[styles.code, language === 'en' && styles.active]}>EN</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={[styles.code, language === 'es' && styles.active]}>ES</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surface,
    borderColor: palette.border2,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  code: { color: palette.textTertiary, fontSize: 12, fontWeight: '800' },
  active: { color: palette.gold },
  sep: { color: palette.textTertiary, fontSize: 12 },
});
