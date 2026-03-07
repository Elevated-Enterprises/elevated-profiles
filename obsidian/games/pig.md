# Pig Dice

Pig Dice is a real-time multiplayer dice game for the Second Circuit community. It is built into the profiles platform at [profiles.secondcircuit.io](https://profiles.secondcircuit.io).

---

## How to Play

### Objective

Be the first player to reach **100 points**.

### Your Turn

On your turn you can do two things:

- **Roll** — roll a single die and add the result to your turn score.
- **Hold** — bank your turn score, adding it permanently to your total, then pass the turn.

### The Pig Rule

If you roll a **1**, you lose all points accumulated this turn and your turn ends immediately. Your banked total is safe — only the current turn's score is lost.

### Winning

The first player whose total score reaches or exceeds 100 wins the game.

---

## Lobby & Rooms

- Any logged-in community member can create a new game room from the Pig Dice page.
- You can give the room a custom name, or it will be named after you automatically.
- The room creator is the **Game Master (GM)**. The GM starts the game when everyone is ready.
- Up to **6 players** can participate. Any additional people who join can watch.
- Players can join mid-lobby but not after the game has started (late joiners become watchers).

### Game Master Controls

The GM has additional controls in the lobby:

- **Start Game** — begins the game (requires at least 2 players).
- **Cancel Game** — closes the room before the game starts.
- **Kick Player** — remove a player from the room.
- **Add Bot / Remove Bot** — add a computer-controlled player to fill empty slots.

---

## Bots

The game includes AI bots that play automatically. Bots use a simple strategy:
- If the current turn score is 20 or more, hold.
- Otherwise, roll.

Bots act instantly on their turn and never disconnect.

---

## Disconnections & Idle Timer

To keep games moving:

- If the active player is **idle for 60 seconds**, a countdown timer appears. When it reaches zero, the turn is automatically ended (Hold is forced).
- If the active player **disconnects**, there is a **30-second reconnect window**. If they reconnect in time, the game continues. If not, their turn is skipped automatically.
- Watchers who disconnect are removed from the room silently.

---

## After the Game

When the game ends, the GM can propose a **Play Again** vote. All players vote yes or no. If the majority votes yes, a new game starts immediately with the same group (watchers who are still connected get promoted to players first, up to the 6-player limit). If the GM votes no, the room closes immediately.

The Play Again vote has a **60-second timeout** — any player who does not vote in time is counted as absent.

---

## Leaderboards

Game results are recorded to the platform's leaderboard system. Stats tracked include wins, losses, and games played, visible on the Games page.

---

## Technical Notes

*(For contributors and the curious.)*

- Real-time multiplayer via **SignalR** (WebSockets with long-polling fallback).
- Game state is persisted to **MongoDB** after every action, so games survive a server restart.
- Rooms are automatically cleaned up after **12 hours** of inactivity.
- The game is turn-based; only the active player can roll or hold. All other participants see the dice results and score updates in real time.
- Chat is available throughout the game for all participants (players and watchers).
