import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionManager } from '../state/session';
import { Matchmaker } from '../state/matchmaker';
import { RoundTimer } from '../core/timer';
import { getMultiplier } from '../core/payoffs';
import { Move, GameMode, GAME_MODES } from '../../../shared/types';

const ROUND_DURATION_MS = 18000; // 18 seconds
const RESULTS_DISPLAY_MS = 10000;  // 10 seconds (longer to see leaderboard)

export class GameSocketHandler {
  private roundTimer: RoundTimer;
  private connectedPlayers: Map<string, { socket: Socket; classCode: string }> = new Map();

  constructor(
    private io: SocketIOServer,
    private sessionManager: SessionManager,
    private matchmaker: Matchmaker,
    private runId: string
  ) {
    this.roundTimer = new RoundTimer({
      onTimeout: this.handleRoundTimeout.bind(this),
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Join queue
      socket.on('join_queue', async (data: { classCode: string; displayName?: string }) => {
        try {
          const { classCode, displayName } = data;

          // Track connection
          this.connectedPlayers.set(socket.id, { socket, classCode });

          // Add to matchmaking queue
          this.matchmaker.joinQueue(socket.id, classCode);

          // Send queue update
          socket.emit('queue_update', {
            queueSize: this.matchmaker.getQueueSize(classCode)
          });

          // Try to match
          const session = await this.matchmaker.attemptMatch(classCode);

          if (session) {
            // Notify all players in the session
            for (const playerId of session.players) {
              const playerSocket = this.connectedPlayers.get(playerId)?.socket;
              if (playerSocket) {
                playerSocket.join(`session:${session.id}`);
                playerSocket.emit('match_found', {
                  sessionId: session.id,
                  players: session.players,
                  yourId: playerId,
                  gameMode: session.gameMode
                });
              }
            }

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

          this.matchmaker.joinQueue(socket.id, classCode);

          socket.emit('queue_update', {
            queueSize: this.matchmaker.getQueueSize(classCode)
          });

          const session = await this.matchmaker.attemptMatch(classCode);

          if (session) {
            for (const playerId of session.players) {
              const playerSocket = this.connectedPlayers.get(playerId)?.socket;
              if (playerSocket) {
                playerSocket.join(`session:${session.id}`);
                playerSocket.emit('match_found', {
                  sessionId: session.id,
                  players: session.players,
                  yourId: playerId,
                  gameMode: session.gameMode
                });
              }
            }

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

        // Remove from queue if present
        this.matchmaker.leaveQueue(socket.id);

        // Remove from connected players
        this.connectedPlayers.delete(socket.id);

        // Note: In production, we'd handle session abandonment here
        // with a 25-second grace period for reconnection
      });
    });
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
   * Get count of connected players
   */
  getConnectedCount(): number {
    return this.connectedPlayers.size;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.roundTimer.clearAll();
    this.connectedPlayers.clear();
  }
}
