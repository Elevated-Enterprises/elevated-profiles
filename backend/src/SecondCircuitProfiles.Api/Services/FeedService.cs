using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class FeedService(MongoDbContext db) : IFeedService
{

    public async Task<List<FeedItemResponse>> GetFeed(
        string? requestingUserId,
        List<string> followingIds,
        List<string> ignoringIds,
        string? cursor,
        int limit = 30)
    {
        var filterBuilder = Builders<FeedEvent>.Filter;
        var filter = filterBuilder.Nin(e => e.ActorUserId, ignoringIds);

        if (cursor != null && DateTime.TryParse(cursor, out var cursorDate))
            filter &= filterBuilder.Lt(e => e.CreatedAt, cursorDate);

        // Status changes only for followed users
        filter &= filterBuilder.Or(
            filterBuilder.Ne(e => e.Type, "status_change"),
            filterBuilder.In(e => e.ActorUserId, followingIds));

        // Fetch a bit more than limit so filtering doesn't leave us short
        var events = await db.FeedEvents
            .Find(filter)
            .SortByDescending(e => e.CreatedAt)
            .Limit(limit * 3)
            .ToListAsync();

        // Collect thought IDs to check for hidden thoughts
        var thoughtTargetIds = events
            .Where(e => e.TargetId != null && e.TargetType == "thought")
            .Select(e => e.TargetId!)
            .Distinct()
            .ToList();

        HashSet<string> hiddenThoughtIds = [];
        if (thoughtTargetIds.Count > 0)
        {
            var hiddenThoughts = await db.Thoughts
                .Find(t => thoughtTargetIds.Contains(t.Id) && (t.IsHidden || t.IsDeleted))
                .Project(t => t.Id)
                .ToListAsync();
            hiddenThoughtIds = hiddenThoughts.ToHashSet();
        }

        // Collect comment IDs to check for deleted comments
        var commentIds = events
            .Where(e => e.Type == "new_comment" && e.TargetCommentId != null)
            .Select(e => e.TargetCommentId!)
            .Distinct()
            .ToList();

        HashSet<string> deletedCommentIds = [];
        if (commentIds.Count > 0)
        {
            var deletedComments = await db.Comments
                .Find(c => commentIds.Contains(c.Id) && c.IsDeleted)
                .Project(c => c.Id)
                .ToListAsync();
            deletedCommentIds = deletedComments.ToHashSet();
        }

        // Filter out events for hidden/deleted thoughts and deleted comments
        var visibleEvents = events
            .Where(e =>
            {
                if (e.TargetId != null && hiddenThoughtIds.Contains(e.TargetId))
                    return false;
                if (e.Type == "new_comment" && e.TargetCommentId != null && deletedCommentIds.Contains(e.TargetCommentId))
                    return false;
                return true;
            })
            .Take(limit)
            .ToList();

        // Enrich with actor user info
        var actorIds = visibleEvents.Select(e => e.ActorUserId).Distinct().ToList();
        var actors = await db.Users.Find(u => actorIds.Contains(u.Id)).ToListAsync();
        var actorMap = actors.ToDictionary(u => u.Id);

        return visibleEvents.Select(e =>
        {
            actorMap.TryGetValue(e.ActorUserId, out var actor);
            return new FeedItemResponse
            {
                Id = e.Id,
                Type = e.Type,
                ActorSlug = actor?.Slug ?? "",
                ActorUsername = actor?.AlternativeName ?? actor?.DiscordUsername ?? "Unknown",
                ActorAvatarUrl = actor?.ProfileImageFilename,
                TargetId = e.TargetId,
                TargetTitle = e.TargetTitle,
                TargetType = e.TargetType,
                Excerpt = e.Excerpt,
                Timestamp = e.CreatedAt,
                IsFromFollowed = followingIds.Contains(e.ActorUserId),
                ReactionCount = e.ReactionCount
            };
        }).ToList();
    }

    public async Task RecordNewThought(string actorUserId, string thoughtId, string thoughtTitle, string excerpt)
    {
        await db.FeedEvents.InsertOneAsync(new FeedEvent
        {
            Type = "new_thought",
            ActorUserId = actorUserId,
            TargetId = thoughtId,
            TargetType = "thought",
            TargetTitle = thoughtTitle,
            Excerpt = excerpt.Length > 150 ? excerpt[..150] + "..." : excerpt,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task RecordNewComment(string actorUserId, string thoughtId, string commentId, string thoughtTitle, string excerpt)
    {
        await db.FeedEvents.InsertOneAsync(new FeedEvent
        {
            Type = "new_comment",
            ActorUserId = actorUserId,
            TargetId = thoughtId,
            TargetCommentId = commentId,
            TargetType = "thought",
            TargetTitle = thoughtTitle,
            Excerpt = excerpt.Length > 150 ? excerpt[..150] + "..." : excerpt,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task RecordReactionMilestone(string thoughtId, string thoughtTitle, string authorUserId, int count)
    {
        await db.FeedEvents.InsertOneAsync(new FeedEvent
        {
            Type = "reaction_milestone",
            ActorUserId = authorUserId,
            TargetId = thoughtId,
            TargetType = "thought",
            TargetTitle = thoughtTitle,
            ReactionCount = count,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task RecordStatusChange(string actorUserId, string statusText)
    {
        await db.FeedEvents.InsertOneAsync(new FeedEvent
        {
            Type = "status_change",
            ActorUserId = actorUserId,
            Excerpt = statusText,
            CreatedAt = DateTime.UtcNow
        });
    }
}
