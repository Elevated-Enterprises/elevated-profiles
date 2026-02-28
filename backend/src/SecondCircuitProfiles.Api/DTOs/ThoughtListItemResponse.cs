namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtListItemResponse
{
    public string Id { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string AuthorSlug { get; set; } = null!;
    public string AuthorUsername { get; set; } = null!;
    public string? AuthorAvatarUrl { get; set; }
    public string Title { get; set; } = null!;
    public string Excerpt { get; set; } = null!;
    public List<string> Tags { get; set; } = [];
    public bool IsPinned { get; set; }
    public bool IsFromFollowed { get; set; }
    public List<ReactionGroupResponse> TopReactions { get; set; } = [];
    public int CommentCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
