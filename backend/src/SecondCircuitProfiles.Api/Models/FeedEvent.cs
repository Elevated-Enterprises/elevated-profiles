using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class FeedEvent
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    // "new_thought" | "new_comment" | "reaction_milestone" | "status_change"
    [BsonElement("type")]
    public string Type { get; set; } = null!;

    [BsonElement("actorUserId")]
    public string ActorUserId { get; set; } = null!;

    [BsonElement("targetId")]
    public string? TargetId { get; set; }

    // "thought" | "comment"
    [BsonElement("targetType")]
    public string? TargetType { get; set; }

    [BsonElement("targetTitle")]
    public string? TargetTitle { get; set; }

    [BsonElement("excerpt")]
    public string? Excerpt { get; set; }

    [BsonElement("reactionCount")]
    public int? ReactionCount { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
