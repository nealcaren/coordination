import { SessionManager } from './session';
import { Session, GameMode, GAME_MODES } from '../../../shared/types';

interface QueuedPlayer {
  playerId: string;
  classCode: string;
  joinedAt: number;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Matchmaker {
  // In-memory queue - transient, doesn't need persistence
  private playerQueue: Map<string, QueuedPlayer> = new Map();
  private gameMode: GameMode = 'classic';

  constructor(
    private sessionManager: SessionManager,
    private runId: string,
    gameMode: GameMode = 'classic'
  ) {
    this.gameMode = gameMode;
  }

  /**
   * Set the game mode for this matchmaker
   */
  setGameMode(gameMode: GameMode): void {
    this.gameMode = gameMode;
  }

  /**
   * Add a player to the matchmaking queue
   */
  joinQueue(playerId: string, classCode: string): void {
    this.playerQueue.set(playerId, {
      playerId,
      classCode,
      joinedAt: Date.now()
    });
  }

  /**
   * Remove a player from the queue
   */
  leaveQueue(playerId: string): void {
    this.playerQueue.delete(playerId);
  }

  /**
   * Get current queue size for a class code
   */
  getQueueSize(classCode: string): number {
    return Array.from(this.playerQueue.values())
      .filter(p => p.classCode === classCode)
      .length;
  }

  /**
   * Get all players in queue for a class code
   */
  getQueuedPlayers(classCode: string): QueuedPlayer[] {
    return Array.from(this.playerQueue.values())
      .filter(p => p.classCode === classCode);
  }

  /**
   * Get the required group size for the current game mode
   */
  getGroupSize(): number {
    return GAME_MODES[this.gameMode].groupSize;
  }

  /**
   * Attempt to match players into a group
   * Group size is determined by the game mode (4 for classic, 6 for solidarity)
   * Returns the created session if successful, null otherwise
   */
  async attemptMatch(classCode: string): Promise<Session | null> {
    const waiting = this.getQueuedPlayers(classCode);
    const groupSize = this.getGroupSize();

    if (waiting.length < groupSize) {
      return null; // Not enough players
    }

    // Take up to 2x group size players, shuffle, and form a group
    // This ensures randomness and prevents queue-order bias
    const candidates = waiting.slice(0, Math.min(groupSize * 2, waiting.length));
    const shuffled = shuffle(candidates);
    const matched = shuffled.slice(0, groupSize);

    // Remove matched players from queue
    matched.forEach(p => this.playerQueue.delete(p.playerId));

    // Create session with game mode
    const session = await this.sessionManager.createSession(
      this.runId,
      matched.map(p => p.playerId),
      this.gameMode
    );

    return session;
  }

  /**
   * Continuously try to match players while possible
   * Returns array of created sessions
   */
  async matchAll(classCode: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const groupSize = this.getGroupSize();

    while (this.getQueueSize(classCode) >= groupSize) {
      const session = await this.attemptMatch(classCode);
      if (session) {
        sessions.push(session);
      } else {
        break;
      }
    }

    return sessions;
  }

  /**
   * Check if a player is in the queue
   */
  isInQueue(playerId: string): boolean {
    return this.playerQueue.has(playerId);
  }

  /**
   * Clear the entire queue (useful for testing)
   */
  clearQueue(): void {
    this.playerQueue.clear();
  }

  /**
   * Remove players who have been waiting too long (optional timeout feature)
   */
  removeStaleEntries(maxWaitMs: number = 5 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [playerId, player] of this.playerQueue.entries()) {
      if (now - player.joinedAt > maxWaitMs) {
        this.playerQueue.delete(playerId);
        removed++;
      }
    }

    return removed;
  }
}
