using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public enum ApplicationSubmissionState
{
    Incomplete,
    Submitted,
    InReview,
    Accepted,
    Rejected,
    LockedOut
}

public class ApplicationSubmission
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("formTypeId")]
    public string FormTypeId { get; set; } = null!;

    [BsonElement("state")]
    [BsonRepresentation(BsonType.String)]
    public ApplicationSubmissionState State { get; set; } = ApplicationSubmissionState.Incomplete;

    [BsonElement("answers")]
    public List<ApplicationAnswer> Answers { get; set; } = [];

    [BsonElement("adminRemarks")]
    public string? AdminRemarks { get; set; }

    [BsonElement("assignedByUserId")]
    public string? AssignedByUserId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("submittedAt")]
    public DateTime? SubmittedAt { get; set; }

    [BsonElement("reviewStartedAt")]
    public DateTime? ReviewStartedAt { get; set; }

    [BsonElement("resolvedAt")]
    public DateTime? ResolvedAt { get; set; }
}

public class ApplicationAnswer
{
    [BsonElement("questionId")]
    public string QuestionId { get; set; } = null!;

    [BsonElement("text")]
    public string Text { get; set; } = "";
}
