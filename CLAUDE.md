# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Contribute or Protect: A Collective Action Simulation** is an online, mobile-friendly educational sociology simulation for classroom use. The exercise runs students through an 8-round social dilemma where they are randomly matched into groups of four and must repeatedly choose between two actions (Contribute or Protect) without knowing others' choices in advance. The system is designed to handle 400 concurrent students in a live classroom setting.

## Core Educational Purpose

This is a sociology teaching tool, not a game optimization exercise. The simulation is designed to reveal social processes: trust formation, norm emergence, collective action problems, and the tension between individual incentives and collective outcomes. All design decisions should preserve ambiguity and let meaning emerge through student experience rather than explicit instruction.

## System Architecture

### Technology Stack
- **Backend**: Node.js + Express + Socket.IO for real-time communication
- **State Management**: Redis for session state, matchmaking queue, and aggregated metrics
- **Frontend**: React (Vite) or Next.js, mobile-first design
- **Scale Target**: 400 concurrent students (~100 simultaneous groups)

### Performance Requirements
- Move submit acknowledgment: < 200ms typical
- Round results broadcast: < 1s after final move or timeout
- Dashboard refresh: 1-2 seconds without lag
- Support 2 app instances behind load balancer for redundancy

## Game Mechanics

### Round Structure
- **8 total rounds** per session
- **Round 4**: ×3 multiplier (bonus round)
- **Round 8**: ×10 multiplier (big bonus round)
- **Per-round timer**: 18 seconds (configurable)
- **Results phase**: 4 seconds display

### Payoff Schedule
For a group of 4 players, where x_count is number of "Protect" choices:
- 4 Protect: each -1
- 3 Protect + 1 Contribute: each Protect +1, Contribute -3
- 2 Protect + 2 Contribute: each Protect +2, each Contribute -2
- 1 Protect + 3 Contribute: Protect +3, each Contribute -1
- 4 Contribute: each +1

### All-Contribute Benchmark
Per player: 19 points total (rounds 1-3: 3, round 4: 3, rounds 5-7: 3, round 8: 10)
Per group: 76 points (critical for instructor dashboard comparisons)

## Terminology

### **IMPORTANT**: Use C/P everywhere, never X/Y
- **Contribute (C)** = former Y (cooperative choice)
- **Protect (P)** = former X (self-protective choice)

This terminology is pedagogically intentional: "Protect" sounds reasonable and defensible, which encourages honest post-game discussion without shame.

### Student-Facing UI
- Decision buttons: "Contribute (C)" and "Protect (P)"
- No definitions or hints on decision screen
- Round results show only: group pattern, individual points, cumulative total
- **Never show** who made which choice

### Instructor Dashboard
Use sociological framing:
- "% Contribute by Round" / "% Protect by Round"
- Group outcome patterns (4C, 3C/1P, 2/2, 1C/3P, 4P)
- Comparison to All-Contribute benchmark

## Critical Behavioral Rules

### Timeout Handling
- Auto-submit default move (Protect) if no submission within 18 seconds
- Mark as `auto=true` for metrics tracking
- Show "% auto-moves" on dashboard

### Disconnect Handling
- Allow 25 seconds for reconnection
- If not reconnected: mark session as `abandoned`
- Notify remaining players: "Game ended—someone left. Requeue?"
- Do not bot-replace missing players in MVP

### Matchmaking
- Random groups of 4 from Redis queue
- When queue length ≥ 4: pop up to 8, shuffle, take 4, return remainder
- Optional class code gate to prevent outsiders

## Data Model (Redis Keys)

### Session State
`session:{session_id}` contains:
- `players`: array of 4 player_ids
- `current_round`: 1-8
- `status`: waiting/in_progress/complete/abandoned
- `scores`: {player_id: total}
- `rounds`: {1: {moves:{}, resolved:false}, ...}

### Metrics for Dashboard
Incremental counters (not recomputed):
- `metrics:connected_count`
- `metrics:queue_count`
- `metrics:active_sessions`
- `metrics:round:{r}:c_count`, `metrics:round:{r}:p_count`, `metrics:round:{r}:auto_count`
- `metrics:session_totals` (sorted set for group totals)
- `metrics:outcome_bins` (counts of patterns like "4C", "3C1P", etc.)

### Multi-Class Support
Namespace all metrics by `run_id`:
- `run:{run_id}:metrics:*`
- Each class session gets unique `class_code` and `run_id`

## Real-Time Events (Socket.IO)

### Client → Server
- `join_queue` {class_code?, display_name?}
- `submit_move` {session_id, round, move:"C"|"P"}
- `requeue` {}

### Server → Client
- `queue_update` {queue_size}
- `match_found` {session_id, players, your_id}
- `round_start` {round, ends_at, multiplier}
- `move_ack` {round}
- `round_results` {round, multiplier, pattern, moves, deltas}
- `game_complete` {final_scores, group_total}
- `session_abandoned` {reason}

### Server → Dashboard
- `metrics_update` every 1-2 seconds (or poll `/api/metrics`)

## Instructor Dashboard Requirements

Display in large, projection-friendly format:
- **Top row**: Connected, in queue, in games (group count), completed, abandoned, auto-move %
- **Round panel**: %C vs %P for rounds 1-8 (highlight multipliers at 4 and 8)
- **Outcome distribution**: counts/percentages of 4C, 3C1P, 2C2P, 1C3P, 4P patterns
- **Score comparisons**: Average/median group totals vs All-Contribute benchmark (76)
- **Trend visualization**: %Contribute over rounds

### Dashboard Security
Protect with secret token in URL or basic auth (environment variable for MVP)

## Mobile UI Guidelines

### Layout Priorities
- One-screen gameplay: round/timer at top, large C/P buttons (min 48px height, ~20% screen each)
- Confirmation state: "Submitted: C"
- Avoid scroll during active decision period
- Simple round summary (not detailed tables)

### Network Resilience
- "Reconnecting..." banner on socket drop
- On reconnect: rehydrate current round, submission status, time remaining

## Testing Requirements

### Load Testing
- Simulate 400 clients joining within 60 seconds
- Each submits 8 moves on schedule
- Verify: no matchmaking deadlocks, consistent session state, accurate metric counters

### Correctness Testing
- Payoff calculation for all patterns
- Multiplier application on rounds 4 and 8
- Timeout auto-submission behavior
- Reconnection state restoration

## Design Philosophy

- **Preserve ambiguity**: The simulation should not tell students how to play or what choices "mean"
- **Avoid over-engineering**: This is a time-boxed classroom exercise, not a production game platform
- **Prioritize reliability over features**: Better to have simple functionality that works perfectly for 400 students than complex features that fail under load
- **Make social forces visible**: The aggregated dashboard data should reveal patterns students experienced individually but couldn't see systemically
