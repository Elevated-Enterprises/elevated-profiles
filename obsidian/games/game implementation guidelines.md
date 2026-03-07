# Game Implementation Guidelines

This document describes how multiplayer games are built on the Second Circuit Profiles platform. It is the reference for developers adding new games.

All games follow the same architectural pattern. The canonical reference implementation is **Pig Dice**; Yahtzee was the second game and confirmed the pattern works across different game types.

---

## Overview

Each game consists of:

- A **MongoDB document model** (persisted state)
- A **service interface + singleton service** (all game logic; holds in-memory state)
- A **background cleanup service** (evicts abandoned games every 5 minutes)
- A **SignalR hub** (thin real-time transport; no game logic)
- A **REST controller** (create game, list open games)
- Two **frontend pages** (game list, game room)
- Two **API functions** added to `frontend/src/lib/api.js`

---

## Naming Conventions

| Concept | Pattern | Pig example | Yahtzee example |
|---|---|---|---|
| C# class prefix | PascalCase | `Pig` | `Yahtzee` |
| Route / slug prefix | lowercase | `pig` | `yahtzee` |
| Slug format | `{prefix}-{6 random alphanumeric}` | `pig-a1b2c3` | `yahtzee-x9k2mw` |
| MongoDB collection | `{prefix}_games` | `pig_games` | `yahtzee_games` |
| SignalR hub route | `/hubs/{prefix}` | `/hubs/pig` | `/hubs/yahtzee` |
| Hub group (in-game) | `{prefix}-{slug}` | `pig-abc123` | `yahtzee-abc123` |
| Hub group (list) | `{prefix}-list` | `pig-list` | `yahtzee-list` |
| Frontend routes | `/{prefix}`, `/{prefix}/:slug` | `/pig`, `/pig/:slug` | `/yahtzee`, `/yahtzee/:slug` |
| Frontend pages | `{Name}GameList.jsx`, `{Name}Game.jsx` | `PigGameList.jsx`, `PigGame.jsx` | `YahtzeeGameList.jsx`, `YahtzeeGame.jsx` |

---

## Backend

### Model (`Models/{Name}Game.cs`)

Every game model has the same base structure:

```csharp
public enum {Name}GameStatus { Lobby, InProgress, Finished, Closed }

public class {Name}Participant
{
    // Identity (all required)
    public string UserId { get; set; }
    public string Username { get; set; }        // discord_username
    public string? DisplayName { get; set; }    // alternative_name (may differ from username)
    public string? UserSlug { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = "player"; // "player" | "watcher"
    public bool IsConnected { get; set; } = true;

    // Game-specific score fields go here

    [BsonIgnore] public string? ConnectionId { get; set; } // transient
}

public class {Name}Game
{
    // Identity
    public string Id { get; set; }     // MongoDB ObjectId
    public string Slug { get; set; }
    public string Name { get; set; }
    public string GmUserId { get; set; }
    public string GmUsername { get; set; }

    // Participants
    public List<{Name}Participant> Participants { get; set; } = [];

    // Turn tracking (game-specific)
    public int CurrentPlayerIndex { get; set; }

    // Play Again vote
    public bool PlayAgainVoteActive { get; set; }
    public Dictionary<string, bool> PlayAgainVotes { get; set; } = [];

    // Status + timestamps
    public {Name}GameStatus Status { get; set; } = {Name}GameStatus.Lobby;
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Transient (not persisted)
    [BsonIgnore] public SemaphoreSlim Lock { get; } = new(1, 1);
    [BsonIgnore] public CancellationTokenSource? IdleCts { get; set; }
    [BsonIgnore] public CancellationTokenSource? DisconnectCts { get; set; }
    [BsonIgnore] public CancellationTokenSource? PlayAgainCts { get; set; }

    // Derived helpers
    public {Name}Participant? GetParticipant(string userId) =>
        Participants.FirstOrDefault(p => p.UserId == userId);

    public string? CurrentActiveUserId { get; } // game-specific logic
}
```

**Important:** `TurnOrder` is game-specific. Pig maintains an explicit `List<string> TurnOrder`; Yahtzee derives turn order from `Participants.Where(p => p.Role == "player")` at runtime. Choose the approach that fits your game's rules.

