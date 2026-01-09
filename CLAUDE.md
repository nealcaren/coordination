# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Coordination Games** is an online, mobile-friendly educational sociology simulation for classroom use. Students are randomly matched into groups and make strategic choices across multiple rounds without knowing others' choices in advance. The system is designed to handle 400 concurrent students in a live classroom setting.

This is a sociology teaching tool, not a game optimization exercise. The simulation reveals social processes: trust formation, norm emergence, collective action problems, and the tension between individual incentives and collective outcomes. All design decisions should preserve ambiguity and let meaning emerge through student experience rather than explicit instruction.

## Development Commands

```bash
# Install all dependencies (monorepo with workspaces)
npm install

# Start both frontend and backend in development mode
npm run dev

# Start only the server (with hot reload)
npm run dev:server    # runs on port 3000

# Start only the client (Vite dev server)
npm run dev:client    # runs on port 3001

# Run tests
npm test              # runs server tests with Jest

# Run tests with coverage (90% threshold)
cd server && npm run test:coverage

# Run tests in watch mode
cd server && npm run test:watch

# Build for production
npm run build         # builds both server and client

# Start production server
npm start
```

## Architecture

### Monorepo Structure
```
├── client/           # React frontend (Vite, ESM)
│   └── src/
│       ├── components/   # QueueScreen, RoundScreen, ResultsScreen, etc.
│       └── hooks/        # useGameSession.ts - Socket.IO state management
├── server/           # Node.js backend (Express, CommonJS)
│   └── src/
│       ├── core/         # payoffs.ts, timer.ts
│       ├── state/        # database.ts, session.ts, matchmaker.ts
│       └── socket/       # handlers.ts
└── shared/           # Shared TypeScript types
    └── types.ts      # GameMode, Move, Session interfaces
```

### Tech Stack
- **Backend**: Node.js + Express + Socket.IO
- **Database**: SQLite (file-based, no external dependencies)
- **Frontend**: React + Vite + TypeScript
- **Real-time**: Socket.IO for bidirectional communication

### Data Flow
1. Students join queue via Socket.IO (`join_queue` event)
2. Matchmaker groups players when queue reaches required size (4 or 6)
3. Server broadcasts `match_found`, then `round_start` events
4. Players submit moves; server calculates payoffs in `core/payoffs.ts`
5. Results broadcast to group; repeat until all rounds complete

## Game Modes

All modes defined in `shared/types.ts` with configuration in `GAME_MODES`:

| Mode | Group Size | Rounds | Moves | Key Concept |
|------|------------|--------|-------|-------------|
| `classic` | 4 | 8 | C/P | Collective action dilemma |
| `consensus` | 4 | 4 | R/B | Coordination game (majority wins) |
| `mechanical` | 4 | 4 | R/B | Unanimity rewards |
| `solidarity-mechanical` | 6 | 2 | X/Y/Z | Durkheim - conformity rewarded |
| `solidarity-organic` | 6 | 2 | X/Y/Z | Durkheim - differentiation rewarded |

### Classic Mode Terminology
**IMPORTANT**: Use C/P everywhere, never X/Y
- **Contribute (C)** = cooperative choice
- **Protect (P)** = self-protective choice

"Protect" sounds reasonable and defensible, encouraging honest post-game discussion without shame.

## Key Files

- `server/src/core/payoffs.ts` - All payoff calculations for all game modes
- `server/src/state/matchmaker.ts` - Queue management and group formation
- `server/src/state/session.ts` - Session state management
- `server/src/socket/handlers.ts` - Socket.IO event handlers
- `client/src/hooks/useGameSession.ts` - Client-side Socket.IO state
- `shared/types.ts` - Game mode configurations and TypeScript types

## API Endpoints

```bash
# Create a new game session
POST /api/run/create
{"classCode": "SOCI101", "gameMode": "classic"}

# Get run status
GET /api/run/:runId/status

# Get dashboard metrics
GET /api/run/:runId/metrics

# Health check
GET /health
```

## Adding a New Game Mode

1. Add mode to `GameMode` type in `shared/types.ts`
2. Add configuration to `GAME_MODES` object (groupSize, rounds, moves, multipliers)
3. Create payoff function in `server/src/core/payoffs.ts`
4. Add routing in `calculatePayoffs()` function
5. Write tests in `server/tests/payoffs.test.ts`
6. Update client UI if new move types needed

## Critical Behavioral Rules

### Timeout Handling
- Auto-submit default move (Protect for classic) if no submission within 18 seconds
- Mark as `auto=true` for metrics tracking

### Disconnect Handling
- Allow 25 seconds for reconnection
- If not reconnected: mark session as `abandoned`
- Notify remaining players with option to requeue

### Dashboard Security
Dashboard URLs include a secret token: `/dashboard/{runId}?token={token}`

## Design Philosophy

- **Preserve ambiguity**: Don't tell students how to play or what choices "mean"
- **Avoid over-engineering**: This is a classroom exercise, not a production game platform
- **Prioritize reliability over features**: Simple functionality that works for 400 students
- **Make social forces visible**: Dashboard reveals patterns students couldn't see individually
