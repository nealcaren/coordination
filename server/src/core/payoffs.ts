import { Move, PatternType, GameMode, GAME_MODES, SolidarityPatternType } from '../../../shared/types';

/**
 * Calculate payoffs for a group based on their moves and game mode
 */
export function calculatePayoffs(
  moves: Move[],
  gameMode: GameMode = 'classic'
): Array<{ move: Move; delta: number }> {
  const config = GAME_MODES[gameMode];

  if (moves.length !== config.groupSize) {
    throw new Error(`Exactly ${config.groupSize} moves required for ${gameMode} mode`);
  }

  if (gameMode === 'consensus') {
    return calculateConsensusPayoffs(moves);
  }
  if (gameMode === 'mechanical') {
    return calculateMechanicalPayoffs(moves);
  }
  if (gameMode === 'solidarity-mechanical') {
    return calculateSolidarityMechanicalPayoffs(moves);
  }
  if (gameMode === 'solidarity-organic') {
    return calculateSolidarityOrganicPayoffs(moves);
  }
  return calculateClassicPayoffs(moves);
}

/**
 * Classic mode payoffs (Contribute or Protect)
 * This implements the exact payoff matrix from the specification
 */
function calculateClassicPayoffs(moves: Move[]): Array<{ move: Move; delta: number }> {
  const cCount = moves.filter(m => m === 'C').length;
  const pCount = 4 - cCount;

  const payoffs: Array<{ move: Move; delta: number }> = [];

  for (const move of moves) {
    let delta: number;

    if (pCount === 4) {
      // All Protect: each gets -1
      delta = -1;
    } else if (pCount === 3) {
      // 3P + 1C: P gets +1, C gets -3
      delta = move === 'P' ? 1 : -3;
    } else if (pCount === 2) {
      // 2P + 2C: P gets +2, C gets -2
      delta = move === 'P' ? 2 : -2;
    } else if (pCount === 1) {
      // 1P + 3C: P gets +3, C gets -1
      delta = move === 'P' ? 3 : -1;
    } else {
      // All Contribute (0P): each gets +1
      delta = 1;
    }

    payoffs.push({ move, delta });
  }

  return payoffs;
}

/**
 * Consensus mode payoffs (Red or Blue)
 * Players who pick the majority color get points equal to the majority count
 * In a tie (2-2), everyone gets 2 points
 */
function calculateConsensusPayoffs(moves: Move[]): Array<{ move: Move; delta: number }> {
  const rCount = moves.filter(m => m === 'R').length;
  const bCount = 4 - rCount;

  const payoffs: Array<{ move: Move; delta: number }> = [];

  for (const move of moves) {
    let delta: number;

    if (rCount === bCount) {
      // Tie (2-2): everyone gets 2
      delta = 2;
    } else if (rCount > bCount) {
      // Red is majority
      delta = move === 'R' ? rCount : bCount;
    } else {
      // Blue is majority
      delta = move === 'B' ? bCount : rCount;
    }

    payoffs.push({ move, delta });
  }

  return payoffs;
}

/**
 * Mechanical Solidarity mode payoffs (Red or Blue) - 4 player version
 * Unanimous = 4 pts each, 3-1 = 1 pt majority / 0 deviant, 2-2 = 0 all
 * Harsh punishment for deviance from the collective
 */
function calculateMechanicalPayoffs(moves: Move[]): Array<{ move: Move; delta: number }> {
  const rCount = moves.filter(m => m === 'R').length;
  const bCount = 4 - rCount;

  const payoffs: Array<{ move: Move; delta: number }> = [];

  for (const move of moves) {
    let delta: number;

    if (rCount === 4 || bCount === 4) {
      // Unanimous: everyone gets 4 points
      delta = 4;
    } else if (rCount === 3 || bCount === 3) {
      // 3-1 split: majority gets 1, deviant gets 0
      const majorityMove = rCount > bCount ? 'R' : 'B';
      delta = move === majorityMove ? 1 : 0;
    } else {
      // 2-2 split: everyone gets 0 (no collective agreement)
      delta = 0;
    }

    payoffs.push({ move, delta });
  }

  return payoffs;
}

/**
 * Get sorted role counts for solidarity modes (6 players, 3 roles: X, Y, Z)
 */
function getSolidarityRoleCounts(moves: Move[]): { counts: number[]; roleForMove: Map<Move, number> } {
  const xCount = moves.filter(m => m === 'X').length;
  const yCount = moves.filter(m => m === 'Y').length;
  const zCount = moves.filter(m => m === 'Z').length;

  // Map each move to its count
  const roleForMove = new Map<Move, number>();
  roleForMove.set('X', xCount);
  roleForMove.set('Y', yCount);
  roleForMove.set('Z', zCount);

  // Sort counts descending for pattern matching
  const counts = [xCount, yCount, zCount].sort((a, b) => b - a);

  return { counts, roleForMove };
}

