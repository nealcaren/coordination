import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './data/game.db') {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database:', dbPath);
      }
    });

    // Enable WAL mode for better concurrency
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async initialize(): Promise<void> {
    const schema = `
      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        game_mode TEXT DEFAULT 'classic',
        current_round INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL
      );

      -- Players in sessions
      CREATE TABLE IF NOT EXISTS session_players (
        session_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        PRIMARY KEY (session_id, player_id),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Moves for each round
      CREATE TABLE IF NOT EXISTS moves (
        session_id TEXT NOT NULL,
        round INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        move TEXT NOT NULL,
        auto INTEGER DEFAULT 0,
        submitted_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, round, player_id),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Round results
      CREATE TABLE IF NOT EXISTS round_results (
        session_id TEXT NOT NULL,
        round INTEGER NOT NULL,
        c_count INTEGER NOT NULL,
        p_count INTEGER NOT NULL,
        multiplier INTEGER NOT NULL,
        resolved_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, round),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Runs (class sessions)
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        class_code TEXT NOT NULL,
        game_mode TEXT DEFAULT 'classic',
        created_at INTEGER NOT NULL,
        dashboard_token TEXT NOT NULL
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_sessions_run_id ON sessions(run_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_moves_session_round ON moves(session_id, round);
      CREATE INDEX IF NOT EXISTS idx_round_results_session ON round_results(session_id);
    `;

    await this.exec(schema);
    console.log('Database schema initialized');
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(dbPath?: string): Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
