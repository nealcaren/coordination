import { useState } from 'react';
import { useGameSession } from './hooks/useGameSession';
import { QueueScreen } from './components/QueueScreen';
import { RoundScreen } from './components/RoundScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { CompleteScreen } from './components/CompleteScreen';
import { InstructorDashboard } from './components/InstructorDashboard';
import { AdminPage } from './components/AdminPage';
import './App.css';

// In production, client and server are on the same origin
// In development, use VITE_SERVER_URL or fallback to localhost:3000
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

type Route =
  | { type: 'game' }
  | { type: 'admin' }
  | { type: 'dashboard'; runId: string; token: string };

// Simple routing based on URL path
function getRoute(): Route {
  // Normalize path by removing trailing slash and converting to lowercase
  const rawPath = window.location.pathname;
  const path = rawPath.replace(/\/+$/, '').toLowerCase() || '/';
  const params = new URLSearchParams(window.location.search);

  // Check for admin route
  if (path === '/admin' || path.startsWith('/admin')) {
    return { type: 'admin' };
  }

  // Check for dashboard route: /dashboard/{runId}?token={token}
  const dashboardMatch = rawPath.match(/^\/dashboard\/([a-zA-Z0-9]+)/i);
  if (dashboardMatch) {
    return {
      type: 'dashboard',
      runId: dashboardMatch[1],
      token: params.get('token') || ''
    };
  }

  return { type: 'game' };
}

function App() {
  const route = getRoute();

  // Render admin page
  if (route.type === 'admin') {
    return <AdminPage serverUrl={SERVER_URL} />;
  }

  // Render dashboard if on dashboard route
  if (route.type === 'dashboard') {
    return (
      <InstructorDashboard
        serverUrl={SERVER_URL}
        runId={route.runId}
        token={route.token}
      />
    );
  }

  return <GameApp />;
}

function GameApp() {
  const [classCode, setClassCode] = useState('');
  const [hasJoined, setHasJoined] = useState(false);

  const {
    gameState,
    playerId,
    gameMode,
    totalRounds,
    round,
    timeRemaining,
    multiplier,
    hasSubmitted,
    score,
    queueSize,
    lastResult,
    groupTotal,
    submitMove,
    requeue
  } = useGameSession(SERVER_URL, classCode);

  if (!hasJoined) {
    return (
      <div className="join-screen">
        <div className="join-content">
          <h1>Contribute or Protect</h1>
          <p className="subtitle">A Collective Action Simulation</p>

          <div className="join-form">
            <label htmlFor="classCode">Enter Class Code:</label>
            <input
              id="classCode"
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="e.g., SOCI101"
              autoComplete="off"
              autoFocus
            />
            <button
              onClick={() => {
                if (classCode.trim()) {
                  setHasJoined(true);
                }
              }}
              disabled={!classCode.trim()}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {gameState === 'connecting' && (
        <div className="connecting-screen">
          <div className="spinner"></div>
          <p>Connecting...</p>
        </div>
      )}

      {gameState === 'queue' && (
        <QueueScreen queueSize={queueSize} classCode={classCode} />
      )}

      {gameState === 'playing' && (
        <RoundScreen
          round={round}
          totalRounds={totalRounds}
          timeRemaining={timeRemaining}
          multiplier={multiplier}
          hasSubmitted={hasSubmitted}
          gameMode={gameMode}
          onSubmit={submitMove}
        />
      )}

      {gameState === 'results' && lastResult && playerId && (
        <ResultsScreen
          result={lastResult}
          playerId={playerId}
          score={score}
          gameMode={gameMode}
        />
      )}

      {gameState === 'complete' && (
        <CompleteScreen
          finalScore={score}
          groupTotal={groupTotal}
          onPlayAgain={requeue}
        />
      )}
    </div>
  );
}

export default App;
