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

        // Track read for authenticated users and fetch read stats
        int readCount = thought.ReadCount;
        int uniqueReaderCount;

        if (requestingUserId != null && requestingUserId != thought.AuthorUserId)
        {
            // Atomically increment the read counter and get updated value
            var updated = await db.Thoughts.FindOneAndUpdateAsync(
                t => t.Id == id && !t.IsDeleted,
                Builders<Thought>.Update.Inc(t => t.ReadCount, 1),
                new MongoDB.Driver.FindOneAndUpdateOptions<Thought>
                {
                    ReturnDocument = MongoDB.Driver.ReturnDocument.After
                });
            readCount = updated?.ReadCount ?? readCount;

            // Record unique reader (ignore duplicate key on unique index)
            try
            {
                await db.ThoughtReads.InsertOneAsync(new Models.ThoughtRead
                {
                    ThoughtId = id,
                    UserId = requestingUserId,
                    ReadAt = DateTime.UtcNow
                });
            }
            catch (MongoDB.Driver.MongoWriteException) { }
        }

        uniqueReaderCount = (int)await db.ThoughtReads.CountDocumentsAsync(
            r => r.ThoughtId == id);

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
            ReadCount = readCount,
            UniqueReaderCount = uniqueReaderCount,
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

    public async Task<ThoughtInsightsResponse?> GetThoughtInsights(string id, string requestingUserId)
    {
        var thought = await db.Thoughts.Find(t => t.Id == id && !t.IsDeleted).FirstOrDefaultAsync();
        if (thought == null || thought.AuthorUserId != requestingUserId) return null;

        // Readers
        var reads = await db.ThoughtReads.Find(r => r.ThoughtId == id).ToListAsync();
        var readerUserIds = reads.Select(r => r.UserId).Distinct().ToList();
        var readerUsers = await db.Users.Find(u => readerUserIds.Contains(u.Id)).ToListAsync();
        var readerMap = readerUsers.ToDictionary(u => u.Id);

        // For each user take only their most recent read
        var readerEntries = reads
            .GroupBy(r => r.UserId)
            .Select(g =>
            {
                var latest = g.OrderByDescending(r => r.ReadAt).First();
                readerMap.TryGetValue(latest.UserId, out var user);
                return new ThoughtReaderEntry
                {
                    Slug = user?.Slug ?? "",
                    Username = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
                    AvatarUrl = user?.ProfileImageFilename,
                    ReadAt = latest.ReadAt
                };
            })
            .OrderByDescending(r => r.ReadAt)
            .ToList();

        // Reactions with reactors
        var reactions = await db.Reactions
            .Find(r => r.TargetId == id && r.TargetType == "thought")
            .ToListAsync();

        var reactorUserIds = reactions.Select(r => r.UserId).Distinct().ToList();
        var reactorUsers = await db.Users.Find(u => reactorUserIds.Contains(u.Id)).ToListAsync();
        var reactorMap = reactorUsers.ToDictionary(u => u.Id);

        var emojiKeys = reactions.Select(r => r.EmojiKey).Distinct().ToList();
        var emojis = await db.AvailableEmojis.Find(e => emojiKeys.Contains(e.Key)).ToListAsync();
        var emojiDefs = emojis.ToDictionary(e => e.Key);

        var reactionGroups = reactions
            .GroupBy(r => r.EmojiKey)
            .Select(g =>
            {
                emojiDefs.TryGetValue(g.Key, out var emoji);
                return new ReactionGroupWithReactors
                {
                    EmojiKey = g.Key,
                    Emoji = emoji?.Emoji ?? g.Key,
                    Label = emoji?.Label ?? g.Key,
                    Reactors = g.Select(r =>
                    {
                        reactorMap.TryGetValue(r.UserId, out var user);
                        return new ReactionReactorEntry
                        {
                            Slug = user?.Slug ?? "",
                            Username = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
                            AvatarUrl = user?.ProfileImageFilename
                        };
                    }).ToList()
                };
            })
            .OrderByDescending(g => g.Reactors.Count)
            .ToList();

        return new ThoughtInsightsResponse
        {
            Readers = readerEntries,
            ReactionGroups = reactionGroups
        };
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
