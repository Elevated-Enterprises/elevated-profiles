using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.Hubs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class PigService(
    MongoDbContext db,
    IHubContext<PigHub> hub,
    ILogger<PigService> logger,
    IGameStatsService gameStatsService) : IPigService
{
    private const int MaxActivePlayers = 6;
    private const int WinScore = 100;
    private const int IdleTimeoutSeconds = 60;
    private const int DisconnectTimeoutSeconds = 30;
    private const int PlayAgainTimeoutSeconds = 60;
    private const string ListGroup = "pig-list";

    private readonly ConcurrentDictionary<string, PigGame> _games = new();

    // ── Group helpers ─────────────────────────────────────────────────────────

    private static string GameGroup(string slug) => $"pig-{slug}";

    // ── Snapshots ─────────────────────────────────────────────────────────────

    private static PigGameStateSnapshot ToSnapshot(PigGame g) => new(
        g.Slug, g.Name, g.GmUserId, g.GmUsername, g.Status,
        g.Participants.Select(p => new PigParticipantDto(
            p.UserId, p.Username, p.DisplayName, p.UserSlug, p.AvatarUrl,
            p.Role, p.Score, p.ConsecutiveSkips, p.IsConnected, p.IsBot)).ToList(),
        g.TurnOrder, g.CurrentPlayerIndex, g.CurrentTurnScore, g.PlayAgainVoteActive);

    private static List<PigParticipantDto> ToParticipantDtos(IEnumerable<PigParticipant> participants) =>
        participants.Select(p => new PigParticipantDto(
            p.UserId, p.Username, p.DisplayName, p.UserSlug, p.AvatarUrl,
            p.Role, p.Score, p.ConsecutiveSkips, p.IsConnected, p.IsBot)).ToList();

    private static PigGameSummary ToSummary(PigGame g) => new(
        g.Slug, g.Name, g.GmUsername, g.Status,
        g.Participants.Count(p => p.Role == "player"),
        g.Participants.Count(p => p.Role == "watcher"),
        g.LastActivity);

    // ── Persistence ───────────────────────────────────────────────────────────

    private async Task PersistAsync(PigGame game)
    {
        game.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<PigGame>.Filter.Eq(g => g.Slug, game.Slug);
        await db.PigGames.ReplaceOneAsync(filter, game, new ReplaceOptions { IsUpsert = true });
    }

    private async Task<PigGame?> LoadFromDbAsync(string slug)
    {
        var game = await db.PigGames.Find(g => g.Slug == slug).FirstOrDefaultAsync();
        return game;
    }

    private async Task<PigGame> GetOrLoadGameAsync(string slug)
    {
        if (_games.TryGetValue(slug, out var cached))
            return cached;

        var fromDb = await LoadFromDbAsync(slug);
        if (fromDb is null) throw new InvalidOperationException($"Game '{slug}' not found.");

        // Reset IsConnected for all human participants (crash recovery); bots are always present
        foreach (var p in fromDb.Participants)
            if (!p.IsBot) p.IsConnected = false;

        _games[slug] = fromDb;
        return fromDb;
    }

    private void BroadcastOpenGames()
    {
        var open = _games.Values
            .Where(g => g.Status is PigGameStatus.Lobby or PigGameStatus.InProgress)
            .OrderByDescending(g => g.LastActivity)
            .Select(ToSummary)
            .ToList();

        _ = hub.Clients.Group(ListGroup).SendAsync("OpenGamesUpdated", open);
    }

    // ── Create Game ───────────────────────────────────────────────────────────

    public async Task<(PigGame game, string? error)> CreateGameAsync(
        string userId, string username, string? displayName, string? userSlug, string? avatarUrl, string? customName)
    {
        var slug = await GenerateUniqueSlugAsync();
        var name = string.IsNullOrWhiteSpace(customName) ? $"{username}'s game" : customName.Trim();

        var game = new PigGame
        {
            Slug = slug,
            Name = name,
            GmUserId = userId,
            GmUsername = username,
            Status = PigGameStatus.Lobby,
            Participants =
            [
                new PigParticipant
                {
                    UserId = userId,
                    Username = username,
                    DisplayName = displayName,
                    UserSlug = userSlug,
                    AvatarUrl = avatarUrl,
                    Role = "player",
                    IsConnected = false
                }
            ],
            LastActivity = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await db.PigGames.InsertOneAsync(game);
        _games[slug] = game;
        BroadcastOpenGames();
        return (game, null);
    }

    private async Task<string> GenerateUniqueSlugAsync()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        while (true)
        {
            var slug = "pig-" + RandomNumberGenerator.GetString(chars, 6);
            if (!_games.ContainsKey(slug))
            {
                var existing = await db.PigGames.Find(g => g.Slug == slug).AnyAsync();
                if (!existing) return slug;
            }
        }
    }

    // ── Open Games List ───────────────────────────────────────────────────────

    public async Task<List<PigGameSummary>> GetOpenGamesAsync(int page, int pageSize)
    {
        // Prefer in-memory data; fall back to MongoDB for games not yet cached
        var inMemory = _games.Values
            .Where(g => g.Status is PigGameStatus.Lobby or PigGameStatus.InProgress)
            .OrderByDescending(g => g.LastActivity)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToSummary)
            .ToList();

        if (inMemory.Count > 0) return inMemory;

        // Fall back to MongoDB (e.g. after server restart before any connections)
        var games = await db.PigGames
            .Find(g => g.Status == PigGameStatus.Lobby || g.Status == PigGameStatus.InProgress)
            .SortByDescending(g => g.LastActivity)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return games.Select(ToSummary).ToList();
    }

    public async Task<int> GetOpenGamesCountAsync()
    {
        var count = _games.Values.Count(g => g.Status is PigGameStatus.Lobby or PigGameStatus.InProgress);
        if (count > 0) return count;
        return (int)await db.PigGames.CountDocumentsAsync(
            g => g.Status == PigGameStatus.Lobby || g.Status == PigGameStatus.InProgress);
    }

    // ── Connection ────────────────────────────────────────────────────────────

    public async Task<(PigGameStateSnapshot? state, string? error)> HandleConnectionAsync(
        string slug, string userId, string username, string? displayName, string? userSlug, string? avatarUrl,
        string connectionId, bool isListMode)
    {
        if (isListMode)
        {
            // List mode: just send current open games; nothing game-specific to do
            var open = _games.Values
                .Where(g => g.Status is PigGameStatus.Lobby or PigGameStatus.InProgress)
                .OrderByDescending(g => g.LastActivity)
                .Select(ToSummary)
                .ToList();
            await hub.Clients.Client(connectionId).SendAsync("OpenGamesUpdated", open);
            return (null, null);
        }

        // Look up user profile for avatar
        if (avatarUrl is null && userSlug is not null)
        {
            var dbUser = await db.Users.Find(u => u.Slug == userSlug).FirstOrDefaultAsync();
            avatarUrl = dbUser?.ProfileImageFilename;
        }

        PigGame game;
        try
        {
            game = await GetOrLoadGameAsync(slug);
        }
        catch
        {
            return (null, "Game not found.");
        }

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status == PigGameStatus.Closed)
                return (null, "This game is closed.");

            var existing = game.GetParticipant(userId);

            if (existing != null)
            {
                // Reconnect
                existing.ConnectionId = connectionId;
                existing.IsConnected = true;

                // Cancel disconnect timer
                game.DisconnectTimerCts?.Cancel();
                game.DisconnectTimerCts = null;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantJoined",
                    new { participant = new PigParticipantDto(existing.UserId, existing.Username, existing.DisplayName, existing.UserSlug, existing.AvatarUrl, existing.Role, existing.Score, existing.ConsecutiveSkips, true, existing.IsBot), participants = ToParticipantDtos(game.Participants) });
            }
            else
            {
                // New participant
                string role;
                if (game.Status == PigGameStatus.Lobby)
                {
                    var activePlayers = game.Participants.Count(p => p.Role == "player");
                    role = activePlayers >= MaxActivePlayers ? "watcher" : "player";
                }
                else
                {
                    role = "watcher";
                }

                var participant = new PigParticipant
                {
                    UserId = userId,
                    Username = username,
                    DisplayName = displayName,
                    UserSlug = userSlug,
                    AvatarUrl = avatarUrl,
                    Role = role,
                    ConnectionId = connectionId,
                    IsConnected = true
                };
                game.Participants.Add(participant);

                game.LastActivity = DateTime.UtcNow;
                await PersistAsync(game);
                BroadcastOpenGames();

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantJoined",
                    new { participant = new PigParticipantDto(participant.UserId, participant.Username, participant.DisplayName, participant.UserSlug, participant.AvatarUrl, participant.Role, participant.Score, participant.ConsecutiveSkips, true, participant.IsBot), participants = ToParticipantDtos(game.Participants) });
            }

            return (ToSnapshot(game), null);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Disconnection ─────────────────────────────────────────────────────────

    public async Task HandleDisconnectionAsync(string? slug, string userId, string connectionId, bool isListMode)
    {
        if (isListMode || slug is null) return;

        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            var participant = game.GetParticipant(userId);
            if (participant is null || participant.ConnectionId != connectionId) return;

            participant.IsConnected = false;

            if (game.Status == PigGameStatus.InProgress && game.CurrentActiveUserId == userId)
            {
                // Active player disconnected — start reconnect window
                game.DisconnectTimerCts?.Cancel();
                var cts = new CancellationTokenSource();
                game.DisconnectTimerCts = cts;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                    new { userId, participants = ToParticipantDtos(game.Participants) });

                _ = RunDisconnectTimerAsync(slug, userId, cts.Token);
            }
            else
            {
                // Non-active player just disconnected — remove if watcher, or just mark disconnected
                if (participant.Role == "watcher")
                {
                    game.Participants.Remove(participant);
                }

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                    new { userId, participants = ToParticipantDtos(game.Participants) });

                // Check if only one player left
                if (game.Status == PigGameStatus.InProgress)
                    await CheckOnlyOnePlayerRemainsAsync(game, slug);
            }
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task RunDisconnectTimerAsync(string slug, string userId, CancellationToken ct)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(DisconnectTimeoutSeconds), ct);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != PigGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;

            var participant = game.GetParticipant(userId);
            if (participant is null) return;
            if (participant.IsConnected) return; // reconnected in time

            await SkipActivePlayerAsync(game, slug, "disconnect");
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Roll ──────────────────────────────────────────────────────────────────

    public async Task RollAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != PigGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;

            // Cancel idle timer
            game.IdleTimerCts?.Cancel();
            game.IdleTimerCts = null;

            var value = Random.Shared.Next(1, 7); // 1..6

            if (value == 1)
            {
                // Pig!
                var turnScore = game.CurrentTurnScore;
                game.CurrentTurnScore = 0;
                game.LastActivity = DateTime.UtcNow;

                var roller = game.GetParticipant(userId);

                await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                    new { value, turnScore = 0, rolledBy = userId });

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
                    new { username = "System", role = "system",
                          text = $"🐷 {roller?.Username ?? "Unknown"} rolled a 1 — Pig! Turn lost.",
                          timestamp = DateTime.UtcNow, isSystem = true });

                await AdvanceTurnAsync(game, slug, "pig", null);
            }
            else
            {
                game.CurrentTurnScore += value;
                game.LastActivity = DateTime.UtcNow;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                    new { value, turnScore = game.CurrentTurnScore, rolledBy = userId });

                // Restart idle timer
                StartIdleTimer(game, slug, userId);
            }
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Hold ──────────────────────────────────────────────────────────────────

    public async Task HoldAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != PigGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;

            game.IdleTimerCts?.Cancel();
            game.IdleTimerCts = null;

            var participant = game.GetParticipant(userId);
            if (participant is null) return;

            participant.Score += game.CurrentTurnScore;
            game.CurrentTurnScore = 0;
            game.LastActivity = DateTime.UtcNow;

            if (participant.Score >= WinScore)
            {
                // Win!
                game.Status = PigGameStatus.Finished;
                await PersistAsync(game);
                BroadcastOpenGames();

                var finalScores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);
                await hub.Clients.Group(GameGroup(slug)).SendAsync("GameWon",
                    new { winnerUserId = userId, winnerUsername = participant.Username, scores = finalScores, reason = "normal" });

                await RecordPigStatsAsync(game, userId);
                return;
            }

            await AdvanceTurnAsync(game, slug, "hold", participant.Score);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Advance Turn ──────────────────────────────────────────────────────────

    private async Task AdvanceTurnAsync(PigGame game, string slug, string reason, int? heldScore)
    {
        var prevUserId = game.CurrentActiveUserId;
        var prevParticipant = prevUserId != null ? game.GetParticipant(prevUserId) : null;

        if (prevParticipant != null)
            prevParticipant.ConsecutiveSkips = 0;

        // Advance turn index
        if (game.TurnOrder.Count > 0)
            game.CurrentPlayerIndex = (game.CurrentPlayerIndex + 1) % game.TurnOrder.Count;

        var nextUserId = game.CurrentActiveUserId;
        var scores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);

        await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnEnded",
            new { reason, scores, nextPlayerId = nextUserId, currentTurnScore = 0 });

        await PersistAsync(game);

        // Start next player's turn (bot or human)
        if (nextUserId != null)
            StartNextPlayerTurn(game, slug, nextUserId);
    }

    // ── Idle Timer ────────────────────────────────────────────────────────────

    private void StartNextPlayerTurn(PigGame game, string slug, string nextUserId)
    {
        var p = game.GetParticipant(nextUserId);
        if (p?.IsBot == true)
            _ = RunBotTurnAsync(slug, nextUserId);
        else
            StartIdleTimer(game, slug, nextUserId);
    }

    private void StartIdleTimer(PigGame game, string slug, string expectedUserId)
    {
        game.IdleTimerCts?.Cancel();
        var cts = new CancellationTokenSource();
        game.IdleTimerCts = cts;

        _ = RunIdleTimerAsync(slug, expectedUserId, cts.Token);
    }

    private async Task RunIdleTimerAsync(string slug, string expectedUserId, CancellationToken ct)
    {
        for (var i = IdleTimeoutSeconds; i >= 0; i--)
        {
            if (ct.IsCancellationRequested) return;

            try
            {
                await hub.Clients.Group(GameGroup(slug)).SendAsync("IdleCountdown", i, ct);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            if (i == 0) break;

            try
            {
                await Task.Delay(1000, ct);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }

        // Timeout fired — skip player
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != PigGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != expectedUserId) return;

            await SkipActivePlayerAsync(game, slug, "idle");
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Bot Turn ──────────────────────────────────────────────────────────────

    private async Task RunBotTurnAsync(string slug, string botUserId)
    {
        // Brief delay so the bot feels like a real player thinking
        await Task.Delay(TimeSpan.FromMilliseconds(1200 + Random.Shared.Next(0, 800)));

        while (true)
        {
            if (!_games.TryGetValue(slug, out var game)) return;

            await game.Lock.WaitAsync();
            try
            {
                if (game.Status != PigGameStatus.InProgress) return;
                if (game.CurrentActiveUserId != botUserId) return;

                var bot = game.GetParticipant(botUserId);
                if (bot is null) return;

                // Strategy: base target 20, adjusted by relative score
                var maxOtherScore = game.TurnOrder
                    .Where(uid => uid != botUserId)
                    .Select(uid => game.GetParticipant(uid)?.Score ?? 0)
                    .DefaultIfEmpty(0)
                    .Max();

                var target = 20;
                if (bot.Score - maxOtherScore > 20)
                    target = 15; // well ahead — be conservative
                else if (maxOtherScore - bot.Score > 20)
                    target = 25; // behind — be aggressive

                if (bot.Score + game.CurrentTurnScore >= WinScore || game.CurrentTurnScore >= target)
                {
                    // Hold
                    bot.Score += game.CurrentTurnScore;
                    game.CurrentTurnScore = 0;
                    game.LastActivity = DateTime.UtcNow;

                    if (bot.Score >= WinScore)
                    {
                        game.Status = PigGameStatus.Finished;
                        await PersistAsync(game);
                        BroadcastOpenGames();

                        var finalScores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);
                        await hub.Clients.Group(GameGroup(slug)).SendAsync("GameWon",
                            new { winnerUserId = botUserId, winnerUsername = bot.Username, scores = finalScores, reason = "normal" });

                        // Bot wins — record "played" for humans, no winner
                        await RecordPigStatsAsync(game, null);
                        return;
                    }

                    await AdvanceTurnAsync(game, slug, "hold", bot.Score);
                    return;
                }

                // Roll
                var value = Random.Shared.Next(1, 7);

                if (value == 1)
                {
                    game.CurrentTurnScore = 0;
                    game.LastActivity = DateTime.UtcNow;

                    await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                        new { value, turnScore = 0, rolledBy = botUserId });

                    await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
                        new { username = "System", role = "system",
                              text = $"🐷 {bot.Username} rolled a 1 — Pig! Turn lost.",
                              timestamp = DateTime.UtcNow, isSystem = true });

                    await AdvanceTurnAsync(game, slug, "pig", null);
                    return;
                }

                game.CurrentTurnScore += value;
                game.LastActivity = DateTime.UtcNow;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                    new { value, turnScore = game.CurrentTurnScore, rolledBy = botUserId });
            }
            finally
            {
                game.Lock.Release();
            }

            // Delay between rolls
            await Task.Delay(TimeSpan.FromMilliseconds(700 + Random.Shared.Next(0, 500)));
        }
    }

    private async Task SkipActivePlayerAsync(PigGame game, string slug, string reason)
    {
        var userId = game.CurrentActiveUserId;
        if (userId is null) return;

        var participant = game.GetParticipant(userId);
        if (participant is null) return;

        participant.ConsecutiveSkips++;
        game.CurrentTurnScore = 0;
        game.LastActivity = DateTime.UtcNow;

        var chatMessage = participant.ConsecutiveSkips == 1
            ? $"{participant.Username} was skipped. One more and you're out."
            : null;

        if (participant.ConsecutiveSkips >= 2)
        {
            // Kick
            await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnSkipped",
                new { userId, username = participant.Username, reason, skipCount = participant.ConsecutiveSkips, nextPlayerId = (string?)null });

            await KickParticipantInternalAsync(game, slug, userId, $"idle_kick");
            return;
        }

        // Advance turn without resetting skip count for this player
        var prevIdx = game.CurrentPlayerIndex;
        if (game.TurnOrder.Count > 0)
            game.CurrentPlayerIndex = (game.CurrentPlayerIndex + 1) % game.TurnOrder.Count;

        var nextUserId = game.CurrentActiveUserId;
        var scores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);

        await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnSkipped",
            new { userId, username = participant.Username, reason, skipCount = participant.ConsecutiveSkips, nextPlayerId = nextUserId });

        if (chatMessage != null)
        {
            await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
                new { username = "System", role = "system", text = chatMessage, timestamp = DateTime.UtcNow, isSystem = true });
        }

        await PersistAsync(game);

        if (nextUserId != null)
            StartNextPlayerTurn(game, slug, nextUserId);
    }

    // ── Start Game ────────────────────────────────────────────────────────────

    public async Task StartGameAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != userId) return;
            if (game.Status != PigGameStatus.Lobby) return;

            var players = game.Participants.Where(p => p.Role == "player").ToList();
            if (players.Count < 2) return;

            game.Status = PigGameStatus.InProgress;
            game.TurnOrder = players.Select(p => p.UserId).ToList();
            game.CurrentPlayerIndex = 0;
            game.CurrentTurnScore = 0;
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameStarted",
                new { turnOrder = game.TurnOrder, participants = ToParticipantDtos(game.Participants) });

            // Start first player's turn
            var firstPlayer = game.TurnOrder[0];
            StartNextPlayerTurn(game, slug, firstPlayer);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Cancel Game ───────────────────────────────────────────────────────────

    public async Task CancelGameAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != userId) return;
            if (game.Status != PigGameStatus.Lobby) return;

            game.Status = PigGameStatus.Closed;
            game.IdleTimerCts?.Cancel();
            game.DisconnectTimerCts?.Cancel();
            game.PlayAgainTimerCts?.Cancel();

            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameCancelled",
                new { reason = "gm_cancelled" });

            _games.TryRemove(slug, out _);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Kick Player ───────────────────────────────────────────────────────────

    public async Task KickPlayerAsync(string slug, string gmUserId, string targetUserId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != gmUserId) return;
            if (targetUserId == gmUserId) return;

            await KickParticipantInternalAsync(game, slug, targetUserId, "kicked_by_gm");
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task KickParticipantInternalAsync(PigGame game, string slug, string targetUserId, string reason)
    {
        var participant = game.GetParticipant(targetUserId);
        if (participant is null) return;

        var wasActive = game.CurrentActiveUserId == targetUserId;

        // Remove from turn order
        game.TurnOrder.Remove(targetUserId);

        // Adjust current player index if needed
        if (game.TurnOrder.Count > 0 && game.CurrentPlayerIndex >= game.TurnOrder.Count)
            game.CurrentPlayerIndex = 0;

        game.Participants.Remove(participant);
        game.LastActivity = DateTime.UtcNow;

        await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayerKicked",
            new { userId = targetUserId, username = participant.Username, reason, participants = ToParticipantDtos(game.Participants) });

        // Notify kicked client specifically
        if (participant.ConnectionId != null)
            await hub.Clients.Client(participant.ConnectionId).SendAsync("YouWereKicked", new { reason });

        await PersistAsync(game);

        await CheckOnlyOnePlayerRemainsAsync(game, slug);

        if (wasActive && game.Status == PigGameStatus.InProgress && game.TurnOrder.Count > 0)
        {
            var nextUserId = game.CurrentActiveUserId;
            var scores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);

            await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnEnded",
                new { reason = "kicked", scores, nextPlayerId = nextUserId, currentTurnScore = 0 });

            if (nextUserId != null)
                StartNextPlayerTurn(game, slug, nextUserId);
        }
    }

    private async Task CheckOnlyOnePlayerRemainsAsync(PigGame game, string slug)
    {
        if (game.Status != PigGameStatus.InProgress) return;
        var activePlayers = game.TurnOrder.Count;
        if (activePlayers > 1) return;

        // One or zero players remain
        game.Status = PigGameStatus.Finished;
        game.IdleTimerCts?.Cancel();

        var winner = activePlayers == 1 ? game.GetParticipant(game.TurnOrder[0]) : null;
        var finalScores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);

        await PersistAsync(game);
        BroadcastOpenGames();

        if (winner != null)
        {
            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameWon",
                new { winnerUserId = winner.UserId, winnerUsername = winner.Username, scores = finalScores, reason = "forfeit" });

            await RecordPigStatsAsync(game, winner.IsBot ? null : winner.UserId);
        }
        else
        {
            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameClosed",
                new { reason = "all_left" });
        }
    }

    // ── Leave Game ────────────────────────────────────────────────────────────

    public async Task LeaveGameAsync(string slug, string userId, string connectionId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            var participant = game.GetParticipant(userId);
            if (participant is null) return;

            bool isGm = game.GmUserId == userId;

            if (isGm && game.Status == PigGameStatus.InProgress)
            {
                // GM leaves mid-game — end immediately
                game.Status = PigGameStatus.Closed;
                game.IdleTimerCts?.Cancel();
                game.DisconnectTimerCts?.Cancel();
                game.PlayAgainTimerCts?.Cancel();

                await PersistAsync(game);
                BroadcastOpenGames();

                await hub.Clients.Group(GameGroup(slug)).SendAsync("GameCancelled",
                    new { reason = "gm_left" });
                await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
                    new { username = "System", role = "system", text = "The Game Master left — game over.", timestamp = DateTime.UtcNow, isSystem = true });

                _games.TryRemove(slug, out _);
                return;
            }

            if (isGm && game.Status == PigGameStatus.Lobby)
            {
                // GM cancels lobby by leaving
                game.Status = PigGameStatus.Closed;
                await PersistAsync(game);
                BroadcastOpenGames();

                await hub.Clients.Group(GameGroup(slug)).SendAsync("GameCancelled",
                    new { reason = "gm_cancelled" });

                _games.TryRemove(slug, out _);
                return;
            }

            var wasActive = game.Status == PigGameStatus.InProgress && game.CurrentActiveUserId == userId;

            game.TurnOrder.Remove(userId);
            if (game.TurnOrder.Count > 0 && game.CurrentPlayerIndex >= game.TurnOrder.Count)
                game.CurrentPlayerIndex = 0;

            game.Participants.Remove(participant);
            game.LastActivity = DateTime.UtcNow;

            await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                new { userId, participants = ToParticipantDtos(game.Participants) });

            await PersistAsync(game);

            if (game.Status == PigGameStatus.InProgress)
            {
                await CheckOnlyOnePlayerRemainsAsync(game, slug);

                if (wasActive && game.Status == PigGameStatus.InProgress && game.TurnOrder.Count > 0)
                {
                    game.IdleTimerCts?.Cancel();
                    game.CurrentTurnScore = 0;
                    var nextUserId = game.CurrentActiveUserId;
                    var scores = game.Participants.ToDictionary(p => p.UserId, p => p.Score);

                    await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnEnded",
                        new { reason = "left", scores, nextPlayerId = nextUserId, currentTurnScore = 0 });

                    if (nextUserId != null)
                        StartNextPlayerTurn(game, slug, nextUserId);
                }
            }
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Play Again ────────────────────────────────────────────────────────────

    public async Task InitiatePlayAgainAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != userId) return;
            if (game.Status != PigGameStatus.Finished) return;

            game.PlayAgainVoteActive = true;
            game.PlayAgainVotes = [];
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);

            var cts = new CancellationTokenSource();
            game.PlayAgainTimerCts = cts;

            await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainPrompt",
                new { timeoutSeconds = PlayAgainTimeoutSeconds });

            _ = RunPlayAgainTimerAsync(slug, cts.Token);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    public async Task PlayAgainVoteAsync(string slug, string userId, bool vote)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (!game.PlayAgainVoteActive) return;
            if (game.GetParticipant(userId) is null) return;

            game.PlayAgainVotes[userId] = vote;

            var yesCount = game.PlayAgainVotes.Values.Count(v => v);
            var noCount = game.PlayAgainVotes.Values.Count(v => !v);

            await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainVoteUpdate",
                new { yesCount, noCount });

            // GM voted No → end immediately
            if (userId == game.GmUserId && !vote)
            {
                await FinalizePlayAgainAsync(game, slug, forceClose: true);
                return;
            }

            // All human participants voted → finalize (bots vote automatically)
            var humanCount = game.Participants.Count(p => !p.IsBot);
            if (game.PlayAgainVotes.Count >= humanCount)
                await FinalizePlayAgainAsync(game, slug, forceClose: false);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task RunPlayAgainTimerAsync(string slug, CancellationToken ct)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(PlayAgainTimeoutSeconds), ct);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (!game.PlayAgainVoteActive) return;
            await FinalizePlayAgainAsync(game, slug, forceClose: false);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task FinalizePlayAgainAsync(PigGame game, string slug, bool forceClose)
    {
        game.PlayAgainVoteActive = false;
        game.PlayAgainTimerCts?.Cancel();
        game.PlayAgainTimerCts = null;

        // Check GM status
        var gmVote = game.PlayAgainVotes.TryGetValue(game.GmUserId, out var gv) ? gv : (bool?)null;
        if (forceClose || gmVote == false)
        {
            // Close game
            game.Status = PigGameStatus.Closed;
            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameClosed",
                new { reason = forceClose ? "gm_no" : "gm_no" });

            _games.TryRemove(slug, out _);
            return;
        }

        // Remove No voters and non-voters; promote Yes watchers to players
        var toRemove = new List<PigParticipant>();
        foreach (var p in game.Participants)
        {
            if (p.IsBot) continue; // bots always stay for the next round
            if (!game.PlayAgainVotes.TryGetValue(p.UserId, out var voted) || !voted)
                toRemove.Add(p);
        }
        foreach (var p in toRemove)
            game.Participants.Remove(p);

        // Promote watchers who voted Yes to players
        foreach (var p in game.Participants)
        {
            if (p.Role == "watcher")
                p.Role = "player";
        }

        // Reset game state to Lobby
        game.Status = PigGameStatus.Lobby;
        game.TurnOrder = [];
        game.CurrentPlayerIndex = 0;
        game.CurrentTurnScore = 0;
        game.PlayAgainVotes = [];

        // Reset scores
        foreach (var p in game.Participants)
        {
            p.Score = 0;
            p.ConsecutiveSkips = 0;
            if (p.IsBot) p.IsConnected = true;
        }

        game.LastActivity = DateTime.UtcNow;
        await PersistAsync(game);
        BroadcastOpenGames();

        await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainResult",
            new { participants = ToParticipantDtos(game.Participants) });
    }

    // ── Chat ──────────────────────────────────────────────────────────────────

    public async Task SendChatAsync(string slug, string userId, string username, string role, string text)
    {
        if (!_games.TryGetValue(slug, out var game)) return;
        if (game.Status == PigGameStatus.Closed) return;
        if (string.IsNullOrWhiteSpace(text)) return;

        var trimmed = text.Trim();
        if (trimmed.Length > 500) trimmed = trimmed[..500];

        await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
            new { userId, username, role, text = trimmed, timestamp = DateTime.UtcNow, isSystem = false });
    }

    // ── Bot Management ────────────────────────────────────────────────────────

    public async Task AddBotAsync(string slug, string gmUserId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != gmUserId) return;
            if (game.Status != PigGameStatus.Lobby) return;

            var activePlayers = game.Participants.Count(p => p.Role == "player");
            if (activePlayers >= MaxActivePlayers) return;

            // Find next available bot number
            var botNumber = Enumerable.Range(1, MaxActivePlayers)
                .First(n => game.Participants.All(p => p.UserId != $"bot-{n}"));

            var bot = new PigParticipant
            {
                UserId = $"bot-{botNumber}",
                Username = $"Bot {botNumber}",
                Role = "player",
                IsBot = true,
                IsConnected = true,
            };
            game.Participants.Add(bot);
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);
            BroadcastOpenGames();

            var dto = new PigParticipantDto(bot.UserId, bot.Username, null, null, null, bot.Role, 0, 0, true, true);
            await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantJoined",
                new { participant = dto, participants = ToParticipantDtos(game.Participants) });
        }
        finally
        {
            game.Lock.Release();
        }
    }

    public async Task RemoveBotAsync(string slug, string gmUserId, string botUserId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != gmUserId) return;
            if (game.Status != PigGameStatus.Lobby) return;

            var bot = game.GetParticipant(botUserId);
            if (bot is null || !bot.IsBot) return;

            game.Participants.Remove(bot);
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                new { userId = botUserId, participants = ToParticipantDtos(game.Participants) });
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    private async Task RecordPigStatsAsync(PigGame game, string? winnerUserId)
    {
        var humanPlayers = game.Participants
            .Where(p => p.Role == "player" && !p.IsBot)
            .ToList();

        // Need at least 2 total players (human or bot) for the game to count
        var totalPlayers = game.Participants.Count(p => p.Role == "player");
        if (totalPlayers < 2 || humanPlayers.Count == 0) return;

        var hadBots = game.Participants.Any(p => p.IsBot);
        var results = humanPlayers.Select(p =>
            new GamePlayerResult(p.UserId, p.Username, p.UserSlug, p.UserId == winnerUserId));

        try { await gameStatsService.RecordGameAsync("pig", results, hadBots); }
        catch (Exception ex) { logger.LogError(ex, "Failed to record pig game stats."); }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    public async Task CleanupAbandonedGamesAsync()
    {
        var cutoff = DateTime.UtcNow.AddHours(-1);

        // Clean in-memory games
        var abandoned = _games.Values
            .Where(g => g.Status is not PigGameStatus.Closed && g.LastActivity < cutoff)
            .ToList();

        foreach (var game in abandoned)
        {
            await game.Lock.WaitAsync();
            try
            {
                game.Status = PigGameStatus.Closed;
                game.IdleTimerCts?.Cancel();
                game.DisconnectTimerCts?.Cancel();
                game.PlayAgainTimerCts?.Cancel();

                await PersistAsync(game);
                BroadcastOpenGames();

                await hub.Clients.Group(GameGroup(game.Slug)).SendAsync("GameClosed",
                    new { reason = "abandoned" });

                _games.TryRemove(game.Slug, out _);
                logger.LogInformation("Cleaned up abandoned game {Slug}", game.Slug);
            }
            finally
            {
                game.Lock.Release();
            }
        }

        // Also close any abandoned games in MongoDB that aren't in memory
        var dbFilter = Builders<PigGame>.Filter.And(
            Builders<PigGame>.Filter.Ne(g => g.Status, PigGameStatus.Closed),
            Builders<PigGame>.Filter.Lt(g => g.LastActivity, cutoff));

        var dbUpdate = Builders<PigGame>.Update
            .Set(g => g.Status, PigGameStatus.Closed)
            .Set(g => g.UpdatedAt, DateTime.UtcNow);

        var result = await db.PigGames.UpdateManyAsync(dbFilter, dbUpdate);
        if (result.ModifiedCount > 0)
            logger.LogInformation("Closed {Count} abandoned pig games in MongoDB", result.ModifiedCount);
    }
}
