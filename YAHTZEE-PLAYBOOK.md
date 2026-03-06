# Yahtzee — Implementation Playbook

## Identifiers

| Concept | Value |
|---------|-------|
| C# class prefix | `Yahtzee` |
| Route / slug prefix | `yahtzee` |
| Slug format | `yahtzee-{6 random alphanumeric chars}` |
| MongoDB collection | `yahtzee_games` |
| SignalR hub route | `/hubs/yahtzee` |
| Hub group (game) | `yahtzee-{slug}` |
| Hub group (list) | `yahtzee-list` |
| Frontend routes | `/yahtzee`, `/yahtzee/:slug` |
| Frontend pages | `YahtzeeGameList.jsx`, `YahtzeeGame.jsx` |

---

## Game Parameters

| Parameter | Value |
|-----------|-------|
| Players | 2–6 (additional joiners become watchers) |
| Idle timeout | 90 seconds |
| Disconnect timeout | 30 seconds (same as Pig) |
| Play Again timeout | 60 seconds (same as Pig) |
| Bonus Yahtzee | Yes — +100 per additional Yahtzee after the first |
| Forced 0-entry | Yes — player must always select a category each turn |
| Play Again mechanic | Identical to Pig (all players vote, majority wins) |

---

## Game Rules Summary

1. The GM creates a lobby. 2–6 players join; extras become watchers.
2. The GM starts the game. Turn order follows join order.
3. On their turn, the active player:
   a. Rolls all 5 dice (mandatory first roll).
   b. Optionally holds any dice and rolls again (up to 2 more times, 3 rolls total).
   c. Must select exactly one unfilled scoring category — even if the result is 0 points.
4. After all players have filled all 13 categories, the game ends.
5. The player with the highest total score wins.

---

## Scoring Categories

### Upper Section (sum of the named die face)

| Category | Points |
|----------|--------|
| Ones | Sum of all 1s |
| Twos | Sum of all 2s |
| Threes | Sum of all 3s |
| Fours | Sum of all 4s |
| Fives | Sum of all 5s |
| Sixes | Sum of all 6s |
| **Upper Bonus** | +35 automatically if upper section total >= 63 |

### Lower Section

| Category | Points |
|----------|--------|
| Three of a Kind | Sum of all dice (requires >= 3 of one face) |
| Four of a Kind | Sum of all dice (requires >= 4 of one face) |
| Full House | 25 (requires exactly 3 of one face + 2 of another) |
| Small Straight | 30 (requires 4 sequential faces) |
| Large Straight | 40 (requires 5 sequential faces) |
| Yahtzee | 50 (requires all 5 dice showing same face) |
| Chance | Sum of all dice (always valid) |

### Bonus Yahtzee Rule

If a player has already scored 50 in the Yahtzee category and rolls another Yahtzee:
- +100 bonus is automatically added to their score.
- The player must still select a category (Joker rule applies):
  - If the corresponding upper section category is unfilled, it must be chosen.
  - Otherwise, any lower section category may be chosen (Full House = 25, Straights = 30/40, others = sum of dice).
  - If all lower section categories are filled, choose any unfilled upper section category (scores the sum of the matching face, possibly 0).

All scoring is computed and validated server-side. The client sends only `SelectScore(category)`; the server calculates the value and broadcasts the result.

---

## Data Model

