import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  scrollTo,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  CELL_H,
  COL,
  COL_GAP,
  H_PAD,
  NUM_COLS,
  SNAP_COUNT,
  THIRD_GAP,
  V_PAD,
  bracketAnchorLayouts,
  bracketLayout,
} from './bracket/layout';

interface Props {
  matches: Match[];
}

/** Vertical space the floating glass tab bar covers at the bottom of the canvas
 *  (bar ≈ 62 + 10 gap + safe-area inset added at runtime). */
const TAB_BAR_CLEARANCE = 88;

/**
 * Apple-Sports-style knockout bracket: a 2D-scrollable tree. Each match sits
 * vertically centered between the two matches that feed it (real WC26 feeding
 * graph), with connector lines; finished feeders advance their winner into the
 * next slot in real time. Horizontally it snaps one stage at a time (past rounds
 * slide off left, upcoming rounds reveal right) with a synced GS→F navigator.
 * As later rounds take the screen, the visible round regroups to FIT the
 * measured viewport height (cells morph with the scroll); a round that can't
 * fit (R32, R16 on small screens) keeps its compact pitch and vertical scroll.
 */
export function BracketTree({ matches }: Props) {
  const { t, language } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const COL_W = Math.round((screenW - H_PAD * 2) / 2); // exactly 2 stages fit
  const cellW = COL_W - COL_GAP;
  const canvasW = NUM_COLS * COL_W;

  const qualifiers = useBracketQualifiers(matches);
  const resolved = useMemo(() => resolveBracket(matches, qualifiers), [matches, qualifiers]);
  const { cells } = useMemo(() => bracketLayout(), []);
  const byId = useMemo(() => {
    const m = new Map<string, Match>();
    for (const x of matches) m.set(x.id, x);
    return m;
  }, [matches]);

  // GS column height drives the anchor-0 canvas (taller than the R32 column).
  const [groupsH, setGroupsH] = useState(2100);
  // Measured height of the vertical scroll window (the visible canvas area).
  const [viewH, setViewH] = useState(0);
  const windowH = viewH || screenH - 300; // pre-measure estimate, corrected on layout
  // Height a round must fit in to drop its vertical scroll: the visible window
  // minus the floating tab bar and the canvas padding.
  const fitH = Math.max(320, windowH - (insets.bottom + TAB_BAR_CLEARANCE) - V_PAD * 2);

  const { tracks, heights } = useMemo(
    () => bracketAnchorLayouts(fitH, groupsH),
    [fitH, groupsH],
  );
  // Snap offsets — the interpolation input range shared by every morphing piece.
  const xs = useMemo(
    () => Array.from({ length: SNAP_COUNT }, (_, i) => i * COL_W),
    [COL_W],
  );

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useScrollOffset(scrollRef);
  const vScrollRef = useAnimatedRef<Animated.ScrollView>();
  const vOffset = useScrollOffset(vScrollRef);

  // Canvas height follows the anchor the scroll is at/between, so vertical
  // scrollability shrinks away as rounds start fitting the screen.
  const heightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollX.value, xs, heights, Extrapolation.CLAMP),
  }));

  // As the canvas compresses (moving into later rounds), ride the vertical
  // offset up so the content never scrolls out of reach.
  useAnimatedReaction(
    () => interpolate(scrollX.value, xs, heights, Extrapolation.CLAMP),
    (h) => {
      const maxY = Math.max(0, h - windowH);
      if (vOffset.value > maxY) scrollTo(vScrollRef, 0, maxY, false);
    },
  );

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

  const finalTrack = tracks.get('FINAL-1');
  const thirdMatch = byId.get('3RD-1');
  const thirdResolved = resolved.get('3RD-1');

  return (
    <View style={{ flex: 1 }}>
      <BracketNavigator scrollX={scrollX} colW={COL_W} onJump={jumpTo} />
      <Animated.ScrollView
        ref={vScrollRef}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COL_W}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          scrollEventThrottle={16}
          style={heightStyle}
          contentContainerStyle={{ width: canvasW + H_PAD * 2, paddingHorizontal: H_PAD }}>
          <Animated.View style={[{ width: canvasW }, heightStyle]}>
            {/* connectors behind the cells */}
            <BracketConnectors
              cells={cells}
              tracks={tracks}
              xs={xs}
              scrollX={scrollX}
              colW={COL_W}
              cellW={cellW}
              vPad={V_PAD}
            />

            {/* col 0 — group standings (vertically scrollable) */}
            <View
              style={{ position: 'absolute', left: 0, top: V_PAD, width: COL_W }}
              onLayout={(e) => setGroupsH(e.nativeEvent.layout.height)}>
              <BracketGroupsColumn matches={matches} width={cellW} />
            </View>

            {/* knockout cells — morph between the per-anchor layouts */}
            {[...cells.entries()].map(([id, pos]) => {
              const m = byId.get(id);
              const r = resolved.get(id);
              const track = tracks.get(id);
              if (!m || !r || !track) return null;
              return (
                <MorphingBox
                  key={id}
                  left={pos.col * COL_W}
                  width={cellW}
                  tops={track.map((cy) => cy - CELL_H / 2 + V_PAD)}
                  xs={xs}
                  scrollX={scrollX}>
                  <BracketCell
                    match={m}
                    resolved={r}
                    language={language}
                    t={t}
                    width={cellW}
                    isFinal={id === 'FINAL-1'}
                  />
                </MorphingBox>
              );
            })}

            {/* third-place box, below the Final */}
            {thirdMatch && thirdResolved && finalTrack ? (
              <MorphingBox
                left={COL.final * COL_W}
                width={cellW}
                tops={finalTrack.map((cy) => cy + CELL_H / 2 + THIRD_GAP + V_PAD)}
                xs={xs}
                scrollX={scrollX}>
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
              </MorphingBox>
            ) : null}
          </Animated.View>
        </Animated.ScrollView>
      </Animated.ScrollView>
    </View>
  );
}

/** Absolutely-positioned box whose vertical position interpolates between the
 *  per-anchor layouts with the horizontal scroll. */
function MorphingBox({
  left,
  width,
  tops,
  xs,
  scrollX,
  children,
}: {
  left: number;
  width: number;
  tops: number[];
  xs: number[];
  scrollX: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollX.value, xs, tops, Extrapolation.CLAMP) },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left, width }, style]}>
      {/* entering animation on an inner wrapper so it composes with the morph */}
      <Animated.View entering={FadeInDown.duration(260)}>{children}</Animated.View>
    </Animated.View>
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
