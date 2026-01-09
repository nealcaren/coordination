# Development Guide

Technical documentation for developers working on the Coordination Games platform.

## Architecture Overview

```
coordination/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI components (JoinScreen, RoundScreen, etc.)
│   │   ├── hooks/          # useGameSession - Socket.IO state management
│   │   └── App.tsx         # Main app with routing
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── core/           # Game logic
│   │   │   ├── payoffs.ts  # All payoff calculations
│   │   │   └── timer.ts    # Round timer management
│   │   ├── state/          # Data layer
│   │   │   ├── database.ts # SQLite wrapper
│   │   │   ├── session.ts  # Session management
│   │   │   └── matchmaker.ts # Queue and group formation
│   │   ├── socket/         # Real-time communication
│   │   │   └── handlers.ts # Socket.IO event handlers
│   │   └── index.ts        # Express server + API routes
│   ├── tests/              # Jest unit tests
│   └── package.json
├── shared/                 # Shared TypeScript types
│   └── types.ts            # GameMode, Move, Session, etc.
└── package.json            # Workspace root
```

### Tech Stack

- **Backend:** Node.js + Express + Socket.IO
- **Database:** SQLite (file-based, no external dependencies)
- **Frontend:** React + Vite + TypeScript
- **Real-time:** Socket.IO for bidirectional communication

---

## Game Modes

### Configuration

All game modes are defined in `shared/types.ts`:

```typescript
export type GameMode =
  | 'classic'              // Contribute or Protect
  | 'consensus'            // Red or Blue (majority wins)
  | 'mechanical'           // Simple unanimity (4 players)
  | 'solidarity-mechanical' // Durkheim mechanical (6 players)
  | 'solidarity-organic';   // Durkheim organic (6 players)
```

Each mode specifies:
- `groupSize`: 4 or 6 players
- `totalRounds`: Number of rounds
- `multiplierRounds`: Which rounds have bonus multipliers
- `moves`: Available choices (2 or 3 options)
- `defaultMove`: Auto-submitted on timeout

### Payoff Matrices

#### Classic Mode (4 players, C/P moves)

| Protect Count | Contribute Gets | Protect Gets |
|---------------|-----------------|--------------|
| 0 (4C) | +1 | - |
| 1 (3C1P) | -1 | +3 |
| 2 (2C2P) | -2 | +2 |
| 3 (1C3P) | -3 | +1 |
| 4 (4P) | - | -1 |

**Multipliers:** Round 4 = ×3, Round 8 = ×10
**Max group total:** 76 points

#### Consensus Mode (4 players, R/B moves)

- Majority color earns points equal to majority count
- Tie (2-2): everyone gets 2 points
- Unanimous (4-0): everyone gets 4 points

**Multipliers:** Round 4 = ×3
**Max group total:** 96 points

#### Mechanical Mode - Simple (4 players, R/B moves)

| Pattern | Points |
|---------|--------|
| 4-0 (unanimous) | +4 each |
| 3-1 | +1 majority, 0 deviant |
| 2-2 | 0 each |

**Multipliers:** Round 4 = ×3
**Max group total:** 96 points

#### Solidarity Mechanical (6 players, X/Y/Z roles)

| Pattern | Meaning | Points |
|---------|---------|--------|
| 6-0-0 | Total conformity | +3 each |
| 5-1-0 | Minor deviance | +2 majority, -1 deviant |
| All others | Fractured | 0 each |

**Multipliers:** Round 2 = ×2
**Max group total:** 54 points

#### Solidarity Organic (6 players, X/Y/Z roles)

| Pattern | Meaning | Points |
|---------|---------|--------|
| 2-2-2 | Perfect balance | +3 each |
| 3-2-1 | Uneven | +2/+2/+1 |
| 4-1-1, 3-3-0, etc. | Inefficient | +1 each |
| 6-0-0 | No specialization | 0 each |

**Multipliers:** Round 2 = ×2
**Max group total:** 54 points

---

## API Reference

### Create a Run

```http
POST /api/run/create
Content-Type: application/json

{
  "classCode": "SOCI101",
  "gameMode": "classic"  // optional, defaults to "classic"
}
```

**Response:**
```json
{
  "runId": "abc123...",
  "classCode": "SOCI101",
  "gameMode": "classic",
  "dashboardUrl": "http://localhost:3000/dashboard/abc123...?token=xyz..."
}
```

### Get Run Status

```http
GET /api/run/:runId/status
```

**Response:**
```json
{
  "runId": "abc123...",
  "classCode": "SOCI101",
  "createdAt": 1704567890000,
  "connectedPlayers": 42,
  "queueSize": 3,
  "activeSessions": 10,
  "completedSessions": 5
}
```

### Get Metrics (Dashboard)

```http
GET /api/run/:runId/metrics
```