```csharp
public enum YahtzeeGameStatus { Lobby, InProgress, Finished, Closed }

public class YahtzeeScoreCard
{
    // Upper section — null = not yet filled
    public int? Ones { get; set; }
    public int? Twos { get; set; }
    public int? Threes { get; set; }
    public int? Fours { get; set; }
    public int? Fives { get; set; }
    public int? Sixes { get; set; }

    // Lower section — null = not yet filled
    public int? ThreeOfAKind { get; set; }
    public int? FourOfAKind { get; set; }
    public int? FullHouse { get; set; }
    public int? SmallStraight { get; set; }
    public int? LargeStraight { get; set; }
    public int? Yahtzee { get; set; }
    public int? Chance { get; set; }

    // Computed / auto-applied
    public int UpperBonus => UpperTotal >= 63 ? 35 : 0;
    public int YahtzeeBonusCount { get; set; } // +100 each
    public int UpperTotal => (Ones ?? 0) + (Twos ?? 0) + (Threes ?? 0)
                           + (Fours ?? 0) + (Fives ?? 0) + (Sixes ?? 0);
    public int GrandTotal => UpperTotal + UpperBonus
                           + (ThreeOfAKind ?? 0) + (FourOfAKind ?? 0)
                           + (FullHouse ?? 0) + (SmallStraight ?? 0)
                           + (LargeStraight ?? 0) + (Yahtzee ?? 0)
                           + (Chance ?? 0) + YahtzeeBonusCount * 100;
    public bool IsComplete => Ones.HasValue && Twos.HasValue && Threes.HasValue
                            && Fours.HasValue && Fives.HasValue && Sixes.HasValue
                            && ThreeOfAKind.HasValue && FourOfAKind.HasValue
                            && FullHouse.HasValue && SmallStraight.HasValue
                            && LargeStraight.HasValue && Yahtzee.HasValue
                            && Chance.HasValue;
}

public class YahtzeeParticipant
{
    public string UserId { get; set; }
    public string Username { get; set; }
    public string UserSlug { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; }        // "player" | "watcher"
    public bool IsConnected { get; set; }
    [BsonIgnore] public string? ConnectionId { get; set; }
    public YahtzeeScoreCard ScoreCard { get; set; } = new();
}

public class YahtzeeGame
{
    [BsonId] public ObjectId Id { get; set; }
    public string Slug { get; set; }
    public string Name { get; set; }
    public string GmUserId { get; set; }
    public string GmUsername { get; set; }
    public List<YahtzeeParticipant> Participants { get; set; } = [];

    // Turn state
    public int[] CurrentDice { get; set; } = [0, 0, 0, 0, 0];
    public bool[] HeldDice { get; set; } = [false, false, false, false, false];
    public int RollCount { get; set; }          // 0–3; 0 = turn not yet started
    public bool ScoredThisTurn { get; set; }    // true after SelectScore
    public int CurrentPlayerIndex { get; set; }

    public YahtzeeGameStatus Status { get; set; } = YahtzeeGameStatus.Lobby;
    public DateTime LastActivity { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [BsonIgnore] public SemaphoreSlim Lock { get; } = new(1, 1);
    [BsonIgnore] public CancellationTokenSource? IdleCts { get; set; }
    [BsonIgnore] public CancellationTokenSource? PlayAgainCts { get; set; }
}
```

---

## Backend Files

### Files to Create

| File | Notes |
|------|-------|
| `Models/YahtzeeGame.cs` | Model + ScoreCard + Participant as above |
| `Services/IYahtzeeService.cs` | Service interface (see below) |
| `Services/YahtzeeService.cs` | Full game logic + state machine |
| `Services/YahtzeeCleanupService.cs` | Copy PigCleanupService, replace Pig → Yahtzee |
| `Hubs/YahtzeeHub.cs` | Copy PigHub structure, adapt hub methods |
| `Controllers/YahtzeeController.cs` | POST + GET endpoints (copy PigController) |

### Service Interface

```csharp
public interface IYahtzeeService
{
    Task<YahtzeeGame> CreateGameAsync(string gmUserId, string gmUsername, string? gmAvatarUrl, string? customName);
    Task<(YahtzeeGame? game, string? error)> HandleConnectionAsync(string connectionId, string gameSlug, string userId, string username, string userSlug, string? avatarUrl, IHubCallerClients clients, IGroupManager groups);
    Task HandleDisconnectionAsync(string connectionId, IHubCallerClients clients, IGroupManager groups);
    Task<PagedResult<YahtzeeGameSummaryDto>> GetOpenGamesAsync(int page, int pageSize);
    Task RollDiceAsync(string connectionId, IHubCallerClients clients);
    Task ToggleHoldAsync(string connectionId, int diceIndex, IHubCallerClients clients);
    Task SelectScoreAsync(string connectionId, string category, IHubCallerClients clients, IGroupManager groups);
    Task VotePlayAgainAsync(string connectionId, bool vote, IHubCallerClients clients, IGroupManager groups);
    Task CleanupAbandonedGamesAsync();
}
```

### Key Service Constants

```csharp
private const int MaxActivePlayers = 6;
private const int IdleTimeoutSeconds = 90;
private const int DisconnectTimeoutSeconds = 30;
private const int PlayAgainTimeoutSeconds = 60;
private static string GameGroup(string slug) => $"yahtzee-{slug}";
private const string ListGroup = "yahtzee-list";
```

### Files to Modify

