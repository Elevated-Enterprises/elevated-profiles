using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class Companion
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonElement("visibility")]
    public Visibility Visibility { get; set; } = Visibility.Private;

    [BsonElement("profileImageFilename")]
    public string? ProfileImageFilename { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = null!;

    [BsonElement("platform")]
    public string? Platform { get; set; }

    [BsonElement("role")]
    public string? Role { get; set; }

    [BsonElement("dateOfBirth")]
    public DateTime? DateOfBirth { get; set; }

    [BsonElement("bio")]
    public string? Bio { get; set; }

    [BsonElement("alignment")]
    public Alignment? Alignment { get; set; }

    [BsonElement("order")]
    public int Order { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