**Response:**
```json
{
  "gameMode": "classic",
  "connected": 42,
  "queue": 3,
  "activeSessions": 10,
  "completedSessions": 5,
  "abandonedSessions": 1,
  "byRound": [
    {"round": 1, "firstCount": 30, "secondCount": 12, "autoCount": 2, "firstPercent": 71, "secondPercent": 29},
    ...
  ],
  "avgGroupTotal": 52,
  "medianGroupTotal": 48,
  "maxGroupTotal": 76,
  "patterns": {"4C": 2, "3C1P": 5, "2C2P": 8, "1C3P": 3, "4P": 1}
}
```

### Delete Run

```http
DELETE /api/run/:runId
```

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_queue` | `{classCode, displayName?}` | Join matchmaking queue |
| `submit_move` | `{sessionId, round, move}` | Submit round choice |
| `requeue` | `{}` | Rejoin queue after game ends |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `queue_update` | `{queueSize}` | Queue size changed |
| `match_found` | `{sessionId, players, yourId, gameMode}` | Matched into group |
| `round_start` | `{round, endsAt, multiplier}` | New round beginning |
| `move_ack` | `{round}` | Move received |
| `round_results` | `{round, multiplier, pattern, payoffs}` | Round resolved |
| `game_complete` | `{finalScores, groupTotal}` | Game finished |
| `session_abandoned` | `{reason}` | Player disconnected |

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Local Setup

```bash
# Clone repository
git clone https://github.com/nealcaren/coordination.git
cd coordination

# Install all dependencies
npm install

# Start development servers (both client and server)
npm run dev
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- API health check: http://localhost:3000/health

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Server tests only
cd server && npm test
```

### Building for Production

```bash
# Build everything
npm run build

# Or separately
npm run build:server
npm run build:client
```

---

## Deployment

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `DATABASE_PATH` | SQLite file path | `./data/game.db` |
| `CLIENT_URL` | Frontend URL (CORS) | `http://localhost:3001` |
| `BASE_URL` | Backend URL (dashboard links) | `http://localhost:3000` |

### Railway (Recommended)

1. Push to GitHub
2. Connect repo at [railway.app](https://railway.app)
3. Set environment variables:
   - `NODE_ENV=production`
   - `CLIENT_URL=https://your-app.up.railway.app`
   - `BASE_URL=https://your-app.up.railway.app`
4. Deploy

### Render

Create a Web Service:
- **Build:** `npm install && npm run build`
- **Start:** `cd server && npm start`
- Add environment variables as above

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - BASE_URL=https://yourdomain.com
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### Nginx (for VPS deployment)

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Database Schema

SQLite with the following tables:

### runs
```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  class_code TEXT NOT NULL,
  game_mode TEXT DEFAULT 'classic',
  dashboard_token TEXT,
  created_at INTEGER
);
```

### sessions
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  game_mode TEXT DEFAULT 'classic',
  status TEXT DEFAULT 'waiting',
  current_round INTEGER DEFAULT 1,
  created_at INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(id)
);
```

### session_players
```sql
CREATE TABLE session_players (
  session_id TEXT,
  player_id TEXT,
  score INTEGER DEFAULT 0,
  PRIMARY KEY (session_id, player_id)
);
```

### moves
```sql
CREATE TABLE moves (
  session_id TEXT,
  player_id TEXT,
  round INTEGER,
  move TEXT,
  auto INTEGER DEFAULT 0,
  created_at INTEGER,
  PRIMARY KEY (session_id, player_id, round)
);
```

---

## Adding New Game Modes

1. **Add to `shared/types.ts`:**
   - Add mode to `GameMode` type
   - Add move types if needed
   - Add pattern types if needed
   - Add configuration to `GAME_MODES`

2. **Add payoff function in `server/src/core/payoffs.ts`:**
   - Create `calculateYourModePayoffs()` function
   - Add routing in `calculatePayoffs()`
   - Update `getGroupPattern()` if needed
   - Update `calculateMaxGroupTotal()`

3. **Update matchmaker if group size differs:**
   - Matchmaker reads `groupSize` from config automatically

4. **Add tests in `server/tests/payoffs.test.ts`**

5. **Update client UI if new moves:**
   - `RoundScreen.tsx` for move buttons
   - `ResultsScreen.tsx` for result display

---

## Performance Considerations

- **Target:** 400 concurrent students (~100 groups)
- **Move acknowledgment:** < 200ms
- **Round resolution:** < 1s after all moves received
- **Dashboard refresh:** 1-2 seconds

### Scaling

For larger deployments:
- Run multiple server instances behind load balancer
- Use Redis for session state (instead of SQLite)
- Use Socket.IO Redis adapter for cross-instance communication

---

## Troubleshooting

### WebSocket Issues
- Verify hosting platform supports WebSockets
- Check nginx/proxy is configured for upgrade headers
- Confirm `CLIENT_URL` matches actual frontend origin

### Students Can't Connect
- Verify class code matches exactly (case-sensitive)
- Check run exists: `GET /api/run/:runId/status`
- Verify students are on correct URL

### Database Issues
- SQLite auto-creates at configured path
- For Docker, mount volume: `-v ./data:/app/data`
- Check write permissions on data directory
