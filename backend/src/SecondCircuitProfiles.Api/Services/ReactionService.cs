using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class ReactionService(MongoDbContext db, IEmojiService emojiService, IFeedService feedService, ISocialService socialService) : IReactionService
{
    private static readonly int[] Milestones = [5, 10, 25, 50, 100];

    public async Task<bool> AddReaction(string targetId, string targetType, string userId, string emojiKey)
    {
        var emoji = await emojiService.GetByKey(emojiKey);
        if (emoji == null || !emoji.IsActive) return false;

        // Block check: look up content owner and verify they haven't blocked the reactor
        string? contentOwnerUserId = null;
        if (targetType == "thought")
        {
            var thought = await db.Thoughts.Find(t => t.Id == targetId).FirstOrDefaultAsync();
            contentOwnerUserId = thought?.AuthorUserId;
        }
        else if (targetType == "comment")
        {
            var comment = await db.Comments.Find(c => c.Id == targetId).FirstOrDefaultAsync();
            if (comment != null)
            {
                var thought = await db.Thoughts.Find(t => t.Id == comment.ThoughtId).FirstOrDefaultAsync();
                contentOwnerUserId = thought?.AuthorUserId;
            }
        }

        if (contentOwnerUserId != null && await socialService.IsBlockedBy(contentOwnerUserId, userId))
            return false;

        var exists = await db.Reactions.Find(
            r => r.TargetId == targetId && r.TargetType == targetType &&
                 r.UserId == userId && r.EmojiKey == emojiKey)
            .AnyAsync();

        if (exists) return false;

        await db.Reactions.InsertOneAsync(new Reaction
        {
            TargetId = targetId,
            TargetType = targetType,
            UserId = userId,
            EmojiKey = emojiKey,
            CreatedAt = DateTime.UtcNow
        });

        if (targetType == "thought")
        {
            var totalCount = (int)await db.Reactions.CountDocumentsAsync(
                r => r.TargetId == targetId && r.TargetType == "thought");

            if (Milestones.Contains(totalCount))
            {
                var thought = await db.Thoughts.Find(t => t.Id == targetId).FirstOrDefaultAsync();
                if (thought != null)
                    await feedService.RecordReactionMilestone(targetId, thought.Title, thought.AuthorUserId, totalCount);
            }
        }

        return true;
    }

    public async Task<bool> RemoveReaction(string targetId, string targetType, string userId, string emojiKey)
    {
        var result = await db.Reactions.DeleteOneAsync(
            r => r.TargetId == targetId && r.TargetType == targetType &&
                 r.UserId == userId && r.EmojiKey == emojiKey);
        return result.DeletedCount > 0;
    }

    public async Task<List<ReactionGroupResponse>> GetReactions(string targetId, string targetType, string? requestingUserId)
    {
        var reactions = await db.Reactions
            .Find(r => r.TargetId == targetId && r.TargetType == targetType)
            .ToListAsync();

        return await BuildGroups(reactions, requestingUserId);
    }

    public async Task<Dictionary<string, List<ReactionGroupResponse>>> GetReactionsBulk(
        List<string> targetIds, string targetType, string? requestingUserId)
    {
        if (targetIds.Count == 0) return new Dictionary<string, List<ReactionGroupResponse>>();

        var allReactions = await db.Reactions
            .Find(r => targetIds.Contains(r.TargetId) && r.TargetType == targetType)
            .ToListAsync();

        var grouped = allReactions.GroupBy(r => r.TargetId);
        var result = new Dictionary<string, List<ReactionGroupResponse>>();

        foreach (var group in grouped)
            result[group.Key] = await BuildGroups(group.ToList(), requestingUserId);

        return result;
    }

    public async Task<int> GetTotalReactionCount(string targetId, string targetType)
    {
        return (int)await db.Reactions.CountDocumentsAsync(
            r => r.TargetId == targetId && r.TargetType == targetType);
    }

    private async Task<List<ReactionGroupResponse>> BuildGroups(List<Reaction> reactions, string? requestingUserId)
    {
        var emojiKeys = reactions.Select(r => r.EmojiKey).Distinct().ToList();
        var allEmojis = await db.AvailableEmojis
            .Find(e => emojiKeys.Contains(e.Key))
            .ToListAsync();
        var emojiMap = allEmojis.ToDictionary(e => e.Key);

        return reactions
            .GroupBy(r => r.EmojiKey)
            .Select(g =>
            {
                emojiMap.TryGetValue(g.Key, out var emojiDef);
                return new ReactionGroupResponse
                {
                    EmojiKey = g.Key,
                    Emoji = emojiDef?.Emoji ?? g.Key,
                    Label = emojiDef?.Label ?? g.Key,
                    Count = g.Count(),
                    UserHasReacted = requestingUserId != null && g.Any(r => r.UserId == requestingUserId)
                };
            })
            .OrderByDescending(r => r.Count)
            .ToList();
    }
}
