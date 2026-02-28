---
name: add-game
description: Adds a new multiplayer game to the platform, following the established Pig Game pattern (SignalR real-time, MongoDB persistence, React frontend).
user-invocable: true
---

# Add a New Game

Use the Pig Game as the canonical reference implementation. Every file listed below has a direct counterpart there.

The user will tell you the game name (e.g. "Blackjack"). Derive all identifiers from it:

| Concept | Pattern | Example |
|---------|---------|---------|
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

All new files go under `backend/src/SecondCircuitProfiles.Api/`.

### 1. Model (`Models/{Name}Game.cs`)

Copy the structure from `Models/PigGame.cs`. Adapt:
- `{Name}GameStatus` enum: at minimum `Lobby`, `InProgress`, `Finished`, `Closed`
- `{Name}Participant`: keep `userId`, `username`, `userSlug`, `avatarUrl`, `role` ("player"/"watcher"), `isConnected`, `connectionId` (not persisted). Add game-specific score fields.
- `{Name}Game`: keep `slug`, `name`, `gmUserId`, `gmUsername`, `participants`, `lastActivity`, `createdAt`, `updatedAt`. Add `Lock` (SemaphoreSlim) and any timer CancellationTokenSources as `[BsonIgnore]`.

### 2. Service interface (`Services/I{Name}Service.cs`)

Minimum surface:
```csharp
Task<{Name}Game> CreateGameAsync(string gmUserId, string gmUsername, string? gmAvatarUrl, string? customName);
Task<({Name}Game? game, string? error)> HandleConnectionAsync(string connectionId, string gameSlug, string userId, string username, string userSlug, string? avatarUrl, IHubCallerClients clients, IGroupManager groups);
Task HandleDisconnectionAsync(string connectionId, IHubCallerClients clients, IGroupManager groups);
Task<PagedResult<{Name}GameSummaryDto>> GetOpenGamesAsync(int page, int pageSize);
// + game-specific action methods (Roll, Hold, etc.)
Task CleanupAbandonedGamesAsync();
```

### 3. Service (`Services/{Name}Service.cs`)

Key constants (adjust per game):
```csharp
private const int MaxActivePlayers = 6;
private const int IdleTimeoutSeconds = 60;
private const int DisconnectTimeoutSeconds = 30;
private const int PlayAgainTimeoutSeconds = 60;
private static string GameGroup(string slug) => $"{prefix}-{slug}";
private const string ListGroup = "{prefix}-list";
```

State: `private ConcurrentDictionary<string, {Name}Game> _games`

Lock pattern — wrap every public method body:
```csharp
await game.Lock.WaitAsync();
try { ... }
finally { game.Lock.Release(); }
```

Persist after every state change:
```csharp
private async Task PersistAsync({Name}Game game) {
    game.UpdatedAt = DateTime.UtcNow;
    await _db.{Name}Games.ReplaceOneAsync(g => g.Id == game.Id, game, new ReplaceOptions { IsUpsert = true });
}
```

Slug generation:
```csharp
const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
var slug = "{prefix}-" + RandomNumberGenerator.GetString(chars, 6);
```

Idle countdown pattern:
```csharp
for (var i = IdleTimeoutSeconds; i >= 0; i--) {
    await clients.Group(GameGroup(slug)).SendAsync("IdleCountdown", i, ct);
    await Task.Delay(1000, ct);
}
```

### 4. Cleanup service (`Services/{Name}CleanupService.cs`)

Copy `PigCleanupService.cs` verbatim, replace `Pig` → `{Name}` throughout.

### 5. Hub (`Hubs/{Name}Hub.cs`)

Copy `PigHub.cs` structure. Adapt:
- Query param check: `path.StartsWithSegments("/hubs/{prefix}")`
- Group names from `{Name}Service`
- Hub methods match the game's actions

---

## Backend — files to modify

### `Services/MongoDbContext.cs`

Add collection property:
```csharp
public IMongoCollection<{Name}Game> {Name}Games { get; }
```

In constructor, initialise and add indexes:
```csharp
{Name}Games = database.GetCollection<{Name}Game>("{prefix}_games");
```

