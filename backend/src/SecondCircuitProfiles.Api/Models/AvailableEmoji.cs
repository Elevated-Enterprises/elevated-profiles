using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class AvailableEmoji
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("key")]
    public string Key { get; set; } = null!;

    [BsonElement("emoji")]
    public string Emoji { get; set; } = null!;

    [BsonElement("label")]
    public string Label { get; set; } = null!;

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    [BsonElement("sortOrder")]
    public int SortOrder { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
