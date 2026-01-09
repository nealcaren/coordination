import { Database } from '../src/state/database';
import { SessionManager } from '../src/state/session';
import { Matchmaker } from '../src/state/matchmaker';
import fs from 'fs';

describe('Matchmaker', () => {
  let db: Database;
  let sessionManager: SessionManager;
  let matchmaker: Matchmaker;
  const testDbPath = './test-matchmaker.db';

  beforeEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    await db.initialize();
    sessionManager = new SessionManager(db);
    matchmaker = new Matchmaker(sessionManager, 'test-run');
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('joinQueue', () => {
    it('should add player to queue', () => {
      matchmaker.joinQueue('p1', 'CLASS1');

      expect(matchmaker.isInQueue('p1')).toBe(true);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(1);
    });

    it('should handle multiple players', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS1');

      expect(matchmaker.getQueueSize('CLASS1')).toBe(3);
    });

    it('should separate queues by class code', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS2');

      expect(matchmaker.getQueueSize('CLASS1')).toBe(2);
      expect(matchmaker.getQueueSize('CLASS2')).toBe(1);
    });
  });

  describe('leaveQueue', () => {
    it('should remove player from queue', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.leaveQueue('p1');

      expect(matchmaker.isInQueue('p1')).toBe(false);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(0);
    });

    it('should handle removing non-existent player', () => {
      expect(() => matchmaker.leaveQueue('p99')).not.toThrow();
    });
  });

  describe('attemptMatch', () => {
    it('should return null when less than 4 players', async () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS1');

      const session = await matchmaker.attemptMatch('CLASS1');
      expect(session).toBeNull();
    });

    it('should create session when exactly 4 players', async () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS1');
      matchmaker.joinQueue('p4', 'CLASS1');

      const session = await matchmaker.attemptMatch('CLASS1');

      expect(session).not.toBeNull();
      expect(session!.players).toHaveLength(4);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(0);
    });

    it('should create session with first 4 when more than 4 players', async () => {
      for (let i = 1; i <= 7; i++) {
        matchmaker.joinQueue(`p${i}`, 'CLASS1');
      }

      const session = await matchmaker.attemptMatch('CLASS1');

      expect(session).not.toBeNull();
      expect(session!.players).toHaveLength(4);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(3); // 3 remain
    });

    it('should remove matched players from queue', async () => {
      const playerIds = ['p1', 'p2', 'p3', 'p4'];
      playerIds.forEach(id => matchmaker.joinQueue(id, 'CLASS1'));

      const session = await matchmaker.attemptMatch('CLASS1');

      expect(session).not.toBeNull();
      playerIds.forEach(id => {
        expect(matchmaker.isInQueue(id)).toBe(false);
      });
    });

    it('should create randomized groups (not always same order)', async () => {
      // This test checks for randomness by running multiple matches
      // and verifying that not all groups have players in the same order

      const firstPlayerIds: string[] = [];

      for (let trial = 0; trial < 10; trial++) {
        matchmaker.clearQueue();

        for (let i = 1; i <= 8; i++) {
          matchmaker.joinQueue(`p${i}`, 'CLASS1');
        }

        const session = await matchmaker.attemptMatch('CLASS1');
        firstPlayerIds.push(session!.players[0]);
      }

      // If truly random, we should see different first players
      const uniqueFirstPlayers = new Set(firstPlayerIds);
      expect(uniqueFirstPlayers.size).toBeGreaterThan(1);
    });
  });

  describe('matchAll', () => {
    it('should match multiple groups', async () => {
      // Add 10 players: should form 2 groups, 2 remain
      for (let i = 1; i <= 10; i++) {
        matchmaker.joinQueue(`p${i}`, 'CLASS1');
      }

      const sessions = await matchmaker.matchAll('CLASS1');

      expect(sessions).toHaveLength(2);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(2);
    });

    it('should match all possible groups', async () => {
      // Add 16 players: should form 4 groups, 0 remain
      for (let i = 1; i <= 16; i++) {
        matchmaker.joinQueue(`p${i}`, 'CLASS1');
      }

      const sessions = await matchmaker.matchAll('CLASS1');

      expect(sessions).toHaveLength(4);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(0);
    });

    it('should return empty array when less than 4 players', async () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');

      const sessions = await matchmaker.matchAll('CLASS1');

      expect(sessions).toHaveLength(0);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(2);
    });
  });

  describe('getQueuedPlayers', () => {
    it('should return queued players for class', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS2');

      const class1Players = matchmaker.getQueuedPlayers('CLASS1');

      expect(class1Players).toHaveLength(2);
      expect(class1Players.map(p => p.playerId)).toEqual(expect.arrayContaining(['p1', 'p2']));
    });

    it('should include join timestamps', () => {
      const before = Date.now();
      matchmaker.joinQueue('p1', 'CLASS1');
      const after = Date.now();

      const players = matchmaker.getQueuedPlayers('CLASS1');

      expect(players[0].joinedAt).toBeGreaterThanOrEqual(before);
      expect(players[0].joinedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('clearQueue', () => {
    it('should remove all players from queue', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');
      matchmaker.joinQueue('p3', 'CLASS2');

      matchmaker.clearQueue();

      expect(matchmaker.getQueueSize('CLASS1')).toBe(0);
      expect(matchmaker.getQueueSize('CLASS2')).toBe(0);
    });
  });

  describe('removeStaleEntries', () => {
    it('should remove players who have been waiting too long', async () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      matchmaker.joinQueue('p3', 'CLASS1');

      // Remove entries older than 50ms
      const removed = matchmaker.removeStaleEntries(50);

      expect(removed).toBe(2); // p1 and p2
      expect(matchmaker.getQueueSize('CLASS1')).toBe(1); // only p3 remains
      expect(matchmaker.isInQueue('p3')).toBe(true);
    });

    it('should not remove recent entries', () => {
      matchmaker.joinQueue('p1', 'CLASS1');
      matchmaker.joinQueue('p2', 'CLASS1');

      const removed = matchmaker.removeStaleEntries(60000); // 1 minute

      expect(removed).toBe(0);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(2);
    });
  });

  describe('Multi-class scenario', () => {
    it('should handle multiple classes independently', async () => {
      // Class 1: 5 players
      for (let i = 1; i <= 5; i++) {
        matchmaker.joinQueue(`class1-p${i}`, 'CLASS1');
      }

      // Class 2: 4 players
      for (let i = 1; i <= 4; i++) {
        matchmaker.joinQueue(`class2-p${i}`, 'CLASS2');
      }

      // Match Class 1
      const class1Sessions = await matchmaker.matchAll('CLASS1');
      expect(class1Sessions).toHaveLength(1);
      expect(matchmaker.getQueueSize('CLASS1')).toBe(1);

      // Match Class 2
      const class2Sessions = await matchmaker.matchAll('CLASS2');
      expect(class2Sessions).toHaveLength(1);
      expect(matchmaker.getQueueSize('CLASS2')).toBe(0);

      // Verify no cross-contamination
      expect(matchmaker.getQueueSize('CLASS1')).toBe(1); // Still 1 waiting
    });
  });

  describe('Real-world simulation', () => {
    it('should handle 200 students joining and matching', async () => {
      // Simulate 200 students joining
      for (let i = 1; i <= 200; i++) {
        matchmaker.joinQueue(`student${i}`, 'SOCI101');
      }

      // Match all
      const sessions = await matchmaker.matchAll('SOCI101');

      // Should create 50 groups (200 / 4)
      expect(sessions).toHaveLength(50);
      expect(matchmaker.getQueueSize('SOCI101')).toBe(0);

      // Verify all sessions have 4 players
      sessions.forEach(session => {
        expect(session.players).toHaveLength(4);
      });

      // Verify all students are in a session (no duplicates)
      const allPlayers = sessions.flatMap(s => s.players);
      const uniquePlayers = new Set(allPlayers);
      expect(uniquePlayers.size).toBe(200);
    }, 15000); // Increase timeout for this test
  });
});