In `EnsureIndexes()`:
```csharp
await {Name}Games.Indexes.CreateManyAsync([
    new CreateIndexModel<{Name}Game>(Builders<{Name}Game>.IndexKeys.Ascending(g => g.Slug), new CreateIndexOptions { Unique = true }),
    new CreateIndexModel<{Name}Game>(Builders<{Name}Game>.IndexKeys.Ascending(g => g.Status)),
    new CreateIndexModel<{Name}Game>(Builders<{Name}Game>.IndexKeys.Descending(g => g.LastActivity)),
]);
```

### `Controllers/{Name}Controller.cs`

Minimal REST surface (copy PigController):
- `POST /api/{prefix}` — create game (requires `[Authorize]`)
- `GET /api/{prefix}?page=&pageSize=` — list open games (requires `[Authorize]`)

### `Program.cs`

Three additions:

```csharp
// 1. Service registration (near Pig registrations)
builder.Services.AddSingleton<I{Name}Service, {Name}Service>();
builder.Services.AddHostedService<{Name}CleanupService>();

// 2. JWT for SignalR — extend the existing OnMessageReceived lambda:
if (!string.IsNullOrEmpty(accessToken) && (
    path.StartsWithSegments("/hubs/pig") ||
    path.StartsWithSegments("/hubs/{prefix}")))   // ← add this line
    context.Token = accessToken;

// 3. Hub mapping (near app.MapHub<PigHub>)
app.MapHub<{Name}Hub>("/hubs/{prefix}");
```

---

## Frontend — files to create

### `frontend/src/pages/{Name}GameList.jsx`

Copy `PigGameList.jsx`. Replace:
- SignalR URL: `/hubs/{prefix}?mode=list&access_token={token}`
- REST call: `getOpen{Name}Games(page, pageSize)`
- Links: `/pig/...` → `/{prefix}/...`
- Display text / heading

### `frontend/src/pages/{Name}Game.jsx`

Copy `PigGame.jsx`. The reducer's action types and state shape will change most — this is where the actual game logic lives. Keep:
- `useReducer` pattern with a `dispatch`-based state machine
- `phase` as the top-level state discriminant: `connecting → lobby → in-progress → finished → play-again → closed | error`
- SignalR connection at `/hubs/{prefix}?gameSlug={slug}&access_token={token}`
- The `Avatar` helper (deterministic gradient, reuse as-is)
- `ParticipantCard` structure

---

## Frontend — files to modify

### `frontend/src/lib/api.js`

Add two exported functions alongside the Pig functions:
```js
export const create{Name}Game = (customName) =>
    api.post('/api/{prefix}', { customName }).then(r => r.data);

export const getOpen{Name}Games = (page = 1, pageSize = 20) =>
    api.get('/api/{prefix}', { params: { page, pageSize } }).then(r => r.data);
```

### `frontend/src/App.jsx`

Add two routes (copy the Pig route block):
```jsx
import {Name}GameList from './pages/{Name}GameList';
import {Name}Game from './pages/{Name}Game';

// inside <Routes>:
<Route path="/{prefix}" element={<{Name}GameList />} />
<Route path="/{prefix}/:slug" element={<ProtectedRoute><{Name}Game /></ProtectedRoute>} />
```

### `frontend/src/components/Navbar.jsx`

Add a nav link next to the Pig link:
```jsx
<NavLink to="/{prefix}">🎮 {Display Name}</NavLink>
```

---

## Implementation order

1. Backend model → service interface → service → cleanup service → hub
2. MongoDbContext → Controller → Program.cs
3. Frontend api.js → GameList page → Game page
4. App.jsx routes → Navbar link
5. Smoke test: create game, join from second browser tab, play a turn

---

## Key decisions to confirm with the user before starting

- Game name (determines all identifiers above)
- Max concurrent players (default: 6, rest become watchers)
- Win condition
- Turn structure: is it turn-based like Pig, or simultaneous?
- Idle timeout (default: 60 s)
- Whether "Play Again" voting is needed (default: yes, copy from Pig)
