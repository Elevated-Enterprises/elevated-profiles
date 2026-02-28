using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class StatusUpdate
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("text")]
    public string Text { get; set; } = null!;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
