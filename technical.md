Got it. Below is a tightened, implementation-ready spec for a **400-student**, **mobile-friendly**, **8-round** version with **bonus at Round 4 (×3)** and **big bonus at Round 8 (×10)**, plus an **instructor “projected stats” screen** with aggregated results in real time.

---

# Technical Spec (MVP+): Online “Win As Much As You Can” for 400 Students

## 1. Product Requirements

### Core student experience

* Students join from phone browser (no app install).
* Randomly matched into groups of **4**.
* Play **8 rounds**:

  * simultaneous selection: X or Y
  * round resolves when all 4 submit OR server timer expires
  * show round outcome, payoff, cumulative score
* Round multipliers:

  * **Round 4:** ×3
  * **Round 8:** ×10
* After Round 8:

  * final group scoreboard
  * **Play Again** re-queues the student for a new random group

### Instructor experience

* A **single URL** you can project that shows live aggregated statistics:

  * How many students connected / in queue / in games
  * Number of active groups
  * Distribution of outcomes (cooperative vs mixed vs conflict-heavy)
  * % X vs % Y by round (especially around bonus rounds)
  * Group total score distribution
  * Topline “class outcome” comparisons: “What would all-Y yield?” vs actual

---

## 2. Scale & Performance Targets (400 students)

### Expected concurrency

* 400 students = ~100 groups simultaneously.
* Each round generates:

  * 400 move submissions
  * 100 round resolutions
  * ~400 result messages (broadcast within each group)

### Target SLOs (reasonable classroom expectations)

* Move submit ack: < 200ms typical
* Round results broadcast: < 1s after final move (or timeout)
* Dashboard refresh: every 1–2 seconds without lag

### Architecture implication

* You want **WebSockets** + **Redis-backed state** (not purely in-memory) for reliability and for running multiple server instances if needed.

---

## 3. Tech Stack Recommendation

### Backend

* Node.js + Express + **Socket.IO**
* Redis for:

  * matchmaking queue
  * session state
  * aggregate metrics
  * Socket.IO scaling adapter (optional but recommended)

### Frontend

* React (Vite) or Next.js
* Mobile-first UI; minimal graphics; large tap targets
* No login. Optional “Class Code” to keep outsiders out.

### Hosting

* Run **2 app instances** behind a load balancer (safe for 400).
* One managed Redis instance.
* TLS/HTTPS required.

---

## 4. Game Logic

### Choices

* Each round: player chooses **X** or **Y**
* Moves hidden until round resolves (simultaneous reveal)

### Payoff schedule (server source-of-truth)

Let x_count ∈ {0..4}, y_count = 4 - x_count:

* 4 X: each **-1**
* 3 X + 1 Y: each X **+1**, Y **-3**
* 2 X + 2 Y: each X **+2**, each Y **-2**
* 1 X + 3 Y: X **+3**, each Y **-1**
* 4 Y: each **+1**

### Multipliers

* Round 4 multiplier = 3
* Round 8 multiplier = 10
* Other rounds multiplier = 1

### “All-Y benchmark” for your debrief

Per player: (Round 1–3) 1+1+1 + (Round4) 1×3 + (Round5–7) 1+1+1 + (Round8) 1×10
= 3 + 3 + 3 + 10 = **19 points** per player
Per group (4 players): **76**

The dashboard should show this benchmark next to actual class averages.

---

## 5. Timing Rules

### Per-round timer

* Default: **18 seconds** per round (tuneable)
* Results phase: **4 seconds** display (or “Continue”)

### Timeout behavior (important for keeping class moving)

* If player does not submit by round deadline:

  * auto-submit a default move (recommended: **X**)
  * mark as `auto=true` for dashboard metrics (“% auto-moves”)

### Disconnect behavior

* If a player disconnects:

  * allow **25 seconds** to reconnect
  * if not back: session ends as `abandoned`
  * remaining players get a message: “Game ended—someone left. Requeue?”
* Keep it simple; don’t bot-replace in MVP.

---

## 6. Matchmaking

### Requirements

* Random groups of 4
* Fast formation under surge load (students join at once)

### Algorithm (MVP)

* Redis list `queue:players`
* When queue length ≥ 4:

  * pop 8 (or all available up to 8), shuffle, take 4
  * push remainder back to queue head
* Create `session_id`, assign players, create Socket.IO room `session:{id}`

### Optional: Class Code gate

* Landing screen asks for **Class Code** (e.g., “SOCI101-NEAL”)
* Server only accepts joins with valid code (configured per run)

---

## 7. Data Model (Redis keys)

### Players

* `player:{player_id}` → JSON: {display_name, created_at, last_seen, socket_id?}

### Session state

* `session:{session_id}` → JSON:

  * players: [player_id…] (length 4)
  * current_round: 1..8
  * status: waiting/in_progress/complete/abandoned
  * scores: {player_id: total}
  * rounds: {1: {moves:{}, resolved:false, ...}, ...}
  * created_at, updated_at

### Round state

For each round:

* moves map: player_id → {move:"X"|"Y", at, auto:boolean}
* resolved payload:

  * x_count, y_count
  * deltas: {player_id: delta}
  * multiplier
  * timestamp

