import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { getLegal, legal, type LegalKind } from '@/lib/legal';
import { palette } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** Renders a legal document (privacy or terms) in the current language. */
export function LegalView({ kind }: { kind: LegalKind }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();

  const sections = getLegal(kind, language);
  const title =
    kind === 'terms'
      ? language === 'es' ? 'Términos de Servicio' : 'Terms of Service'
      : language === 'es' ? 'Política de Privacidad' : 'Privacy Policy';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={palette.text} size={22} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>
          {legal.meta.appName} · {legal.meta.entity} · {legal.meta.updated}
        </Text>
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: palette.text, fontSize: 20, fontWeight: '900', flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  updated: { color: palette.textTertiary, fontSize: 12, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { color: palette.gold, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  sectionBody: { color: palette.textSecondary, fontSize: 14, lineHeight: 21 },
});
