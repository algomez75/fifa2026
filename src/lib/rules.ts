import type { Language } from './i18n';

/** One scoring tier shown as a points pill + explanation. */
export interface ScoreTier {
  points: string;
  title: string;
  desc: string;
}

/** One tournament phase row (label + a short meta badge + description). */
export interface PhaseItem {
  label: string;
  meta: string;
  desc: string;
}

/** The full bilingual "How to play" content. Kept here (not in the locale
 *  dictionaries) so the rich, structured rules live in one cohesive place —
 *  same approach as `lib/legal.ts`. */
export interface RulesContent {
  eyebrow: string;
  title: string;
  intro: string;

  predictTitle: string;
  predictBody: string;

  scoringTitle: string;
  scoringIntro: string;
  tiers: ScoreTier[];
  scoringNotes: string[];

  phasesTitle: string;
  phasesIntro: string;
  phases: PhaseItem[];
  knockoutNote: string;

  leaderboardTitle: string;
  leaderboardBody: string;

  challengeTitle: string;
  challengeBody: string;

  fairTitle: string;
  fairBody: string;
}

const en: RulesContent = {
  eyebrow: 'Predictions · scoring · format',
  title: 'How to play',
  intro:
    'Predict the score of every match, earn points for how close you get, and climb the global ranking. Here is exactly how it works.',

  predictTitle: 'Making a prediction',
  predictBody:
    "Open any upcoming match — from the Schedule, Home, or a team's page — and tap to enter the score you think it will finish. That is your prediction for that match. Predict as many matches as you like; each one is independent.",

  scoringTitle: 'How points work',
  scoringIntro: 'Every match you predict is graded the same way:',
  tiers: [
    {
      points: '+3',
      title: 'Exact score',
      desc: 'You nailed the final scoreline — e.g. you said 2–1 and it finished 2–1.',
    },
    {
      points: '+1',
      title: 'Right result',
      desc: 'You got the winner (or a draw) right but not the exact score — e.g. you said 2–0 and it finished 3–1.',
    },
    {
      points: '0',
      title: 'Miss',
      desc: 'Wrong outcome — the result went the other way.',
    },
  ],
  scoringNotes: [
    'Predictions lock at kickoff. Change a pick any time before the match starts — never after.',
    'Group stage and knockout matches all score the same 3 / 1 / 0 way.',
    'In a knockout match your prediction is graded on the full-time score, including extra time if it is played. A penalty shootout does not change your prediction points.',
  ],

  phasesTitle: 'The tournament format',
  phasesIntro:
    'The 2026 World Cup has 48 teams and 104 matches: a group stage, then single-elimination knockout rounds all the way to the final.',
  phases: [
    {
      label: 'Group stage',
      meta: '72 matches · 12 groups of 4',
      desc: 'Each team plays 3 matches (win = 3 pts, draw = 1, loss = 0). The top 2 of every group plus the 8 best third-placed teams — 32 in all — advance to the knockouts.',
    },
    {
      label: 'Round of 32',
      meta: '16 matches',
      desc: 'The knockouts begin. From here it is win or go home.',
    },
    {
      label: 'Round of 16',
      meta: '8 matches',
      desc: 'The 16 winners pair off; 8 survive.',
    },
    {
      label: 'Quarter-finals',
      meta: '4 matches',
      desc: 'The last 8 fight for a place in the semis.',
    },
    {
      label: 'Semi-finals',
      meta: '2 matches',
      desc: 'The final four. Winners reach the final.',
    },
    {
      label: 'Third-place play-off',
      meta: '1 match',
      desc: 'The two losing semi-finalists play for the bronze.',
    },
    {
      label: 'Final',
      meta: '1 match',
      desc: 'The two surviving teams play for the title.',
    },
  ],
  knockoutNote:
    'From the Round of 32 on it is single elimination: if a match is level after 90 minutes it goes to 30 minutes of extra time, and then a penalty shootout if still tied.',

  leaderboardTitle: 'The leaderboard',
  leaderboardBody:
    'Your rank is the sum of all your prediction points plus any points won in 1v1 challenges. The number of exact scores breaks ties. Everyone competes in one global ranking — share yours from the Ranking tab.',

  challengeTitle: '1v1 challenges',
  challengeBody:
    'Challenge another player on any upcoming match: you each pick a winner (home, away, or draw) and a goal margin. When the match ends, the pick closest to the real result wins +3; if both are equally close it is a tie and each gets +1. A wrong winner always loses to a correct one. Challenges also lock at kickoff, and the points count toward your leaderboard total. Start one from a player’s profile in the Ranking.',

  fairTitle: 'Fair play',
  fairBody:
    'Another player’s pick for a match that has not kicked off yet stays hidden, so nobody can copy it. You always see your own.',
};

