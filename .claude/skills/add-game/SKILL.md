---
name: add-game
description: Adds a new multiplayer game to the platform, following the established Pig/Yahtzee pattern (SignalR real-time, MongoDB persistence, React frontend).
user-invocable: true
---

# Add a New Game

The canonical reference implementations are **Pig Dice** (first game, includes bots) and **Yahtzee** (second game, confirmed the pattern). Read both before starting. The full architectural reference is in the Obsidian vault at `games/game implementation guidelines.md`.

The user will tell you the game name (e.g. "Blackjack"). Derive all identifiers from it:

| Concept | Pattern | Example |
|---|---|---|
| C# class prefix | PascalCase | `Blackjack` |
| Route / slug prefix | lowercase | `blackjack` |
| Slug format | `{prefix}-{6 random alphanumeric chars}` | `blackjack-a1b2c3` |
| MongoDB collection | `{prefix}_games` | `blackjack_games` |
| SignalR hub route | `/hubs/{prefix}` | `/hubs/blackjack` |
| Hub group (game) | `{prefix}-{slug}` | `blackjack-abc123` |
| Hub group (list) | `{prefix}-list` | `blackjack-list` |
| Frontend routes | `/{prefix}`, `/{prefix}/:slug` | `/blackjack`, `/blackjack/:slug` |
| Frontend pages | `{Name}GameList.jsx`, `{Name}Game.jsx` | `BlackjackGameList.jsx`, `BlackjackGame.jsx` |

---

## Backend — files to create

All new files under `backend/src/SecondCircuitProfiles.Api/`.

### 1. Model (`Models/{Name}Game.cs`)

Status enum: `Lobby`, `InProgress`, `Finished`, `Closed`.

Participant fields (mandatory):
- `UserId`, `Username` (discord_username), `DisplayName` (alternative_name — may differ), `UserSlug`, `AvatarUrl`
- `Role` ("player" | "watcher"), `IsConnected`
- `[BsonIgnore] string? ConnectionId` (transient)
- game-specific score fields

Game fields (mandatory):
- `Id` (ObjectId), `Slug`, `Name`, `GmUserId`, `GmUsername`
- `List<{Name}Participant> Participants`
- `int CurrentPlayerIndex`
- `bool PlayAgainVoteActive`, `Dictionary<string, bool> PlayAgainVotes`
- `{Name}GameStatus Status`, `LastActivity`, `CreatedAt`, `UpdatedAt`
- `[BsonIgnore] SemaphoreSlim Lock = new(1, 1)`
- `[BsonIgnore] CancellationTokenSource? IdleCts`, `DisconnectCts`, `PlayAgainCts`

Also add `GetParticipant(userId)` helper, and `CurrentActiveUserId` computed property.

**TurnOrder approach:** Pig uses an explicit `List<string> TurnOrder`; Yahtzee derives it at runtime from `Participants.Where(p => p.Role == "player")`. Choose the one that fits the game.

### 2. Service interface (`Services/I{Name}Service.cs`)

Define DTOs in the same file. Minimum required methods:

```csharp
Task<({Name}Game game, string? error)> CreateGameAsync(
    string userId, string username, string? displayName, string? userSlug, string? avatarUrl, string? customName);

Task<({Name}GameStateDto? state, string? error)> HandleConnectionAsync(
    string? slug, string userId, string username, string? displayName, string? userSlug, string? avatarUrl,
    string connectionId, bool isListMode);

Task HandleDisconnectionAsync(string? slug, string userId, string connectionId, bool isListMode);

Task<List<{Name}GameSummaryDto>> GetOpenGamesAsync(int page, int pageSize);
Task<int> GetOpenGamesCountAsync();

Task StartGameAsync(string slug, string userId);
Task CancelGameAsync(string slug, string userId);
Task VotePlayAgainAsync(string slug, string userId, bool vote);
Task InitiatePlayAgainAsync(string slug, string userId);
Task SendChatAsync(string slug, string userId, string username, string text);
Task CleanupAbandonedGamesAsync();
// + game-specific action methods
```

