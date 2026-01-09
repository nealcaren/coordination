import { Database } from '../src/state/database';
import { SessionManager } from '../src/state/session';
import { Move } from '../../shared/types';
import fs from 'fs';
import path from 'path';

describe('SessionManager', () => {
  let db: Database;
  let sessionManager: SessionManager;
  const testDbPath = './test-game.db';

  beforeEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    await db.initialize();
    sessionManager = new SessionManager(db);
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createSession', () => {
    it('should create a session with 4 players', async () => {
      const session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);

      expect(session).toBeDefined();
      expect(session.players).toHaveLength(4);
      expect(session.currentRound).toBe(1);
      expect(session.status).toBe('active');
      expect(session.scores).toEqual({
        p1: 0,
        p2: 0,
        p3: 0,
        p4: 0
      });
    });

    it('should throw error if not exactly 4 players', async () => {
      await expect(
        sessionManager.createSession('run1', ['p1', 'p2'])
      ).rejects.toThrow('Session requires exactly 4 players');

      await expect(
        sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4', 'p5'])
      ).rejects.toThrow('Session requires exactly 4 players');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
      const session2 = await sessionManager.createSession('run1', ['p5', 'p6', 'p7', 'p8']);

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getSession', () => {
    it('should retrieve a session by ID', async () => {
      const created = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
      const retrieved = await sessionManager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.players).toEqual(created.players);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('submitMove', () => {
    let session: any;

    beforeEach(async () => {
      session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
    });

    it('should accept a valid move', async () => {
      await expect(
        sessionManager.submitMove(session.id, 'p1', 'C')
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.submitMove('non-existent', 'p1', 'C')
      ).rejects.toThrow('Session not found');
    });

    it('should throw error for player not in session', async () => {
      await expect(
        sessionManager.submitMove(session.id, 'p99', 'C')
      ).rejects.toThrow('Player not in session');
    });

    it('should throw error for duplicate move submission', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');

      await expect(
        sessionManager.submitMove(session.id, 'p1', 'P')
      ).rejects.toThrow('Move already submitted for this round');
    });

    it('should accept auto-submitted moves', async () => {
      await expect(
        sessionManager.submitMove(session.id, 'p1', 'P', true)
      ).resolves.not.toThrow();
    });
  });

  describe('allMovesSubmitted', () => {
    let session: any;

    beforeEach(async () => {
      session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
    });

    it('should return false when no moves submitted', async () => {
      const result = await sessionManager.allMovesSubmitted(session.id);
      expect(result).toBe(false);
    });

    it('should return false when only some moves submitted', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');

      const result = await sessionManager.allMovesSubmitted(session.id);
      expect(result).toBe(false);
    });

    it('should return true when all 4 moves submitted', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'C');
      await sessionManager.submitMove(session.id, 'p4', 'C');

      const result = await sessionManager.allMovesSubmitted(session.id);
      expect(result).toBe(true);
    });
  });

  describe('resolveRound', () => {
    let session: any;

    beforeEach(async () => {
      session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
    });

    it('should throw error if not all moves submitted', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');

      await expect(
        sessionManager.resolveRound(session.id)
      ).rejects.toThrow('Not all moves submitted');
    });

    it('should resolve round with all Contribute', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'C');
      await sessionManager.submitMove(session.id, 'p4', 'C');

      const result = await sessionManager.resolveRound(session.id);

      expect(result.round).toBe(1);
      expect(result.multiplier).toBe(1);
      expect(result.firstCount).toBe(4);
      expect(result.secondCount).toBe(0);
      expect(result.pattern).toBe('4C');
      expect(result.payoffs).toHaveLength(4);

      // Each player should get +1
      result.payoffs.forEach(p => {
        expect(p.delta).toBe(1);
        expect(p.total).toBe(1);
        expect(p.auto).toBe(false);
      });
    });

    it('should resolve round with mixed moves', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'P');
      await sessionManager.submitMove(session.id, 'p4', 'P');

      const result = await sessionManager.resolveRound(session.id);

      expect(result.firstCount).toBe(2);
      expect(result.secondCount).toBe(2);
      expect(result.pattern).toBe('2C2P');

      // Check payoffs: P gets +2, C gets -2
      const cPlayers = result.payoffs.filter(p => p.move === 'C');
      const pPlayers = result.payoffs.filter(p => p.move === 'P');

      cPlayers.forEach(p => expect(p.delta).toBe(-2));
      pPlayers.forEach(p => expect(p.delta).toBe(2));
    });

    it('should apply multiplier on round 4', async () => {
      // Advance to round 4
      for (let i = 1; i < 4; i++) {
        await sessionManager.submitMove(session.id, 'p1', 'C');
        await sessionManager.submitMove(session.id, 'p2', 'C');
        await sessionManager.submitMove(session.id, 'p3', 'C');
        await sessionManager.submitMove(session.id, 'p4', 'C');
        await sessionManager.resolveRound(session.id);
        await sessionManager.advanceRound(session.id);
      }

      // Round 4 moves
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'C');
      await sessionManager.submitMove(session.id, 'p4', 'C');

      const result = await sessionManager.resolveRound(session.id);

      expect(result.round).toBe(4);
      expect(result.multiplier).toBe(3);

      // Each player gets +1 × 3 = +3
      result.payoffs.forEach(p => {
        expect(p.delta).toBe(3);
      });
    });

    it('should track auto-submitted moves', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'C');
      await sessionManager.submitMove(session.id, 'p4', 'P', true); // auto

      const result = await sessionManager.resolveRound(session.id);

      const autoMove = result.payoffs.find(p => p.playerId === 'p4');
      expect(autoMove!.auto).toBe(true);
    });
  });

  describe('advanceRound', () => {
    let session: any;

    beforeEach(async () => {
      session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
    });

    it('should advance to next round', async () => {
      await sessionManager.submitMove(session.id, 'p1', 'C');
      await sessionManager.submitMove(session.id, 'p2', 'C');
      await sessionManager.submitMove(session.id, 'p3', 'C');
      await sessionManager.submitMove(session.id, 'p4', 'C');
      await sessionManager.resolveRound(session.id);

      await sessionManager.advanceRound(session.id);

      const updated = await sessionManager.getSession(session.id);
      expect(updated!.currentRound).toBe(2);
      expect(updated!.status).toBe('active');
    });

    it('should mark session complete after round 8', async () => {
      // Play through 8 rounds
      for (let round = 1; round <= 8; round++) {
        await sessionManager.submitMove(session.id, 'p1', 'C');
        await sessionManager.submitMove(session.id, 'p2', 'C');
        await sessionManager.submitMove(session.id, 'p3', 'C');
        await sessionManager.submitMove(session.id, 'p4', 'C');
        await sessionManager.resolveRound(session.id);
        await sessionManager.advanceRound(session.id);
      }

      const final = await sessionManager.getSession(session.id);
      expect(final!.status).toBe('complete');
    });
  });

  describe('Full game simulation', () => {
    it('should complete an all-Contribute game with total of 76', async () => {
      const session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);

      // Play 8 rounds, all Contribute
      for (let round = 1; round <= 8; round++) {
        await sessionManager.submitMove(session.id, 'p1', 'C');
        await sessionManager.submitMove(session.id, 'p2', 'C');
        await sessionManager.submitMove(session.id, 'p3', 'C');
        await sessionManager.submitMove(session.id, 'p4', 'C');
        await sessionManager.resolveRound(session.id);
        await sessionManager.advanceRound(session.id);
      }

      const final = await sessionManager.getSession(session.id);
      expect(final!.status).toBe('complete');

      const groupTotal = Object.values(final!.scores).reduce((sum, score) => sum + score, 0);
      expect(groupTotal).toBe(76);
    });

    it('should handle mixed strategy game correctly', async () => {
      const session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);

      const rounds: Move[][] = [
        ['C', 'C', 'C', 'C'], // Round 1: +4
        ['C', 'C', 'C', 'P'], // Round 2: +0 (3×-1, 1×+3)
        ['C', 'C', 'P', 'P'], // Round 3: +0
        ['C', 'C', 'C', 'C'], // Round 4: +12 (×3)
        ['P', 'P', 'P', 'C'], // Round 5: +0
        ['P', 'P', 'P', 'P'], // Round 6: -4
        ['C', 'C', 'P', 'P'], // Round 7: +0
        ['C', 'C', 'C', 'C']  // Round 8: +40 (×10)
      ];

      for (let round = 0; round < 8; round++) {
        const moves = rounds[round];
        await sessionManager.submitMove(session.id, 'p1', moves[0]);
        await sessionManager.submitMove(session.id, 'p2', moves[1]);
        await sessionManager.submitMove(session.id, 'p3', moves[2]);
        await sessionManager.submitMove(session.id, 'p4', moves[3]);
        await sessionManager.resolveRound(session.id);
        await sessionManager.advanceRound(session.id);
      }

      const final = await sessionManager.getSession(session.id);
      const groupTotal = Object.values(final!.scores).reduce((sum, score) => sum + score, 0);

      // Expected: 4+0+0+12+0-4+0+40 = 52
      expect(groupTotal).toBe(52);
    });
  });

  describe('abandonSession', () => {
    it('should mark session as abandoned', async () => {
      const session = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);

      await sessionManager.abandonSession(session.id);

      const updated = await sessionManager.getSession(session.id);
      expect(updated!.status).toBe('abandoned');
    });
  });

  describe('getRunSessions', () => {
    it('should retrieve all sessions for a run', async () => {
      await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
      await sessionManager.createSession('run1', ['p5', 'p6', 'p7', 'p8']);
      await sessionManager.createSession('run2', ['p9', 'p10', 'p11', 'p12']);

      const run1Sessions = await sessionManager.getRunSessions('run1');
      const run2Sessions = await sessionManager.getRunSessions('run2');

      expect(run1Sessions).toHaveLength(2);
      expect(run2Sessions).toHaveLength(1);
    });

    it('should filter sessions by status', async () => {
      const session1 = await sessionManager.createSession('run1', ['p1', 'p2', 'p3', 'p4']);
      const session2 = await sessionManager.createSession('run1', ['p5', 'p6', 'p7', 'p8']);

      await sessionManager.abandonSession(session1.id);

      const activeSessions = await sessionManager.getRunSessions('run1', 'active');
      const abandonedSessions = await sessionManager.getRunSessions('run1', 'abandoned');

      expect(activeSessions).toHaveLength(1);
      expect(abandonedSessions).toHaveLength(1);
    });
  });
});
