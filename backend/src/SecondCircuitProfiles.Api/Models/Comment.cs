using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class Comment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("thoughtId")]
    public string ThoughtId { get; set; } = null!;

    [BsonElement("authorUserId")]
    public string AuthorUserId { get; set; } = null!;

    [BsonElement("body")]
    public string Body { get; set; } = null!;

    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
