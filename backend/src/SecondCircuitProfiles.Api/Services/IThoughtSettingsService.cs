using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IThoughtSettingsService
{
    Task<ThoughtSettingsResponse> GetSettings();
    Task<ThoughtSettingsResponse> UpdateSettings(ThoughtSettingsUpdateRequest request);
    Task<ThoughtSettingsResponse> SetUserOverride(string userId, ThoughtUserOverrideRequest request);
    Task<(int maxPerWindow, int windowHours, int minThoughtLength, int minCommentLength)> GetEffectiveSettings(string userId);
}
