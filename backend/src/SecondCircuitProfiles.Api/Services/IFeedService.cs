using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IFeedService
{
    Task<List<FeedItemResponse>> GetFeed(
        string? requestingUserId,
        List<string> followingIds,
        List<string> ignoringIds,
        string? cursor,
        int limit = 30);

    Task RecordNewThought(string actorUserId, string thoughtId, string thoughtTitle, string excerpt);
    Task RecordNewComment(string actorUserId, string thoughtId, string thoughtTitle, string excerpt);
    Task RecordReactionMilestone(string thoughtId, string thoughtTitle, string authorUserId, int count);
    Task RecordStatusChange(string actorUserId, string statusText);
}