/**
 * Solidarity Mechanical mode payoffs (6 players, 3 roles)
 * Conformity rewarded - based on Durkheim's mechanical solidarity
 *
 * | Pattern   | Interpretation   | Points                   |
 * |-----------|------------------|--------------------------|
 * | 6-0-0     | Total conformity | +3 points each           |
 * | 5-1-0     | Minor deviance   | +2 majority, -1 deviant  |
 * | 4-2-0     | Fractured norms  | 0 points all             |
 * | 4-1-1     | Fractured norms  | 0 points all             |
 * | 3-3-0     | Moral breakdown  | 0 points all             |
 * | 3-2-1     | Moral breakdown  | 0 points all             |
 * | 2-2-2     | Moral breakdown  | 0 points all             |
 */
function calculateSolidarityMechanicalPayoffs(moves: Move[]): Array<{ move: Move; delta: number }> {
  const { counts, roleForMove } = getSolidarityRoleCounts(moves);
  const [max, mid, min] = counts;

  const payoffs: Array<{ move: Move; delta: number }> = [];

  // Determine pattern
  if (max === 6) {
    // 6-0-0: Total conformity - everyone gets +3
    for (const move of moves) {
      payoffs.push({ move, delta: 3 });
    }
  } else if (max === 5 && mid === 1) {
    // 5-1-0: Minor deviance - majority +2, deviant -1
    // Find which role has count 5 (majority) and which has count 1 (deviant)
    for (const move of moves) {
      const count = roleForMove.get(move) || 0;
      if (count === 5) {
        payoffs.push({ move, delta: 2 });
      } else {
        payoffs.push({ move, delta: -1 });
      }
    }
  } else {
    // All other patterns: fractured norms / moral breakdown - 0 points
    for (const move of moves) {
      payoffs.push({ move, delta: 0 });
    }
  }

  return payoffs;
}

/**
 * Solidarity Organic mode payoffs (6 players, 3 roles)
 * Differentiation rewarded - based on Durkheim's organic solidarity
 *
 * | Pattern   | Interpretation              | Points                                         |
 * |-----------|-----------------------------|-------------------------------------------------|
 * | 2-2-2     | Balanced division of labor  | +3 points each                                  |
 * | 3-2-1     | Functional but uneven       | +2 underfilled (1), +2 balanced (2), +1 over (3)|
 * | 4-1-1     | Inefficient coordination    | +1 each                                         |
 * | 3-3-0     | Inefficient coordination    | +1 each                                         |
 * | 4-2-0     | Very inefficient            | +1 each                                         |
 * | 5-1-0     | Near monopoly               | +1 each                                         |
 * | 6-0-0     | No specialization           | 0 points                                        |
 */
function calculateSolidarityOrganicPayoffs(moves: Move[]): Array<{ move: Move; delta: number }> {
  const { counts, roleForMove } = getSolidarityRoleCounts(moves);
  const [max, mid, min] = counts;

  const payoffs: Array<{ move: Move; delta: number }> = [];

  if (max === 2 && mid === 2 && min === 2) {
    // 2-2-2: Perfect balance - everyone gets +3
    for (const move of moves) {
      payoffs.push({ move, delta: 3 });
    }
  } else if (max === 3 && mid === 2 && min === 1) {
    // 3-2-1: Functional but uneven
    // +2 for underfilled role (count=1), +2 for balanced (count=2), +1 for oversupplied (count=3)
    for (const move of moves) {
      const count = roleForMove.get(move) || 0;
      if (count === 1) {
        payoffs.push({ move, delta: 2 }); // Underfilled - valuable
      } else if (count === 2) {
        payoffs.push({ move, delta: 2 }); // Balanced
      } else {
        payoffs.push({ move, delta: 1 }); // Oversupplied
      }
    }
  } else if (max === 6) {
    // 6-0-0: No specialization - 0 points
    for (const move of moves) {
      payoffs.push({ move, delta: 0 });
    }
  } else {
    // All other patterns (4-1-1, 3-3-0, 4-2-0, 5-1-0): Inefficient - +1 each
    for (const move of moves) {
      payoffs.push({ move, delta: 1 });
    }
  }

  return payoffs;
}

/**
 * Get the multiplier for a given round and game mode
 */
export function getMultiplier(round: number, gameMode: GameMode = 'classic'): number {
  const config = GAME_MODES[gameMode];
  return config.multiplierRounds[round] || 1;
}

/**
 * Apply multiplier based on round number and game mode
 */
export function applyMultiplier(
  round: number,
  basePayoff: number,
  gameMode: GameMode = 'classic'
): number {
  return basePayoff * getMultiplier(round, gameMode);
}

/**
 * Classify group outcome pattern based on game mode
 */
