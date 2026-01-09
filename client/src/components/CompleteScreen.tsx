import { motion } from 'framer-motion';

interface CompleteScreenProps {
  finalScore: number;
  groupTotal: number;
  onPlayAgain: () => void;
}

export function CompleteScreen({ finalScore, groupTotal, onPlayAgain }: CompleteScreenProps) {
  const benchmark = 76;
  const percentOfBenchmark = Math.round((groupTotal / benchmark) * 100);

  return (
    <div className="complete-screen">
      <motion.div
        className="complete-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Game Complete!</h1>

        <div className="final-stats">
          <div className="stat-box your-score">
            <p className="stat-label">Your Final Score</p>
            <p className="stat-value">{finalScore}</p>
          </div>

          <div className="stat-box group-score">
            <p className="stat-label">Group Total</p>
            <p className="stat-value">{groupTotal}</p>
            <p className="stat-subtext">
              {percentOfBenchmark}% of maximum possible ({benchmark})
            </p>
          </div>
        </div>

        <div className="outcome-message">
          {groupTotal === benchmark && (
            <p className="perfect">🎉 Perfect cooperation! Your group achieved the maximum possible score.</p>
          )}
          {groupTotal >= benchmark * 0.8 && groupTotal < benchmark && (
            <p className="great">✨ Great cooperation! Your group worked well together.</p>
          )}
          {groupTotal >= benchmark * 0.5 && groupTotal < benchmark * 0.8 && (
            <p className="good">Your group showed moderate cooperation.</p>
          )}
          {groupTotal >= 0 && groupTotal < benchmark * 0.5 && (
            <p className="low">Your group faced challenges with cooperation.</p>
          )}
          {groupTotal < 0 && (
            <p className="negative">Your group experienced significant conflict.</p>
          )}
        </div>

        <motion.button
          className="play-again-button"
          onClick={onPlayAgain}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          Play Again
        </motion.button>
      </motion.div>
    </div>
  );
}