No `IHubCallerClients` or `IGroupManager` in the interface — services receive a `IHubContext<{Name}Hub>` via DI.

### 3. Service (`Services/{Name}Service.cs`)

Constructor signature:
```csharp
public class {Name}Service(
    MongoDbContext db,
    IHubContext<{Name}Hub> hub,
    ILogger<{Name}Service> logger,
    IGameStatsService gameStatsService) : I{Name}Service
```

Key constants:
```csharp
private const int MaxActivePlayers = 6;       // tune per game
private const int IdleTimeoutSeconds = 60;    // Pig: 60, Yahtzee: 90
private const int DisconnectTimeoutSeconds = 30;
private const int PlayAgainTimeoutSeconds = 60;
private const string ListGroup = "{prefix}-list";
private static string GameGroup(string slug) => $"{prefix}-{slug}";
```

In-memory state: `private readonly ConcurrentDictionary<string, {Name}Game> _games = new();`

**Lock pattern** — every public method touching a game:
```csharp
await game.Lock.WaitAsync();
try { ... }
finally { game.Lock.Release(); }
```

**Persistence** — filter by Slug, not Id:
```csharp
private async Task PersistAsync({Name}Game game)
{
    game.UpdatedAt = DateTime.UtcNow;
    var filter = Builders<{Name}Game>.Filter.Eq(g => g.Slug, game.Slug);
    await db.{Name}Games.ReplaceOneAsync(filter, game, new ReplaceOptions { IsUpsert = true });
}
```

**Crash recovery:**
```csharp
private async Task<{Name}Game> GetOrLoadGameAsync(string slug)
{
    if (_games.TryGetValue(slug, out var cached)) return cached;
    var fromDb = await db.{Name}Games.Find(g => g.Slug == slug).FirstOrDefaultAsync()
        ?? throw new InvalidOperationException($"Game '{slug}' not found.");
    foreach (var p in fromDb.Participants) p.IsConnected = false;
    _games[slug] = fromDb;
    return fromDb;
}
```

**Slug generation:**
```csharp
const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
var slug = "{prefix}-" + RandomNumberGenerator.GetString(chars, 6);
```

**Avatar lookup in HandleConnectionAsync:**
```csharp
if (avatarUrl is null && userSlug is not null)
{
    var dbUser = await db.Users.Find(u => u.Slug == userSlug).FirstOrDefaultAsync();
    avatarUrl = dbUser?.ProfileImageFilename;
}
```

**Open games list** — prefer in-memory, MongoDB fallback for fresh restarts.

**BroadcastOpenGames()** — call whenever the visible list might change (create, start, join, finish, cancel, close).

**Idle timer** — countdown sent to the entire game group (not just the active player). On expiry, auto-advance the turn:
- **Yahtzee** — auto-roll if not yet rolled, then auto-select the worst available category.
- **Pig** — skip the active player's turn (turn score lost). Track `ConsecutiveSkips`; two skips in a row → kick the player.

**Stats recording** at game end:
```csharp
await gameStatsService.RecordGameAsync("{prefix}", results, hadBots: false);
```

**Cleanup** — evict from memory if `Status == Closed` or `LastActivity < DateTime.UtcNow.AddHours(-12)`. Also update stale DB records to `Closed`.

### 4. Cleanup service (`Services/{Name}CleanupService.cs`)

Copy `PigCleanupService.cs` verbatim, replace `Pig` → `{Name}`. Runs every 5 minutes.

### 5. Hub (`Hubs/{Name}Hub.cs`)

Claims extraction (same pattern in every hub):
```csharp
private string UserId => Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw ...;
private string Username => Context.User?.FindFirstValue("discord_username") ?? "Unknown";
private string? AlternativeName => Context.User?.FindFirstValue("alternative_name");
private string? UserSlug => Context.User?.FindFirstValue("slug");
private string? GameSlug => Context.GetHttpContext()?.Request.Query["gameSlug"]... ;
private bool IsListMode => Context.GetHttpContext()?.Request.Query["mode"] == "list";
```

