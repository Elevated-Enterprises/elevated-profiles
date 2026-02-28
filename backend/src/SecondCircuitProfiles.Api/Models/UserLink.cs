using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class UserLink
{
    [BsonElement("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("label")]
    public string Label { get; set; } = null!;

    [BsonElement("url")]
    public string Url { get; set; } = null!;
}
