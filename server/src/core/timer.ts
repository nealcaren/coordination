/**
 * Round Timer Engine
 * Manages timers for game rounds with auto-submission on timeout
 */

interface RoundTimerCallback {
  onTimeout: (sessionId: string, round: number) => void;
  onComplete?: (sessionId: string, round: number) => void;
}

interface ActiveTimer {
  sessionId: string;
  round: number;
  startedAt: number;
  endsAt: number;
  duration: number;
  timeoutId: NodeJS.Timeout;
}

export class RoundTimer {
  private activeTimers: Map<string, ActiveTimer> = new Map();
  private callbacks: RoundTimerCallback;

  constructor(callbacks: RoundTimerCallback) {
    this.callbacks = callbacks;
  }

  /**
   * Start a timer for a round
   */
  startRound(sessionId: string, round: number, durationMs: number): void {
    // Cancel existing timer for this session if any
    this.cancelRound(sessionId);

    const now = Date.now();
    const endsAt = now + durationMs;

    const timeoutId = setTimeout(() => {
      this.handleTimeout(sessionId, round);
    }, durationMs);

    this.activeTimers.set(sessionId, {
      sessionId,
      round,
      startedAt: now,
      endsAt,
      duration: durationMs,
      timeoutId
    });
  }

  /**
   * Cancel a timer for a session (e.g., when all players submit early)
   */
  cancelRound(sessionId: string): void {
    const timer = this.activeTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer.timeoutId);
      this.activeTimers.delete(sessionId);

      // Optionally call completion callback
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(sessionId, timer.round);
      }
    }
  }

  /**
   * Get remaining time for a session in milliseconds
   */
  getTimeRemaining(sessionId: string): number {
    const timer = this.activeTimers.get(sessionId);
    if (!timer) return 0;

    const remaining = timer.endsAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Check if a timer is active for a session
   */
  isActive(sessionId: string): boolean {
    return this.activeTimers.has(sessionId);
  }

  /**
   * Get timer info for a session
   */
  getTimerInfo(sessionId: string): { round: number; endsAt: number; remaining: number } | null {
    const timer = this.activeTimers.get(sessionId);
    if (!timer) return null;

    return {
      round: timer.round,
      endsAt: timer.endsAt,
      remaining: this.getTimeRemaining(sessionId)
    };
  }

  /**
   * Handle timeout event
   */
  private handleTimeout(sessionId: string, round: number): void {
    const timer = this.activeTimers.get(sessionId);
    if (timer) {
      this.activeTimers.delete(sessionId);
      this.callbacks.onTimeout(sessionId, round);
    }
  }

  /**
   * Clear all timers (useful for testing/shutdown)
   */
  clearAll(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer.timeoutId);
    }
    this.activeTimers.clear();
  }

  /**
   * Get count of active timers
   */
  getActiveCount(): number {
    return this.activeTimers.size;
  }
}
