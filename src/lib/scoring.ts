import type { Match, Prediction } from './database.types';

export type PredictionOutcome = 'exact' | 'result' | 'miss' | 'pending';

export interface PredictionResult {
  outcome: PredictionOutcome;
  points: number;
}

/** Score a prediction against a match. exact=3, correct result=1, else 0. */
export function scorePrediction(
  pred: Pick<Prediction, 'home_pred' | 'away_pred'>,
  match: Pick<Match, 'status' | 'home_score' | 'away_score'>,
): PredictionResult {
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) {
    return { outcome: 'pending', points: 0 };
  }
  if (pred.home_pred === match.home_score && pred.away_pred === match.away_score) {
    return { outcome: 'exact', points: 3 };
  }
  const predDiff = Math.sign(pred.home_pred - pred.away_pred);
  const realDiff = Math.sign(match.home_score - match.away_score);
  if (predDiff === realDiff) return { outcome: 'result', points: 1 };
  return { outcome: 'miss', points: 0 };
}