**`Services/MongoDbContext.cs`**
```csharp
// Property:
public IMongoCollection<YahtzeeGame> YahtzeeGames { get; }

// Constructor:
YahtzeeGames = database.GetCollection<YahtzeeGame>("yahtzee_games");

// EnsureIndexes():
await YahtzeeGames.Indexes.CreateManyAsync([
    new CreateIndexModel<YahtzeeGame>(Builders<YahtzeeGame>.IndexKeys.Ascending(g => g.Slug),   new CreateIndexOptions { Unique = true }),
    new CreateIndexModel<YahtzeeGame>(Builders<YahtzeeGame>.IndexKeys.Ascending(g => g.Status)),
    new CreateIndexModel<YahtzeeGame>(Builders<YahtzeeGame>.IndexKeys.Descending(g => g.LastActivity)),
]);
```

**`Program.cs`**
```csharp
// Service registration:
builder.Services.AddSingleton<IYahtzeeService, YahtzeeService>();
builder.Services.AddHostedService<YahtzeeCleanupService>();

// JWT for SignalR — extend existing OnMessageReceived lambda:
if (!string.IsNullOrEmpty(accessToken) && (
    path.StartsWithSegments("/hubs/pig") ||
    path.StartsWithSegments("/hubs/yahtzee")))  // <- add this line
    context.Token = accessToken;

// Hub mapping:
app.MapHub<YahtzeeHub>("/hubs/yahtzee");
```

---

## SignalR Messages

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `GameState` | Full game state | On connect / rejoin |
| `DiceRolled` | `{ dice: int[5], heldDice: bool[5], rollCount: int }` | After each roll |
| `HoldToggled` | `{ diceIndex: int, isHeld: bool }` | Immediately, visible to all |
| `ScoreSelected` | `{ userId, category, points, updatedScoreCard, grandTotal }` | After category selection |
| `TurnChanged` | `{ currentPlayerIndex: int, playerName: string }` | On turn advance |
| `YahtzeeBonusAwarded` | `{ userId, bonusCount: int }` | When bonus Yahtzee triggers |
| `GameFinished` | `{ rankings: [{ userId, username, grandTotal, scoreCard }] }` | Game end |
| `IdleCountdown` | `{ seconds: int }` | Every second during idle timer |
| `PlayAgainVote` | `{ userId, vote: bool, votesFor, votesAgainst, total }` | Like Pig |
| `PlayAgainCountdown` | `{ seconds: int }` | Like Pig |

### Client → Server (Hub Methods)

| Method | Parameters | Guard conditions |
|--------|-----------|-----------------|
| `RollDice` | — | Active player only; rollCount < 3; !scoredThisTurn |
| `ToggleHold` | `diceIndex: int` | Active player only; rollCount >= 1 and < 3 |
| `SelectScore` | `category: string` | Active player only; rollCount >= 1; category unfilled |
| `VotePlayAgain` | `vote: bool` | Play-Again phase only |

---

## Frontend Files

### Files to Create

| File | Notes |
|------|-------|
| `src/pages/YahtzeeGameList.jsx` | Copy PigGameList, adapt hub URL and API call |
| `src/pages/YahtzeeGame.jsx` | Full game page — see UI spec below |
| `src/components/CountdownRing.jsx` | Reusable SVG arc countdown component |

### CountdownRing Component Spec

SVG circle with `stroke-dashoffset` animation:
- `radius = 20`, `circumference ≈ 125.66`
- Full circle (90s) → empty (0s) via `stroke-dashoffset: 0 → 125.66`
- Colour transitions: green → orange (< 30s) → red (< 15s)
- Displayed for all participants; tracks the active player's remaining time
- Hidden in Lobby and Finished phases

```jsx
// Usage:
<CountdownRing seconds={idleSeconds} maxSeconds={90} size={48} />
```

### YahtzeeGame.jsx — Reducer Phases

```
connecting → lobby → in-progress → finished → play-again → closed
                                                          ↗
                                              error (any phase)
```

### UI Layout (In-Progress Phase)

