import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Database, getDatabase } from './state/database';
import { SessionManager } from './state/session';
import { Matchmaker } from './state/matchmaker';
import { GameSocketHandler } from './socket/handlers';
import { randomBytes } from 'crypto';
import { GameMode, GAME_MODES } from '../../shared/types';
import { calculateMaxGroupTotal } from './core/payoffs';

dotenv.config();

const PORT = process.env.PORT || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || './data/game.db';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CLIENT_URL || true  // In production, allow same-origin or specified URL
      : 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Global state
let db: Database;
let sessionManager: SessionManager;
const runs: Map<string, { matchmaker: Matchmaker; socketHandler: GameSocketHandler }> = new Map();

// Initialize database
async function initializeDatabase() {
  db = getDatabase(DATABASE_PATH);
  await db.initialize();
  sessionManager = new SessionManager(db);
  console.log('Database initialized');
}

// API Routes

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.get('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

/**
 * Create a new run (class session)
 */
app.post('/api/run/create', async (req, res) => {
  try {
    const { classCode, gameMode = 'classic' } = req.body;

    if (!classCode) {
      return res.status(400).json({ error: 'classCode is required' });
    }

    // Validate game mode
    if (!GAME_MODES[gameMode as GameMode]) {
      const validModes = Object.keys(GAME_MODES).join('", "');
      return res.status(400).json({ error: `Invalid gameMode. Must be one of: "${validModes}"` });
    }

    const runId = randomBytes(16).toString('hex');
    const dashboardToken = randomBytes(32).toString('hex');

    // Store run in database with game mode
    await db.run(
      'INSERT INTO runs (id, class_code, game_mode, created_at, dashboard_token) VALUES (?, ?, ?, ?, ?)',
      [runId, classCode, gameMode, Date.now(), dashboardToken]
    );

    // Create matchmaker and socket handler for this run
    const matchmaker = new Matchmaker(sessionManager, runId, gameMode as GameMode);
    const socketHandler = new GameSocketHandler(io, sessionManager, matchmaker, runId);

    runs.set(runId, { matchmaker, socketHandler });

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    res.json({
      runId,
      classCode,
      gameMode,
      dashboardUrl: `${baseUrl}/dashboard/${runId}?token=${dashboardToken}`
    });
  } catch (error) {
    console.error('Error creating run:', error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

/**
 * Get run status
 */
app.get('/api/run/:runId/status', async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await db.get<any>('SELECT * FROM runs WHERE id = ?', [runId]);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const activeSessions = await sessionManager.getRunSessions(runId, 'active');
    const completedSessions = await sessionManager.getRunSessions(runId, 'complete');

    const runData = runs.get(runId);
    const connectedCount = runData?.socketHandler.getConnectedCount() || 0;
    const queueSize = runData?.matchmaker.getQueueSize(run.class_code) || 0;

    res.json({
      runId: run.id,
      classCode: run.class_code,
      createdAt: run.created_at,
      connectedPlayers: connectedCount,
      queueSize,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length
    });
  } catch (error) {
    console.error('Error getting run status:', error);
    res.status(500).json({ error: 'Failed to get run status' });
  }
});

/**
 * Get metrics for dashboard
 */
app.get('/api/run/:runId/metrics', async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await db.get<any>('SELECT * FROM runs WHERE id = ?', [runId]);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const gameMode = (run.game_mode || 'classic') as GameMode;
    const config = GAME_MODES[gameMode];
    const firstMove = config.moves.first;

    // Get all sessions for this run
    const sessions = await sessionManager.getRunSessions(runId);
    const activeSessions = sessions.filter(s => s.status === 'active');
    const completedSessions = sessions.filter(s => s.status === 'complete');
    const abandonedSessions = sessions.filter(s => s.status === 'abandoned');

    const runData = runs.get(runId);
    const connectedCount = runData?.socketHandler.getConnectedCount() || 0;
    const queueSize = runData?.matchmaker.getQueueSize(run.class_code) || 0;

    // Get moves by round
    const movesByRound = await db.all<{ round: number; move: string; auto: number; count: number }>(
      `SELECT round, move, auto, COUNT(*) as count
       FROM moves
       WHERE session_id IN (SELECT id FROM sessions WHERE run_id = ?)
       GROUP BY round, move, auto`,
      [runId]
    );

    // Organize by round (use totalRounds from config)
    const byRound = [];
    for (let round = 1; round <= config.totalRounds; round++) {
      const roundMoves = movesByRound.filter(m => m.round === round);
      const firstCount = roundMoves.filter(m => m.move === firstMove).reduce((sum, m) => sum + m.count, 0);
      const secondCount = roundMoves.filter(m => m.move !== firstMove).reduce((sum, m) => sum + m.count, 0);
      const autoCount = roundMoves.filter(m => m.auto === 1).reduce((sum, m) => sum + m.count, 0);
      const total = firstCount + secondCount;

      byRound.push({
        round,
        firstCount,
        secondCount,
        autoCount,
        firstPercent: total > 0 ? Math.round((firstCount / total) * 100) : 0,
        secondPercent: total > 0 ? Math.round((secondCount / total) * 100) : 0
      });
    }

    // Calculate group totals
    const groupTotals = completedSessions.map(s =>
      Object.values(s.scores).reduce((sum, score) => sum + score, 0)
    );

    const avgGroupTotal = groupTotals.length > 0
      ? Math.round(groupTotals.reduce((sum, total) => sum + total, 0) / groupTotals.length)
      : 0;

    const medianGroupTotal = groupTotals.length > 0
      ? groupTotals.sort((a, b) => a - b)[Math.floor(groupTotals.length / 2)]
      : 0;

    // Get pattern distribution (from last round based on game mode)
    const lastRound = config.totalRounds;
    const patterns: Record<string, number> = gameMode === 'classic'
      ? { '4C': 0, '3C1P': 0, '2C2P': 0, '1C3P': 0, '4P': 0 }
      : { '4R': 0, '3R1B': 0, '2R2B': 0, '1R3B': 0, '4B': 0 };

    for (const session of completedSessions) {
      const lastRoundMoves = await sessionManager.getRoundMoves(session.id, lastRound);
      if (lastRoundMoves.length === 4) {
        const firstMoveCount = lastRoundMoves.filter(m => m.move === firstMove).length;
        if (gameMode === 'classic') {
          if (firstMoveCount === 4) patterns['4C']++;
          else if (firstMoveCount === 3) patterns['3C1P']++;
          else if (firstMoveCount === 2) patterns['2C2P']++;
          else if (firstMoveCount === 1) patterns['1C3P']++;
          else patterns['4P']++;
        } else {
          if (firstMoveCount === 4) patterns['4R']++;
          else if (firstMoveCount === 3) patterns['3R1B']++;
          else if (firstMoveCount === 2) patterns['2R2B']++;
          else if (firstMoveCount === 1) patterns['1R3B']++;
          else patterns['4B']++;
        }
      }
    }

    res.json({
      gameMode,
      connected: connectedCount,
      queue: queueSize,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      abandonedSessions: abandonedSessions.length,
      byRound,
      avgGroupTotal,
      medianGroupTotal,
      maxGroupTotal: calculateMaxGroupTotal(gameMode),
      patterns
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * Delete a run (for testing)
 */
app.delete('/api/run/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    // Cleanup socket handler
    const runData = runs.get(runId);
    if (runData) {
      runData.socketHandler.cleanup();
      runs.delete(runId);
    }

    // Delete from database (cascades to all related tables)
    await db.run('DELETE FROM runs WHERE id = ?', [runId]);
    await db.run('DELETE FROM sessions WHERE run_id = ?', [runId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting run:', error);
    res.status(500).json({ error: 'Failed to delete run' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // From dist/server/src/ go up to root, then to client/dist
  const clientDistPath = path.join(__dirname, '../../../../client/dist');

  // Serve static assets
  app.use(express.static(clientDistPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  console.log('Production mode: serving static files from', clientDistPath);
}

// Start server
async function start() {
  try {
    await initializeDatabase();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Socket.IO ready for connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

start();
