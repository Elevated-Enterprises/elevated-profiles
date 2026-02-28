using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class Reaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("targetId")]
    public string TargetId { get; set; } = null!;

    [BsonElement("targetType")]
    public string TargetType { get; set; } = null!; // "thought" | "comment"

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("emojiKey")]
    public string EmojiKey { get; set; } = null!;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