```
┌──────────────────────────────────────────────────────┐
│  Active player: Bob          [CountdownRing]  2/3    │
│                                                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│  │ 3  │ │ 6  │ │ 2  │ │ 6  │ │ 1  │   <- Dice       │
│  │    │ │HELD│ │    │ │HELD│ │    │                  │
│  └────┘ └────┘ └────┘ └────┘ └────┘                 │
│                  [ Roll Dice ]                        │
├──────────────────────────────────────────────────────┤
│  Last action: Bob → Three of a Kind (+14 points)     │
├──────────────────────────────────────────────────────┤
│  [You (Alice)] [Bob] [Chris] ...   <- tabs           │
│                                                       │
│  Your Scorecard:                                      │
│  ┌──────────────────┬────────┐                        │
│  │ Ones             │   3    │  <- filled, greyed out │
│  │ Twos             │  ---   │                        │
│  │ ...              │        │                        │
│  │ Upper Bonus      │  ---   │  (+35 if >= 63)        │
│  ├──────────────────┼────────┤                        │
│  │ Three of a Kind  │ [14]   │  <- selectable, highlighted │
│  │ Four of a Kind   │  ---   │                        │
│  │ Full House       │  [0]   │  <- selectable (forced 0)  │
│  │ Small Straight   │  ---   │                        │
│  │ Large Straight   │  ---   │                        │
│  │ Yahtzee          │  ---   │                        │
│  │ Chance           │ [17]   │  <- selectable, highlighted │
│  ├──────────────────┼────────┤                        │
│  │ TOTAL            │   37   │                        │
│  └──────────────────┴────────┘                        │
│                                                       │
│  > Bob's Scorecard  (collapsed, click to expand)     │
│  > Chris's Scorecard (collapsed, click to expand)    │
└──────────────────────────────────────────────────────┘
```

**Scorecard interaction rules:**
- Only the **active player** sees highlighted/selectable categories (with pre-calculated points).
- Pre-calculated values shown in brackets — e.g. `[14]`, `[0]`.
- Filled categories are greyed out and non-interactive.
- Categories only become selectable after at least 1 roll.
- Other players' scorecards are collapsible accordions, read-only.
- Watchers see everything but cannot interact.

### Files to Modify

**`src/lib/api.js`**
```js
export const createYahtzeeGame = (customName) =>
    api.post('/api/yahtzee', { customName }).then(r => r.data);

export const getOpenYahtzeeGames = (page = 1, pageSize = 20) =>
    api.get('/api/yahtzee', { params: { page, pageSize } }).then(r => r.data);
```

**`src/App.jsx`**
```jsx
import YahtzeeGameList from './pages/YahtzeeGameList';
import YahtzeeGame from './pages/YahtzeeGame';

// Inside <Routes>:
<Route path="/yahtzee" element={<YahtzeeGameList />} />
<Route path="/yahtzee/:slug" element={<ProtectedRoute><YahtzeeGame /></ProtectedRoute>} />
```

**`src/components/Navbar.jsx`**
```jsx
<NavLink to="/yahtzee">Yahtzee</NavLink>
```

---

## Implementation Order

1. `Models/YahtzeeGame.cs` — model, scorecard, scoring helpers (static methods)
2. `Services/IYahtzeeService.cs` — interface
3. `Services/YahtzeeService.cs` — state machine, lock pattern, persistence
4. `Services/YahtzeeCleanupService.cs` — copy + rename from Pig
5. `Hubs/YahtzeeHub.cs` — hub methods
6. `Controllers/YahtzeeController.cs` — POST + GET
7. `Services/MongoDbContext.cs` + `Program.cs` — wire up
8. `src/lib/api.js` — two API functions
9. `src/components/CountdownRing.jsx` — reusable timer component
10. `src/pages/YahtzeeGameList.jsx` — game list page
11. `src/pages/YahtzeeGame.jsx` — full game page (reducer + UI)
12. `src/App.jsx` + `src/components/Navbar.jsx` — routes + nav link

---

## Smoke Test Checklist

- [ ] Create game → appears in game list
- [ ] Second browser tab joins → both see lobby
- [ ] GM starts game → turn order established
- [ ] Roll dice → dice values update for all participants
- [ ] Hold toggle → held state visible to all
- [ ] Re-roll → only non-held dice change
- [ ] Select category → scorecard updates, turn advances
- [ ] Forced 0-entry → selectable with [0] shown
- [ ] Bonus Yahtzee → +100 applied, toast/notification shown
- [ ] Upper bonus → auto-applied when upper total >= 63
- [ ] All 13 categories filled for all players → game ends, rankings shown
- [ ] Idle countdown ring visible and counts down for all
- [ ] Play Again vote → new round with same players
- [ ] Disconnect / reconnect → game state restored
- [ ] Watcher joins → sees full state, cannot interact
