using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class ThoughtSettings
{
    [BsonId]
    public string Id { get; set; } = "settings"; // singleton document

    [BsonElement("maxThoughtsPerWindow")]
    public int MaxThoughtsPerWindow { get; set; } = 3;

    [BsonElement("rateLimitWindowHours")]
    public int RateLimitWindowHours { get; set; } = 24;

    [BsonElement("minThoughtLength")]
    public int MinThoughtLength { get; set; } = 150;

    [BsonElement("minCommentLength")]
    public int MinCommentLength { get; set; } = 30;

    [BsonElement("userOverrides")]
    public Dictionary<string, ThoughtSettingsOverride> UserOverrides { get; set; } = new();
}

public class ThoughtSettingsOverride
{
    [BsonElement("maxThoughtsPerWindow")]
    public int? MaxThoughtsPerWindow { get; set; }

    [BsonElement("rateLimitWindowHours")]
    public int? RateLimitWindowHours { get; set; }

    [BsonElement("minThoughtLength")]
    public int? MinThoughtLength { get; set; }

    [BsonElement("minCommentLength")]
    public int? MinCommentLength { get; set; }
}
