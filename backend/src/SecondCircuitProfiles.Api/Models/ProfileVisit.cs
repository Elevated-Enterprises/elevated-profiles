using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class ProfileVisit
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("profileUserId")]
    public string ProfileUserId { get; set; } = null!;

    [BsonElement("visitorUserId")]
    public string VisitorUserId { get; set; } = null!;

    [BsonElement("visitedAt")]
    public DateTime VisitedAt { get; set; } = DateTime.UtcNow;
}
