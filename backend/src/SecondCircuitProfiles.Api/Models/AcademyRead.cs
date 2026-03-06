using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class AcademyRead
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("articlePath")]
    public string ArticlePath { get; set; } = null!;

    [BsonElement("visitorUserId")]
    public string VisitorUserId { get; set; } = null!;

    [BsonElement("readAt")]
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;
}
