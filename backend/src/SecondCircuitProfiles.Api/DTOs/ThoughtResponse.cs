namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtResponse
{
    public string Id { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string AuthorSlug { get; set; } = null!;
    public string AuthorUserId { get; set; } = null!;
    public string AuthorUsername { get; set; } = null!;
    public string? AuthorAvatarUrl { get; set; }
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string? ImageUrl { get; set; }
    public List<string> Tags { get; set; } = [];
    public bool IsPinned { get; set; }
    public bool IsHidden { get; set; }
    public bool IsOwnThought { get; set; }
    public List<CommentResponse> Comments { get; set; } = [];
    public List<ReactionGroupResponse> Reactions { get; set; } = [];
    public int ReadCount { get; set; }
    public int UniqueReaderCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
