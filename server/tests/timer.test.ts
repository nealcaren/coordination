import { RoundTimer } from '../src/core/timer';

describe('RoundTimer', () => {
  let timer: RoundTimer;
  let timeoutCalls: Array<{ sessionId: string; round: number }> = [];
  let completeCalls: Array<{ sessionId: string; round: number }> = [];

  beforeEach(() => {
    timeoutCalls = [];
    completeCalls = [];

    timer = new RoundTimer({
      onTimeout: (sessionId, round) => {
        timeoutCalls.push({ sessionId, round });
      },
      onComplete: (sessionId, round) => {
        completeCalls.push({ sessionId, round });
      }
    });
  });

  afterEach(() => {
    timer.clearAll();
  });

  describe('startRound', () => {
    it('should start a timer', () => {
      timer.startRound('session1', 1, 1000);

      expect(timer.isActive('session1')).toBe(true);
      expect(timer.getActiveCount()).toBe(1);
    });

    it('should track timer info', () => {
      const before = Date.now();
      timer.startRound('session1', 3, 5000);
      const after = Date.now();

      const info = timer.getTimerInfo('session1');
      expect(info).not.toBeNull();
      expect(info!.round).toBe(3);
      expect(info!.endsAt).toBeGreaterThanOrEqual(before + 5000);
      expect(info!.endsAt).toBeLessThanOrEqual(after + 5000);
      expect(info!.remaining).toBeGreaterThan(4900);
      expect(info!.remaining).toBeLessThanOrEqual(5000);
    });

    it('should replace existing timer for same session', () => {
      timer.startRound('session1', 1, 5000);
      timer.startRound('session1', 2, 3000);

      const info = timer.getTimerInfo('session1');
      expect(info!.round).toBe(2);
      expect(timer.getActiveCount()).toBe(1);
    });

    it('should handle multiple sessions independently', () => {
      timer.startRound('session1', 1, 1000);
      timer.startRound('session2', 1, 2000);
      timer.startRound('session3', 1, 3000);

      expect(timer.getActiveCount()).toBe(3);
      expect(timer.isActive('session1')).toBe(true);
      expect(timer.isActive('session2')).toBe(true);
      expect(timer.isActive('session3')).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return remaining time', async () => {
      timer.startRound('session1', 1, 1000);

      const remaining1 = timer.getTimeRemaining('session1');
      expect(remaining1).toBeGreaterThan(900);
      expect(remaining1).toBeLessThanOrEqual(1000);

      await new Promise(resolve => setTimeout(resolve, 500));

      const remaining2 = timer.getTimeRemaining('session1');
      expect(remaining2).toBeGreaterThan(400);
      expect(remaining2).toBeLessThan(600);
    });

    it('should return 0 for non-existent timer', () => {
      expect(timer.getTimeRemaining('non-existent')).toBe(0);
    });

    it('should return 0 after timer completes', async () => {
      timer.startRound('session1', 1, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timer.getTimeRemaining('session1')).toBe(0);
    });
  });

  describe('cancelRound', () => {
    it('should cancel active timer', () => {
      timer.startRound('session1', 1, 5000);
      timer.cancelRound('session1');

      expect(timer.isActive('session1')).toBe(false);
      expect(timer.getActiveCount()).toBe(0);
    });

    it('should call onComplete callback when cancelled', () => {
      timer.startRound('session1', 2, 5000);
      timer.cancelRound('session1');

      expect(completeCalls).toHaveLength(1);
      expect(completeCalls[0]).toEqual({ sessionId: 'session1', round: 2 });
    });

    it('should not throw for non-existent timer', () => {
      expect(() => timer.cancelRound('non-existent')).not.toThrow();
    });

    it('should prevent timeout callback after cancellation', async () => {
      timer.startRound('session1', 1, 100);
      timer.cancelRound('session1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timeoutCalls).toHaveLength(0);
    });
  });

  describe('timeout callback', () => {
    it('should call onTimeout when timer expires', async () => {
      timer.startRound('session1', 3, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timeoutCalls).toHaveLength(1);
      expect(timeoutCalls[0]).toEqual({ sessionId: 'session1', round: 3 });
    });

    it('should remove timer from active list after timeout', async () => {
      timer.startRound('session1', 1, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timer.isActive('session1')).toBe(false);
      expect(timer.getActiveCount()).toBe(0);
    });

    it('should handle multiple timeouts independently', async () => {
      timer.startRound('session1', 1, 100);
      timer.startRound('session2', 1, 200);
      timer.startRound('session3', 1, 300);

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 350));

      // All three should have timed out
      expect(timeoutCalls).toHaveLength(3);

      // Verify all sessions were called
      const sessionIds = timeoutCalls.map(t => t.sessionId);
      expect(sessionIds).toContain('session1');
      expect(sessionIds).toContain('session2');
      expect(sessionIds).toContain('session3');
    });
  });

  describe('isActive', () => {
    it('should return true for active timer', () => {
      timer.startRound('session1', 1, 1000);
      expect(timer.isActive('session1')).toBe(true);
    });

    it('should return false for non-existent timer', () => {
      expect(timer.isActive('non-existent')).toBe(false);
    });

    it('should return false after cancellation', () => {
      timer.startRound('session1', 1, 1000);
      timer.cancelRound('session1');
      expect(timer.isActive('session1')).toBe(false);
    });

    it('should return false after timeout', async () => {
      timer.startRound('session1', 1, 100);
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(timer.isActive('session1')).toBe(false);
    });
  });

  describe('getTimerInfo', () => {
    it('should return null for non-existent timer', () => {
      expect(timer.getTimerInfo('non-existent')).toBeNull();
    });

    it('should return complete timer info', () => {
      const before = Date.now();
      timer.startRound('session1', 5, 10000);
      const after = Date.now();

      const info = timer.getTimerInfo('session1');
      expect(info).not.toBeNull();
      expect(info!.round).toBe(5);
      expect(info!.endsAt).toBeGreaterThanOrEqual(before + 10000);
      expect(info!.endsAt).toBeLessThanOrEqual(after + 10000);
      expect(info!.remaining).toBeGreaterThan(9900);
    });
  });

  describe('clearAll', () => {
    it('should clear all active timers', () => {
      timer.startRound('session1', 1, 5000);
      timer.startRound('session2', 1, 5000);
      timer.startRound('session3', 1, 5000);

      timer.clearAll();

      expect(timer.getActiveCount()).toBe(0);
      expect(timer.isActive('session1')).toBe(false);
      expect(timer.isActive('session2')).toBe(false);
      expect(timer.isActive('session3')).toBe(false);
    });

    it('should prevent timeouts after clearAll', async () => {
      timer.startRound('session1', 1, 100);
      timer.startRound('session2', 1, 100);

      timer.clearAll();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(timeoutCalls).toHaveLength(0);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(timer.getActiveCount()).toBe(0);
    });

    it('should track active timer count', () => {
      timer.startRound('session1', 1, 1000);
      expect(timer.getActiveCount()).toBe(1);

      timer.startRound('session2', 1, 1000);
      expect(timer.getActiveCount()).toBe(2);

      timer.cancelRound('session1');
      expect(timer.getActiveCount()).toBe(1);

      timer.cancelRound('session2');
      expect(timer.getActiveCount()).toBe(0);
    });
  });

  describe('Real-world scenario', () => {
    it('should handle typical game round flow', async () => {
      // Start round 1 with 18 second timer
      timer.startRound('session1', 1, 18000);

      expect(timer.isActive('session1')).toBe(true);

      // Simulate all players submitting early (after 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 100));
      timer.cancelRound('session1');

      // Should not timeout since cancelled
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(timeoutCalls).toHaveLength(0);
      expect(completeCalls).toHaveLength(1);
    });

    it('should handle timeout scenario', async () => {
      // Start round with 200ms timer
      timer.startRound('session1', 4, 200);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should have triggered timeout
      expect(timeoutCalls).toHaveLength(1);
      expect(timeoutCalls[0]).toEqual({ sessionId: 'session1', round: 4 });
      expect(timer.isActive('session1')).toBe(false);
    });
  });
});
