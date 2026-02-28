using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class Thought
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("slug")]
    public string? Slug { get; set; }

    [BsonElement("authorUserId")]
    public string AuthorUserId { get; set; } = null!;

    [BsonElement("title")]
    public string Title { get; set; } = null!;

    [BsonElement("body")]
    public string Body { get; set; } = null!;

    [BsonElement("imageFilename")]
    public string? ImageFilename { get; set; }

    [BsonElement("tags")]
    public List<string> Tags { get; set; } = [];

    [BsonElement("isPinned")]
    public bool IsPinned { get; set; } = false;

    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;

    [BsonElement("isHidden")]
    public bool IsHidden { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
