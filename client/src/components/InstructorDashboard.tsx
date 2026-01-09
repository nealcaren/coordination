import { useEffect, useState } from 'react';
import './InstructorDashboard.css';

interface RoundData {
  round: number;
  cCount: number;
  pCount: number;
  autoCount: number;
  cPercent: number;
  pPercent: number;
}

interface Metrics {
  connected: number;
  queue: number;
  activeSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  byRound: RoundData[];
  avgGroupTotal: number;
  medianGroupTotal: number;
  allContributeBenchmark: number;
  patterns: {
    '4C': number;
    '3C1P': number;
    '2C2P': number;
    '1C3P': number;
    '4P': number;
  };
}

interface InstructorDashboardProps {
  serverUrl: string;
  runId: string;
  token: string;
}

export function InstructorDashboard({ serverUrl, runId, token }: InstructorDashboardProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/run/${runId}/metrics`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
        setLastUpdate(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Initial fetch
    fetchMetrics();

    // Poll every 2 seconds
    const interval = setInterval(fetchMetrics, 2000);

    return () => clearInterval(interval);
  }, [serverUrl, runId, token]);

  if (error) {
    return (
      <div className="dashboard dashboard-error">
        <h1>Dashboard Error</h1>
        <p>{error}</p>
        <p>Check that the run ID and token are correct.</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="dashboard dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Calculate total auto-moves and total moves
  const totalMoves = metrics.byRound.reduce((sum, r) => sum + r.cCount + r.pCount, 0);
  const totalAuto = metrics.byRound.reduce((sum, r) => sum + r.autoCount, 0);
  const autoPercent = totalMoves > 0 ? Math.round((totalAuto / totalMoves) * 100) : 0;

  // Calculate pattern totals for percentages
  const totalPatterns = Object.values(metrics.patterns).reduce((sum, count) => sum + count, 0);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Instructor Dashboard</h1>
        {lastUpdate && (
          <span className="last-update">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </header>

      {/* Status Cards */}
      <section className="status-cards">
        <div className="status-card">
          <span className="status-value">{metrics.connected}</span>
          <span className="status-label">Connected</span>
        </div>
        <div className="status-card">
          <span className="status-value">{metrics.queue}</span>
          <span className="status-label">In Queue</span>
        </div>
        <div className="status-card">
          <span className="status-value">{metrics.activeSessions}</span>
          <span className="status-label">Active Games</span>
        </div>
        <div className="status-card status-complete">
          <span className="status-value">{metrics.completedSessions}</span>
          <span className="status-label">Completed</span>
        </div>
        <div className="status-card status-abandoned">
          <span className="status-value">{metrics.abandonedSessions}</span>
          <span className="status-label">Abandoned</span>
        </div>
        <div className="status-card">
          <span className="status-value">{autoPercent}%</span>
          <span className="status-label">Auto-Moves</span>
        </div>
      </section>

      {/* Round by Round Stats */}
      <section className="rounds-section">
        <h2>Contribute vs Protect by Round</h2>
        <div className="rounds-grid">
          {metrics.byRound.map((round) => (
            <div
              key={round.round}
              className={`round-card ${round.round === 4 ? 'bonus-3x' : ''} ${round.round === 8 ? 'bonus-10x' : ''}`}
            >
              <div className="round-header">
                <span className="round-number">Round {round.round}</span>
                {round.round === 4 && <span className="multiplier-badge">3x</span>}
                {round.round === 8 && <span className="multiplier-badge">10x</span>}
              </div>
              <div className="round-bars">
                <div className="bar-container">
                  <div
                    className="bar bar-contribute"
                    style={{ width: `${round.cPercent}%` }}
                  >
                    {round.cPercent > 10 && <span>{round.cPercent}%</span>}
                  </div>
                  <div
                    className="bar bar-protect"
                    style={{ width: `${round.pPercent}%` }}
                  >
                    {round.pPercent > 10 && <span>{round.pPercent}%</span>}
                  </div>
                </div>
              </div>
              <div className="round-counts">
                <span className="count-contribute">C: {round.cCount}</span>
                <span className="count-protect">P: {round.pCount}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounds-legend">
          <span className="legend-item"><span className="legend-color contribute"></span> Contribute</span>
          <span className="legend-item"><span className="legend-color protect"></span> Protect</span>
        </div>
      </section>

      {/* Two column layout for patterns and scores */}
      <div className="bottom-sections">
        {/* Outcome Patterns */}
        <section className="patterns-section">
          <h2>Outcome Patterns</h2>
          <div className="patterns-grid">
            {Object.entries(metrics.patterns).map(([pattern, count]) => {
              const percent = totalPatterns > 0 ? Math.round((count / totalPatterns) * 100) : 0;
              return (
                <div key={pattern} className="pattern-row">
                  <span className="pattern-label">{formatPattern(pattern)}</span>
                  <div className="pattern-bar-container">
                    <div
                      className={`pattern-bar ${getPatternClass(pattern)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="pattern-count">{count}</span>
                  <span className="pattern-percent">{percent}%</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Score Comparison */}
        <section className="scores-section">
          <h2>Group Score Comparison</h2>
          <div className="scores-comparison">
            <div className="score-item">
              <span className="score-label">All-Contribute Benchmark</span>
              <span className="score-value benchmark">{metrics.allContributeBenchmark}</span>
            </div>
            <div className="score-item">
              <span className="score-label">Average Group Total</span>
              <span className={`score-value ${metrics.avgGroupTotal < metrics.allContributeBenchmark ? 'below' : 'above'}`}>
                {metrics.avgGroupTotal}
              </span>
            </div>
            <div className="score-item">
              <span className="score-label">Median Group Total</span>
              <span className={`score-value ${metrics.medianGroupTotal < metrics.allContributeBenchmark ? 'below' : 'above'}`}>
                {metrics.medianGroupTotal}
              </span>
            </div>
          </div>
          {metrics.completedSessions > 0 && (
            <div className="score-bar-visual">
              <div className="score-bar-track">
                <div
                  className="score-bar-benchmark"
                  style={{ left: `${(metrics.allContributeBenchmark / 100) * 100}%` }}
                >
                  <span>Benchmark</span>
                </div>
                <div
                  className="score-bar-avg"
                  style={{ left: `${(metrics.avgGroupTotal / 100) * 100}%` }}
                >
                  <span>Avg</span>
                </div>
              </div>
              <div className="score-bar-labels">
                <span>-40</span>
                <span>0</span>
                <span>40</span>
                <span>76</span>
                <span>100</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatPattern(pattern: string): string {
  switch (pattern) {
    case '4C': return '4 Contribute';
    case '3C1P': return '3C / 1P';
    case '2C2P': return '2C / 2P';
    case '1C3P': return '1C / 3P';
    case '4P': return '4 Protect';
    default: return pattern;
  }
}

function getPatternClass(pattern: string): string {
  switch (pattern) {
    case '4C': return 'pattern-all-c';
    case '3C1P': return 'pattern-3c';
    case '2C2P': return 'pattern-2c';
    case '1C3P': return 'pattern-1c';
    case '4P': return 'pattern-all-p';
    default: return '';
  }
}
