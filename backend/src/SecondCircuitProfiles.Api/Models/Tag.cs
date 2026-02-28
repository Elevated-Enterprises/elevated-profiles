using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class ThoughtTag
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("name")]
    public string Name { get; set; } = null!;

    [BsonElement("color")]
    public string? Color { get; set; }

    [BsonElement("sortOrder")]
    public int SortOrder { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
