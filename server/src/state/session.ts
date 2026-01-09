import { Database } from './database';
import { Move, Session, RoundResult, SessionStatus, GameMode, GAME_MODES } from '../../../shared/types';
import { calculatePayoffs, getMultiplier, getGroupPattern, getFirstMoveCount } from '../core/payoffs';
import { randomBytes } from 'crypto';

export class SessionManager {
  constructor(private db: Database) {}

  /**
   * Generate a unique session ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Create a new session with 4 players
   */
  async createSession(runId: string, playerIds: string[], gameMode: GameMode = 'classic'): Promise<Session> {
    if (playerIds.length !== 4) {
      throw new Error('Session requires exactly 4 players');
    }

    const sessionId = this.generateId();
    const now = Date.now();

    // Insert session
    await this.db.run(
      'INSERT INTO sessions (id, run_id, game_mode, current_round, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, runId, gameMode, 1, 'active', now]
    );

    // Insert players
    for (const playerId of playerIds) {
      await this.db.run(
        'INSERT INTO session_players (session_id, player_id, score) VALUES (?, ?, ?)',
        [sessionId, playerId, 0]
      );
    }

    return {
      id: sessionId,
      runId,
      gameMode,
      players: playerIds,
      currentRound: 1,
      status: 'active',
      scores: Object.fromEntries(playerIds.map(id => [id, 0])),
      createdAt: now
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.db.get<any>(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (!session) return null;

    const players = await this.db.all<{ player_id: string; score: number }>(
      'SELECT player_id, score FROM session_players WHERE session_id = ?',
      [sessionId]
    );

    return {
      id: session.id,
      runId: session.run_id,
      gameMode: (session.game_mode || 'classic') as GameMode,
      players: players.map(p => p.player_id),
      currentRound: session.current_round,
      status: session.status as SessionStatus,
      scores: Object.fromEntries(players.map(p => [p.player_id, p.score])),
      createdAt: session.created_at
    };
  }

  /**
   * Submit a move for a player in the current round
   */
  async submitMove(
    sessionId: string,
    playerId: string,
    move: Move,
    auto: boolean = false
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    if (!session.players.includes(playerId)) {
      throw new Error('Player not in session');
    }

    const round = session.currentRound;

    // Check if move already submitted
    const existing = await this.db.get(
      'SELECT * FROM moves WHERE session_id = ? AND round = ? AND player_id = ?',
      [sessionId, round, playerId]
    );

    if (existing) {
      throw new Error('Move already submitted for this round');
    }

    // Insert move
    await this.db.run(
      'INSERT INTO moves (session_id, round, player_id, move, auto, submitted_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, round, playerId, move, auto ? 1 : 0, Date.now()]
    );
  }

  /**
   * Check if all players have submitted moves for current round
   */
  async allMovesSubmitted(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const moves = await this.db.all<{ move: string }>(
      'SELECT move FROM moves WHERE session_id = ? AND round = ?',
      [sessionId, session.currentRound]
    );

    const config = GAME_MODES[session.gameMode];
    return moves.length === config.groupSize;
  }

  /**
   * Resolve the current round and calculate payoffs
   */
  async resolveRound(sessionId: string): Promise<RoundResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const round = session.currentRound;
    const gameMode = session.gameMode;
    const config = GAME_MODES[gameMode];

    // Get all moves for this round
    const moveRows = await this.db.all<{ player_id: string; move: string; auto: number }>(
      'SELECT player_id, move, auto FROM moves WHERE session_id = ? AND round = ? ORDER BY player_id',
      [sessionId, round]
    );

    if (moveRows.length !== config.groupSize) {
      throw new Error('Not all moves submitted');
    }

    // Calculate payoffs based on game mode (pass round for durkheim mode)
    const moves = moveRows.map(m => m.move as Move);
    const payoffs = calculatePayoffs(moves, gameMode, round);
    const multiplier = getMultiplier(round, gameMode);
    const pattern = getGroupPattern(moves, gameMode);

    // Count first and second moves (C/P or R/B depending on mode)
    const firstCount = getFirstMoveCount(moves, gameMode);
    const secondCount = config.groupSize - firstCount;

    // Update player scores
    for (let i = 0; i < moveRows.length; i++) {
      const playerId = moveRows[i].player_id;
      const delta = payoffs[i].delta * multiplier;

      await this.db.run(
        'UPDATE session_players SET score = score + ? WHERE session_id = ? AND player_id = ?',
        [delta, sessionId, playerId]
      );
    }

    // Store round result
    await this.db.run(
      'INSERT INTO round_results (session_id, round, c_count, p_count, multiplier, resolved_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, round, firstCount, secondCount, multiplier, Date.now()]
    );

    // Get updated scores
    const updatedSession = await this.getSession(sessionId);
    if (!updatedSession) {
      throw new Error('Session disappeared');
    }

    return {
      round,
      multiplier,
      firstCount,
      secondCount,
      pattern,
      payoffs: moveRows.map((m, i) => ({
        playerId: m.player_id,
        move: m.move as Move,
        delta: payoffs[i].delta * multiplier,
        total: updatedSession.scores[m.player_id],
        auto: m.auto === 1
      })),
      resolvedAt: Date.now()
    };
  }

  /**
   * Advance to the next round
   */
  async advanceRound(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const config = GAME_MODES[session.gameMode];

    if (session.currentRound >= config.totalRounds) {
      // Game complete
      await this.db.run(
        'UPDATE sessions SET status = ? WHERE id = ?',
        ['complete', sessionId]
      );
    } else {
      // Next round
      await this.db.run(
        'UPDATE sessions SET current_round = current_round + 1 WHERE id = ?',
        [sessionId]
      );
    }
  }

  /**
   * Mark session as abandoned
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.db.run(
      'UPDATE sessions SET status = ? WHERE id = ?',
      ['abandoned', sessionId]
    );
  }

  /**
   * Get all sessions for a run
   */
  async getRunSessions(runId: string, status?: SessionStatus): Promise<Session[]> {
    let sql = 'SELECT id FROM sessions WHERE run_id = ?';
    const params: any[] = [runId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    const rows = await this.db.all<{ id: string }>(sql, params);
    const sessions = await Promise.all(
      rows.map(row => this.getSession(row.id))
    );

    return sessions.filter((s): s is Session => s !== null);
  }

  /**
   * Get moves for a specific round
   */
  async getRoundMoves(sessionId: string, round: number): Promise<Array<{ playerId: string; move: Move; auto: boolean }>> {
    const moves = await this.db.all<{ player_id: string; move: string; auto: number }>(
      'SELECT player_id, move, auto FROM moves WHERE session_id = ? AND round = ?',
      [sessionId, round]
    );

    return moves.map(m => ({
      playerId: m.player_id,
      move: m.move as Move,
      auto: m.auto === 1
    }));
  }
}
