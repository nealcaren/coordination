import { motion } from 'framer-motion';
import { GameMode, GAME_MODES } from '../../../shared/types';

interface RoundResult {
  round: number;
  multiplier: number;
  gameMode: GameMode;
  pattern: {
    firstCount: number;
    secondCount: number;
  };
  deltas: Array<{
    playerId: string;
    delta: number;
    total: number;
  }>;
}

interface ResultsScreenProps {
  result: RoundResult;
  playerId: string;
  score: number;
  gameMode: GameMode;
}

export function ResultsScreen({ result, playerId, score, gameMode }: ResultsScreenProps) {
  const myDelta = result.deltas.find(d => d.playerId === playerId);
  const delta = myDelta?.delta || 0;
  const config = GAME_MODES[gameMode];

  return (
    <div className="results-screen">
      <div className="results-content">
        <h2>Round {result.round} Results</h2>

        <motion.div
          className="group-outcome"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="outcome-label">Group outcome:</p>
          <p className="outcome-pattern">
            {result.pattern.firstCount} {config.moveLabels.first} / {result.pattern.secondCount} {config.moveLabels.second}
          </p>
        </motion.div>

        <motion.div
          className={`score-change ${delta >= 0 ? 'positive' : 'negative'}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="change-label">Your points this round:</p>
          <p className="change-value">
            {delta > 0 ? '+' : ''}{delta}
            {result.multiplier > 1 && (
              <span className="multiplier-note"> (×{result.multiplier})</span>
            )}
          </p>
        </motion.div>

        <motion.div
          className="total-score"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="total-label">Your total:</p>
          <p className="total-value">{score}</p>
        </motion.div>
      </div>
    </div>
  );
}
