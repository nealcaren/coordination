# Coordination Games: Sociology Simulations for the Classroom

Interactive online simulations designed to teach core sociological concepts through lived experience. Students play short games in randomly-matched groups, making choices that reveal social dynamics in real time.

Built for large lecture settings (300+ students) with mobile-first design and live instructor dashboards.

## Available Simulations

### 1. Contribute or Protect (Classic)
**Concept:** Collective Action Dilemma

A classic social dilemma where individual rationality conflicts with group welfare. Students choose to **Contribute** (cooperate) or **Protect** (defect) in groups of 4 over 8 rounds.

| Pattern | Contribute Gets | Protect Gets |
|---------|-----------------|--------------|
| 4 Contribute | +1 each | - |
| 3C / 1P | -1 each | +3 |
| 2C / 2P | -2 each | +2 each |
| 1C / 3P | -3 | +1 each |
| 4 Protect | - | -1 each |

**Benchmark:** 76 points (all contribute every round)

**Key insight:** "Protect" sounds reasonable and defensible, which encourages honest post-game discussion. Students discover the tragedy of the commons through experience.

---

### 2. Mechanical Solidarity (Durkheim)
**Concept:** Traditional Society - Conformity Rewarded

Students are matched into groups of 6 and choose one of three roles: **Producer**, **Distributor**, or **Regulator**. In this mode, conformity is sacred. The more alike the group, the better the outcome.

| Pattern | Meaning | Points |
|---------|---------|--------|
| 6-0-0 | Total conformity | +3 each |
| 5-1-0 | Minor deviance | +2 majority, -1 deviant |
| Any other | Fractured norms | 0 each |

**Benchmark:** 54 points (all same role both rounds)

**Key insight:** Students feel intense pressure to conform. Even one "rebel" damages everyone. The roles don't matter - only sameness does.

---

### 3. Organic Solidarity (Durkheim)
**Concept:** Modern Society - Differentiation Rewarded

Same setup as Mechanical: 6 players, 3 roles. But now **diversity is valued**. The group succeeds when roles are balanced.

| Pattern | Meaning | Points |
|---------|---------|--------|
| 2-2-2 | Perfect division of labor | +3 each |
| 3-2-1 | Functional but uneven | +2/+2/+1 |
| 4-1-1, 3-3-0, etc. | Inefficient | +1 each |
| 6-0-0 | No specialization | 0 each |

**Benchmark:** 54 points (balanced 2-2-2 both rounds)

**Key insight:** Students feel pressure to spread out. But coordination is hard - which role do *you* take?

---

### 4. Durkheim Contrast (Both in Sequence)
**Pedagogical Power:** Run Mechanical first, then Organic with the same students.

The roles never change - only the rules for how society holds together. Students experience firsthand that:
- In **mechanical solidarity**, difference feels dangerous
- In **organic solidarity**, sameness feels dangerous

This is the core Durkheim lesson: solidarity is a **social structure**, not individual virtue.

---

### 5. Consensus / Coordination
**Concept:** Pure Coordination Game

Groups of 4 choose **Red** or **Blue**. Majority wins, but ties still pay. A simpler game for exploring how groups coordinate without communication.

---

## Running a Class Session

### Before Class

1. **Deploy the app** (see [DEVELOPMENT.md](DEVELOPMENT.md) for hosting options)

2. **Create a session:**
   ```bash
   curl -X POST https://your-app.com/api/run/create \
     -H "Content-Type: application/json" \
     -d '{"classCode": "SOCI101", "gameMode": "solidarity-mechanical"}'
   ```

   Available game modes:
   - `classic` - Contribute or Protect (8 rounds, groups of 4)
   - `solidarity-mechanical` - Mechanical Solidarity (2 rounds, groups of 6)
   - `solidarity-organic` - Organic Solidarity (2 rounds, groups of 6)
   - `consensus` - Red/Blue coordination (4 rounds, groups of 4)
   - `mechanical` - Simple unanimity game (4 rounds, groups of 4)

3. **Save the dashboard URL** from the response

4. **Share the class code** with students (e.g., write "SOCI101" on the board)

### During Class

1. **Project the dashboard** using the URL from step 3
2. **Direct students** to your app URL on their phones
3. **Students enter the class code** and wait in the queue
4. **Games auto-start** when enough players are matched (4 or 6 depending on mode)
5. **Monitor in real time** - watch patterns emerge as groups complete rounds

### For Durkheim Contrast

Run two sessions back-to-back:

1. Create a `solidarity-mechanical` session
2. Let students play (2 rounds, ~3 minutes)
3. Discuss briefly: "What did you notice about which choices felt 'right'?"
4. Create a `solidarity-organic` session with new class code
5. Same students play again
6. Discuss: "What changed? The roles were identical."

---

## Debrief Discussion Prompts

### Collective Action (Classic Mode)
- How did your group's behavior change across rounds?
- What happened before the bonus rounds (4 and 8)?
- Why might "Protect" feel more defensible even when it hurts the group?
- Compare your group's total to the 76-point benchmark. What would it take to get there?

### Durkheim Solidarity Modes
- Why did conformity feel safe in one game and harmful in the other?
- Why was deviance punished in the first game but necessary in the second?
- What kind of society would make each rule set feel "natural"?
- How did coordination happen without communication?

### General
- Who in your group seemed to lead? Did that change across rounds?
- Did you ever sacrifice your score to "punish" another player? Why?
- What would happen if you could talk to your group between rounds?

---

## Technical Requirements

- **Students:** Any modern smartphone browser (no app install)
- **Instructor:** Dashboard URL projected on screen
- **Scale:** Tested for 400 concurrent students
- **Time:** Classic mode ~15 min, Solidarity modes ~5 min each

See [DEVELOPMENT.md](DEVELOPMENT.md) for deployment and development details.

---

## Quick Start (Local Development)

```bash
git clone https://github.com/nealcaren/coordination.git
cd coordination
npm install
npm run dev
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000

Create a test session:
```bash
curl -X POST http://localhost:3000/api/run/create \
  -H "Content-Type: application/json" \
  -d '{"classCode": "TEST", "gameMode": "classic"}'
```

---

## License

MIT - Educational use encouraged.

---

## Credits

Designed for sociology education. Inspired by the classic "Win As Much As You Can" exercise and Durkheim's *The Division of Labor in Society*.
