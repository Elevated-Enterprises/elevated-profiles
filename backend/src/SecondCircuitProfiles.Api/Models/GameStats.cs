using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class GameStats
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("username")]
    public string Username { get; set; } = null!;

    [BsonElement("userSlug")]
    public string? UserSlug { get; set; }

    [BsonElement("gameType")]
    public string GameType { get; set; } = null!; // "pig" | "yahtzee"

    // Games without any bots
    [BsonElement("gamesPlayed")]
    public int GamesPlayed { get; set; }

    [BsonElement("gamesWon")]
    public int GamesWon { get; set; }

    // Games where at least one bot participated
    [BsonElement("gamesPlayedWithBots")]
    public int GamesPlayedWithBots { get; set; }

    [BsonElement("gamesWonWithBots")]
    public int GamesWonWithBots { get; set; }
}
