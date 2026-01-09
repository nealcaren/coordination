import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameMode, Move } from '../../../shared/types';

type GameState = 'connecting' | 'queue' | 'playing' | 'results' | 'complete';

interface PlayerDelta {
  playerId: string;
  delta: number;
  total: number;
}

interface RoundResult {
  round: number;
  multiplier: number;
  gameMode: GameMode;
  pattern: {
    firstCount: number;
    secondCount: number;
  };
  deltas: PlayerDelta[];
}

export function useGameSession(serverUrl: string, classCode: string, shouldConnect: boolean = false) {
  const [gameState, setGameState] = useState<GameState>('connecting');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [totalRounds, setTotalRounds] = useState(8);
  const [round, setRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(18);
  const [endsAt, setEndsAt] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [groupSize, setGroupSize] = useState(4);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [finalScores, setFinalScores] = useState<Record<string, number>>({});
  const [groupTotal, setGroupTotal] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection only when shouldConnect is true
  useEffect(() => {
    if (!shouldConnect || !classCode) {
      return;
    }

    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setGameState('queue');
      // Join queue with class code
      socket.emit('join_queue', { classCode });
    });

    socket.on('queue_update', (data: { queueSize: number; gameMode?: GameMode; groupSize?: number }) => {
      setQueueSize(data.queueSize);
      if (data.gameMode) setGameMode(data.gameMode);
      if (data.groupSize) setGroupSize(data.groupSize);
    });

    socket.on('match_found', (data: { sessionId: string; players: string[]; yourId: string; gameMode: GameMode }) => {
      console.log('Match found!', data);
      setSessionId(data.sessionId);
      setPlayerId(data.yourId);
      setGameMode(data.gameMode);
      setGameState('playing');
    });

    socket.on('round_start', (data: { round: number; totalRounds: number; endsAt: number; multiplier: number; gameMode: GameMode }) => {
      console.log('Round start:', data);
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setEndsAt(data.endsAt);
      setMultiplier(data.multiplier);
      setGameMode(data.gameMode);
      setHasSubmitted(false);
      setGameState('playing');
      setLastResult(null);
    });

    socket.on('move_ack', (data: { round: number }) => {
      console.log('Move acknowledged:', data);
      setHasSubmitted(true);
    });

    socket.on('round_results', (data: RoundResult) => {
      console.log('Round results:', data);
      setLastResult(data);
      setGameState('results');

      // Update score
      const myDelta = data.deltas.find(d => d.playerId === socket.id);
      if (myDelta) {
        setScore(myDelta.total);
      }
    });

    socket.on('game_complete', (data: { finalScores: Record<string, number>; groupTotal: number }) => {
      console.log('Game complete:', data);
      setFinalScores(data.finalScores);
      setGroupTotal(data.groupTotal);
      setGameState('complete');
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      // Don't alert for "Invalid class code" as it's handled by showing the form
    });

    return () => {
      socket.disconnect();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [serverUrl, classCode, shouldConnect]);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'playing' && endsAt > 0 && !hasSubmitted) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(timerRef.current!);
        }
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [gameState, endsAt, hasSubmitted]);

  const submitMove = (move: Move) => {
    if (!socketRef.current || !sessionId || hasSubmitted) return;

    console.log('Submitting move:', move, 'for session:', sessionId, 'round:', round);
    socketRef.current.emit('submit_move', {
      sessionId,
      round,
      move
    });
  };

  const requeue = () => {
    if (!socketRef.current) return;

    setGameState('queue');
    setSessionId(null);
    setRound(1);
    setScore(0);
    setHasSubmitted(false);
    setLastResult(null);

    socketRef.current.emit('requeue', { classCode });
  };

  return {
    gameState,
    sessionId,
    playerId,
    gameMode,
    totalRounds,
    round,
    timeRemaining,
    multiplier,
    hasSubmitted,
    score,
    queueSize,
    groupSize,
    lastResult,
    finalScores,
    groupTotal,
    submitMove,
    requeue
  };
}
