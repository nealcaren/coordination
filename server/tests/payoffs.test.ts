import {
  calculatePayoffs,
  applyMultiplier,
  getMultiplier,
  getGroupPattern,
  calculateMaxGroupTotal,
  simulateGame
} from '../src/core/payoffs';
import { Move } from '../../shared/types';

describe('Payoff Calculations', () => {
  describe('calculatePayoffs', () => {
    it('should throw error if wrong number of moves for classic mode', () => {
      expect(() => calculatePayoffs(['C', 'C'])).toThrow('Exactly 4 moves required for classic mode');
      expect(() => calculatePayoffs(['C', 'C', 'C', 'C', 'C'])).toThrow('Exactly 4 moves required for classic mode');
    });

    it('should throw error if wrong number of moves for solidarity modes', () => {
      expect(() => calculatePayoffs(['X', 'X', 'X', 'X'], 'solidarity-mechanical'))
        .toThrow('Exactly 6 moves required for solidarity-mechanical mode');
      expect(() => calculatePayoffs(['X', 'X', 'X', 'X'], 'solidarity-organic'))
        .toThrow('Exactly 6 moves required for solidarity-organic mode');
    });

    it('should calculate 4 Protect: each gets -1', () => {
      const payoffs = calculatePayoffs(['P', 'P', 'P', 'P']);
      expect(payoffs).toEqual([
        { move: 'P', delta: -1 },
        { move: 'P', delta: -1 },
        { move: 'P', delta: -1 },
        { move: 'P', delta: -1 }
      ]);
    });

    it('should calculate 3 Protect + 1 Contribute: P gets +1, C gets -3', () => {
      const payoffs = calculatePayoffs(['P', 'P', 'P', 'C']);
      expect(payoffs).toEqual([
        { move: 'P', delta: 1 },
        { move: 'P', delta: 1 },
        { move: 'P', delta: 1 },
        { move: 'C', delta: -3 }
      ]);
    });

    it('should calculate 2 Protect + 2 Contribute: P gets +2, C gets -2', () => {
      const payoffs = calculatePayoffs(['P', 'P', 'C', 'C']);
      expect(payoffs).toEqual([
        { move: 'P', delta: 2 },
        { move: 'P', delta: 2 },
        { move: 'C', delta: -2 },
        { move: 'C', delta: -2 }
      ]);
    });

    it('should calculate 1 Protect + 3 Contribute: P gets +3, C gets -1', () => {
      const payoffs = calculatePayoffs(['P', 'C', 'C', 'C']);
      expect(payoffs).toEqual([
        { move: 'P', delta: 3 },
        { move: 'C', delta: -1 },
        { move: 'C', delta: -1 },
        { move: 'C', delta: -1 }
      ]);
    });

    it('should calculate 4 Contribute: each gets +1', () => {
      const payoffs = calculatePayoffs(['C', 'C', 'C', 'C']);
      expect(payoffs).toEqual([
        { move: 'C', delta: 1 },
        { move: 'C', delta: 1 },
        { move: 'C', delta: 1 },
        { move: 'C', delta: 1 }
      ]);
    });

    it('should preserve order of moves', () => {
      const payoffs = calculatePayoffs(['C', 'P', 'C', 'P']);
      expect(payoffs[0].move).toBe('C');
      expect(payoffs[1].move).toBe('P');
      expect(payoffs[2].move).toBe('C');
      expect(payoffs[3].move).toBe('P');
    });
  });

  describe('applyMultiplier', () => {
    it('should apply ×1 multiplier for rounds 1-3', () => {
      expect(applyMultiplier(1, 5)).toBe(5);
      expect(applyMultiplier(2, 5)).toBe(5);
      expect(applyMultiplier(3, 5)).toBe(5);
    });

    it('should apply ×3 multiplier for round 4', () => {
      expect(applyMultiplier(4, 5)).toBe(15);
      expect(applyMultiplier(4, 1)).toBe(3);
      expect(applyMultiplier(4, -3)).toBe(-9);
    });

    it('should apply ×1 multiplier for rounds 5-7', () => {
      expect(applyMultiplier(5, 5)).toBe(5);
      expect(applyMultiplier(6, 5)).toBe(5);
      expect(applyMultiplier(7, 5)).toBe(5);
    });

    it('should apply ×10 multiplier for round 8', () => {
      expect(applyMultiplier(8, 5)).toBe(50);
      expect(applyMultiplier(8, 1)).toBe(10);
      expect(applyMultiplier(8, -3)).toBe(-30);
    });

    it('should handle negative payoffs correctly', () => {
      expect(applyMultiplier(4, -1)).toBe(-3);
      expect(applyMultiplier(8, -1)).toBe(-10);
    });
  });

  describe('getMultiplier', () => {
    it('should return correct multipliers', () => {
      expect(getMultiplier(1)).toBe(1);
      expect(getMultiplier(2)).toBe(1);
      expect(getMultiplier(3)).toBe(1);
      expect(getMultiplier(4)).toBe(3);
      expect(getMultiplier(5)).toBe(1);
      expect(getMultiplier(6)).toBe(1);
      expect(getMultiplier(7)).toBe(1);
      expect(getMultiplier(8)).toBe(10);
    });
  });

  describe('getGroupPattern', () => {
    it('should classify 4C pattern', () => {
      expect(getGroupPattern(['C', 'C', 'C', 'C'])).toBe('4C');
    });

    it('should classify 3C1P pattern', () => {
      expect(getGroupPattern(['C', 'C', 'C', 'P'])).toBe('3C1P');
      expect(getGroupPattern(['P', 'C', 'C', 'C'])).toBe('3C1P');
    });

    it('should classify 2C2P pattern', () => {
      expect(getGroupPattern(['C', 'C', 'P', 'P'])).toBe('2C2P');
      expect(getGroupPattern(['P', 'C', 'P', 'C'])).toBe('2C2P');
    });

    it('should classify 1C3P pattern', () => {
      expect(getGroupPattern(['C', 'P', 'P', 'P'])).toBe('1C3P');
      expect(getGroupPattern(['P', 'P', 'C', 'P'])).toBe('1C3P');
    });

    it('should classify 4P pattern', () => {
      expect(getGroupPattern(['P', 'P', 'P', 'P'])).toBe('4P');
    });
  });

  describe('calculateMaxGroupTotal', () => {
    it('should return exactly 76 for classic mode', () => {
      expect(calculateMaxGroupTotal('classic')).toBe(76);
    });

    it('should return correct total for consensus mode', () => {
      // Rounds 1-3: 4 players × 4 points = 16 per round = 48
      // Round 4: 4 players × 4 points × 3 multiplier = 48
      // Total: 96
      expect(calculateMaxGroupTotal('consensus')).toBe(96);
    });
  });

  describe('simulateGame', () => {
    it('should throw error if not correct number of rounds for game mode', () => {
      const moves: Move[][] = [['C', 'C', 'C', 'C']];
      expect(() => simulateGame(moves, 'classic')).toThrow('Must provide moves for exactly 8 rounds');
      expect(() => simulateGame(moves, 'consensus')).toThrow('Must provide moves for exactly 4 rounds');
    });

    it('should calculate All-Contribute game totaling 76', () => {
      const allContribute: Move[][] = [
        ['C', 'C', 'C', 'C'], // Round 1: 4 points (1 each)
        ['C', 'C', 'C', 'C'], // Round 2: 4 points (1 each)
        ['C', 'C', 'C', 'C'], // Round 3: 4 points (1 each)
        ['C', 'C', 'C', 'C'], // Round 4: 12 points (1×3 each)
        ['C', 'C', 'C', 'C'], // Round 5: 4 points (1 each)
        ['C', 'C', 'C', 'C'], // Round 6: 4 points (1 each)
        ['C', 'C', 'C', 'C'], // Round 7: 4 points (1 each)
        ['C', 'C', 'C', 'C']  // Round 8: 40 points (1×10 each)
      ];
      // Total: 4+4+4+12+4+4+4+40 = 76
      expect(simulateGame(allContribute)).toBe(76);
    });

    it('should calculate All-Protect game totaling -48', () => {
      const allProtect: Move[][] = [
        ['P', 'P', 'P', 'P'], // Round 1: -4 points (-1 each)
        ['P', 'P', 'P', 'P'], // Round 2: -4 points (-1 each)
        ['P', 'P', 'P', 'P'], // Round 3: -4 points (-1 each)
        ['P', 'P', 'P', 'P'], // Round 4: -12 points (-1×3 each)
        ['P', 'P', 'P', 'P'], // Round 5: -4 points (-1 each)
        ['P', 'P', 'P', 'P'], // Round 6: -4 points (-1 each)
        ['P', 'P', 'P', 'P'], // Round 7: -4 points (-1 each)
        ['P', 'P', 'P', 'P']  // Round 8: -40 points (-1×10 each)
      ];
      // Total: -4-4-4-12-4-4-4-40 = -76
      expect(simulateGame(allProtect)).toBe(-76);
    });

    it('should calculate mixed game correctly', () => {
      const mixed: Move[][] = [
        ['C', 'C', 'C', 'C'], // Round 1: +4 (all +1)
        ['P', 'C', 'C', 'C'], // Round 2: +0 (1×+3, 3×-1)
        ['P', 'P', 'C', 'C'], // Round 3: +0 (2×+2, 2×-2)
        ['C', 'C', 'C', 'C'], // Round 4: +12 (all +1×3)
        ['P', 'P', 'P', 'C'], // Round 5: +0 (3×+1, 1×-3)
        ['P', 'P', 'P', 'P'], // Round 6: -4 (all -1)
        ['C', 'C', 'P', 'P'], // Round 7: +0 (2×-2, 2×+2)
        ['C', 'C', 'C', 'C']  // Round 8: +40 (all +1×10)
      ];
      // Total: 4+0+0+12+0-4+0+40 = 52
      expect(simulateGame(mixed)).toBe(52);
    });

    it('should verify payoff matrix properties: sum is always balanced', () => {
      // In each round, the sum of raw payoffs should equal a specific value
      // This tests the mathematical consistency of the payoff matrix

      const testCases = [
        { moves: ['P', 'P', 'P', 'P'], expectedSum: -4 },  // 4×-1 = -4
        { moves: ['P', 'P', 'P', 'C'], expectedSum: 0 },   // 3×1 + 1×-3 = 0
        { moves: ['P', 'P', 'C', 'C'], expectedSum: 0 },   // 2×2 + 2×-2 = 0
        { moves: ['P', 'C', 'C', 'C'], expectedSum: 0 },   // 1×3 + 3×-1 = 0
        { moves: ['C', 'C', 'C', 'C'], expectedSum: 4 }    // 4×1 = 4
      ];

      testCases.forEach(({ moves, expectedSum }) => {
        const payoffs = calculatePayoffs(moves as Move[]);
        const sum = payoffs.reduce((total, p) => total + p.delta, 0);
        expect(sum).toBe(expectedSum);
      });
    });
  });

  describe('Integration: Full game scenarios', () => {
    it('should handle a realistic classroom scenario', () => {
      // Simulate a group that starts cooperative but defects over time
      const scenario: Move[][] = [
        ['C', 'C', 'C', 'C'], // Round 1: Everyone cooperates
        ['C', 'C', 'C', 'C'], // Round 2: Still cooperating
        ['C', 'C', 'C', 'P'], // Round 3: One defector
        ['C', 'C', 'P', 'P'], // Round 4 (×3): More defection
        ['C', 'P', 'P', 'P'], // Round 5: Breakdown
        ['P', 'P', 'P', 'P'], // Round 6: Full defection
        ['P', 'P', 'P', 'P'], // Round 7: Still defecting
        ['C', 'C', 'C', 'C']  // Round 8 (×10): Last-round cooperation
      ];

      const total = simulateGame(scenario);
      // This should be less than the All-Contribute benchmark of 76
      expect(total).toBeLessThan(76);
      // But greater than All-Protect of -76
      expect(total).toBeGreaterThan(-76);
    });

    it('should verify All-Contribute is optimal', () => {
      const allC = simulateGame(Array(8).fill(['C', 'C', 'C', 'C']));

      // Try various other strategies - none should beat All-Contribute
      const allP = simulateGame(Array(8).fill(['P', 'P', 'P', 'P']));
      const alternating = simulateGame([
        ['C', 'C', 'C', 'C'],
        ['P', 'P', 'P', 'P'],
        ['C', 'C', 'C', 'C'],
        ['P', 'P', 'P', 'P'],
        ['C', 'C', 'C', 'C'],
        ['P', 'P', 'P', 'P'],
        ['C', 'C', 'C', 'C'],
        ['P', 'P', 'P', 'P']
      ]);

      expect(allC).toBeGreaterThan(allP);
      expect(allC).toBeGreaterThan(alternating);
      expect(allC).toBe(76);
    });
  });

  describe('Mechanical Solidarity mode', () => {
    it('should give 4 pts each when unanimous', () => {
      const allRed = calculatePayoffs(['R', 'R', 'R', 'R'], 'mechanical');
      expect(allRed).toEqual([
        { move: 'R', delta: 4 },
        { move: 'R', delta: 4 },
        { move: 'R', delta: 4 },
        { move: 'R', delta: 4 }
      ]);

      const allBlue = calculatePayoffs(['B', 'B', 'B', 'B'], 'mechanical');
      expect(allBlue).toEqual([
        { move: 'B', delta: 4 },
        { move: 'B', delta: 4 },
        { move: 'B', delta: 4 },
        { move: 'B', delta: 4 }
      ]);
    });

    it('should give 1 pt to majority, 0 to deviant in 3-1 split', () => {
      const threeRed = calculatePayoffs(['R', 'R', 'R', 'B'], 'mechanical');
      expect(threeRed).toEqual([
        { move: 'R', delta: 1 },
        { move: 'R', delta: 1 },
        { move: 'R', delta: 1 },
        { move: 'B', delta: 0 }
      ]);

      const threeBlue = calculatePayoffs(['R', 'B', 'B', 'B'], 'mechanical');
      expect(threeBlue).toEqual([
        { move: 'R', delta: 0 },
        { move: 'B', delta: 1 },
        { move: 'B', delta: 1 },
        { move: 'B', delta: 1 }
      ]);
    });

    it('should give 0 pts to everyone in 2-2 split', () => {
      const split = calculatePayoffs(['R', 'R', 'B', 'B'], 'mechanical');
      expect(split).toEqual([
        { move: 'R', delta: 0 },
        { move: 'R', delta: 0 },
        { move: 'B', delta: 0 },
        { move: 'B', delta: 0 }
      ]);
    });

    it('should calculate max group total as 96', () => {
      expect(calculateMaxGroupTotal('mechanical')).toBe(96);
    });

    it('should simulate unanimous game correctly', () => {
      const unanimous = simulateGame([
        ['R', 'R', 'R', 'R'], // Round 1: 16 pts
        ['R', 'R', 'R', 'R'], // Round 2: 16 pts
        ['R', 'R', 'R', 'R'], // Round 3: 16 pts
        ['R', 'R', 'R', 'R']  // Round 4: 48 pts (×3)
      ], 'mechanical');
      expect(unanimous).toBe(96);
    });

    it('should punish deviance harshly', () => {
      const withDeviant = simulateGame([
        ['R', 'R', 'R', 'R'], // Round 1: 16 pts
        ['R', 'R', 'R', 'B'], // Round 2: 3 pts (3×1 + 0)
        ['R', 'R', 'R', 'R'], // Round 3: 16 pts
        ['R', 'R', 'R', 'R']  // Round 4: 48 pts (×3)
      ], 'mechanical');
      // 16 + 3 + 16 + 48 = 83 (lost 13 pts from one deviance)
      expect(withDeviant).toBe(83);
    });
  });

  describe('Solidarity Mechanical mode (6 players, 3 roles)', () => {
    it('should give +3 each when 6-0-0 (total conformity)', () => {
      const allX = calculatePayoffs(['X', 'X', 'X', 'X', 'X', 'X'], 'solidarity-mechanical');
      expect(allX.every(p => p.delta === 3)).toBe(true);
      expect(allX.reduce((sum, p) => sum + p.delta, 0)).toBe(18);

      const allY = calculatePayoffs(['Y', 'Y', 'Y', 'Y', 'Y', 'Y'], 'solidarity-mechanical');
      expect(allY.every(p => p.delta === 3)).toBe(true);
    });

    it('should give +2 majority, -1 deviant when 5-1-0 (minor deviance)', () => {
      const fiveOne = calculatePayoffs(['X', 'X', 'X', 'X', 'X', 'Y'], 'solidarity-mechanical');
      // 5 players get +2, 1 deviant gets -1
      const majorityPayoffs = fiveOne.filter(p => p.move === 'X');
      const deviantPayoffs = fiveOne.filter(p => p.move === 'Y');

      expect(majorityPayoffs.every(p => p.delta === 2)).toBe(true);
      expect(deviantPayoffs.every(p => p.delta === -1)).toBe(true);
      // Total: 5×2 + 1×(-1) = 9
      expect(fiveOne.reduce((sum, p) => sum + p.delta, 0)).toBe(9);
    });

    it('should give 0 pts when 4-2-0 (fractured norms)', () => {
      const fourTwo = calculatePayoffs(['X', 'X', 'X', 'X', 'Y', 'Y'], 'solidarity-mechanical');
      expect(fourTwo.every(p => p.delta === 0)).toBe(true);
    });

    it('should give 0 pts when 4-1-1 (fractured norms)', () => {
      const fourOneOne = calculatePayoffs(['X', 'X', 'X', 'X', 'Y', 'Z'], 'solidarity-mechanical');
      expect(fourOneOne.every(p => p.delta === 0)).toBe(true);
    });

    it('should give 0 pts when 3-3-0 (moral breakdown)', () => {
      const threeThree = calculatePayoffs(['X', 'X', 'X', 'Y', 'Y', 'Y'], 'solidarity-mechanical');
      expect(threeThree.every(p => p.delta === 0)).toBe(true);
    });

    it('should give 0 pts when 3-2-1 (moral breakdown)', () => {
      const threeTwoOne = calculatePayoffs(['X', 'X', 'X', 'Y', 'Y', 'Z'], 'solidarity-mechanical');
      expect(threeTwoOne.every(p => p.delta === 0)).toBe(true);
    });

    it('should give 0 pts when 2-2-2 (moral breakdown)', () => {
      const balanced = calculatePayoffs(['X', 'X', 'Y', 'Y', 'Z', 'Z'], 'solidarity-mechanical');
      expect(balanced.every(p => p.delta === 0)).toBe(true);
    });

    it('should calculate max group total as 54', () => {
      // Round 1: 6×3 = 18, Round 2: 6×3×2 = 36, Total = 54
      expect(calculateMaxGroupTotal('solidarity-mechanical')).toBe(54);
    });

    it('should classify patterns correctly', () => {
      expect(getGroupPattern(['X', 'X', 'X', 'X', 'X', 'X'], 'solidarity-mechanical')).toBe('6-0-0');
      expect(getGroupPattern(['X', 'X', 'X', 'X', 'X', 'Y'], 'solidarity-mechanical')).toBe('5-1-0');
      expect(getGroupPattern(['X', 'X', 'X', 'X', 'Y', 'Y'], 'solidarity-mechanical')).toBe('4-2-0');
      expect(getGroupPattern(['X', 'X', 'X', 'X', 'Y', 'Z'], 'solidarity-mechanical')).toBe('4-1-1');
      expect(getGroupPattern(['X', 'X', 'X', 'Y', 'Y', 'Y'], 'solidarity-mechanical')).toBe('3-3-0');
      expect(getGroupPattern(['X', 'X', 'X', 'Y', 'Y', 'Z'], 'solidarity-mechanical')).toBe('3-2-1');
      expect(getGroupPattern(['X', 'X', 'Y', 'Y', 'Z', 'Z'], 'solidarity-mechanical')).toBe('2-2-2');
    });

    it('should simulate perfect conformity game', () => {
      const perfect = simulateGame([
        ['X', 'X', 'X', 'X', 'X', 'X'], // Round 1: 18 pts
        ['X', 'X', 'X', 'X', 'X', 'X']  // Round 2: 36 pts (×2)
      ], 'solidarity-mechanical');
      expect(perfect).toBe(54);
    });
  });

  describe('Solidarity Organic mode (6 players, 3 roles)', () => {
    it('should give +3 each when 2-2-2 (balanced division of labor)', () => {
      const balanced = calculatePayoffs(['X', 'X', 'Y', 'Y', 'Z', 'Z'], 'solidarity-organic');
      expect(balanced.every(p => p.delta === 3)).toBe(true);
      expect(balanced.reduce((sum, p) => sum + p.delta, 0)).toBe(18);
    });

    it('should reward underfilled/balanced roles when 3-2-1', () => {
      const uneven = calculatePayoffs(['X', 'X', 'X', 'Y', 'Y', 'Z'], 'solidarity-organic');
      // X has 3 (oversupplied) → +1 each
      // Y has 2 (balanced) → +2 each
      // Z has 1 (underfilled) → +2

      const xPayoffs = uneven.filter(p => p.move === 'X');
      const yPayoffs = uneven.filter(p => p.move === 'Y');
      const zPayoffs = uneven.filter(p => p.move === 'Z');

      expect(xPayoffs.every(p => p.delta === 1)).toBe(true);  // Oversupplied
      expect(yPayoffs.every(p => p.delta === 2)).toBe(true);  // Balanced
      expect(zPayoffs.every(p => p.delta === 2)).toBe(true);  // Underfilled

      // Total: 3×1 + 2×2 + 1×2 = 3 + 4 + 2 = 9
      expect(uneven.reduce((sum, p) => sum + p.delta, 0)).toBe(9);
    });

    it('should give +1 each when 4-1-1 (inefficient coordination)', () => {
      const inefficient = calculatePayoffs(['X', 'X', 'X', 'X', 'Y', 'Z'], 'solidarity-organic');
      expect(inefficient.every(p => p.delta === 1)).toBe(true);
    });

    it('should give +1 each when 3-3-0 (inefficient coordination)', () => {
      const halfHalf = calculatePayoffs(['X', 'X', 'X', 'Y', 'Y', 'Y'], 'solidarity-organic');
      expect(halfHalf.every(p => p.delta === 1)).toBe(true);
    });

    it('should give +1 each when 4-2-0 (very inefficient)', () => {
      const veryInefficient = calculatePayoffs(['X', 'X', 'X', 'X', 'Y', 'Y'], 'solidarity-organic');
      expect(veryInefficient.every(p => p.delta === 1)).toBe(true);
    });

    it('should give +1 each when 5-1-0 (near monopoly)', () => {
      const nearMonopoly = calculatePayoffs(['X', 'X', 'X', 'X', 'X', 'Y'], 'solidarity-organic');
      expect(nearMonopoly.every(p => p.delta === 1)).toBe(true);
    });

    it('should give 0 pts when 6-0-0 (no specialization)', () => {
      const noSpecialization = calculatePayoffs(['X', 'X', 'X', 'X', 'X', 'X'], 'solidarity-organic');
      expect(noSpecialization.every(p => p.delta === 0)).toBe(true);
    });

    it('should calculate max group total as 54', () => {
      // Round 1: 6×3 = 18, Round 2: 6×3×2 = 36, Total = 54
      expect(calculateMaxGroupTotal('solidarity-organic')).toBe(54);
    });

    it('should classify patterns correctly', () => {
      expect(getGroupPattern(['X', 'X', 'Y', 'Y', 'Z', 'Z'], 'solidarity-organic')).toBe('2-2-2');
      expect(getGroupPattern(['X', 'X', 'X', 'Y', 'Y', 'Z'], 'solidarity-organic')).toBe('3-2-1');
      expect(getGroupPattern(['X', 'X', 'X', 'X', 'X', 'X'], 'solidarity-organic')).toBe('6-0-0');
    });

    it('should simulate perfect division of labor game', () => {
      const perfect = simulateGame([
        ['X', 'X', 'Y', 'Y', 'Z', 'Z'], // Round 1: 18 pts
        ['X', 'X', 'Y', 'Y', 'Z', 'Z']  // Round 2: 36 pts (×2)
      ], 'solidarity-organic');
      expect(perfect).toBe(54);
    });
  });

  describe('Solidarity mode inversions (pedagogical key)', () => {
    it('should reward 6-0-0 in mechanical but punish in organic', () => {
      const allSame = ['X', 'X', 'X', 'X', 'X', 'X'] as Move[];

      const mechPayoffs = calculatePayoffs(allSame, 'solidarity-mechanical');
      const orgPayoffs = calculatePayoffs(allSame, 'solidarity-organic');

      // Mechanical: conformity rewarded
      expect(mechPayoffs.every(p => p.delta === 3)).toBe(true);
      // Organic: no specialization punished
      expect(orgPayoffs.every(p => p.delta === 0)).toBe(true);
    });

    it('should reward 2-2-2 in organic but punish in mechanical', () => {
      const balanced = ['X', 'X', 'Y', 'Y', 'Z', 'Z'] as Move[];

      const mechPayoffs = calculatePayoffs(balanced, 'solidarity-mechanical');
      const orgPayoffs = calculatePayoffs(balanced, 'solidarity-organic');

      // Mechanical: moral breakdown
      expect(mechPayoffs.every(p => p.delta === 0)).toBe(true);
      // Organic: perfect division of labor
      expect(orgPayoffs.every(p => p.delta === 3)).toBe(true);
    });

    it('should demonstrate the key pedagogical contrast', () => {
      // This test captures the core Durkheim lesson:
      // The SAME behavior produces OPPOSITE outcomes depending on solidarity type

      const allConform = ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] as Move[];
      const allDifferent = ['X', 'X', 'Y', 'Y', 'Z', 'Z'] as Move[];

      // In Mechanical Solidarity: conformity is valued
      const mechConform = calculatePayoffs(allConform, 'solidarity-mechanical');
      const mechDifferent = calculatePayoffs(allDifferent, 'solidarity-mechanical');

      expect(mechConform.reduce((s, p) => s + p.delta, 0)).toBe(18);  // Best
      expect(mechDifferent.reduce((s, p) => s + p.delta, 0)).toBe(0);  // Worst

      // In Organic Solidarity: differentiation is valued
      const orgConform = calculatePayoffs(allConform, 'solidarity-organic');
      const orgDifferent = calculatePayoffs(allDifferent, 'solidarity-organic');

      expect(orgConform.reduce((s, p) => s + p.delta, 0)).toBe(0);   // Worst
      expect(orgDifferent.reduce((s, p) => s + p.delta, 0)).toBe(18); // Best
    });
  });
});
