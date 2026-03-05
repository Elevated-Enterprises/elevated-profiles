using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class CommentService(
    MongoDbContext db,
    IThoughtSettingsService settingsService,
    IReactionService reactionService,
    IFeedService feedService,
    ISocialService socialService) : ICommentService
{

    public async Task<List<CommentResponse>> GetComments(string thoughtId, string? requestingUserId)
    {
        var comments = await db.Comments
            .Find(c => c.ThoughtId == thoughtId && !c.IsDeleted)
            .SortBy(c => c.CreatedAt)
            .ToListAsync();

        var authorIds = comments.Select(c => c.AuthorUserId).Distinct().ToList();
        var authors = await db.Users.Find(u => authorIds.Contains(u.Id)).ToListAsync();
        var authorMap = authors.ToDictionary(u => u.Id);

        var commentIds = comments.Select(c => c.Id).ToList();
        var reactionMap = await reactionService.GetReactionsBulk(commentIds, "comment", requestingUserId);

        return comments.Select(c =>
        {
            authorMap.TryGetValue(c.AuthorUserId, out var author);
            reactionMap.TryGetValue(c.Id, out var reactions);
            return new CommentResponse
            {
                Id = c.Id,
                AuthorSlug = author?.Slug ?? "",
                AuthorUsername = author?.AlternativeName ?? author?.DiscordUsername ?? "Unknown",
                AuthorAvatarUrl = author?.ProfileImageFilename,
                Body = c.Body,
                CreatedAt = c.CreatedAt,
                Reactions = reactions ?? [],
                IsOwnComment = requestingUserId != null && c.AuthorUserId == requestingUserId
            };
        }).ToList();
    }

    public async Task<(CommentResponse? comment, string? error)> CreateComment(
        string thoughtId, string userId, CommentCreateRequest request)
    {
        var (_, _, _, minCommentLength) = await settingsService.GetEffectiveSettings(userId);

        if (request.Body.Trim().Length < minCommentLength)
            return (null, $"Comment must be at least {minCommentLength} characters.");

        var thought = await db.Thoughts.Find(t => t.Id == thoughtId && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null)
            return (null, "Thought not found.");

        if (await socialService.IsBlockedBy(thought.AuthorUserId, userId))
            return (null, "You cannot comment on this user's thoughts.");

        var comment = new Comment
        {
            ThoughtId = thoughtId,
            AuthorUserId = userId,
            Body = request.Body.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.Comments.InsertOneAsync(comment);

        await feedService.RecordNewComment(userId, thoughtId, comment.Id, thought.Title, comment.Body);

        var user = await db.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
        return (new CommentResponse
        {
            Id = comment.Id,
            AuthorSlug = user?.Slug ?? "",
            AuthorUsername = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
            AuthorAvatarUrl = user?.ProfileImageFilename,
            Body = comment.Body,
            CreatedAt = comment.CreatedAt,
            Reactions = [],
            IsOwnComment = true
        }, null);
    }

    public async Task<bool> DeleteComment(string commentId, string userId, bool isAdmin)
    {
        var comment = await db.Comments.Find(c => c.Id == commentId && !c.IsDeleted).FirstOrDefaultAsync();
        if (comment == null) return false;

        if (!isAdmin && comment.AuthorUserId != userId)
        {
            // Thought owner may also delete comments on their own thoughts
            var thought = await db.Thoughts.Find(t => t.Id == comment.ThoughtId && !t.IsDeleted).FirstOrDefaultAsync();
            if (thought == null || thought.AuthorUserId != userId) return false;
        }

        var update = Builders<Comment>.Update.Set(c => c.IsDeleted, true);
        await db.Comments.UpdateOneAsync(c => c.Id == commentId, update);
        return true;
    }
}
