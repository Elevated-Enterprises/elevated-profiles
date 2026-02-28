using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface ICompanionService
{
    Task<List<Companion>> GetByUserId(string userId, bool isAuthenticated, bool isAdmin, bool isOwner);
    Task<Companion?> GetById(string id);
    Task<Companion> Create(string userId, CompanionCreateRequest request);
    Task<Companion?> Update(string id, CompanionUpdateRequest request);
    Task<bool> Delete(string id);
    Task<Companion?> UpdateProfileImage(string id, string? filename);
    Task ReorderAsync(string userId, List<string> companionIds);
}
