using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public enum YahtzeeGameStatus { Lobby, InProgress, Finished, Closed }

public class YahtzeeScoreCard
{
    [BsonElement("ones")]         public int? Ones { get; set; }
    [BsonElement("twos")]         public int? Twos { get; set; }
    [BsonElement("threes")]       public int? Threes { get; set; }
    [BsonElement("fours")]        public int? Fours { get; set; }
    [BsonElement("fives")]        public int? Fives { get; set; }
    [BsonElement("sixes")]        public int? Sixes { get; set; }

    [BsonElement("threeOfAKind")] public int? ThreeOfAKind { get; set; }
    [BsonElement("fourOfAKind")]  public int? FourOfAKind { get; set; }
    [BsonElement("fullHouse")]    public int? FullHouse { get; set; }
    [BsonElement("smallStraight")]public int? SmallStraight { get; set; }
    [BsonElement("largeStraight")]public int? LargeStraight { get; set; }
    [BsonElement("yahtzee")]      public int? Yahtzee { get; set; }
    [BsonElement("chance")]       public int? Chance { get; set; }

    [BsonElement("yahtzeeBonusCount")]
    public int YahtzeeBonusCount { get; set; }

    [BsonIgnore]
    public int UpperTotal =>
        (Ones ?? 0) + (Twos ?? 0) + (Threes ?? 0) + (Fours ?? 0) + (Fives ?? 0) + (Sixes ?? 0);

    [BsonIgnore]
    public int UpperBonus => UpperTotal >= 63 ? 35 : 0;

    [BsonIgnore]
    public int GrandTotal =>
        UpperTotal + UpperBonus
        + (ThreeOfAKind ?? 0) + (FourOfAKind ?? 0) + (FullHouse ?? 0)
        + (SmallStraight ?? 0) + (LargeStraight ?? 0) + (Yahtzee ?? 0) + (Chance ?? 0)
        + YahtzeeBonusCount * 100;

    [BsonIgnore]
    public bool IsComplete =>
        Ones.HasValue && Twos.HasValue && Threes.HasValue && Fours.HasValue
        && Fives.HasValue && Sixes.HasValue && ThreeOfAKind.HasValue && FourOfAKind.HasValue
        && FullHouse.HasValue && SmallStraight.HasValue && LargeStraight.HasValue
        && Yahtzee.HasValue && Chance.HasValue;
}

public class YahtzeeParticipant
{
    [BsonElement("userId")]      public string UserId { get; set; } = null!;
    [BsonElement("username")]    public string Username { get; set; } = null!;
    [BsonElement("userSlug")]    public string? UserSlug { get; set; }
    [BsonElement("displayName")] public string? DisplayName { get; set; }
    [BsonElement("avatarUrl")]   public string? AvatarUrl { get; set; }
    [BsonElement("role")]        public string Role { get; set; } = "player"; // "player" | "watcher"
    [BsonElement("isConnected")] public bool IsConnected { get; set; } = true;
    [BsonElement("scoreCard")]   public YahtzeeScoreCard ScoreCard { get; set; } = new();

    [BsonIgnore] public string? ConnectionId { get; set; }
}

public class YahtzeeGame
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("slug")]              public string Slug { get; set; } = null!;
    [BsonElement("name")]              public string Name { get; set; } = null!;
    [BsonElement("gmUserId")]          public string GmUserId { get; set; } = null!;
    [BsonElement("gmUsername")]        public string GmUsername { get; set; } = null!;
    [BsonElement("participants")]      public List<YahtzeeParticipant> Participants { get; set; } = [];

    [BsonElement("currentDice")]       public int[] CurrentDice { get; set; } = [0, 0, 0, 0, 0];
    [BsonElement("heldDice")]          public bool[] HeldDice { get; set; } = [false, false, false, false, false];
    [BsonElement("rollCount")]         public int RollCount { get; set; }
    [BsonElement("scoredThisTurn")]    public bool ScoredThisTurn { get; set; }
    [BsonElement("currentPlayerIndex")]public int CurrentPlayerIndex { get; set; }

    [BsonElement("randomiseTurnOrder")] public bool RandomiseTurnOrder { get; set; }

    [BsonElement("playAgainVoteActive")]public bool PlayAgainVoteActive { get; set; }
    [BsonElement("playAgainVotes")]     public Dictionary<string, bool> PlayAgainVotes { get; set; } = [];

    [BsonElement("status")]            public YahtzeeGameStatus Status { get; set; } = YahtzeeGameStatus.Lobby;
    [BsonElement("lastActivity")]      public DateTime LastActivity { get; set; } = DateTime.UtcNow;
    [BsonElement("createdAt")]         public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [BsonElement("updatedAt")]         public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonIgnore] public SemaphoreSlim Lock { get; } = new(1, 1);
    [BsonIgnore] public CancellationTokenSource? IdleCts { get; set; }
    [BsonIgnore] public CancellationTokenSource? DisconnectCts { get; set; }
    [BsonIgnore] public CancellationTokenSource? PlayAgainCts { get; set; }

    public YahtzeeParticipant? GetParticipant(string userId) =>
        Participants.FirstOrDefault(p => p.UserId == userId);

    public List<YahtzeeParticipant> Players =>
        Participants.Where(p => p.Role == "player").ToList();

    public string? CurrentActiveUserId
    {
        get
        {
            if (Status != YahtzeeGameStatus.InProgress) return null;
            var players = Players;
            if (players.Count == 0) return null;
            return players[CurrentPlayerIndex % players.Count].UserId;
        }
    }
}
