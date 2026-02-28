using System.Security.Cryptography;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class ThoughtService(
    MongoDbContext db,
    IThoughtSettingsService settingsService,
    IReactionService reactionService,
    ICommentService commentService,
    IFeedService feedService) : IThoughtService
{
    public async Task<List<ThoughtListItemResponse>> GetGlobalThoughts(
        string? requestingUserId,
        List<string> followingIds,
        List<string> ignoringIds,
        string? tagFilter,
        bool followedFirst,
        string? cursor,
        int limit = 20)
    {
        var filterBuilder = Builders<Thought>.Filter;
        var filter = filterBuilder.Eq(t => t.IsDeleted, false)
            & filterBuilder.Eq(t => t.IsHidden, false)
            & filterBuilder.Nin(t => t.AuthorUserId, ignoringIds);

        if (!string.IsNullOrWhiteSpace(tagFilter))
            filter &= filterBuilder.AnyEq(t => t.Tags, tagFilter);

        if (cursor != null && DateTime.TryParse(cursor, out var cursorDate))
            filter &= filterBuilder.Lt(t => t.CreatedAt, cursorDate);

        var thoughts = await db.Thoughts.Find(filter)
            .SortByDescending(t => t.CreatedAt)
            .Limit(limit * 2) // fetch extra for followed-first sorting
            .ToListAsync();

        if (followedFirst && followingIds.Count > 0)
        {
            var followed = thoughts.Where(t => followingIds.Contains(t.AuthorUserId))
                .OrderByDescending(t => t.CreatedAt).ToList();
            var others = thoughts.Where(t => !followingIds.Contains(t.AuthorUserId))
                .OrderByDescending(t => t.CreatedAt).ToList();
            thoughts = followed.Concat(others).Take(limit).ToList();
        }
        else
        {
            thoughts = thoughts.Take(limit).ToList();
        }

        return await MapToListItems(thoughts, followingIds, requestingUserId);
    }

    public async Task<List<ThoughtListItemResponse>> GetThoughtsByUser(
        string authorUserId, string? requestingUserId)
    {
        var thoughts = await db.Thoughts
            .Find(t => t.AuthorUserId == authorUserId && !t.IsDeleted && !t.IsHidden)
            .SortByDescending(t => t.IsPinned)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        return await MapToListItems(thoughts, [], requestingUserId);
    }

    public async Task<ThoughtResponse?> GetThoughtBySlug(string slug, string? requestingUserId)
    {
        var thought = await db.Thoughts.Find(t => t.Slug == slug && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null) return null;
        return await GetThought(thought.Id, requestingUserId);
    }

    public async Task<ThoughtResponse?> GetThought(string id, string? requestingUserId)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null) return null;

        var author = await db.Users.Find(u => u.Id == thought.AuthorUserId).FirstOrDefaultAsync();
        var comments = await commentService.GetComments(id, requestingUserId);
        var reactions = await reactionService.GetReactions(id, "thought", requestingUserId);

        return new ThoughtResponse
        {
            Id = thought.Id,
            Slug = thought.Slug ?? thought.Id,
            AuthorSlug = author?.Slug ?? "",
            AuthorUserId = thought.AuthorUserId,
            AuthorUsername = author?.AlternativeName ?? author?.DiscordUsername ?? "Unknown",
            AuthorAvatarUrl = author?.ProfileImageFilename,
            Title = thought.Title,
            Body = thought.Body,
            ImageUrl = thought.ImageFilename,
            Tags = thought.Tags,
            IsPinned = thought.IsPinned,
            IsHidden = thought.IsHidden,
            IsOwnThought = requestingUserId != null && thought.AuthorUserId == requestingUserId,
            Comments = comments,
            Reactions = reactions,
            CreatedAt = thought.CreatedAt,
            UpdatedAt = thought.UpdatedAt
        };
    }

    public async Task<(ThoughtResponse? thought, string? error)> CreateThought(
        string userId, ThoughtCreateRequest request)
    {
        var (maxPerWindow, windowHours, minThoughtLength, _) =
            await settingsService.GetEffectiveSettings(userId);

        if (request.Body.Trim().Length < minThoughtLength)
            return (null, $"Thought body must be at least {minThoughtLength} characters.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return (null, "Title is required.");

        // Rate limit check
        var windowStart = DateTime.UtcNow.AddHours(-windowHours);
        var recentCount = (int)await db.Thoughts.CountDocumentsAsync(
            t => t.AuthorUserId == userId && t.CreatedAt >= windowStart && !t.IsDeleted);

        if (recentCount >= maxPerWindow)
            return (null, $"Rate limit reached. You can post {maxPerWindow} thoughts per {windowHours} hours.");

        var thought = new Thought
        {
            AuthorUserId = userId,
            Slug = await GenerateUniqueSlug(),
            Title = request.Title.Trim(),
            Body = request.Body.Trim(),
            Tags = request.Tags ?? [],
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await db.Thoughts.InsertOneAsync(thought);

        var excerpt = thought.Body.Length > 200 ? thought.Body[..200] : thought.Body;
        await feedService.RecordNewThought(userId, thought.Id, thought.Title, excerpt);

        return (await GetThought(thought.Id, userId), null);
    }

    public async Task<ThoughtResponse?> UpdateThought(string id, string userId, ThoughtUpdateRequest request)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null || thought.AuthorUserId != userId) return null;

        var update = Builders<Thought>.Update.Set(t => t.UpdatedAt, DateTime.UtcNow);

        if (request.Title != null)
            update = update.Set(t => t.Title, request.Title.Trim());
        if (request.Body != null)
            update = update.Set(t => t.Body, request.Body.Trim());
        if (request.ClearImage)
            update = update.Set(t => t.ImageFilename, (string?)null);

        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return await GetThought(id, userId);
    }

    public async Task<bool> DeleteThought(string id, string userId, bool isAdmin)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null) return false;
        if (!isAdmin && thought.AuthorUserId != userId) return false;

        var update = Builders<Thought>.Update.Set(t => t.IsDeleted, true);
        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return true;
    }

    public async Task<ThoughtResponse?> TogglePin(string id, string userId)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null || thought.AuthorUserId != userId) return null;

        var update = Builders<Thought>.Update
            .Set(t => t.IsPinned, !thought.IsPinned)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return await GetThought(id, userId);
    }

    public async Task<ThoughtResponse?> UpdateTags(string id, ThoughtTagsUpdateRequest request)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null) return null;

        var update = Builders<Thought>.Update
            .Set(t => t.Tags, request.Tags)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return await GetThought(id, null);
    }

    public async Task<ThoughtResponse?> UpdateImage(string id, string userId, string? filename)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null || thought.AuthorUserId != userId) return null;

        var update = Builders<Thought>.Update
            .Set(t => t.ImageFilename, filename)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return await GetThought(id, userId);
    }

    public async Task<ThoughtRateLimitResponse> GetRateLimit(string userId)
    {
        var (maxPerWindow, windowHours, _, _) = await settingsService.GetEffectiveSettings(userId);
        var windowStart = DateTime.UtcNow.AddHours(-windowHours);
        var used = (int)await db.Thoughts.CountDocumentsAsync(
            t => t.AuthorUserId == userId && t.CreatedAt >= windowStart && !t.IsDeleted);

        return new ThoughtRateLimitResponse
        {
            MaxPerWindow = maxPerWindow,
            WindowHours = windowHours,
            UsedInWindow = used,
            RemainingInWindow = Math.Max(0, maxPerWindow - used)
        };
    }

    public async Task<bool> SetHidden(string id, bool hidden)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null) return false;

        var update = Builders<Thought>.Update.Set(t => t.IsHidden, hidden);
        await db.Thoughts.UpdateOneAsync(t => t.Id == id, update);
        return true;
    }

    private async Task<string> GenerateUniqueSlug()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        while (true)
        {
            var slug = RandomNumberGenerator.GetString(chars, 8);
            var existing = await db.Thoughts.Find(t => t.Slug == slug).FirstOrDefaultAsync();
            if (existing is null) return slug;
        }
    }

    private async Task<List<ThoughtListItemResponse>> MapToListItems(
        List<Thought> thoughts,
        List<string> followingIds,
        string? requestingUserId)
    {
        if (thoughts.Count == 0) return [];

        var authorIds = thoughts.Select(t => t.AuthorUserId).Distinct().ToList();
        var authors = await db.Users.Find(u => authorIds.Contains(u.Id)).ToListAsync();
        var authorMap = authors.ToDictionary(u => u.Id);

        var thoughtIds = thoughts.Select(t => t.Id).ToList();
        var reactionMap = await reactionService.GetReactionsBulk(thoughtIds, "thought", requestingUserId);

        // Comment counts
        var commentCounts = new Dictionary<string, int>();
        foreach (var tId in thoughtIds)
        {
            commentCounts[tId] = (int)await db.Comments.CountDocumentsAsync(
                c => c.ThoughtId == tId && !c.IsDeleted);
        }

        return thoughts.Select(t =>
        {
            authorMap.TryGetValue(t.AuthorUserId, out var author);
            reactionMap.TryGetValue(t.Id, out var reactions);
            var excerpt = t.Body.Length > 200 ? t.Body[..200] + "..." : t.Body;

            return new ThoughtListItemResponse
            {
                Id = t.Id,
                Slug = t.Slug ?? t.Id,
                AuthorSlug = author?.Slug ?? "",
                AuthorUsername = author?.AlternativeName ?? author?.DiscordUsername ?? "Unknown",
                AuthorAvatarUrl = author?.ProfileImageFilename,
                Title = t.Title,
                Excerpt = excerpt,
                Tags = t.Tags,
                IsPinned = t.IsPinned,
                IsFromFollowed = followingIds.Contains(t.AuthorUserId),
                TopReactions = (reactions ?? []).Take(3).ToList(),
                CommentCount = commentCounts.GetValueOrDefault(t.Id, 0),
                CreatedAt = t.CreatedAt
            };
        }).ToList();
    }
}
