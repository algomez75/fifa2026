import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BracketTree } from '@/components/BracketTree';
import { GroupTable } from '@/components/GroupTable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LangToggle } from '@/components/LangToggle';
import { ErrorState, LoadingState } from '@/components/States';
import { groupLetters, seedTeams } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { type GroupsView, useAppStore, useTranslation } from '@/store/useAppStore';

export default function GroupsScreen() {
  const { t } = useTranslation();
  const { data: matches, isLoading, isError, refetch } = useMatches();
  const view = useAppStore((s) => s.groupsView);
  const setView = useAppStore((s) => s.setGroupsView);

  const teamsByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const team of seedTeams) {
      if (!team.group_letter) continue;
      (map[team.group_letter] ??= []).push(team.id);
    }
    return map;
  }, []);

  const groupMatches = useMemo(
    () => (matches ?? []).filter((m) => m.stage === 'group'),
    [matches],
  );

  const select = (v: GroupsView) => {
    Haptics.selectionAsync();
    setView(v);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.groups.eyebrow}
        title={t.groups.title}
        right={<LangToggle />}
      />

      <View style={styles.segment}>
        <SegmentBtn
          label={t.groups.groupView}
          active={view === 'groups'}
          onPress={() => select('groups')}
        />
        <SegmentBtn
          label={t.groups.bracketView}
          active={view === 'bracket'}
          onPress={() => select('bracket')}
        />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : view === 'groups' ? (
        <Animated.View key="groups" entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}>
            {groupLetters.map((letter) => (
              <View key={letter} style={{ marginBottom: 16 }}>
                <GroupTable
                  groupLetter={letter}
                  teamIds={teamsByGroup[letter] ?? []}
                  matches={groupMatches.filter((m) => m.group_letter === letter)}
                />
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View key="bracket" entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bracketScroll}>
            <BracketTree matches={matches ?? []} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

function SegmentBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segBtn, active && styles.segBtnActive]}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  segBtnActive: { backgroundColor: palette.goldDim },
  segText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
  segTextActive: { color: palette.gold },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  bracketScroll: { paddingBottom: 140 },
});