---

### Service Interface (`Services/I{Name}Service.cs`)

Define DTOs in the same file as the interface. The mandatory minimum surface:

```csharp
// DTOs
public record {Name}ParticipantDto(string UserId, string Username, string? DisplayName,
    string? UserSlug, string? AvatarUrl, string Role, bool IsConnected /*, game-specific fields */);

public record {Name}GameSummaryDto(string Slug, string Name, string GmUsername,
    {Name}GameStatus Status, int PlayerCount, int WatcherCount, DateTime LastActivity);

public record {Name}GameStateDto(/* all fields the client needs */);

// Interface
public interface I{Name}Service
{
    Task<({Name}Game game, string? error)> CreateGameAsync(
        string userId, string username, string? displayName, string? userSlug, string? avatarUrl, string? customName);

    Task<({Name}GameStateDto? state, string? error)> HandleConnectionAsync(
        string? slug, string userId, string username, string? displayName, string? userSlug, string? avatarUrl,
        string connectionId, bool isListMode);

    Task HandleDisconnectionAsync(string? slug, string userId, string connectionId, bool isListMode);

    Task<List<{Name}GameSummaryDto>> GetOpenGamesAsync(int page, int pageSize);
    Task<int> GetOpenGamesCountAsync();

    // Game-specific actions (examples):
    Task StartGameAsync(string slug, string userId);
    Task CancelGameAsync(string slug, string userId);
    Task VotePlayAgainAsync(string slug, string userId, bool vote);
    Task InitiatePlayAgainAsync(string slug, string userId);
    Task SendChatAsync(string slug, string userId, string username, string text);

    Task CleanupAbandonedGamesAsync();
}
```

No `IHubCallerClients` or `IGroupManager` in the service interface — the hub does its own SignalR group management, and the service receives a `IHubContext<{Name}Hub>` via DI constructor injection.

---

### Service (`Services/{Name}Service.cs`)

Constructor:

```csharp
public class {Name}Service(
    MongoDbContext db,
    IHubContext<{Name}Hub> hub,
    ILogger<{Name}Service> logger,
    IGameStatsService gameStatsService) : I{Name}Service
```

Key constants (tune per game):

```csharp
private const int MaxActivePlayers = 6;      // rest become watchers
private const int IdleTimeoutSeconds = 60;   // Yahtzee uses 90
private const int DisconnectTimeoutSeconds = 30;
private const int PlayAgainTimeoutSeconds = 60;
private const string ListGroup = "{prefix}-list";
private static string GameGroup(string slug) => $"{prefix}-{slug}";
```

In-memory state:

```csharp
private readonly ConcurrentDictionary<string, {Name}Game> _games = new();
```

**Lock pattern** — every public method that touches a game must wrap its body:

```csharp
await game.Lock.WaitAsync();
try { ... }
finally { game.Lock.Release(); }
```

**Persistence** — after every state change:

```csharp
private async Task PersistAsync({Name}Game game)
{
    game.UpdatedAt = DateTime.UtcNow;
    var filter = Builders<{Name}Game>.Filter.Eq(g => g.Slug, game.Slug);
    await db.{Name}Games.ReplaceOneAsync(filter, game, new ReplaceOptions { IsUpsert = true });
}
```

Note: filter by `Slug`, not by `Id`. This is intentional — the slug is the stable external identifier.

**Crash recovery** via `GetOrLoadGameAsync`:

```csharp
private async Task<{Name}Game> GetOrLoadGameAsync(string slug)
{
    if (_games.TryGetValue(slug, out var cached)) return cached;

    var fromDb = await db.{Name}Games.Find(g => g.Slug == slug).FirstOrDefaultAsync()
        ?? throw new InvalidOperationException($"Game '{slug}' not found.");

    foreach (var p in fromDb.Participants)
        p.IsConnected = false; // all connections lost during restart

    _games[slug] = fromDb;
    return fromDb;
}
```

**Slug generation:**

