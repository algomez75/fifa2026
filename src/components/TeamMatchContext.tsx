import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Match, Prediction, Team } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { seedTeams } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { GlassCard } from './GlassCard';
import { GroupTable } from './GroupTable';
import { MatchCard } from './MatchCard';
import { TeamFlag } from './TeamFlag';

interface Props {
  home?: Team;
  away?: Team;
  /** Full match list (from useMatches) — filtered per team inside. */
  matches: Match[];
  /** The match being viewed — excluded from each team's "previous" list. */
  currentMatchId: string;
  predictions?: Record<string, Prediction>;
  onPressMatch?: (m: Match) => void;
}

/**
 * Apple-Sports-style context block shown below the lineups on the match detail
 * screen: two tabs (one per team) revealing that team's previous results and its
 * current group standing. Reuses `MatchCard` + `GroupTable` so styling stays in
 * sync with the rest of the app. Always rendered (incl. live), so the context
 * persists through every match state.
 */
export function TeamMatchContext({
  home,
  away,
  matches,
  currentMatchId,
  predictions,
  onPressMatch,
}: Props) {
  const { t, language } = useTranslation();
  const [tab, setTab] = useState<'home' | 'away'>('home');

  const active = tab === 'home' ? home : away;

  // Finished matches involving the active team, newest first, minus this one.
  const previous = useMemo(() => {
    if (!active) return [];
    return matches
      .filter(
        (m) =>
          m.id !== currentMatchId &&
          m.status === 'finished' &&
          (m.home_team_id === active.id || m.away_team_id === active.id),
      )
      .sort(
        (a, b) =>
          new Date(b.kickoff_utc).getTime() - new Date(a.kickoff_utc).getTime(),
      );
  }, [active, matches, currentMatchId]);

  // Group context for the active team (group stage only).
  const group = useMemo(() => {
    const letter = active?.group_letter;
    if (!letter) return null;
    return {
      letter,
      teamIds: seedTeams
        .filter((x) => x.group_letter === letter)
        .map((x) => x.id),
      matches: matches.filter(
        (m) => m.stage === 'group' && m.group_letter === letter,
      ),
    };
  }, [active, matches]);

  if (!home && !away) return null;

  return (
    <View>
      {/* Team tabs — same visual language as the formation selector */}
      <View style={styles.tabs}>
        <TeamTab
          team={home}
          label={teamName(home, language)}
          active={tab === 'home'}
          onPress={() => setTab('home')}
        />
        <TeamTab
          team={away}
          label={teamName(away, language)}
          active={tab === 'away'}
          onPress={() => setTab('away')}
        />
      </View>

      {/* Previous matches */}
      <Text style={styles.subTitle}>{t.matchContext.previousMatches}</Text>
      {previous.length ? (
        <View style={{ gap: 10 }}>
          {previous.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              prediction={predictions?.[m.id] ?? null}
              onPress={onPressMatch}
            />
          ))}
        </View>
      ) : (
        <GlassCard>
          <Text style={styles.note}>{t.matchContext.noPrevious}</Text>
        </GlassCard>
      )}

      {/* Group standing */}
      {group ? (
        <>
          <Text style={styles.subTitle}>{t.matchContext.standing}</Text>
          <GroupTable
            groupLetter={group.letter}
            teamIds={group.teamIds}
            matches={group.matches}
          />
        </>
      ) : null}
    </View>
  );
}

function TeamTab({
  team,
  label,
  active,
  onPress,
}: {
  team?: Team;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabOn]}>
      <TeamFlag team={team} size={18} showName={false} />
      <Text
        style={[styles.tabText, active && styles.tabTextOn]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabOn: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  tabText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  tabTextOn: { color: palette.gold },
  subTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 10,
  },
  note: {
    color: palette.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 4,
  },
});
