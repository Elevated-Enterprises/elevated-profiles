using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IThoughtService
{
    Task<List<ThoughtListItemResponse>> GetGlobalThoughts(
        string? requestingUserId,
        List<string> followingIds,
        List<string> ignoringIds,
        string? tagFilter,
        bool followedFirst,
        string? cursor,
        int limit = 20);

    Task<List<ThoughtListItemResponse>> GetThoughtsByUser(
        string authorUserId,
        string? requestingUserId);

    Task<ThoughtResponse?> GetThought(string id, string? requestingUserId);
    Task<ThoughtResponse?> GetThoughtBySlug(string slug, string? requestingUserId);

    Task<(ThoughtResponse? thought, string? error)> CreateThought(
        string userId, ThoughtCreateRequest request);

    Task<ThoughtResponse?> UpdateThought(string id, string userId, ThoughtUpdateRequest request);
    Task<bool> DeleteThought(string id, string userId, bool isAdmin);
    Task<ThoughtResponse?> TogglePin(string id, string userId);
    Task<ThoughtResponse?> UpdateTags(string id, ThoughtTagsUpdateRequest request);
    Task<ThoughtResponse?> UpdateImage(string id, string userId, string? filename);
    Task<ThoughtRateLimitResponse> GetRateLimit(string userId);
    Task<bool> SetHidden(string id, bool hidden);
    Task<ThoughtInsightsResponse?> GetThoughtInsights(string id, string requestingUserId);
}