```csharp
private async Task<string> GenerateUniqueSlugAsync()
{
    const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    while (true)
    {
        var slug = "{prefix}-" + RandomNumberGenerator.GetString(chars, 6);
        if (!_games.ContainsKey(slug))
        {
            var existing = await db.{Name}Games.Find(g => g.Slug == slug).AnyAsync();
            if (!existing) return slug;
        }
    }
}
```

**Avatar lookup in `HandleConnectionAsync`:**

```csharp
if (avatarUrl is null && userSlug is not null)
{
    var dbUser = await db.Users.Find(u => u.Slug == userSlug).FirstOrDefaultAsync();
    avatarUrl = dbUser?.ProfileImageFilename;
}
```

**Open games list** — prefer in-memory, fall back to MongoDB (for fresh restarts):

```csharp
public async Task<List<{Name}GameSummaryDto>> GetOpenGamesAsync(int page, int pageSize)
{
    var inMemory = _games.Values
        .Where(g => g.Status is {Name}GameStatus.Lobby or {Name}GameStatus.InProgress)
        .OrderByDescending(g => g.LastActivity)
        .Skip((page - 1) * pageSize).Take(pageSize)
        .Select(ToSummary).ToList();

    if (inMemory.Count > 0) return inMemory;

    // MongoDB fallback
    ...
}
```

**Broadcast open games** whenever the visible list might change:

```csharp
private void BroadcastOpenGames()
{
    var open = _games.Values
        .Where(g => g.Status is {Name}GameStatus.Lobby or {Name}GameStatus.InProgress)
        .OrderByDescending(g => g.LastActivity)
        .Select(ToSummary).ToList();

    _ = hub.Clients.Group(ListGroup).SendAsync("OpenGamesUpdated", open);
}
```

Call `BroadcastOpenGames()` on: game created, game started, player joined, game finished/closed/cancelled.

**Idle timer** (broadcast countdown to entire game group):

```csharp
private void StartIdleTimer({Name}Game game, string slug, string expectedUserId)
{
    game.IdleCts?.Cancel();
    var cts = new CancellationTokenSource();
    game.IdleCts = cts;
    _ = RunIdleTimerAsync(slug, expectedUserId, cts.Token);
}

private async Task RunIdleTimerAsync(string slug, string expectedUserId, CancellationToken ct)
{
    for (var i = IdleTimeoutSeconds; i >= 0; i--)
    {
        if (ct.IsCancellationRequested) return;
        try { await hub.Clients.Group(GameGroup(slug)).SendAsync("IdleCountdown", i, ct); }
        catch (OperationCanceledException) { return; }
        if (i == 0) break;
        try { await Task.Delay(1000, ct); }
        catch (OperationCanceledException) { return; }
    }
    // Auto-advance turn on expiry
    ...
}
```

The `IdleCountdown` event is sent to the **whole group** (all players and watchers), not just the active player.

**Recording stats** at game end via `IGameStatsService`:

```csharp
private async Task RecordStatsAsync({Name}Game game)
{
    var players = /* get all players */;
    if (players.Count < 2) return;

    var winner = /* determine winner */;
    var results = players.Select(p =>
        new GamePlayerResult(p.UserId, p.Username, p.UserSlug, p.UserId == winner.UserId));

    try { await gameStatsService.RecordGameAsync("{prefix}", results, hadBots: false); }
    catch (Exception ex) { logger.LogError(ex, "Failed to record {prefix} game stats."); }
}
```

**Play Again flow:**
1. GM calls `InitiatePlayAgainAsync` (only valid in `Finished` state)
2. Sends `PlayAgainPrompt` with `timeoutSeconds` to game group
3. Players call `VotePlayAgainAsync` (yes/no)
4. If GM votes no → immediately close
5. If all players voted → resolve
6. On timeout → resolve with whatever votes exist
7. Majority yes → reset all score state, promote connected watchers to players (up to `MaxActivePlayers`), broadcast `PlayAgainResult`
8. Majority no (or GM veto) → set status to `Closed`, broadcast `GameClosed`, remove from `_games`

**Cleanup** (runs every 5 minutes, evicts after 12 hours idle):

