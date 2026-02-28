namespace SecondCircuitProfiles.Api.DTOs;

public class CommentResponse
{
    public string Id { get; set; } = null!;
    public string AuthorSlug { get; set; } = null!;
    public string AuthorUsername { get; set; } = null!;
    public string? AuthorAvatarUrl { get; set; }
    public string Body { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public List<ReactionGroupResponse> Reactions { get; set; } = [];
    public bool IsOwnComment { get; set; }
}
