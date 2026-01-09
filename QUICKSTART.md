# Quick Start Guide

## Get the Game Running in 5 Minutes! 🚀

### 1. Install Dependencies (First time only)

```bash
# Install root dependencies
npm install

# Install server and client dependencies
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Set Up Environment

```bash
# Copy environment files
cp server/.env.example server/.env
cp client/.env.example client/.env

# No need to edit them for local development!
```

### 3. Start the Application

**Option A: Start everything at once (recommended)**
```bash
npm run dev
```

**Option B: Start server and client separately**

Terminal 1 (Server):
```bash
npm run dev:server
```

Terminal 2 (Client):
```bash
npm run dev:client
```

### 4. Create a Class Run

Open a new terminal and create a class session:

```bash
curl -X POST http://localhost:3000/api/run/create \
  -H "Content-Type: application/json" \
  -d '{"classCode": "TEST101"}'
```

You'll get back:
```json
{
  "runId": "abc123...",
  "classCode": "TEST101",
  "dashboardUrl": "http://localhost:3000/dashboard/abc123?token=..."
}
```

### 5. Test with Students

1. Open **http://localhost:3001** in your browser (or on your phone)
2. Enter class code: **TEST101**
3. Click "Join Game"
4. Open 3 more browser tabs/phones and repeat
5. Watch them get matched into a group!
6. Play the 8-round game

## Testing with Multiple Students

### On Your Computer
- Open 4 browser tabs
- Use different browsers (Chrome, Firefox, Safari, Edge)
- Use incognito/private windows

### On Mobile Devices
- Find your computer's IP address:
  ```bash
  # Mac/Linux
  ifconfig | grep "inet "

  # Windows
  ipconfig
  ```
- Update `client/.env`:
  ```
  VITE_SERVER_URL=http://YOUR_IP:3000
  ```
- Open `http://YOUR_IP:3001` on phones

## Common Issues

### "Cannot connect to server"
- Make sure server is running: `npm run dev:server`
- Check server is on port 3000: `http://localhost:3000/health`

### "Queue never matches"
- You need exactly 4 players to form a group
- Check server logs for errors
- Verify all players used the same class code

### Changes not showing
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Restart dev servers

## What's Happening Behind the Scenes

1. **Server starts** → Initializes SQLite database
2. **Client opens** → Shows join screen
3. **Student joins** → Connects via Socket.IO, enters queue
4. **4 students in queue** → Server creates session, matches them
5. **Round starts** → 18-second timer begins
6. **Players submit** → Moves stored in database
7. **All submit or timeout** → Payoffs calculated, results broadcast
8. **8 rounds complete** → Final scores shown, can play again

## Next Steps

- **Run tests**: `npm test` (97 tests should pass!)
- **Check coverage**: `npm run test:coverage`
- **Build for production**: `npm run build`
- **Read the docs**: See README.md for full details

## Quick Reference

| What | Where | Port |
|------|-------|------|
| Student UI | http://localhost:3001 | 3001 |
| Server API | http://localhost:3000 | 3000 |
| Health Check | http://localhost:3000/health | 3000 |
| Database | ./data/game.db | - |

## Tips for Class Day

1. **Create run before class** with real class code (e.g., "SOCI101")
2. **Share QR code** pointing to client URL with class code parameter
3. **Project dashboard** (coming soon!) to show live statistics
4. **Have backup plan** - print instructions in case of tech issues
5. **Test beforehand** with friends/colleagues to verify setup

Happy gaming! 🎮
