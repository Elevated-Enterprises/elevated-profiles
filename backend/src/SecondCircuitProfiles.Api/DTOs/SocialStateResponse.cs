namespace SecondCircuitProfiles.Api.DTOs;

public class SocialStateResponse
{
    public List<string> FollowingUserIds { get; set; } = [];
    public List<string> IgnoringUserIds { get; set; } = [];
    public List<string> BlockedUserIds { get; set; } = [];
}
