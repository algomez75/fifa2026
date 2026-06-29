import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown,
  scrollTo,
  useAnimatedRef,
  useScrollOffset,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import type { Match } from '@/lib/database.types';
import { resolveBracket } from '@/lib/qualification';
import { palette, stageMeta } from '@/lib/theme';
import { useBracketQualifiers } from '@/hooks/useBracketQualifiers';
import { useTranslation } from '@/store/useAppStore';

import { BracketCell } from './bracket/BracketCell';
import { BracketConnectors } from './bracket/BracketConnectors';
import { BracketGroupsColumn } from './bracket/BracketGroupsColumn';
import { BracketNavigator } from './bracket/BracketNavigator';
import { CELL_H, COL, COL_GAP, H_PAD, NUM_COLS, V_PAD, bracketLayout } from './bracket/layout';

interface Props {
  matches: Match[];
}

/**
 * Apple-Sports-style knockout bracket: a 2D-scrollable tree. Each match sits
 * vertically centered between the two matches that feed it (real WC26 feeding
 * graph), with connector lines; finished feeders advance their winner into the
 * next slot in real time. Horizontally it snaps one stage at a time (past rounds
 * slide off left, upcoming rounds reveal right) with a synced GS→F navigator;
 * vertically it pans (the GS column holds all 12 group tables).
 */
export function BracketTree({ matches }: Props) {
  const { t, language } = useTranslation();
  const { width: screenW } = useWindowDimensions();

  const COL_W = Math.round((screenW - H_PAD * 2) / 2); // exactly 2 stages fit
  const cellW = COL_W - COL_GAP;
  const canvasW = NUM_COLS * COL_W;

  const qualifiers = useBracketQualifiers(matches);
  const resolved = useMemo(() => resolveBracket(matches, qualifiers), [matches, qualifiers]);
  const { cells, knockoutHeight } = useMemo(() => bracketLayout(), []);
  const byId = useMemo(() => {
    const m = new Map<string, Match>();
    for (const x of matches) m.set(x.id, x);
    return m;
  }, [matches]);

  // GS column height drives the canvas (it's taller than the knockout columns).
  const [groupsH, setGroupsH] = useState(2100);
  const canvasH = Math.max(knockoutHeight, groupsH) + V_PAD * 2;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useScrollOffset(scrollRef);

  const jumpTo = useCallback(
    (i: number) => {
      const x = Math.min(i, NUM_COLS - 2) * COL_W; // clamp so SF+F is the last page
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, x, 0, true);
      });
    },
    [COL_W, scrollRef],
  );

  const finalPos = cells.get('FINAL-1');
  const thirdMatch = byId.get('3RD-1');
  const thirdResolved = resolved.get('3RD-1');

  return (
    <View style={{ flex: 1 }}>
      <BracketNavigator scrollX={scrollX} colW={COL_W} onJump={jumpTo} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COL_W}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          scrollEventThrottle={16}
          style={{ height: canvasH }}
          contentContainerStyle={{ width: canvasW + H_PAD * 2, paddingHorizontal: H_PAD }}>
          <View style={{ width: canvasW, height: canvasH }}>
            {/* connectors behind the cells */}
            <BracketConnectors cells={cells} colW={COL_W} cellW={cellW} vPad={V_PAD} />

            {/* col 0 — group standings (vertically scrollable) */}
            <View
              style={{ position: 'absolute', left: 0, top: V_PAD, width: COL_W }}
              onLayout={(e) => setGroupsH(e.nativeEvent.layout.height)}>
              <BracketGroupsColumn matches={matches} width={cellW} />
            </View>

            {/* knockout cells, positioned by the tree layout */}
            {[...cells.entries()].map(([id, pos]) => {
              const m = byId.get(id);
              const r = resolved.get(id);
              if (!m || !r) return null;
              return (
                <Animated.View
                  key={id}
                  entering={FadeInDown.duration(260)}
                  style={{
                    position: 'absolute',
                    left: pos.col * COL_W,
                    top: pos.cy - CELL_H / 2 + V_PAD,
                    width: cellW,
                  }}>
                  <BracketCell
                    match={m}
                    resolved={r}
                    language={language}
                    t={t}
                    width={cellW}
                    isFinal={id === 'FINAL-1'}
                  />
                </Animated.View>
              );
            })}

            {/* third-place box, below the Final */}
            {thirdMatch && thirdResolved && finalPos ? (
              <View
                style={{
                  position: 'absolute',
                  left: COL.final * COL_W,
                  top: finalPos.cy + CELL_H / 2 + 44 + V_PAD,
                  width: cellW,
                }}>
                <Text style={styles.thirdTitle}>
                  {language === 'es' ? stageMeta.third.labelEs : stageMeta.third.label}
                </Text>
                <BracketCell
                  match={thirdMatch}
                  resolved={thirdResolved}
                  language={language}
                  t={t}
                  width={cellW}
                />
              </View>
            ) : null}
          </View>
        </Animated.ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  thirdTitle: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
});
