using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public enum PigGameStatus
{
    Lobby,
    InProgress,
    Finished,
    Closed
}

public class PigParticipant
{
    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("username")]
    public string Username { get; set; } = null!;

    [BsonElement("userSlug")]
    public string? UserSlug { get; set; }

    [BsonElement("avatarUrl")]
    public string? AvatarUrl { get; set; }

    [BsonElement("role")]
    public string Role { get; set; } = "player"; // "player" | "watcher"

    [BsonElement("score")]
    public int Score { get; set; }

    [BsonElement("consecutiveSkips")]
    public int ConsecutiveSkips { get; set; }

    [BsonElement("isConnected")]
    public bool IsConnected { get; set; } = true;

    // Transient — not persisted to MongoDB
    [BsonIgnore]
    public string? ConnectionId { get; set; }
}

public class PigGame
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("slug")]
    public string Slug { get; set; } = null!;

    [BsonElement("name")]
    public string Name { get; set; } = null!;

    [BsonElement("gmUserId")]
    public string GmUserId { get; set; } = null!;

    [BsonElement("gmUsername")]
    public string GmUsername { get; set; } = null!;

    [BsonElement("status")]
    public PigGameStatus Status { get; set; } = PigGameStatus.Lobby;

    [BsonElement("participants")]
    public List<PigParticipant> Participants { get; set; } = [];

    [BsonElement("turnOrder")]
    public List<string> TurnOrder { get; set; } = []; // userId list in play order

    [BsonElement("currentPlayerIndex")]
    public int CurrentPlayerIndex { get; set; }

    [BsonElement("currentTurnScore")]
    public int CurrentTurnScore { get; set; }

    [BsonElement("playAgainVoteActive")]
    public bool PlayAgainVoteActive { get; set; }

    [BsonElement("playAgainVotes")]
    public Dictionary<string, bool> PlayAgainVotes { get; set; } = [];

    [BsonElement("lastActivity")]
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Transient — not persisted to MongoDB
    [BsonIgnore]
    public CancellationTokenSource? IdleTimerCts { get; set; }

    [BsonIgnore]
    public CancellationTokenSource? DisconnectTimerCts { get; set; }

    [BsonIgnore]
    public CancellationTokenSource? PlayAgainTimerCts { get; set; }

    [BsonIgnore]
    public SemaphoreSlim Lock { get; } = new(1, 1);

    // Derived helpers
    public PigParticipant? GetParticipant(string userId) =>
        Participants.FirstOrDefault(p => p.UserId == userId);

    public string? CurrentActiveUserId =>
        Status == PigGameStatus.InProgress && TurnOrder.Count > 0
            ? TurnOrder[CurrentPlayerIndex % TurnOrder.Count]
            : null;
}
