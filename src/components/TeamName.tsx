import { useState } from 'react';
import { type StyleProp, Text, type TextStyle } from 'react-native';

import type { Team } from '@/lib/database.types';
import type { Language } from '@/lib/i18n';
import { teamAbbr, teamName } from '@/lib/format';

interface Props {
  team?: Team;
  language: Language;
  style?: StyleProp<TextStyle>;
  /** Shown when there's no team (e.g. an undecided knockout slot). */
  fallback?: string;
}

/**
 * Renders a team's name on a single line. If it would overflow its container,
 * it shows the FIFA-style 3-letter uppercase code (USA, BIH, KOR) instead of
 * truncating with an ellipsis. Modular — use anywhere a team name might clip.
 */
export function TeamName({ team, language, style, fallback }: Props) {
  const full = team ? teamName(team, language) : (fallback ?? 'TBD');
  const abbr = team ? teamAbbr(team) : (fallback ?? 'TBD');
  const [clip, setClip] = useState(false);

  return (
    <Text
      style={style}
      numberOfLines={1}
      ellipsizeMode="clip"
      onTextLayout={(e) => {
        const shown = e.nativeEvent.lines
          .map((l) => l.text)
          .join('')
          .trimEnd();
        const next = shown.length < full.length;
        if (next !== clip) setClip(next);
      }}>
      {clip ? abbr : full}
    </Text>
  );
}
