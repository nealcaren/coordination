// Shared types between client and server

// Game modes
export type GameMode = 'classic' | 'consensus' | 'mechanical' | 'solidarity-mechanical' | 'solidarity-organic' | 'durkheim';

// Moves for each mode
export type ClassicMove = 'C' | 'P'; // Contribute or Protect
export type ConsensusMove = 'R' | 'B'; // Red or Blue
export type SolidarityMove = 'X' | 'Y' | 'Z'; // Producer, Distributor, Regulator
export type Move = ClassicMove | ConsensusMove | SolidarityMove;

export type SessionStatus = 'waiting' | 'active' | 'complete' | 'abandoned';

// Pattern types for each mode
export type ClassicPatternType = '4C' | '3C1P' | '2C2P' | '1C3P' | '4P';
export type ConsensusPatternType = '4R' | '3R1B' | '2R2B' | '1R3B' | '4B';
// Solidarity patterns: sorted counts (e.g., 3-2-1 means one role has 3, one has 2, one has 1)
export type SolidarityPatternType = '6-0-0' | '5-1-0' | '4-2-0' | '4-1-1' | '3-3-0' | '3-2-1' | '2-2-2';
export type PatternType = ClassicPatternType | ConsensusPatternType | SolidarityPatternType;

// Game mode configurations
export interface GameModeConfig {
  mode: GameMode;
  name: string;
  description: string;
  totalRounds: number;
  groupSize: number; // 4 for classic/consensus/mechanical, 6 for solidarity modes
  multiplierRounds: Record<number, number>; // round -> multiplier
  moves: { first: Move; second: Move; third?: Move };
  moveLabels: { first: string; second: string; third?: string };
  defaultMove: Move; // For auto-submission on timeout
}

export const GAME_MODES: Record<GameMode, GameModeConfig> = {
  classic: {
    mode: 'classic',
    name: 'Contribute or Protect',
    description: 'Classic collective action dilemma (8 rounds)',
    totalRounds: 8,
    groupSize: 4,
    multiplierRounds: { 4: 3, 8: 10 },
    moves: { first: 'C', second: 'P' },
    moveLabels: { first: 'Contribute', second: 'Protect' },
    defaultMove: 'P'
  },
  consensus: {
    mode: 'consensus',
    name: 'Red or Blue',
    description: 'Coordination game - majority wins (4 rounds)',
    totalRounds: 4,
    groupSize: 4,
    multiplierRounds: { 4: 3 },
    moves: { first: 'R', second: 'B' },
    moveLabels: { first: 'Red', second: 'Blue' },
    defaultMove: 'R'
  },
  mechanical: {
    mode: 'mechanical',
    name: 'Mechanical (Simple)',
    description: 'Unanimity required - 4 players, 2 choices (4 rounds)',
    totalRounds: 4,
    groupSize: 4,
    multiplierRounds: { 4: 3 },
    moves: { first: 'R', second: 'B' },
    moveLabels: { first: 'Red', second: 'Blue' },
    defaultMove: 'R'
  },
  'solidarity-mechanical': {
    mode: 'solidarity-mechanical',
    name: 'Mechanical Solidarity',
    description: 'Conformity rewarded - 6 players, 3 roles (2 rounds)',
    totalRounds: 2,
    groupSize: 6,
    multiplierRounds: { 2: 2 }, // Second round is bonus
    moves: { first: 'X', second: 'Y', third: 'Z' },
    moveLabels: { first: 'Producer', second: 'Distributor', third: 'Regulator' },
    defaultMove: 'X'
  },
  'solidarity-organic': {
    mode: 'solidarity-organic',
    name: 'Organic Solidarity',
    description: 'Differentiation rewarded - 6 players, 3 roles (2 rounds)',
    totalRounds: 2,
    groupSize: 6,
    multiplierRounds: { 2: 2 }, // Second round is bonus
    moves: { first: 'X', second: 'Y', third: 'Z' },
    moveLabels: { first: 'Producer', second: 'Distributor', third: 'Regulator' },
    defaultMove: 'X'
  },
  durkheim: {
    mode: 'durkheim',
    name: 'Solidarity Game',
    description: 'Discover how society holds together (8 rounds)',
    totalRounds: 8,
    groupSize: 6,
    multiplierRounds: { 4: 2, 8: 2 }, // Bonus at transition and end
    moves: { first: 'X', second: 'Y', third: 'Z' },
    moveLabels: { first: 'Producer', second: 'Distributor', third: 'Regulator' },
    defaultMove: 'X'
  }
};

export interface PlayerPayoff {
  playerId: string;
  move: Move;
  delta: number;  // Points gained/lost this round
  total: number;  // Cumulative score
  auto: boolean;  // Was this an auto-submitted move?
}

export interface RoundResult {
  round: number;
  multiplier: number;
  firstCount: number;  // Number of first move choices (C or R)
  secondCount: number; // Number of second move choices (P or B)
  pattern: PatternType;
  payoffs: PlayerPayoff[];
  resolvedAt: number;
}

export interface Session {
  id: string;
  runId: string;
  gameMode: GameMode;
  players: string[];
  currentRound: number;
  status: SessionStatus;
  scores: Record<string, number>;
  createdAt: number;
}

export interface MetricsSnapshot {
  gameMode: GameMode;
  connected: number;
  queue: number;
  activeSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  byRound: Array<{
    round: number;
    firstCount: number;   // C or R count
    secondCount: number;  // P or B count
    autoCount: number;
    firstPercent: number;
    secondPercent: number;
  }>;
  avgGroupTotal: number;
  medianGroupTotal: number;
  maxGroupTotal: number;  // Benchmark for this mode
  patterns: Record<string, number>;
}
