using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IStatusService
{
    Task<StatusUpdateResponse> SetStatus(string userId, string text);
    Task<StatusUpdateResponse?> GetLatestStatus(string userId);
    Task<Dictionary<string, string>> GetLatestStatuses(List<string> userIds);
}