export function getGroupPattern(moves: Move[], gameMode: GameMode = 'classic'): PatternType {
  if (gameMode === 'solidarity-mechanical' || gameMode === 'solidarity-organic') {
    // Solidarity modes: 6 players, 3 roles (X, Y, Z)
    const { counts } = getSolidarityRoleCounts(moves);
    const [max, mid, min] = counts;

    // Return pattern as sorted counts string
    if (max === 6) return '6-0-0';
    if (max === 5 && mid === 1) return '5-1-0';
    if (max === 4 && mid === 2) return '4-2-0';
    if (max === 4 && mid === 1) return '4-1-1';
    if (max === 3 && mid === 3) return '3-3-0';
    if (max === 3 && mid === 2) return '3-2-1';
    return '2-2-2';
  }

  if (gameMode === 'consensus' || gameMode === 'mechanical') {
    // Both consensus and mechanical use R/B moves
    const rCount = moves.filter(m => m === 'R').length;
    if (rCount === 4) return '4R';
    if (rCount === 3) return '3R1B';
    if (rCount === 2) return '2R2B';
    if (rCount === 1) return '1R3B';
    return '4B';
  }

  // Classic mode
  const cCount = moves.filter(m => m === 'C').length;
  if (cCount === 4) return '4C';
  if (cCount === 3) return '3C1P';
  if (cCount === 2) return '2C2P';
  if (cCount === 1) return '1C3P';
  return '4P';
}

/**
 * Get the first move count (C for classic, R for consensus)
 */
export function getFirstMoveCount(moves: Move[], gameMode: GameMode = 'classic'): number {
  const firstMove = GAME_MODES[gameMode].moves.first;
  return moves.filter(m => m === firstMove).length;
}

/**
 * Calculate the maximum possible group total for a game mode
 * Classic: 76 points (all Contribute)
 * Consensus/Mechanical: 96 points (all unanimous)
 * Solidarity modes: varies by optimal strategy
 */
export function calculateMaxGroupTotal(gameMode: GameMode = 'classic'): number {
  const config = GAME_MODES[gameMode];

  if (gameMode === 'classic') {
    // When all 4 players Contribute each round, each gets +1
    // Rounds 1-3: 1 × 3 = 3 points per player
    // Round 4: 1 × 3 = 3 points per player (3x multiplier)
    // Rounds 5-7: 1 × 3 = 3 points per player
    // Round 8: 1 × 10 = 10 points per player (10x multiplier)
    // Total per player: 19, per group: 76
    return 76;
  }

  if (gameMode === 'consensus' || gameMode === 'mechanical') {
    // When all 4 players pick same color, each gets 4 points
    // Rounds 1-3: 4 × 4 players = 16 per round = 48 total
    // Round 4: 4 × 4 players × 3 multiplier = 48
    // Total: 96
    let total = 0;
    for (let round = 1; round <= config.totalRounds; round++) {
      const multiplier = config.multiplierRounds[round] || 1;
      total += 4 * 4 * multiplier; // 4 players × 4 points × multiplier
    }
    return total;
  }

  if (gameMode === 'solidarity-mechanical') {
    // When all 6 players pick same role, each gets +3
    // Round 1: 3 × 6 = 18
    // Round 2: 3 × 6 × 2 = 36 (2x multiplier)
    // Total: 54
    let total = 0;
    for (let round = 1; round <= config.totalRounds; round++) {
      const multiplier = config.multiplierRounds[round] || 1;
      total += 3 * 6 * multiplier; // 6 players × 3 points × multiplier
    }
    return total;
  }

  if (gameMode === 'solidarity-organic') {
    // When 2-2-2 split (perfect division of labor), each gets +3
    // Round 1: 3 × 6 = 18
    // Round 2: 3 × 6 × 2 = 36 (2x multiplier)
    // Total: 54
    let total = 0;
    for (let round = 1; round <= config.totalRounds; round++) {
      const multiplier = config.multiplierRounds[round] || 1;
      total += 3 * 6 * multiplier; // 6 players × 3 points × multiplier
    }
    return total;
  }

  return 0;
}

/**
 * Simulate a full game and return total group score
 * Useful for testing and validation
 */
export function simulateGame(
  movesPerRound: Move[][],
  gameMode: GameMode = 'classic'
): number {
  const config = GAME_MODES[gameMode];

  if (movesPerRound.length !== config.totalRounds) {
    throw new Error(`Must provide moves for exactly ${config.totalRounds} rounds`);
  }

  // Initialize player scores based on group size
  const playerScores = new Array(config.groupSize).fill(0);

  for (let round = 1; round <= config.totalRounds; round++) {
    const moves = movesPerRound[round - 1];
    const payoffs = calculatePayoffs(moves, gameMode);

    payoffs.forEach((payoff, index) => {
      playerScores[index] += applyMultiplier(round, payoff.delta, gameMode);
    });
  }

  return playerScores.reduce((sum, score) => sum + score, 0);
}