const es: RulesContent = {
  eyebrow: 'Predicciones · puntaje · formato',
  title: 'Cómo jugar',
  intro:
    'Predice el marcador de cada partido, gana puntos según qué tan cerca quedes y sube en el ranking global. Así funciona exactamente.',

  predictTitle: 'Cómo predecir',
  predictBody:
    'Abre cualquier partido próximo — desde el Calendario, Inicio o la página de un equipo — y toca para ingresar el marcador con el que crees que terminará. Ese es tu pronóstico para ese partido. Predice todos los partidos que quieras; cada uno es independiente.',

  scoringTitle: 'Cómo se puntúa',
  scoringIntro: 'Cada partido que predices se evalúa de la misma forma:',
  tiers: [
    {
      points: '+3',
      title: 'Marcador exacto',
      desc: 'Acertaste el marcador final exacto — p. ej. dijiste 2–1 y terminó 2–1.',
    },
    {
      points: '+1',
      title: 'Resultado correcto',
      desc: 'Acertaste el ganador (o el empate) pero no el marcador exacto — p. ej. dijiste 2–0 y terminó 3–1.',
    },
    {
      points: '0',
      title: 'Fallo',
      desc: 'Resultado equivocado — el partido se fue para el otro lado.',
    },
  ],
  scoringNotes: [
    'Las predicciones se cierran al iniciar el partido. Cambia tu pronóstico cuando quieras antes del inicio — nunca después.',
    'La fase de grupos y las eliminatorias puntúan igual: 3 / 1 / 0.',
    'En un partido de eliminatoria tu predicción se evalúa con el marcador del tiempo reglamentario, incluida la prórroga si se juega. La tanda de penales no cambia tus puntos de predicción.',
  ],

  phasesTitle: 'El formato del torneo',
  phasesIntro:
    'El Mundial 2026 tiene 48 equipos y 104 partidos: una fase de grupos y luego eliminación directa hasta la final.',
  phases: [
    {
      label: 'Fase de grupos',
      meta: '72 partidos · 12 grupos de 4',
      desc: 'Cada equipo juega 3 partidos (victoria = 3 pts, empate = 1, derrota = 0). Los 2 primeros de cada grupo más los 8 mejores terceros — 32 en total — avanzan a las eliminatorias.',
    },
    {
      label: 'Dieciseisavos de final',
      meta: '16 partidos',
      desc: 'Empiezan las eliminatorias. A partir de aquí, ganas o quedas fuera.',
    },
    {
      label: 'Octavos de final',
      meta: '8 partidos',
      desc: 'Los 16 ganadores se emparejan; sobreviven 8.',
    },
    {
      label: 'Cuartos de final',
      meta: '4 partidos',
      desc: 'Los últimos 8 pelean por un lugar en semifinales.',
    },
    {
      label: 'Semifinales',
      meta: '2 partidos',
      desc: 'Los cuatro mejores. Los ganadores llegan a la final.',
    },
    {
      label: 'Tercer puesto',
      meta: '1 partido',
      desc: 'Los dos semifinalistas perdedores juegan por el bronce.',
    },
    {
      label: 'Final',
      meta: '1 partido',
      desc: 'Los dos equipos que sobreviven juegan por el título.',
    },
  ],
  knockoutNote:
    'Desde los dieciseisavos es eliminación directa: si un partido está empatado tras los 90 minutos se juega una prórroga de 30 minutos, y luego una tanda de penales si sigue igualado.',

  leaderboardTitle: 'El ranking',
  leaderboardBody:
    'Tu posición es la suma de todos tus puntos de predicción más los puntos ganados en retos 1v1. El número de marcadores exactos desempata. Todos compiten en un único ranking global — comparte el tuyo desde la pestaña Ranking.',

  challengeTitle: 'Retos 1v1',
  challengeBody:
    'Reta a otro jugador en cualquier partido próximo: cada uno elige un ganador (local, visitante o empate) y una diferencia de goles. Al terminar el partido, el pronóstico más cercano al resultado real gana +3; si ambos quedan igual de cerca es empate y cada uno suma +1. Un ganador equivocado siempre pierde frente a uno acertado. Los retos también se cierran al iniciar el partido, y los puntos cuentan para tu total en el ranking. Inicia uno desde el perfil de un jugador en el Ranking.',

  fairTitle: 'Juego limpio',
  fairBody:
    'El pronóstico de otro jugador para un partido que aún no ha empezado permanece oculto, para que nadie lo copie. Tú siempre ves el tuyo.',
};

export function getRules(lang: Language): RulesContent {
  return lang === 'es' ? es : en;
}
