import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionManager } from '../state/session';
import { Matchmaker } from '../state/matchmaker';
import { RoundTimer } from '../core/timer';
import { getMultiplier } from '../core/payoffs';
import { Move, GameMode, GAME_MODES } from '../../../shared/types';

const ROUND_DURATION_MS = 18000; // 18 seconds
const RESULTS_DISPLAY_MS = 10000;  // 10 seconds (longer to see leaderboard)

// Track connected players globally (shared across all runs)
const globalConnectedPlayers: Map<string, { socket: Socket; classCode: string; runId: string }> = new Map();

// Track runs and their matchmakers
const runMatchmakers: Map<string, { matchmaker: Matchmaker; gameMode: GameMode }> = new Map();

export class GameSocketHandler {
  private roundTimer: RoundTimer;
  private static initialized = false;

  constructor(
    private io: SocketIOServer,
    private sessionManager: SessionManager,
    private matchmaker: Matchmaker,
    private runId: string
  ) {
    this.roundTimer = new RoundTimer({
      onTimeout: this.handleRoundTimeout.bind(this),
    });

    // Register this run's matchmaker
    runMatchmakers.set(runId, {
      matchmaker,
      gameMode: matchmaker.getGameMode ? matchmaker.getGameMode() : 'classic'
    });

    // Only set up socket handlers once (singleton pattern)
    if (!GameSocketHandler.initialized) {
      GameSocketHandler.initialized = true;
      this.setupSocketHandlers();
    }
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Join queue
      socket.on('join_queue', async (data: { classCode: string; displayName?: string }) => {
        try {
          const { classCode } = data;

          // Find the run for this class code
          const runInfo = await this.findRunByClassCode(classCode);
          if (!runInfo) {
            socket.emit('error', { message: 'Invalid class code' });
            return;
          }

          const { runId, matchmaker, gameMode } = runInfo;

          // Track connection with runId
          globalConnectedPlayers.set(socket.id, { socket, classCode, runId });

          // Join class code room for broadcasts
          socket.join(`class:${classCode}`);

          // Add to matchmaking queue
          matchmaker.joinQueue(socket.id, classCode);

          const groupSize = GAME_MODES[gameMode].groupSize;
          const queueSize = matchmaker.getQueueSize(classCode);

          // Broadcast queue update to ALL players in this class
          this.io.to(`class:${classCode}`).emit('queue_update', {
            queueSize,
            gameMode,
            groupSize
          });

          // Try to match
          const session = await matchmaker.attemptMatch(classCode);

          if (session) {
            // Notify all players in the session
            for (const playerId of session.players) {
              const playerInfo = globalConnectedPlayers.get(playerId);
              if (playerInfo) {
                playerInfo.socket.join(`session:${session.id}`);
                playerInfo.socket.leave(`class:${classCode}`); // Leave queue room
                playerInfo.socket.emit('match_found', {
                  sessionId: session.id,
                  players: session.players,
                  yourId: playerId,
                  gameMode: session.gameMode
                });
              }
            }

            // Broadcast updated queue size to remaining players
            const newQueueSize = matchmaker.getQueueSize(classCode);
            this.io.to(`class:${classCode}`).emit('queue_update', {
              queueSize: newQueueSize,
              gameMode,
              groupSize
            });

            // Start round 1
            await this.startRound(session.id, 1);
          }
        } catch (error) {
          console.error('Error in join_queue:', error);
          socket.emit('error', { message: 'Failed to join queue' });
        }
      });

      // Submit move
      socket.on('submit_move', async (data: { sessionId: string; round: number; move: Move }) => {
        try {
          const { sessionId, round, move } = data;

          // Submit the move
          await this.sessionManager.submitMove(sessionId, socket.id, move, false);

          // Acknowledge
          socket.emit('move_ack', { round });

          // Check if all moves submitted
          const allSubmitted = await this.sessionManager.allMovesSubmitted(sessionId);

          if (allSubmitted) {
            // Cancel timer and resolve immediately
            this.roundTimer.cancelRound(sessionId);
            await this.resolveRound(sessionId);
          }
        } catch (error) {
          console.error('Error in submit_move:', error);
          socket.emit('error', { message: 'Failed to submit move' });
        }
      });

      // Requeue after game complete
      socket.on('requeue', async (data: { classCode: string }) => {
        try {
          const { classCode } = data;

          const runInfo = await this.findRunByClassCode(classCode);
          if (!runInfo) {
            socket.emit('error', { message: 'Invalid class code' });
            return;
          }

          const { runId, matchmaker, gameMode } = runInfo;

          // Update tracking
          globalConnectedPlayers.set(socket.id, { socket, classCode, runId });
          socket.join(`class:${classCode}`);

          matchmaker.joinQueue(socket.id, classCode);

          const groupSize = GAME_MODES[gameMode].groupSize;
          const queueSize = matchmaker.getQueueSize(classCode);

          // Broadcast to all waiting
          this.io.to(`class:${classCode}`).emit('queue_update', {
            queueSize,
            gameMode,
            groupSize
          });

          const session = await matchmaker.attemptMatch(classCode);

          if (session) {
            for (const playerId of session.players) {
              const playerInfo = globalConnectedPlayers.get(playerId);
              if (playerInfo) {
                playerInfo.socket.join(`session:${session.id}`);
                playerInfo.socket.leave(`class:${classCode}`);
                playerInfo.socket.emit('match_found', {
                  sessionId: session.id,
                  players: session.players,
                  yourId: playerId,
                  gameMode: session.gameMode
                });
              }
            }

            // Update remaining queue
            const newQueueSize = matchmaker.getQueueSize(classCode);
            this.io.to(`class:${classCode}`).emit('queue_update', {
              queueSize: newQueueSize,
              gameMode,
              groupSize
            });

            await this.startRound(session.id, 1);
          }
        } catch (error) {
          console.error('Error in requeue:', error);
          socket.emit('error', { message: 'Failed to requeue' });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        const playerInfo = globalConnectedPlayers.get(socket.id);
        if (playerInfo) {
          const runData = runMatchmakers.get(playerInfo.runId);
          if (runData) {
            runData.matchmaker.leaveQueue(socket.id);

            // Broadcast updated queue to remaining players
            const queueSize = runData.matchmaker.getQueueSize(playerInfo.classCode);
            const groupSize = GAME_MODES[runData.gameMode].groupSize;
            this.io.to(`class:${playerInfo.classCode}`).emit('queue_update', {
              queueSize,
              gameMode: runData.gameMode,
              groupSize
            });
          }
        }

        globalConnectedPlayers.delete(socket.id);
      });
    });
  }

  /**
   * Find the run info for a given class code
   */
  private async findRunByClassCode(classCode: string): Promise<{ runId: string; matchmaker: Matchmaker; gameMode: GameMode } | null> {
    // Look up the run in the database
    const db = (this.sessionManager as any).db;
    const run = await db.get(
      'SELECT id, game_mode FROM runs WHERE class_code = ? ORDER BY created_at DESC LIMIT 1',
      [classCode]
    ) as { id: string; game_mode: string } | undefined;

    if (!run) return null;

    const runData = runMatchmakers.get(run.id);
    if (!runData) return null;

    return {
      runId: run.id,
      matchmaker: runData.matchmaker,
      gameMode: run.game_mode as GameMode
    };
  }

  /**
   * Start a new round
   */
  private async startRound(sessionId: string, round: number): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) return;

    const config = GAME_MODES[session.gameMode];
    const multiplier = getMultiplier(round, session.gameMode);
    const endsAt = Date.now() + ROUND_DURATION_MS;

    this.io.to(`session:${sessionId}`).emit('round_start', {
      round,
      totalRounds: config.totalRounds,
      endsAt,
      multiplier,
      gameMode: session.gameMode
    });

    // Start the timer
    this.roundTimer.startRound(sessionId, round, ROUND_DURATION_MS);
  }

  /**
   * Handle round timeout (auto-submit default move for missing players)
   */
  private async handleRoundTimeout(sessionId: string, round: number): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) return;

      const config = GAME_MODES[session.gameMode];
      const defaultMove = config.defaultMove;

      // Auto-submit default move for players who haven't moved
      for (const playerId of session.players) {
        const moves = await this.sessionManager.getRoundMoves(sessionId, round);
        const hasSubmitted = moves.some(m => m.playerId === playerId);

        if (!hasSubmitted) {
          await this.sessionManager.submitMove(sessionId, playerId, defaultMove, true);
        }
      }

      // Resolve the round
      await this.resolveRound(sessionId);
    } catch (error) {
      console.error('Error in handleRoundTimeout:', error);
    }
  }

  /**
   * Resolve a round and broadcast results
   */
  private async resolveRound(sessionId: string): Promise<void> {
    try {
      const result = await this.sessionManager.resolveRound(sessionId);
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) return;

      // Get all player totals for leaderboard (sorted by score)
      const leaderboard = result.payoffs
        .map(p => ({ playerId: p.playerId, total: p.total }))
        .sort((a, b) => b.total - a.total);

      // Broadcast results (WITHOUT individual player moves for anonymity)
      this.io.to(`session:${sessionId}`).emit('round_results', {
        round: result.round,
        multiplier: result.multiplier,
        gameMode: session.gameMode,
        pattern: {
          firstCount: result.firstCount,
          secondCount: result.secondCount
        },
        // Send each player their individual delta and total
        deltas: result.payoffs.map(p => ({
          playerId: p.playerId,
          delta: p.delta,
          total: p.total
        })),
        // Send leaderboard for display
        leaderboard
      });

      // Wait for results display time, then advance
      setTimeout(async () => {
        await this.advanceOrComplete(sessionId, result.round);
      }, RESULTS_DISPLAY_MS);
    } catch (error) {
      console.error('Error in resolveRound:', error);
    }
  }

  /**
   * Advance to next round or complete the game
   */
  private async advanceOrComplete(sessionId: string, currentRound: number): Promise<void> {
    try {
      await this.sessionManager.advanceRound(sessionId);

      const session = await this.sessionManager.getSession(sessionId);
      if (!session) return;

      if (session.status === 'complete') {
        // Game complete
        const groupTotal = Object.values(session.scores).reduce((sum, score) => sum + score, 0);

        this.io.to(`session:${sessionId}`).emit('game_complete', {
          finalScores: session.scores,
          groupTotal
        });
      } else {
        // Start next round
        this.startRound(sessionId, session.currentRound);
      }
    } catch (error) {
      console.error('Error in advanceOrComplete:', error);
    }
  }

  /**
   * Get count of connected players for this run
   */
  getConnectedCount(): number {
    let count = 0;
    for (const player of globalConnectedPlayers.values()) {
      if (player.runId === this.runId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.roundTimer.clearAll();
    // Remove this run's matchmaker
    runMatchmakers.delete(this.runId);
    // Remove players from this run
    for (const [socketId, player] of globalConnectedPlayers.entries()) {
      if (player.runId === this.runId) {
        globalConnectedPlayers.delete(socketId);
      }
    }
  }
}
