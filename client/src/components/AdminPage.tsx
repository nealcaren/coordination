import { useState } from 'react';
import { GameMode, GAME_MODES } from '../../../shared/types';
import './AdminPage.css';

interface AdminPageProps {
  serverUrl: string;
}

interface RunInfo {
  runId: string;
  classCode: string;
  gameMode: GameMode;
  dashboardUrl: string;
  studentUrl: string;
}

export function AdminPage({ serverUrl }: AdminPageProps) {
  const [classCode, setClassCode] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classCode.trim()) {
      setError('Please enter a class code');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/run/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: classCode.trim().toUpperCase(), gameMode })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();

      // Build student URL (same origin, root path)
      const studentUrl = window.location.origin;

      setRunInfo({
        runId: data.runId,
        classCode: data.classCode,
        gameMode: data.gameMode,
        dashboardUrl: data.dashboardUrl,
        studentUrl
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleReset = () => {
    setRunInfo(null);
    setClassCode('');
    setGameMode('classic');
    setError(null);
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Instructor Setup</h1>
        <p className="admin-subtitle">Create a new session for your class</p>

        {!runInfo ? (
          <form onSubmit={handleCreate} className="create-form">
            <div className="form-group">
              <label htmlFor="classCode">Class Code</label>
              <input
                id="classCode"
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="e.g., SOCI101"
                autoComplete="off"
                autoFocus
                disabled={isCreating}
              />
              <p className="form-hint">Students will enter this code to join</p>
            </div>

            <div className="form-group">
              <label htmlFor="gameMode">Game Mode</label>
              <select
                id="gameMode"
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value as GameMode)}
                disabled={isCreating}
              >
                {Object.entries(GAME_MODES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.name} ({config.totalRounds} rounds)
                  </option>
                ))}
              </select>
              <p className="form-hint">
                {gameMode === 'classic'
                  ? 'Contribute/Protect - Classic social dilemma (8 rounds)'
                  : 'Red/Blue - Majority wins consensus game (4 rounds)'}
              </p>
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" disabled={isCreating || !classCode.trim()}>
              {isCreating ? 'Creating...' : 'Create Session'}
            </button>
          </form>
        ) : (
          <div className="session-created">
            <div className="success-badge">Session Created</div>

            <div className="info-section">
              <h2>Game Mode</h2>
              <div className="mode-display">
                <span className="mode-name">{GAME_MODES[runInfo.gameMode].name}</span>
                <span className="mode-rounds">{GAME_MODES[runInfo.gameMode].totalRounds} rounds</span>
              </div>
            </div>

            <div className="info-section">
              <h2>Class Code</h2>
              <div className="code-display">
                <span className="big-code">{runInfo.classCode}</span>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(runInfo.classCode, 'code')}
                >
                  {copied === 'code' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="info-hint">Write this on the board for students</p>
            </div>

            <div className="info-section">
              <h2>Student URL</h2>
              <div className="url-display">
                <code>{runInfo.studentUrl}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(runInfo.studentUrl, 'student')}
                >
                  {copied === 'student' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="info-hint">Students go here and enter the class code</p>
            </div>

            <div className="info-section">
              <h2>Instructor Dashboard</h2>
              <div className="url-display">
                <code className="truncate">{runInfo.dashboardUrl}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(runInfo.dashboardUrl, 'dashboard')}
                >
                  {copied === 'dashboard' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="action-buttons">
              <a
                href={runInfo.dashboardUrl}
                className="primary-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Dashboard
              </a>
              <button className="secondary-btn" onClick={handleReset}>
                Create Another Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
