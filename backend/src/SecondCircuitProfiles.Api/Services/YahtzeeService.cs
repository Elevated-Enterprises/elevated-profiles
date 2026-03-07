using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.Hubs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class YahtzeeService(
    MongoDbContext db,
    IHubContext<YahtzeeHub> hub,
    ILogger<YahtzeeService> logger,
    IGameStatsService gameStatsService) : IYahtzeeService
{
    private const int MaxActivePlayers = 4;
    private const int IdleTimeoutSeconds = 90;
    private const int DisconnectTimeoutSeconds = 30;
    private const int PlayAgainTimeoutSeconds = 60;
    private const string ListGroup = "yahtzee-list";

    private readonly ConcurrentDictionary<string, YahtzeeGame> _games = new();

    private static string GameGroup(string slug) => $"yahtzee-{slug}";

    // ── Scoring helpers ───────────────────────────────────────────────────────

    private static readonly string[] AllCategories =
    [
        "ones", "twos", "threes", "fours", "fives", "sixes",
        "threeOfAKind", "fourOfAKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"
    ];

    private static readonly string[] UpperCategories = ["ones", "twos", "threes", "fours", "fives", "sixes"];
    private static readonly string[] LowerCategories = ["threeOfAKind", "fourOfAKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];

    private static bool IsYahtzee(int[] dice) => dice.All(d => d == dice[0]);

    private static bool IsFullHouse(int[] dice)
    {
        var groups = dice.GroupBy(d => d).Select(g => g.Count()).OrderBy(c => c).ToList();
        return groups.Count == 2 && groups[0] == 2 && groups[1] == 3;
    }

    private static bool IsSmallStraight(int[] dice)
    {
        var distinct = dice.Distinct().OrderBy(d => d).ToList();
        if (distinct.Count < 4) return false;
        for (var i = 0; i <= distinct.Count - 4; i++)
        {
            if (distinct[i + 1] == distinct[i] + 1
                && distinct[i + 2] == distinct[i] + 2
                && distinct[i + 3] == distinct[i] + 3)
                return true;
        }
        return false;
    }

    private static bool IsLargeStraight(int[] dice)
    {
        var distinct = dice.Distinct().OrderBy(d => d).ToList();
        return distinct.Count == 5 && distinct[4] - distinct[0] == 4;
    }

    private static bool IsAlreadyFilled(string category, YahtzeeScoreCard sc) => category switch
    {
        "ones"          => sc.Ones.HasValue,
        "twos"          => sc.Twos.HasValue,
        "threes"        => sc.Threes.HasValue,
        "fours"         => sc.Fours.HasValue,
        "fives"         => sc.Fives.HasValue,
        "sixes"         => sc.Sixes.HasValue,
        "threeOfAKind"  => sc.ThreeOfAKind.HasValue,
        "fourOfAKind"   => sc.FourOfAKind.HasValue,
        "fullHouse"     => sc.FullHouse.HasValue,
        "smallStraight" => sc.SmallStraight.HasValue,
        "largeStraight" => sc.LargeStraight.HasValue,
        "yahtzee"       => sc.Yahtzee.HasValue,
        "chance"        => sc.Chance.HasValue,
        _               => true
    };

    private static int? CalculateScore(string category, int[] dice, YahtzeeScoreCard sc)
    {
        bool isJoker = IsYahtzee(dice) && sc.Yahtzee.HasValue && sc.Yahtzee == 50;

        return category switch
        {
            "ones"          => dice.Where(d => d == 1).Sum(),
            "twos"          => dice.Where(d => d == 2).Sum(),
            "threes"        => dice.Where(d => d == 3).Sum(),
            "fours"         => dice.Where(d => d == 4).Sum(),
            "fives"         => dice.Where(d => d == 5).Sum(),
            "sixes"         => dice.Where(d => d == 6).Sum(),
            "threeOfAKind"  => dice.GroupBy(d => d).Any(g => g.Count() >= 3) ? dice.Sum() : 0,
            "fourOfAKind"   => dice.GroupBy(d => d).Any(g => g.Count() >= 4) ? dice.Sum() : 0,
            "fullHouse"     => isJoker ? 25 : (IsFullHouse(dice) ? 25 : 0),
            "smallStraight" => isJoker ? 30 : (IsSmallStraight(dice) ? 30 : 0),
            "largeStraight" => isJoker ? 40 : (IsLargeStraight(dice) ? 40 : 0),
            "yahtzee"       => IsYahtzee(dice) ? 50 : 0,
            "chance"        => dice.Sum(),
            _               => null
        };
    }

    private static void ApplyScore(string category, int points, YahtzeeScoreCard sc)
    {
        switch (category)
        {
            case "ones":          sc.Ones = points; break;
            case "twos":          sc.Twos = points; break;
            case "threes":        sc.Threes = points; break;
            case "fours":         sc.Fours = points; break;
            case "fives":         sc.Fives = points; break;
            case "sixes":         sc.Sixes = points; break;
            case "threeOfAKind":  sc.ThreeOfAKind = points; break;
            case "fourOfAKind":   sc.FourOfAKind = points; break;
            case "fullHouse":     sc.FullHouse = points; break;
            case "smallStraight": sc.SmallStraight = points; break;
            case "largeStraight": sc.LargeStraight = points; break;
            case "yahtzee":       sc.Yahtzee = points; break;
            case "chance":        sc.Chance = points; break;
        }
    }

    // Validates whether a category can legally be selected (Joker rules + not already filled)
    private static bool IsValidCategory(string category, int[] dice, YahtzeeScoreCard sc)
    {
        if (IsAlreadyFilled(category, sc)) return false;

        if (IsYahtzee(dice) && sc.Yahtzee.HasValue && sc.Yahtzee == 50)
        {
            // Bonus Yahtzee — Joker rules apply
            var face = dice[0];
            var upperCat = face switch { 1 => "ones", 2 => "twos", 3 => "threes", 4 => "fours", 5 => "fives", _ => "sixes" };

            if (!IsAlreadyFilled(upperCat, sc))
                return category == upperCat;

            // Corresponding upper filled — any unfilled lower section category
            var anyLowerAvailable = LowerCategories.Any(c => !IsAlreadyFilled(c, sc));
            if (anyLowerAvailable)
                return LowerCategories.Contains(category);

            // All lower filled — any upper section
            return UpperCategories.Contains(category);
        }

        return true;
    }

    // Picks the "worst" available category (lowest potential score, prefer 0-scorers)
    private static string AutoSelectCategory(int[] dice, YahtzeeScoreCard sc)
    {
        var scored = AllCategories
            .Where(c => !IsAlreadyFilled(c, sc) && IsValidCategory(c, dice, sc))
            .Select(c => (category: c, score: CalculateScore(c, dice, sc) ?? 0))
            .OrderBy(x => x.score)
            .FirstOrDefault();

        return scored.category ?? AllCategories.First(c => !IsAlreadyFilled(c, sc));
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    private static YahtzeeScoreCardDto ToScoreCardDto(YahtzeeScoreCard sc) => new(
        sc.Ones, sc.Twos, sc.Threes, sc.Fours, sc.Fives, sc.Sixes,
        sc.ThreeOfAKind, sc.FourOfAKind, sc.FullHouse, sc.SmallStraight,
        sc.LargeStraight, sc.Yahtzee, sc.Chance,
        sc.YahtzeeBonusCount, sc.UpperTotal, sc.UpperBonus, sc.GrandTotal, sc.IsComplete);

    private static YahtzeeParticipantDto ToParticipantDto(YahtzeeParticipant p) => new(
        p.UserId, p.Username, p.UserSlug, p.AvatarUrl, p.Role, p.IsConnected, ToScoreCardDto(p.ScoreCard));

    private static List<YahtzeeParticipantDto> ToParticipantDtos(IEnumerable<YahtzeeParticipant> participants) =>
        participants.Select(ToParticipantDto).ToList();

    private static YahtzeeGameStateDto ToState(YahtzeeGame g) => new(
        g.Slug, g.Name, g.GmUserId, g.GmUsername, g.Status,
        ToParticipantDtos(g.Participants),
        g.CurrentDice, g.HeldDice, g.RollCount, g.ScoredThisTurn,
        g.CurrentPlayerIndex, g.PlayAgainVoteActive);

    private static YahtzeeGameSummaryDto ToSummary(YahtzeeGame g) => new(
        g.Slug, g.Name, g.GmUsername, g.Status,
        g.Participants.Count(p => p.Role == "player"),
        g.Participants.Count(p => p.Role == "watcher"),
        g.LastActivity);

    // ── Persistence ───────────────────────────────────────────────────────────

    private async Task PersistAsync(YahtzeeGame game)
    {
        game.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<YahtzeeGame>.Filter.Eq(g => g.Slug, game.Slug);
        await db.YahtzeeGames.ReplaceOneAsync(filter, game, new ReplaceOptions { IsUpsert = true });
    }

    private async Task<YahtzeeGame> GetOrLoadGameAsync(string slug)
    {
        if (_games.TryGetValue(slug, out var cached))
            return cached;

        var fromDb = await db.YahtzeeGames.Find(g => g.Slug == slug).FirstOrDefaultAsync()
            ?? throw new InvalidOperationException($"Game '{slug}' not found.");

        foreach (var p in fromDb.Participants)
            p.IsConnected = false;

        _games[slug] = fromDb;
        return fromDb;
    }

    private void BroadcastOpenGames()
    {
        var open = _games.Values
            .Where(g => g.Status is YahtzeeGameStatus.Lobby or YahtzeeGameStatus.InProgress)
            .OrderByDescending(g => g.LastActivity)
            .Select(ToSummary)
            .ToList();

        _ = hub.Clients.Group(ListGroup).SendAsync("OpenGamesUpdated", open);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<(YahtzeeGame game, string? error)> CreateGameAsync(
        string userId, string username, string? userSlug, string? avatarUrl, string? customName)
    {
        var slug = await GenerateUniqueSlugAsync();
        var name = string.IsNullOrWhiteSpace(customName) ? $"{username}'s game" : customName.Trim();

        var game = new YahtzeeGame
        {
            Slug = slug,
            Name = name,
            GmUserId = userId,
            GmUsername = username,
            Participants =
            [
                new YahtzeeParticipant
                {
                    UserId = userId,
                    Username = username,
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

        await db.YahtzeeGames.InsertOneAsync(game);
        _games[slug] = game;
        BroadcastOpenGames();
        return (game, null);
    }

    private async Task<string> GenerateUniqueSlugAsync()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        while (true)
        {
            var slug = "yahtzee-" + RandomNumberGenerator.GetString(chars, 6);
            if (!_games.ContainsKey(slug))
            {
                var existing = await db.YahtzeeGames.Find(g => g.Slug == slug).AnyAsync();
                if (!existing) return slug;
            }
        }
    }

    // ── Open Games ────────────────────────────────────────────────────────────

    public async Task<List<YahtzeeGameSummaryDto>> GetOpenGamesAsync(int page, int pageSize)
    {
        var inMemory = _games.Values
            .Where(g => g.Status is YahtzeeGameStatus.Lobby or YahtzeeGameStatus.InProgress)
            .OrderByDescending(g => g.LastActivity)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToSummary)
            .ToList();

        if (inMemory.Count > 0) return inMemory;

        var games = await db.YahtzeeGames
            .Find(g => g.Status == YahtzeeGameStatus.Lobby || g.Status == YahtzeeGameStatus.InProgress)
            .SortByDescending(g => g.LastActivity)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return games.Select(ToSummary).ToList();
    }

    public async Task<int> GetOpenGamesCountAsync()
    {
        var count = _games.Values.Count(g => g.Status is YahtzeeGameStatus.Lobby or YahtzeeGameStatus.InProgress);
        if (count > 0) return count;
        return (int)await db.YahtzeeGames.CountDocumentsAsync(
            g => g.Status == YahtzeeGameStatus.Lobby || g.Status == YahtzeeGameStatus.InProgress);
    }

    // ── Connection ────────────────────────────────────────────────────────────

    public async Task<(YahtzeeGameStateDto? state, string? error)> HandleConnectionAsync(
        string? slug, string userId, string username, string? userSlug, string? avatarUrl,
        string connectionId, bool isListMode)
    {
        if (isListMode)
        {
            var open = _games.Values
                .Where(g => g.Status is YahtzeeGameStatus.Lobby or YahtzeeGameStatus.InProgress)
                .OrderByDescending(g => g.LastActivity)
                .Select(ToSummary)
                .ToList();
            await hub.Clients.Client(connectionId).SendAsync("OpenGamesUpdated", open);
            return (null, null);
        }

        if (string.IsNullOrEmpty(slug))
            return (null, "Game not found.");

        if (avatarUrl is null && userSlug is not null)
        {
            var dbUser = await db.Users.Find(u => u.Slug == userSlug).FirstOrDefaultAsync();
            avatarUrl = dbUser?.ProfileImageFilename;
        }

        YahtzeeGame game;
        try { game = await GetOrLoadGameAsync(slug); }
        catch { return (null, "Game not found."); }

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status == YahtzeeGameStatus.Closed)
                return (null, "This game is closed.");

            var existing = game.GetParticipant(userId);
            if (existing != null)
            {
                existing.ConnectionId = connectionId;
                existing.IsConnected = true;

                game.DisconnectCts?.Cancel();
                game.DisconnectCts = null;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantJoined",
                    new { participant = ToParticipantDto(existing), participants = ToParticipantDtos(game.Participants) });
            }
            else
            {
                string role;
                if (game.Status == YahtzeeGameStatus.Lobby)
                {
                    var activePlayers = game.Participants.Count(p => p.Role == "player");
                    role = activePlayers >= MaxActivePlayers ? "watcher" : "player";
                }
                else
                {
                    role = "watcher";
                }

                var participant = new YahtzeeParticipant
                {
                    UserId = userId,
                    Username = username,
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
                    new { participant = ToParticipantDto(participant), participants = ToParticipantDtos(game.Participants) });
            }

            return (ToState(game), null);
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

            if (game.Status == YahtzeeGameStatus.InProgress && game.CurrentActiveUserId == userId)
            {
                game.DisconnectCts?.Cancel();
                var cts = new CancellationTokenSource();
                game.DisconnectCts = cts;

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                    new { userId, participants = ToParticipantDtos(game.Participants) });

                _ = RunDisconnectTimerAsync(slug, userId, cts.Token);
            }
            else
            {
                if (participant.Role == "watcher")
                    game.Participants.Remove(participant);

                await hub.Clients.Group(GameGroup(slug)).SendAsync("ParticipantLeft",
                    new { userId, participants = ToParticipantDtos(game.Participants) });
            }
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task RunDisconnectTimerAsync(string slug, string userId, CancellationToken ct)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(DisconnectTimeoutSeconds), ct); }
        catch (OperationCanceledException) { return; }

        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != YahtzeeGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;

            var participant = game.GetParticipant(userId);
            if (participant is null || participant.IsConnected) return;

            // Auto-select worst category and advance turn
            await AutoSelectAndAdvanceAsync(game, slug, userId);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Start / Cancel ────────────────────────────────────────────────────────

    public async Task StartGameAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != userId) return;
            if (game.Status != YahtzeeGameStatus.Lobby) return;

            var players = game.Players;
            if (players.Count < 2) return;

            game.Status = YahtzeeGameStatus.InProgress;
            game.CurrentPlayerIndex = 0;
            game.CurrentDice = [0, 0, 0, 0, 0];
            game.HeldDice = [false, false, false, false, false];
            game.RollCount = 0;
            game.ScoredThisTurn = false;
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameStarted",
                new { participants = ToParticipantDtos(game.Participants), currentPlayerIndex = 0 });

            // Start idle timer for first player
            StartIdleTimer(game, slug, game.CurrentActiveUserId!);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    public async Task CancelGameAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.GmUserId != userId) return;
            if (game.Status != YahtzeeGameStatus.Lobby) return;

            game.Status = YahtzeeGameStatus.Closed;
            await PersistAsync(game);
            BroadcastOpenGames();

            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameCancelled", new { reason = "gm_cancelled" });
            _games.TryRemove(slug, out _);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Roll Dice ─────────────────────────────────────────────────────────────

    public async Task RollDiceAsync(string slug, string userId)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != YahtzeeGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;
            if (game.RollCount >= 3) return;
            if (game.ScoredThisTurn) return;

            game.IdleCts?.Cancel();
            game.IdleCts = null;

            for (var i = 0; i < 5; i++)
            {
                if (!game.HeldDice[i] || game.RollCount == 0)
                    game.CurrentDice[i] = Random.Shared.Next(1, 7);
            }
            game.RollCount++;

            // Reset all holds on first roll
            if (game.RollCount == 1)
                game.HeldDice = [false, false, false, false, false];

            game.LastActivity = DateTime.UtcNow;

            // Check for Bonus Yahtzee
            var participant = game.GetParticipant(userId)!;
            if (IsYahtzee(game.CurrentDice) && participant.ScoreCard.Yahtzee == 50)
            {
                participant.ScoreCard.YahtzeeBonusCount++;
                await PersistAsync(game);

                await hub.Clients.Group(GameGroup(slug)).SendAsync("YahtzeeBonusAwarded",
                    new { userId, bonusCount = participant.ScoreCard.YahtzeeBonusCount });
            }

            await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                new { dice = game.CurrentDice, heldDice = game.HeldDice, rollCount = game.RollCount });

            // Restart idle timer (only if player can still roll or needs to score)
            StartIdleTimer(game, slug, userId);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Toggle Hold ───────────────────────────────────────────────────────────

    public async Task ToggleHoldAsync(string slug, string userId, int diceIndex)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != YahtzeeGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;
            if (game.RollCount == 0 || game.RollCount >= 3) return;
            if (game.ScoredThisTurn) return;
            if (diceIndex < 0 || diceIndex > 4) return;

            game.HeldDice[diceIndex] = !game.HeldDice[diceIndex];

            await hub.Clients.Group(GameGroup(slug)).SendAsync("HoldToggled",
                new { diceIndex, isHeld = game.HeldDice[diceIndex] });
        }
        finally
        {
            game.Lock.Release();
        }
    }

    // ── Select Score ──────────────────────────────────────────────────────────

    public async Task SelectScoreAsync(string slug, string userId, string category)
    {
        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != YahtzeeGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != userId) return;
            if (game.RollCount == 0) return;

            var participant = game.GetParticipant(userId);
            if (participant is null) return;

            if (!IsValidCategory(category, game.CurrentDice, participant.ScoreCard)) return;

            game.IdleCts?.Cancel();
            game.IdleCts = null;

            var points = CalculateScore(category, game.CurrentDice, participant.ScoreCard) ?? 0;
            ApplyScore(category, points, participant.ScoreCard);
            game.ScoredThisTurn = true;
            game.LastActivity = DateTime.UtcNow;

            await hub.Clients.Group(GameGroup(slug)).SendAsync("ScoreSelected",
                new
                {
                    userId,
                    category,
                    points,
                    updatedScoreCard = ToScoreCardDto(participant.ScoreCard),
                    grandTotal = participant.ScoreCard.GrandTotal
                });

            await AdvanceTurnAsync(game, slug);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    private async Task AutoSelectAndAdvanceAsync(YahtzeeGame game, string slug, string userId)
    {
        var participant = game.GetParticipant(userId);
        if (participant is null) return;

        // Auto-roll if not yet rolled
        if (game.RollCount == 0)
        {
            for (var i = 0; i < 5; i++)
                game.CurrentDice[i] = Random.Shared.Next(1, 7);
            game.RollCount = 1;
            game.HeldDice = [false, false, false, false, false];

            await hub.Clients.Group(GameGroup(slug)).SendAsync("DiceRolled",
                new { dice = game.CurrentDice, heldDice = game.HeldDice, rollCount = game.RollCount });
        }

        var category = AutoSelectCategory(game.CurrentDice, participant.ScoreCard);
        var points = CalculateScore(category, game.CurrentDice, participant.ScoreCard) ?? 0;
        ApplyScore(category, points, participant.ScoreCard);
        game.ScoredThisTurn = true;
        game.LastActivity = DateTime.UtcNow;

        await hub.Clients.Group(GameGroup(slug)).SendAsync("ScoreSelected",
            new
            {
                userId,
                category,
                points,
                updatedScoreCard = ToScoreCardDto(participant.ScoreCard),
                grandTotal = participant.ScoreCard.GrandTotal,
                autoSelected = true
            });

        await AdvanceTurnAsync(game, slug);
    }

    private async Task AdvanceTurnAsync(YahtzeeGame game, string slug)
    {
        // Check if ALL players have complete scorecards
        var players = game.Players;
        if (players.All(p => p.ScoreCard.IsComplete))
        {
            await EndGameAsync(game, slug);
            return;
        }

        // Advance to next player, skipping completed ones
        var startIndex = game.CurrentPlayerIndex;
        for (var i = 1; i <= players.Count; i++)
        {
            var nextIndex = (startIndex + i) % players.Count;
            if (!players[nextIndex].ScoreCard.IsComplete)
            {
                game.CurrentPlayerIndex = nextIndex;
                break;
            }
        }

        // Reset turn state
        game.CurrentDice = [0, 0, 0, 0, 0];
        game.HeldDice = [false, false, false, false, false];
        game.RollCount = 0;
        game.ScoredThisTurn = false;

        var nextPlayer = game.CurrentActiveUserId;
        var nextUsername = nextPlayer != null ? game.GetParticipant(nextPlayer)?.Username ?? "" : "";

        await PersistAsync(game);

        await hub.Clients.Group(GameGroup(slug)).SendAsync("TurnChanged",
            new { currentPlayerIndex = game.CurrentPlayerIndex, playerName = nextUsername });

        if (nextPlayer != null)
            StartIdleTimer(game, slug, nextPlayer);
    }

    private async Task EndGameAsync(YahtzeeGame game, string slug)
    {
        game.Status = YahtzeeGameStatus.Finished;
        game.IdleCts?.Cancel();
        game.IdleCts = null;

        await PersistAsync(game);
        BroadcastOpenGames();

        var rankings = game.Players
            .OrderByDescending(p => p.ScoreCard.GrandTotal)
            .Select((p, rank) => new
            {
                rank = rank + 1,
                userId = p.UserId,
                username = p.Username,
                grandTotal = p.ScoreCard.GrandTotal,
                scoreCard = ToScoreCardDto(p.ScoreCard)
            })
            .ToList();

        await hub.Clients.Group(GameGroup(slug)).SendAsync("GameFinished", new { rankings });

        await RecordYahtzeeStatsAsync(game);
    }

    // ── Idle Timer ────────────────────────────────────────────────────────────

    private void StartIdleTimer(YahtzeeGame game, string slug, string expectedUserId)
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

            try
            {
                await hub.Clients.Group(GameGroup(slug)).SendAsync("IdleCountdown", i, ct);
            }
            catch (OperationCanceledException) { return; }

            if (i == 0) break;

            try { await Task.Delay(1000, ct); }
            catch (OperationCanceledException) { return; }
        }

        if (!_games.TryGetValue(slug, out var game)) return;

        await game.Lock.WaitAsync();
        try
        {
            if (game.Status != YahtzeeGameStatus.InProgress) return;
            if (game.CurrentActiveUserId != expectedUserId) return;

            await AutoSelectAndAdvanceAsync(game, slug, expectedUserId);
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
            if (game.Status != YahtzeeGameStatus.Finished) return;

            game.PlayAgainVoteActive = true;
            game.PlayAgainVotes = [];
            game.LastActivity = DateTime.UtcNow;

            await PersistAsync(game);

            var cts = new CancellationTokenSource();
            game.PlayAgainCts = cts;

            await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainPrompt",
                new { timeoutSeconds = PlayAgainTimeoutSeconds });

            _ = RunPlayAgainTimerAsync(slug, cts.Token);
        }
        finally
        {
            game.Lock.Release();
        }
    }

    public async Task VotePlayAgainAsync(string slug, string userId, bool vote)
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

            await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainVoteUpdate", new { yesCount, noCount });

            if (userId == game.GmUserId && !vote)
            {
                await FinalizePlayAgainAsync(game, slug, forceClose: true);
                return;
            }

            var humanCount = game.Participants.Count(p => p.Role == "player");
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
        try { await Task.Delay(TimeSpan.FromSeconds(PlayAgainTimeoutSeconds), ct); }
        catch (OperationCanceledException) { return; }

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

    private async Task FinalizePlayAgainAsync(YahtzeeGame game, string slug, bool forceClose)
    {
        game.PlayAgainCts?.Cancel();
        game.PlayAgainCts = null;
        game.PlayAgainVoteActive = false;

        var yesCount = game.PlayAgainVotes.Values.Count(v => v);
        var noCount = game.PlayAgainVotes.Values.Count(v => !v);
        var majority = !forceClose && yesCount > noCount;

        if (!majority)
        {
            game.Status = YahtzeeGameStatus.Closed;
            await PersistAsync(game);
            BroadcastOpenGames();
            await hub.Clients.Group(GameGroup(slug)).SendAsync("GameClosed", new { reason = "play_again_no" });
            _games.TryRemove(slug, out _);
            return;
        }

        // Promote connected watchers to players (up to MaxActivePlayers)
        var currentPlayerCount = game.Participants.Count(p => p.Role == "player");
        foreach (var p in game.Participants.Where(p => p.Role == "watcher" && p.IsConnected))
        {
            if (currentPlayerCount >= MaxActivePlayers) break;
            p.Role = "player";
            currentPlayerCount++;
        }

        // Reset for a new round
        foreach (var p in game.Participants.Where(p => p.Role == "player"))
            p.ScoreCard = new YahtzeeScoreCard();

        game.Status = YahtzeeGameStatus.InProgress;
        game.CurrentPlayerIndex = 0;
        game.CurrentDice = [0, 0, 0, 0, 0];
        game.HeldDice = [false, false, false, false, false];
        game.RollCount = 0;
        game.ScoredThisTurn = false;
        game.PlayAgainVotes = [];
        game.LastActivity = DateTime.UtcNow;

        await PersistAsync(game);

        await hub.Clients.Group(GameGroup(slug)).SendAsync("PlayAgainResult",
            new { participants = ToParticipantDtos(game.Participants), currentPlayerIndex = 0 });

        if (game.CurrentActiveUserId is { } firstPlayer)
            StartIdleTimer(game, slug, firstPlayer);
    }

    // ── Chat ──────────────────────────────────────────────────────────────────

    public async Task SendChatAsync(string slug, string userId, string username, string text)
    {
        if (!_games.TryGetValue(slug, out var game)) return;
        if (game.Status == YahtzeeGameStatus.Closed) return;

        var trimmed = text.Trim();
        if (string.IsNullOrEmpty(trimmed)) return;
        if (trimmed.Length > 500) trimmed = trimmed[..500];

        var participant = game.GetParticipant(userId);
        var role = participant?.Role ?? "watcher";

        await hub.Clients.Group(GameGroup(slug)).SendAsync("ChatMessage",
            new { userId, username, role, text = trimmed, timestamp = DateTime.UtcNow, isSystem = false });
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    private async Task RecordYahtzeeStatsAsync(YahtzeeGame game)
    {
        var players = game.Players;
        if (players.Count < 2) return;

        var winner = players.OrderByDescending(p => p.ScoreCard.GrandTotal).First();
        var results = players.Select(p =>
            new GamePlayerResult(p.UserId, p.Username, p.UserSlug, p.UserId == winner.UserId));

        try { await gameStatsService.RecordGameAsync("yahtzee", results, hadBots: false); }
        catch (Exception ex) { logger.LogError(ex, "Failed to record yahtzee game stats."); }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    public async Task CleanupAbandonedGamesAsync()
    {
        var cutoff = DateTime.UtcNow.AddHours(-12);
        var slugsToRemove = _games.Values
            .Where(g => g.Status is YahtzeeGameStatus.Closed || g.LastActivity < cutoff)
            .Select(g => g.Slug)
            .ToList();

        foreach (var slug in slugsToRemove)
        {
            if (_games.TryRemove(slug, out var game))
            {
                game.IdleCts?.Cancel();
                game.DisconnectCts?.Cancel();
                game.PlayAgainCts?.Cancel();
            }
        }

        if (slugsToRemove.Count > 0)
            logger.LogInformation("Yahtzee cleanup: removed {Count} game(s) from memory.", slugsToRemove.Count);

        // Mark stale DB games as closed
        var filter = Builders<YahtzeeGame>.Filter.And(
            Builders<YahtzeeGame>.Filter.In(g => g.Status,
                [YahtzeeGameStatus.Lobby, YahtzeeGameStatus.InProgress]),
            Builders<YahtzeeGame>.Filter.Lt(g => g.LastActivity, cutoff));

        var update = Builders<YahtzeeGame>.Update.Set(g => g.Status, YahtzeeGameStatus.Closed);
        await db.YahtzeeGames.UpdateManyAsync(filter, update);
    }
}
