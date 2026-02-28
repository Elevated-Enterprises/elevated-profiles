using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IUserService
{
    Task<User?> GetBySlug(string slug);
    Task<User?> GetByDiscordId(string discordId);
    Task<User> FindOrCreate(string discordId, string discordUsername, bool isAdmin);
    Task<User?> Update(string slug, UserUpdateRequest request);
    Task<User?> UpdateProfileImage(string slug, string? filename);
    Task<User?> UpdateBannerImage(string slug, string? filename);
    Task<User?> UpdateLanguages(string slug, List<string> languages);
    Task<User?> UpdateSkills(string slug, List<string> skillIds);
    Task<User?> UpdateLlmExperiences(string slug, List<LlmExperience> experiences);
    Task<Dictionary<string, string>> GetSettings(string slug);
    Task<Dictionary<string, string>> PatchSettings(string slug, Dictionary<string, string?> patch);
    Task<User?> UpdateLinks(string slug, List<UserLink> links);
    Task<User?> SetPrimaryCompanion(string slug, string? companionId);
    Task<User?> UpdateCommunityRoles(string slug, List<string> roleIds);
    Task<User?> SetAmbassadorCommunity(string slug, string? communityId);
    Task<User?> SetBlocked(string slug, bool blocked);
    Task<PaginatedResponse<UserListItemResponse>> GetUsersPage(
        int seed, int page, int pageSize, string? search,
        bool isAuthenticated, bool isAdmin,
        List<string>? skillIds = null,
        string? llmProviderId = null,
        ExperienceLevel? minExperienceLevel = null,
        string? sort = "random",
        bool? hasProfileImage = null,
        string? communityRoleId = null,
        bool? adminOnly = null,
        bool? ambassadorOnly = null,
        string? ambassadorCommunityId = null);
}
