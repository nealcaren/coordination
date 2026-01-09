import { motion } from 'framer-motion';
import { GameMode, Move, GAME_MODES } from '../../../shared/types';

interface RoundScreenProps {
  round: number;
  totalRounds: number;
  timeRemaining: number;
  multiplier: number;
  hasSubmitted: boolean;
  gameMode: GameMode;
  onSubmit: (move: Move) => void;
}

export function RoundScreen({ round, totalRounds, timeRemaining, multiplier, hasSubmitted, gameMode, onSubmit }: RoundScreenProps) {
  const config = GAME_MODES[gameMode];
  const { moves, moveLabels } = config;

  return (
    <div className="round-screen">
      <div className="round-header">
        <div className="round-number">
          Round {round} of {totalRounds}
          {multiplier > 1 && (
            <motion.span
              className="multiplier-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              ×{multiplier} BONUS
            </motion.span>
          )}
        </div>
        <div className={`timer ${timeRemaining <= 5 ? 'urgent' : ''}`}>
          {timeRemaining}s
        </div>
      </div>

      <div className="decision-area">
        {!hasSubmitted ? (
          <>
            <p className="prompt">Choose one:</p>
            <div className="button-container">
              <motion.button
                className={`action-button ${gameMode === 'classic' ? 'contribute' : 'red'}`}
                onClick={() => onSubmit(moves.first)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
              >
                <span className="button-label">{moveLabels.first}</span>
                <span className="button-letter">{moves.first}</span>
              </motion.button>

              <motion.button
                className={`action-button ${gameMode === 'classic' ? 'protect' : 'blue'}`}
                onClick={() => onSubmit(moves.second)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
              >
                <span className="button-label">{moveLabels.second}</span>
                <span className="button-letter">{moves.second}</span>
              </motion.button>

              {moves.third && moveLabels.third && (
                <motion.button
                  className="action-button green"
                  onClick={() => onSubmit(moves.third!)}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="button-label">{moveLabels.third}</span>
                  <span className="button-letter">{moves.third}</span>
                </motion.button>
              )}
            </div>
          </>
        ) : (
          <motion.div
            className="submitted-confirmation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="checkmark">✓</div>
            <p>Choice submitted</p>
            <p className="waiting-text">Waiting for other players...</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