```csharp
public async Task CleanupAbandonedGamesAsync()
{
    var cutoff = DateTime.UtcNow.AddHours(-12);
    var slugsToRemove = _games.Values
        .Where(g => g.Status is {Name}GameStatus.Closed || g.LastActivity < cutoff)
        .Select(g => g.Slug).ToList();

    foreach (var slug in slugsToRemove)
    {
        if (_games.TryRemove(slug, out var game))
        {
            game.IdleCts?.Cancel();
            game.DisconnectCts?.Cancel();
            game.PlayAgainCts?.Cancel();
        }
    }

    // Mark stale DB games as Closed
    var filter = Builders<{Name}Game>.Filter.And(
        Builders<{Name}Game>.Filter.In(g => g.Status, [{Name}GameStatus.Lobby, {Name}GameStatus.InProgress]),
        Builders<{Name}Game>.Filter.Lt(g => g.LastActivity, cutoff));
    await db.{Name}Games.UpdateManyAsync(filter,
        Builders<{Name}Game>.Update.Set(g => g.Status, {Name}GameStatus.Closed));
}
```

---

### Cleanup Service (`Services/{Name}CleanupService.cs`)

Copy `PigCleanupService.cs` verbatim, replacing `Pig` with `{Name}`. Runs every 5 minutes.

---

### Hub (`Hubs/{Name}Hub.cs`)

The hub is intentionally thin — extract claims, read query params, manage groups, delegate everything to the service.

JWT claims extracted in the hub:

```csharp
private string UserId => Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw ...;
private string Username => Context.User?.FindFirstValue("discord_username") ?? "Unknown";
private string? AlternativeName => Context.User?.FindFirstValue("alternative_name");
private string? UserSlug => Context.User?.FindFirstValue("slug");
private string? GameSlug => Context.GetHttpContext()?.Request.Query["gameSlug"].ToString() is { Length: > 0 } s ? s : null;
private bool IsListMode => Context.GetHttpContext()?.Request.Query["mode"].ToString() == "list";
```

`OnConnectedAsync` pattern:
1. Abort if `!isListMode && slug is null`
2. `await Groups.AddToGroupAsync(connectionId, isListMode ? "{prefix}-list" : $"{prefix}-{slug}")`
3. Call `service.HandleConnectionAsync(...)` — returns state snapshot
4. Send `"GameState"` to caller if state != null; send `"Error"` and abort on error

`OnDisconnectedAsync`: call `service.HandleDisconnectionAsync(...)`, swallow exceptions.

Hub methods: one per game action, always read `GameSlug` and return if null.

---

### MongoDbContext (`Services/MongoDbContext.cs`)

Add to the class:

```csharp
public IMongoCollection<{Name}Game> {Name}Games { get; }
```

In constructor:

```csharp
{Name}Games = database.GetCollection<{Name}Game>("{prefix}_games");
```

In `EnsureIndexes()`:

```csharp
await {Name}Games.Indexes.CreateManyAsync([
    new CreateIndexModel<{Name}Game>(
        Builders<{Name}Game>.IndexKeys.Ascending(g => g.Slug),
        new CreateIndexOptions { Unique = true }),
    new CreateIndexModel<{Name}Game>(
        Builders<{Name}Game>.IndexKeys.Ascending(g => g.Status)),
    new CreateIndexModel<{Name}Game>(
        Builders<{Name}Game>.IndexKeys.Descending(g => g.LastActivity)),
]);
```

---

### Controller (`Controllers/{Name}Controller.cs`)

