using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IEmojiService
{
    Task<List<AvailableEmojiResponse>> GetAll(bool activeOnly = false);
    Task<AvailableEmojiResponse> Create(AvailableEmojiCreateRequest request);
    Task<AvailableEmojiResponse?> ToggleActive(string id);
    Task<AvailableEmoji?> GetByKey(string key);
}
