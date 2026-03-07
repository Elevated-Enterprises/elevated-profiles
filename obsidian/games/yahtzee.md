# Yahtzee

Yahtzee is a real-time multiplayer dice game for the Second Circuit community. It is built into the profiles platform at [profiles.secondcircuit.io](https://profiles.secondcircuit.io).

---

## How to Play

### Objective

Fill your scorecard with the highest possible total. The player with the highest **grand total** at the end wins.

### Your Turn

On your turn you have up to **three rolls**:

1. **First roll** — all five dice are rolled. Holds from a previous roll do not carry over to the first roll; all dice are always re-rolled on the first roll of a turn.
2. **Between rolls** — click any dice you want to keep (hold them), then roll again.
3. **Third roll** — after your third roll you must select a scoring category.

You may score after your **first or second roll** if you are happy with the result — you do not have to use all three rolls.

### Scoring

After rolling, choose a category on your scorecard to assign the dice. Each category can only be used once per game. If the dice do not qualify for the category you choose, you score **0** in that slot (a "sacrifice").

#### Upper Section

| Category | Score |
|---|---|
| Ones | Sum of all 1s |
| Twos | Sum of all 2s |
| Threes | Sum of all 3s |
| Fours | Sum of all 4s |
| Fives | Sum of all 5s |
| Sixes | Sum of all 6s |

**Upper bonus:** If your upper section total reaches **63 or more**, you earn a **+35 bonus**.

#### Lower Section

| Category | Requirement | Score |
|---|---|---|
| Three of a Kind | At least 3 dice the same | Sum of all dice |
| Four of a Kind | At least 4 dice the same | Sum of all dice |
| Full House | Three of one + two of another | 25 |
| Small Straight | 4 sequential dice (e.g. 1-2-3-4) | 30 |
| Large Straight | 5 sequential dice (e.g. 2-3-4-5-6) | 40 |
| Yahtzee | All 5 dice the same | 50 |
| Chance | Any dice | Sum of all dice |

### Yahtzee Bonus

If you roll a Yahtzee and you have already scored 50 in the Yahtzee category, you earn a **+100 bonus** for each additional Yahtzee you roll. This is tracked separately on your scorecard.

#### Joker Rules (Bonus Yahtzee scoring)

When you roll a bonus Yahtzee (all five dice matching), special joker rules apply to where you may score it:

1. If the matching upper section category (e.g. Fives for five 5s) is unfilled, you **must** score it there.
2. If that category is already filled, you may score it in any **lower section** category — and you receive the fixed category value (e.g. Full House = 25) even if the dice would not normally qualify.
3. If all lower section categories are filled, you may score it in any remaining **upper section** category.

### End of Game

The game ends when all players have filled every category on their scorecard. Rankings are shown by grand total.

---

## Lobby & Rooms

- Any logged-in community member can create a new game room from the Yahtzee page.
- You can give the room a custom name, or it will be named after you automatically.
- The room creator is the **Game Master (GM)**. The GM starts the game when everyone is ready.
- Up to **4 players** can participate. Any additional people who join can watch.
- Players can join the lobby but not after the game has started (late joiners become watchers).

### Game Master Controls

- **Start Game** — begins the game (requires at least 2 players).
- **Cancel Game** — closes the room before the game starts.

---

## Disconnections & Idle Timer

To keep games moving:

- If the active player is **idle for 90 seconds**, a countdown timer appears on screen. When it reaches zero, the game automatically selects the **lowest-scoring available category** and advances the turn.
- If the active player **disconnects**, there is a **30-second reconnect window**. If they reconnect, the game continues. If not, their turn is auto-completed (the worst available category is selected for them).
- Watchers who disconnect are removed from the room silently.

---

## After the Game

When all scorecards are complete, the GM can propose a **Play Again** vote. All players vote yes or no. A majority yes resets all scorecards and starts a new game immediately — unlike Pig, Yahtzee skips the lobby and goes straight back into play. Watchers who are still connected get promoted to players first (up to the 4-player limit). If the GM votes no, the room closes immediately.

The Play Again vote has a **60-second timeout**.

---

## Leaderboards

Game results are recorded to the platform's leaderboard system. Stats include wins, losses, and games played, visible on the Games page.

---

## Technical Notes

*(For contributors and the curious.)*

- Real-time multiplayer via **SignalR** (WebSockets with long-polling fallback).
- Game state is persisted to **MongoDB** after every significant action, so games survive a server restart.
- Rooms are automatically cleaned up after **12 hours** of inactivity.
- All dice rolls and category selections are processed server-side. The client sends intent (roll, hold die index, select category); the server validates and broadcasts the new state to all participants.
- Chat is available throughout the game for all participants.
- No bots — Yahtzee is human players only.
