import { BlurView } from 'expo-blur';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { GlassCard } from '@/components/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderActions } from '@/components/HeaderActions';
import type { HistoricalEdition } from '@/lib/database.types';
import { seedHistory } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<HistoricalEdition | null>(null);

  const editions = useMemo(
    () => [...seedHistory.editions].sort((a, b) => b.year - a.year),
    [],
  );

  const titles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of seedHistory.editions) {
      if (e.champion) counts.set(e.champion, (counts.get(e.champion) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const topMatches = useMemo(
    () =>
      [...seedHistory.matches]
        .sort(
          (a, b) =>
            (b.home_score ?? 0) + (b.away_score ?? 0) -
            ((a.home_score ?? 0) + (a.away_score ?? 0)),
        )
        .slice(0, 8),
    [],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.history.eyebrow}
        title={t.history.title}
        right={<HeaderActions />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {/* Most titles chart */}
        <Text style={styles.sectionTitle}>{t.history.mostTitles}</Text>
        <GlassCard style={{ marginBottom: 20 }}>
          <TitlesChart data={titles.slice(0, 8)} />
        </GlassCard>

        {/* Editions */}
        <Text style={styles.sectionTitle}>{t.history.results}</Text>
        <View style={{ gap: 10, marginBottom: 20 }}>
          {editions.map((e) => (
            <Pressable key={e.year} onPress={() => setSelected(e)}>
              <View style={styles.editionCard}>
                <View style={styles.editionYear}>
                  <Text style={styles.yearText}>{e.year}</Text>
                  <Text style={styles.hostText} numberOfLines={1}>
                    {e.host}
                  </Text>
                </View>
                <View style={styles.editionBody}>
                  <Text style={styles.champLabel}>🏆 {t.history.champion}</Text>
                  <Text style={styles.champName}>{e.champion}</Text>
                  <Text style={styles.runnerUp}>
                    {t.history.runnerUp}: {e.runner_up} · {e.final_score}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Highest scoring */}
        <Text style={styles.sectionTitle}>{t.history.highestScoring}</Text>
        <GlassCard>
          {topMatches.map((m, i) => (
            <View
              key={`${m.year}-${i}`}
              style={[styles.scoreRow, i > 0 && styles.scoreRowBorder]}>
              <Text style={styles.scoreYear}>{m.year}</Text>
              <Text style={styles.scoreTeams} numberOfLines={1}>
                {m.home_team} {m.home_score}–{m.away_score} {m.away_team}
              </Text>
              <Text style={styles.scoreTotal}>
                {(m.home_score ?? 0) + (m.away_score ?? 0)}
              </Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>

      <EditionModal
        edition={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function TitlesChart({ data }: { data: { country: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const rowH = 26;
  const labelW = 110;
  const chartW = 150;
  const height = data.length * rowH;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${labelW + chartW + 24} ${height}`}>
      {data.map((d, i) => {
        const y = i * rowH;
        const barW = (d.count / max) * chartW;
        return (
          <Rect
            key={`bar-${d.country}`}
            x={labelW}
            y={y + 4}
            width={barW}
            height={rowH - 12}
            rx={4}
            fill={palette.gold}
            opacity={0.55 + 0.45 * (d.count / max)}
          />
        );
      })}
      {data.map((d, i) => {
        const y = i * rowH;
        const barW = (d.count / max) * chartW;
        return (
          <SvgText
            key={`lbl-${d.country}`}
            x={0}
            y={y + rowH / 2 + 1}
            fill={palette.text}
            fontSize={12}
            fontWeight="600">
            {d.country}
          </SvgText>
        );
      })}
      {data.map((d, i) => {
        const y = i * rowH;
        const barW = (d.count / max) * chartW;
        return (
          <SvgText
            key={`val-${d.country}`}
            x={labelW + barW + 6}
            y={y + rowH / 2 + 1}
            fill={palette.gold}
            fontSize={12}
            fontWeight="800">
            {d.count}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function EditionModal({
  edition,
  onClose,
}: {
  edition: HistoricalEdition | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!edition) return null;
  const matches = seedHistory.matches.filter((m) => m.year === edition.year);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.modalYear}>{edition.year}</Text>
          <Text style={styles.modalHost}>
            {t.history.host}: {edition.host}
          </Text>

          <View style={styles.statsGrid}>
            <Stat label="🏆" value={edition.champion ?? '—'} />
            <Stat label="🥈" value={edition.runner_up ?? '—'} />
            <Stat label="🥉" value={edition.third_place ?? '—'} />
            <Stat label="⚽" value={`${edition.total_goals} ${t.history.goals}`} />
            <Stat label="👥" value={`${edition.total_teams} ${t.history.teams}`} />
            <Stat label="🥇" value={edition.top_scorer ?? '—'} />
          </View>

          {matches.length ? (
            <>
              <Text style={styles.modalSection}>{t.history.results}</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {matches.map((m, i) => (
                  <Text key={i} style={styles.modalMatch}>
                    {m.stage}: {m.home_team} {m.home_score}–{m.away_score}{' '}
                    {m.away_team}
                  </Text>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>{t.common.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 4,
  },
  editionCard: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  editionYear: {
    width: 92,
    backgroundColor: palette.surface,
    padding: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: palette.border,
  },
  yearText: { color: palette.gold, fontSize: 22, fontWeight: '900' },
  hostText: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  editionBody: { flex: 1, padding: 14, justifyContent: 'center' },
  champLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  champName: { color: palette.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  runnerUp: { color: palette.textSecondary, fontSize: 12, marginTop: 4 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  scoreRowBorder: { borderTopWidth: 1, borderTopColor: palette.border },
  scoreYear: { color: palette.gold, fontSize: 12, fontWeight: '800', width: 38 },
  scoreTeams: { color: palette.text, fontSize: 13, fontWeight: '600', flex: 1 },
  scoreTotal: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: '900',
    width: 24,
    textAlign: 'right',
  },
  // modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border2,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border2,
    marginBottom: 8,
  },
  modalYear: { color: palette.gold, fontSize: 32, fontWeight: '900' },
  modalHost: { color: palette.textSecondary, fontSize: 14, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    width: '31%',
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 10,
    gap: 2,
  },
  statLabel: { fontSize: 16 },
  statValue: { color: palette.text, fontSize: 12, fontWeight: '700' },
  modalSection: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  modalMatch: { color: palette.textSecondary, fontSize: 13, paddingVertical: 3 },
  close: { alignItems: 'center', paddingVertical: 10, marginTop: 8 },
  closeText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});