```csharp
[ApiController]
[Route("api/{prefix}")]
[Authorize]
public class {Name}Controller({Name}Service {name}Service, IUserService userService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string Username => User.FindFirstValue("discord_username") ?? "Unknown";
    private string? AlternativeName => User.FindFirstValue("alternative_name");
    private string? UserSlug => User.FindFirstValue("slug");

    [HttpPost]
    public async Task<IActionResult> CreateGame([FromBody] Create{Name}GameRequest request)
    {
        string? avatarUrl = null;
        if (UserSlug != null)
        {
            var user = await userService.GetBySlug(UserSlug);
            avatarUrl = user?.ProfileImageFilename;
        }

        var (game, error) = await {name}Service.CreateGameAsync(
            UserId, Username, AlternativeName, UserSlug, avatarUrl, request.CustomName);

        if (error != null) return BadRequest(new { error });
        return Ok(new { slug = game.Slug, name = game.Name });
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenGames([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 50) pageSize = Math.Clamp(pageSize, 1, 50);

        var games = await {name}Service.GetOpenGamesAsync(page, pageSize);
        var total = await {name}Service.GetOpenGamesCountAsync();

        return Ok(new { items = games, page, pageSize, totalCount = total,
            totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }
}
```

---

### Program.cs

Three additions:

```csharp
// 1. Service registration (near existing game registrations)
builder.Services.AddSingleton<I{Name}Service, {Name}Service>();
builder.Services.AddHostedService<{Name}CleanupService>();

// 2. JWT for SignalR — extend the existing OnMessageReceived lambda:
if (!string.IsNullOrEmpty(accessToken) && (
    path.StartsWithSegments("/hubs/pig") ||
    path.StartsWithSegments("/hubs/yahtzee") ||
    path.StartsWithSegments("/hubs/{prefix}")))   // add this line
    context.Token = accessToken;

// 3. Hub mapping (near existing hub mappings)
app.MapHub<{Name}Hub>("/hubs/{prefix}");
```

`IGameStatsService` is already registered as a shared singleton — do not re-register it.

---

## Frontend

### `frontend/src/lib/api.js`

Add alongside the other game API functions:

```js
export const create{Name}Game = (customName) =>
    api.post('/api/{prefix}', { customName }).then(r => r.data);

export const getOpen{Name}Games = (page = 1, pageSize = 20) =>
    api.get('/api/{prefix}', { params: { page, pageSize } }).then(r => r.data);
```

### `{Name}GameList.jsx`

Copy `PigGameList.jsx`. Change:
- SignalR URL: `/hubs/{prefix}?mode=list&access_token=${token}`
- Import `create{Name}Game`
- Navigation target: `/{prefix}/${res.slug}`
- Display text

### `{Name}Game.jsx`

Copy `PigGame.jsx`. The reducer action types and state shape change per game — this is where the actual game UI and logic lives. Keep:
- `useReducer` pattern with a `dispatch`-based state machine
- `phase` as the top-level discriminant: `connecting → lobby → in-progress → finished → play-again → closed | error`
- SignalR URL: `/hubs/{prefix}?gameSlug={slug}&access_token=${token}`
- `Avatar` helper (deterministic gradient by username)
- `ParticipantCard` structure
- `IdleCountdownRing` — SVG ring countdown shown to all players. Needs `idleCountdown` (current seconds) and `idleCountdownMax` (captured once when countdown starts, i.e. when `state.idleCountdown === null` before the first tick). Reset both to `null` on turn transition. Ring goes amber → red + pulsing below 33%.

### `App.jsx`

```jsx
import {Name}GameList from './pages/{Name}GameList';
import {Name}Game from './pages/{Name}Game';

// inside <Routes>:
<Route path="/{prefix}" element={<{Name}GameList />} />
<Route path="/{prefix}/:slug" element={<ProtectedRoute><{Name}Game /></ProtectedRoute>} />
```

### `Navbar.jsx`

Add a nav link next to the existing game links:

```jsx
<NavLink to="/{prefix}">{Display Name}</NavLink>
```

---

## Implementation Order

1. Model → service interface + DTOs → service → cleanup service → hub
2. MongoDbContext → controller → Program.cs
3. `api.js` → GameList page → Game page
4. `App.jsx` routes → Navbar link
5. Smoke test: create game in one browser tab, join from a second tab, play a full turn

---

## Questions to Resolve Before Starting

- Game name (determines all identifiers)
- Max concurrent players (default: 6, extras become watchers)
- Is the game turn-based or simultaneous?
- Win condition
- Idle timeout duration (Pig: 60 s, Yahtzee: 90 s)
- Does the game need bots? (Pig has them; Yahtzee does not)
- Does Play Again voting apply?
