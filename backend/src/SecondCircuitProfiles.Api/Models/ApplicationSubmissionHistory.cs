using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class ApplicationSubmissionHistory
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("submissionId")]
    public string SubmissionId { get; set; } = null!;

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("fromState")]
    [BsonRepresentation(BsonType.String)]
    public ApplicationSubmissionState? FromState { get; set; }

    [BsonElement("toState")]
    [BsonRepresentation(BsonType.String)]
    public ApplicationSubmissionState ToState { get; set; }

    [BsonElement("changedByUserId")]
    public string ChangedByUserId { get; set; } = null!;

    [BsonElement("changedByDiscordUsername")]
    public string ChangedByDiscordUsername { get; set; } = null!;

    [BsonElement("remarks")]
    public string? Remarks { get; set; }

    [BsonElement("changedAt")]
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
}
