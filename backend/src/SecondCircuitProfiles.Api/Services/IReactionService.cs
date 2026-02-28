using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IReactionService
{
    Task<bool> AddReaction(string targetId, string targetType, string userId, string emojiKey);
    Task<bool> RemoveReaction(string targetId, string targetType, string userId, string emojiKey);
    Task<List<ReactionGroupResponse>> GetReactions(string targetId, string targetType, string? requestingUserId);
    Task<Dictionary<string, List<ReactionGroupResponse>>> GetReactionsBulk(List<string> targetIds, string targetType, string? requestingUserId);
    Task<int> GetTotalReactionCount(string targetId, string targetType);
}