`OnConnectedAsync`: abort if not list mode and no slug → add to group → call `HandleConnectionAsync` → send `"GameState"` or `"Error"`.

`OnDisconnectedAsync`: call `HandleDisconnectionAsync`, swallow exceptions.

Hub methods: one per game action, guard with `if (slug is null) return`.

---

## Backend — files to modify

### `Services/MongoDbContext.cs`

Add collection property, initialise in constructor, add 3 indexes in `EnsureIndexes()`: unique on `Slug`, on `Status`, descending on `LastActivity`.

### `Controllers/{Name}Controller.cs`

Inject both `I{Name}Service` and `IUserService`. Look up avatar via `userService.GetBySlug(UserSlug)` before calling `CreateGameAsync`. Pass `AlternativeName` from the `alternative_name` claim.

### `Program.cs`

```csharp
// Service registration
builder.Services.AddSingleton<I{Name}Service, {Name}Service>();
builder.Services.AddHostedService<{Name}CleanupService>();

// JWT for SignalR — extend the existing OnMessageReceived lambda
path.StartsWithSegments("/hubs/{prefix}")   // add alongside existing hub paths

// Hub mapping
app.MapHub<{Name}Hub>("/hubs/{prefix}");
```

`IGameStatsService` is already registered — do not add it again.

---

## Frontend — files to create

### `frontend/src/pages/{Name}GameList.jsx`

Copy `PigGameList.jsx`. Change:
- SignalR URL: `/hubs/{prefix}?mode=list&access_token=${token}`
- Import `create{Name}Game` from `../lib/api`
- Navigate to `/{prefix}/${res.data.slug}` after creation
- Update display text/headings

### `frontend/src/pages/{Name}Game.jsx`

Copy `PigGame.jsx`. The reducer action types and state shape change per game — this is where the actual game UI and logic lives. Keep:
- `useReducer` with `dispatch`-based state machine
- `phase` as top-level discriminant: `connecting → lobby → in-progress → finished → play-again → closed | error`
- SignalR URL: `/hubs/{prefix}?gameSlug={slug}&access_token=${token}`
- `Avatar` helper (deterministic gradient by username hash)
- `ParticipantCard` structure
- `IdleCountdownRing` — SVG ring countdown to all players. State needs `idleCountdown` (current value) and `idleCountdownMax` (captured once at first tick, when `state.idleCountdown === null`). Reset both to `null` on turn transition. Ring turns amber → red + pulsing below 33%.

---

## Frontend — files to modify

### `frontend/src/lib/api.js`

```js
export const create{Name}Game = (customName) =>
    api.post('/api/{prefix}', { customName: customName || null })

export const getOpen{Name}Games = (page = 1, pageSize = 20) =>
    api.get('/api/{prefix}', { params: { page, pageSize } })
```

Do **not** add `.then(r => r.data)` — the existing game functions return the raw axios response, and the frontend accesses `res.data.slug`.

### `frontend/src/App.jsx`

```jsx
import {Name}GameList from './pages/{Name}GameList';
import {Name}Game from './pages/{Name}Game';

<Route path="/{prefix}" element={<{Name}GameList />} />
<Route path="/{prefix}/:slug" element={<ProtectedRoute><{Name}Game /></ProtectedRoute>} />
```

### `frontend/src/components/Navbar.jsx`

Add nav link next to existing game links.

---

## Implementation Order

1. Model → service interface + DTOs → service → cleanup service → hub
2. MongoDbContext → controller → Program.cs
3. `api.js` → GameList page → Game page
4. `App.jsx` routes → Navbar link
5. Smoke test: create game, join from second browser tab, play a full turn

---

## Questions to Confirm Before Starting

- Game name (determines all identifiers)
- Max concurrent players (default: 6)
- Turn-based or simultaneous?
- Win condition
- Idle timeout duration (default: 60 s)
- Bots needed? (Pig has them; Yahtzee does not)
- Play Again voting needed? (default: yes)
- On Play Again yes: return to Lobby like Pig (GM must restart), or restart directly like Yahtzee?
