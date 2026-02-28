using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class SocialEdge
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("fromUserId")]
    public string FromUserId { get; set; } = null!;

    [BsonElement("toUserId")]
    public string ToUserId { get; set; } = null!;

    [BsonElement("edgeType")]
    public string EdgeType { get; set; } = null!; // "follow" | "ignore" | "block"

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