### Aggregates for dashboard

Maintain incremental counters rather than recomputing:

* `metrics:connected_count`
* `metrics:queue_count`
* `metrics:active_sessions`
* `metrics:round:{r}:x_count`, `metrics:round:{r}:y_count`, `metrics:round:{r}:auto_count`
* `metrics:session_totals` (Redis sorted set for group totals)
* `metrics:player_totals` (optional)
* `metrics:outcome_bins` (counts of group patterns like “4Y”, “3Y1X”, etc., by round)

---

## 8. Real-Time Events (Socket.IO)

### Client → Server

* `join_queue` {class_code?, display_name?}
* `submit_move` {session_id, round, move:"X"|"Y"}
* `requeue` {}
* `heartbeat` (optional; or rely on socket ping)

### Server → Client

* `queue_update` {queue_size, est_wait_seconds?}
* `match_found` {session_id, players:[{id,name}], your_id}
* `round_start` {round, ends_at, multiplier}
* `move_ack` {round}
* `round_results` {
  round,
  multiplier,
  pattern:{x_count,y_count},
  moves:[{player_id, move, auto}],
  deltas:[{player_id, delta, total}]
  }
* `game_complete` {final_scores, group_total}
* `session_abandoned` {reason}

### Server → Instructor dashboard

Two options:

1. Dashboard is also a Socket.IO client receiving `metrics_update` every 1–2 seconds (recommended).
2. Dashboard polls `/api/metrics` every second (simpler fallback).

---

## 9. Instructor Dashboard (“Projected Sheet”)

### Display requirements (big font, simple visuals)

**Top row:**

* Connected: N
* In queue: N
* In games: N (and groups count)
* Completed sessions: N
* Abandoned sessions: N
* Auto-move rate: %

**Round-by-round panel (1–8):**

* %X vs %Y each round (stacked bar or two numbers)
* Highlight Round 4 and Round 8 multipliers
* Optional: “cooperation index” = %Y (since Y is cooperation signal)

**Outcome distribution panel (for current round or last resolved round):**

* counts (or %) of patterns:

  * 4Y
  * 3Y1X
  * 2Y2X
  * 1Y3X
  * 4X

**Score panels:**

* Average player total score
* Average group total score
* Median group total score
* Compare to benchmark:

  * “All-Y benchmark group total: 76”
  * “Class avg group total: X” (live)

**Optional “sparkline-ish” trend:**

* %Y over rounds (simple line)

### Data sources

All of the above should be computed from Redis counters + session totals ZSET.

### Security

* Dashboard URL protected by:

  * secret token in URL, or
  * basic auth, or
  * separate “instructor code”
    MVP recommendation: **secret token** environment variable.

---

## 10. Mobile-Friendly UI Requirements

### Layout

* One-screen gameplay:

  * round + timer at top
  * huge X / Y buttons (min 48px height, ideally ~20% screen each)
  * confirmation state: “Submitted: Y”
* Don’t show tiny tables during play; show simple round summary.
* Avoid scroll during active decision period.

### Accessibility

* Color is not the only signal (X and Y must be clear text).
* Buttons labeled with both letter and meaning if you want (e.g., “Y (Cooperate)”).

### Network resilience

* If socket drops:

  * “Reconnecting…” banner
  * on reconnect, server rehydrates current state and shows:

    * current round, whether they already submitted, time remaining

---

## 11. Operational Plan for Class Day

* You create a new “run” with a Class Code and Instructor Token.
* Students join from QR code + short URL.
* You project the dashboard and can narrate:

  * “Look at Round 4 behavior vs Round 3”
  * “Watch what happens on Round 8”

This requires a “run id”:

### Run object

* `run_id`
* `class_code`
* `created_at`
* metrics keys namespaced by run: `run:{run_id}:metrics:*`

This is key so multiple classes don’t mix.

---

## 12. Testing & Load

### Load test scenario (minimum)

* Simulate 400 clients joining within 60 seconds
* Each submits 8 moves on schedule
* Verify:

  * no deadlocks in matchmaking
  * session state remains consistent
  * metrics counters match totals

### Correctness tests

* Payoff mapping for each pattern
* Multiplier application on rounds 4 and 8
* Timeout auto-submission
* Reconnection state restoration

---

## 13. Build Checklist (Minimal but Complete)

### Must-have

* Queue + match to groups of 4
* 8-round engine + timers + multipliers
* Mobile UI
* Requeue
* Instructor dashboard with:

  * connected/queue/in-game counts
  * %X/%Y by round
  * pattern distribution
  * average group totals + benchmark

### Nice-to-have (low lift)

* “Class starts in…” lock (so early joiners wait)
* Export CSV after run (group totals + per-round stats)
* A “Reset run” button on instructor dashboard

---

If you want, I can also give you:

* a concrete Redis key schema (exact key names + value formats),
* an API contract for `/api/run/create`, `/api/metrics`, `/api/export`,
* and a minimal wireframe for the student screen + dashboard layout (so a developer can implement without interpretation).
