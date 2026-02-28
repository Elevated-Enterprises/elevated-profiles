using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface ISocialService
{
    Task Follow(string fromUserId, string toUserId);
    Task Unfollow(string fromUserId, string toUserId);
    Task Ignore(string fromUserId, string toUserId);
    Task RemoveIgnore(string fromUserId, string toUserId);
    Task<SocialStateResponse> GetSocialState(string userId);
    Task<List<string>> GetFollowingIds(string userId);
    Task<List<string>> GetIgnoringIds(string userId);
    Task Block(string fromUserId, string toUserId);
    Task Unblock(string fromUserId, string toUserId);
    Task<bool> IsBlockedBy(string contentOwnerUserId, string visitorUserId);
}
