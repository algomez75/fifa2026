import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { getRules, type PhaseItem, type ScoreTier } from '@/lib/rules';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** In-app "How to play" guide: prediction scoring + the full tournament format,
 *  in the current language. Reached from Profile → About. */
export default function HowToPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const r = getRules(language);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={palette.text} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{r.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{r.eyebrow}</Text>
        <Text style={styles.lead}>{r.intro}</Text>

        {/* Making a prediction */}
        <Text style={styles.sectionTitle}>{r.predictTitle}</Text>
        <Text style={styles.paragraph}>{r.predictBody}</Text>

        {/* Scoring */}
        <Text style={styles.sectionTitle}>{r.scoringTitle}</Text>
        <Text style={styles.paragraph}>{r.scoringIntro}</Text>
        <View style={styles.tiers}>
          {r.tiers.map((tier) => (
            <TierRow key={tier.points} tier={tier} />
          ))}
        </View>
        {r.scoringNotes.map((note, i) => (
          <View key={i} style={styles.noteRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.note}>{note}</Text>
          </View>
        ))}

        {/* Tournament format */}
        <Text style={styles.sectionTitle}>{r.phasesTitle}</Text>
        <Text style={styles.paragraph}>{r.phasesIntro}</Text>
        <View style={styles.phases}>
          {r.phases.map((phase, i) => (
            <PhaseRow key={phase.label} phase={phase} last={i === r.phases.length - 1} />
          ))}
        </View>
        <View style={styles.callout}>
          <Text style={styles.calloutText}>{r.knockoutNote}</Text>
        </View>

        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>{r.leaderboardTitle}</Text>
        <Text style={styles.paragraph}>{r.leaderboardBody}</Text>

        {/* Challenges */}
        <Text style={styles.sectionTitle}>⚔️ {r.challengeTitle}</Text>
        <Text style={styles.paragraph}>{r.challengeBody}</Text>

        {/* Fair play */}
        <Text style={styles.sectionTitle}>{r.fairTitle}</Text>
        <Text style={styles.paragraph}>{r.fairBody}</Text>
      </ScrollView>
    </View>
  );
}

function TierRow({ tier }: { tier: ScoreTier }) {
  const top = tier.points === '+3';
  const mid = tier.points === '+1';
  return (
    <View style={styles.tier}>
      <View
        style={[
          styles.pill,
          top && styles.pillTop,
          mid && styles.pillMid,
          !top && !mid && styles.pillZero,
        ]}>
        <Text
          style={[
            styles.pillText,
            top && styles.pillTextTop,
            !top && styles.pillTextDim,
          ]}>
          {tier.points}
        </Text>
      </View>
      <View style={styles.tierBody}>
        <Text style={styles.tierTitle}>{tier.title}</Text>
        <Text style={styles.tierDesc}>{tier.desc}</Text>
      </View>
    </View>
  );
}

function PhaseRow({ phase, last }: { phase: PhaseItem; last: boolean }) {
  return (
    <View style={[styles.phase, !last && styles.phaseBorder]}>
      <View style={styles.phaseHead}>
        <Text style={styles.phaseLabel}>{phase.label}</Text>
        <Text style={styles.phaseMeta}>{phase.meta}</Text>
      </View>
      <Text style={styles.phaseDesc}>{phase.desc}</Text>
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
  headerTitle: { color: palette.text, fontSize: 20, fontWeight: '900', flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 60 },

  eyebrow: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  lead: { color: palette.text, fontSize: 16, lineHeight: 23, fontWeight: '600' },

  sectionTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 26,
    marginBottom: 8,
  },
  paragraph: { color: palette.textSecondary, fontSize: 14.5, lineHeight: 22 },

  // Scoring tiers
  tiers: { gap: 10, marginTop: 14 },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
  },
  pill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTop: { backgroundColor: palette.gold },
  pillMid: { backgroundColor: palette.goldDim, borderWidth: 1, borderColor: palette.gold },
  pillZero: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border2 },
  pillText: { fontSize: 18, fontWeight: '900' },
  pillTextTop: { color: palette.bg },
  pillTextDim: { color: palette.gold },
  tierBody: { flex: 1, gap: 3 },
  tierTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  tierDesc: { color: palette.textSecondary, fontSize: 13.5, lineHeight: 19 },

  // Scoring notes
  noteRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingRight: 4 },
  bullet: { color: palette.gold, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  note: { color: palette.textSecondary, fontSize: 13.5, lineHeight: 20, flex: 1 },

  // Phases
  phases: {
    marginTop: 14,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
  },
  phase: { paddingVertical: 13 },
  phaseBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  phaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 3,
  },
  phaseLabel: { color: palette.gold, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  phaseMeta: {
    color: palette.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  phaseDesc: { color: palette.textSecondary, fontSize: 13.5, lineHeight: 19 },

  callout: {
    marginTop: 14,
    backgroundColor: palette.cardElevated,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.gold,
    padding: 14,
  },
  calloutText: { color: palette.text, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
});
