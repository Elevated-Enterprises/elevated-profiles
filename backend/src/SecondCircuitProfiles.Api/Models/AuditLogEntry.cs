using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class AuditLogEntry
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("adminDiscordId")]
    public string AdminDiscordId { get; set; } = null!;

    [BsonElement("adminDiscordUsername")]
    public string AdminDiscordUsername { get; set; } = null!;

    [BsonElement("action")]
    public string Action { get; set; } = null!;

    [BsonElement("targetType")]
    public string TargetType { get; set; } = null!;

    [BsonElement("targetId")]
    public string TargetId { get; set; } = null!;

    [BsonElement("details")]
    public string? Details { get; set; }

    [BsonElement("previousValues")]
    public BsonDocument? PreviousValues { get; set; }

    [BsonElement("newValues")]
    public BsonDocument? NewValues { get; set; }

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
