using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/users")]
[Produces("application/json")]
public class UsersController(
    IUserService userService,
    ICompanionService companionService,
    IImageService imageService,
    IAuditService auditService,
    ISkillService skillService,
    ILlmProviderService llmProviderService,
    ICommunityRoleService communityRoleService,
    IPartnerCommunityService partnerCommunityService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<PaginatedResponse<UserListItemResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int? seed,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        [FromQuery] string? search = null,
        [FromQuery] List<string>? skillIds = null,
        [FromQuery] string? llmProviderId = null,
        [FromQuery] ExperienceLevel? minExperienceLevel = null,
        [FromQuery] string? sort = "random",
        [FromQuery] bool? hasProfileImage = null,
        [FromQuery] string? communityRoleId = null,
        [FromQuery] bool? adminOnly = null,
        [FromQuery] bool? ambassadorOnly = null,
        [FromQuery] string? ambassadorCommunityId = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 50) pageSize = 50;

        var actualSeed = seed ?? Random.Shared.Next();
        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        var result = await userService.GetUsersPage(
            actualSeed, page, pageSize, search, isAuthenticated, isAdmin,
            skillIds, llmProviderId, minExperienceLevel, sort, hasProfileImage, communityRoleId, adminOnly,
            ambassadorOnly, ambassadorCommunityId);

        return Ok(result);
    }

    [HttpGet("{slug}")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(string slug)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isAdmin = User.FindFirstValue("is_admin") == "true";
        var currentSlug = User.FindFirstValue("slug");
        var isOwner = currentSlug == slug;

        if (!isAdmin && !isOwner)
        {
            if (user.IsBlocked || user.Visibility == Models.Visibility.Private)
                return NotFound();
            if (user.Visibility == Models.Visibility.MembersOnly && !isAuthenticated)
                return NotFound();
        }

        var companions = await companionService.GetByUserId(
            user.Id, isAuthenticated, isAdmin, isOwner);

        var response = await BuildUserResponse(user, isOwner, isAuthenticated, isAdmin, companions);
        return Ok(response);
    }

    [Authorize]
    [HttpPut("{slug}")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(string slug, [FromBody] UserUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var existingUser = await userService.GetBySlug(slug);
        if (existingUser is null) return NotFound();

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "UpdateUser",
                "User",
                slug,
                previousValues: new
                {
                    existingUser.Visibility,
                    existingUser.LocationVisibility,
                    existingUser.DateOfBirthVisibility,
                    existingUser.AlternativeName,
                    existingUser.DateOfBirth,
                    existingUser.Country,
                    existingUser.City,
                    existingUser.Bio,
                    existingUser.Alignment
                },
                newValues: request);
        }

        var updated = await userService.Update(slug, request);
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpPost("{slug}/image")]
    [ProducesResponseType<ImageUploadResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadProfileImage(string slug, IFormFile file)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        if (user.ProfileImageFilename is not null)
            imageService.DeleteImage(user.ProfileImageFilename);

        try
        {
            var filename = await imageService.SaveImage(file);
            await userService.UpdateProfileImage(slug, filename);

            if (isAdmin && currentSlug != slug)
            {
                await auditService.LogAction(
                    User.FindFirstValue("discord_id")!,
                    User.FindFirstValue("discord_username")!,
                    "UpdateUserImage",
                    "User",
                    slug);
            }

            return Ok(new ImageUploadResponse { ProfileImageUrl = filename });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ErrorResponse { Error = ex.Message });
        }
    }

    [Authorize]
    [HttpDelete("{slug}/image")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProfileImage(string slug)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        if (user.ProfileImageFilename is not null)
            imageService.DeleteImage(user.ProfileImageFilename);

        await userService.UpdateProfileImage(slug, null);

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "DeleteUserImage",
                "User",
                slug);
        }

        return NoContent();
    }

    [Authorize]
    [HttpPost("{slug}/banner")]
    [ProducesResponseType<ImageUploadResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadBannerImage(string slug, IFormFile file)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        if (user.BannerImageFilename is not null)
            imageService.DeleteImage(user.BannerImageFilename);

        try
        {
            var filename = await imageService.SaveImage(file);
            await userService.UpdateBannerImage(slug, filename);

            if (isAdmin && currentSlug != slug)
            {
                await auditService.LogAction(
                    User.FindFirstValue("discord_id")!,
                    User.FindFirstValue("discord_username")!,
                    "UpdateUserBanner",
                    "User",
                    slug);
            }

            return Ok(new ImageUploadResponse { ProfileImageUrl = filename });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ErrorResponse { Error = ex.Message });
        }
    }

    [Authorize]
    [HttpDelete("{slug}/banner")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteBannerImage(string slug)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        if (user.BannerImageFilename is not null)
            imageService.DeleteImage(user.BannerImageFilename);

        await userService.UpdateBannerImage(slug, null);

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "DeleteUserBanner",
                "User",
                slug);
        }

        return NoContent();
    }

    [Authorize]
    [HttpPut("{slug}/skills")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSkills(string slug, [FromBody] UserSkillsUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var existingUser = await userService.GetBySlug(slug);
        if (existingUser is null) return NotFound();

        // Validate that all provided skill IDs exist
        if (request.SkillIds.Count > 0)
        {
            var validSkills = await skillService.GetByIds(request.SkillIds);
            if (validSkills.Count != request.SkillIds.Distinct().Count())
                return BadRequest(new ErrorResponse { Error = "One or more skill IDs are invalid." });
        }

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "UpdateUserSkills",
                "User",
                slug,
                previousValues: new { existingUser.SkillIds },
                newValues: new { request.SkillIds });
        }

        var updated = await userService.UpdateSkills(slug, request.SkillIds.Distinct().ToList());
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpPut("{slug}/languages")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLanguages(string slug, [FromBody] UserLanguagesUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var existingUser = await userService.GetBySlug(slug);
        if (existingUser is null) return NotFound();

        // Deduplicate and sanitize
        var languages = request.Languages
            .Select(l => l.Trim())
            .Where(l => !string.IsNullOrEmpty(l))
            .Distinct()
            .ToList();

        var updated = await userService.UpdateLanguages(slug, languages);
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpPut("{slug}/llm-experiences")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLlmExperiences(string slug, [FromBody] UserLlmExperiencesUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var existingUser = await userService.GetBySlug(slug);
        if (existingUser is null) return NotFound();

        // Validate that all provided LLM provider IDs exist
        var providerIds = request.Experiences.Select(e => e.LlmProviderId).Distinct().ToList();
        if (providerIds.Count > 0)
        {
            var validProviders = await llmProviderService.GetByIds(providerIds);
            if (validProviders.Count != providerIds.Count)
                return BadRequest(new ErrorResponse { Error = "One or more LLM provider IDs are invalid." });
        }

        // Deduplicate by provider (last entry wins if duplicates)
        var experiences = request.Experiences
            .GroupBy(e => e.LlmProviderId)
            .Select(g => g.Last())
            .Select(e => new LlmExperience
            {
                LlmProviderId = e.LlmProviderId,
                ExperienceLevel = e.ExperienceLevel
            })
            .ToList();

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "UpdateUserLlmExperiences",
                "User",
                slug,
                previousValues: new { existingUser.LlmExperiences },
                newValues: new { experiences });
        }

        var updated = await userService.UpdateLlmExperiences(slug, experiences);
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpPut("{slug}/links")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLinks(string slug, [FromBody] UserLinksUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var existingUser = await userService.GetBySlug(slug);
        if (existingUser is null) return NotFound();

        if (request.Links.Count > 20)
            return BadRequest(new ErrorResponse { Error = "Maximum 20 links allowed." });

        var links = request.Links.Select(l => new Models.UserLink
        {
            Label = l.Label.Trim(),
            Url = l.Url.Trim()
        }).ToList();

        var updated = await userService.UpdateLinks(slug, links);
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpGet("{slug}/settings")]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings(string slug)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var settings = await userService.GetSettings(slug);
        return Ok(settings);
    }

    [Authorize]
    [HttpPatch("{slug}/settings")]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PatchSettings(string slug, [FromBody] UserSettingsUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        // Settings are personal — owner only (admins cannot edit user settings)
        if (currentSlug != slug)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var settings = await userService.PatchSettings(slug, request.Settings);
        return Ok(settings);
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPut("{slug}/community-roles")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCommunityRoles(string slug, [FromBody] UserCommunityRolesUpdateRequest request)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var roleIds = request.RoleIds.Distinct().ToList();
        var updated = await userService.UpdateCommunityRoles(slug, roleIds);
        if (updated is null) return NotFound();

        var isAdmin = User.FindFirstValue("is_admin") == "true";
        var currentSlug = User.FindFirstValue("slug");
        return Ok(await BuildUserResponse(updated, isOwner: currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    [Authorize]
    [HttpPut("{slug}/primary-companion")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryCompanion(string slug, [FromBody] SetPrimaryCompanionRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        if (currentSlug != slug) return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        await userService.SetPrimaryCompanion(slug, request.CompanionId);
        return NoContent();
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPut("{slug}/ambassador-community")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetAmbassadorCommunity(string slug, [FromBody] SetAmbassadorCommunityRequest request)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        // Validate communityId if provided
        if (request.CommunityId is not null)
        {
            var community = await partnerCommunityService.GetById(request.CommunityId);
            if (community is null)
                return BadRequest(new ErrorResponse { Error = "Partner community not found." });
        }

        var isAdmin = User.FindFirstValue("is_admin") == "true";
        var currentSlug = User.FindFirstValue("slug");

        await auditService.LogAction(
            User.FindFirstValue("discord_id")!,
            User.FindFirstValue("discord_username")!,
            "SetAmbassadorCommunity",
            "User",
            slug,
            previousValues: new { user.AmbassadorCommunityId },
            newValues: new { communityId = request.CommunityId });

        var updated = await userService.SetAmbassadorCommunity(slug, request.CommunityId);
        if (updated is null) return NotFound();

        return Ok(await BuildUserResponse(updated, isOwner: currentSlug == slug, isAuthenticated: true, isAdmin));
    }

    private async Task<UserResponse> BuildUserResponse(
        Models.User user, bool isOwner, bool isAuthenticated = true, bool isAdmin = false,
        IEnumerable<Models.Companion>? companions = null)
    {
        var skills = await skillService.GetByIds(user.SkillIds);
        var skillMap = skills.ToDictionary(s => s.Id);

        var communityRoles = await communityRoleService.GetByIds(user.CommunityRoleIds);
        var communityRoleMap = communityRoles.ToDictionary(r => r.Id);

        PartnerCommunityResponse? ambassadorCommunity = null;
        if (user.AmbassadorCommunityId is not null)
        {
            var pc = await partnerCommunityService.GetById(user.AmbassadorCommunityId);
            if (pc is not null)
                ambassadorCommunity = new PartnerCommunityResponse
                {
                    Id = pc.Id,
                    Name = pc.Name,
                    DiscordInviteUrl = pc.DiscordInviteUrl,
                    CreatedAt = pc.CreatedAt
                };
        }

        var llmProviderIds = user.LlmExperiences.Select(e => e.LlmProviderId).ToList();
        var llmProviders = await llmProviderService.GetByIds(llmProviderIds);
        var llmProviderMap = llmProviders.ToDictionary(p => p.Id);

        // Apply field-level visibility for location and date of birth
        var canSeeLocation = isOwner || isAdmin
            || user.LocationVisibility == Visibility.Public
            || (isAuthenticated && user.LocationVisibility == Visibility.MembersOnly);

        var canSeeDateOfBirth = isOwner || isAdmin
            || user.DateOfBirthVisibility == Visibility.Public
            || (isAuthenticated && user.DateOfBirthVisibility == Visibility.MembersOnly);

        // JoinedAt falls back to 2026-02-20 if not set (migration fallback)
        var joinedAt = user.JoinedAt ?? new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc);

        return new UserResponse
        {
            Slug = user.Slug,
            UserId = user.Id,
            DiscordUsername = user.DiscordUsername,
            Visibility = user.Visibility,
            LocationVisibility = user.LocationVisibility,
            DateOfBirthVisibility = user.DateOfBirthVisibility,
            ProfileImageUrl = user.ProfileImageFilename,
            BannerImageUrl = user.BannerImageFilename,
            TimezoneOffsetMinutes = canSeeLocation ? user.TimezoneOffsetMinutes : null,
            Languages = user.Languages,
            AlternativeName = user.AlternativeName,
            DateOfBirth = canSeeDateOfBirth ? user.DateOfBirth : null,
            Country = canSeeLocation ? user.Country : null,
            City = canSeeLocation ? user.City : null,
            Bio = user.Bio,
            Alignment = user.Alignment,
            IsOwnProfile = isOwner,
            IsAdmin = user.IsAdmin,
            Skills = user.SkillIds
                .Where(id => skillMap.ContainsKey(id))
                .Select(id => new SkillResponse
                {
                    Id = skillMap[id].Id,
                    Name = skillMap[id].Name,
                    CreatedAt = skillMap[id].CreatedAt
                }).ToList(),
            LlmExperiences = user.LlmExperiences
                .Where(e => llmProviderMap.ContainsKey(e.LlmProviderId))
                .Select(e => new LlmExperienceResponse
                {
                    LlmProviderId = e.LlmProviderId,
                    LlmProviderName = llmProviderMap[e.LlmProviderId].Name,
                    ExperienceLevel = e.ExperienceLevel
                }).ToList(),
            Links = user.Links.Select(l => new UserLinkResponse
            {
                Id = l.Id,
                Label = l.Label,
                Url = l.Url
            }).ToList(),
            PrimaryCompanionId = user.PrimaryCompanionId,
            IsBlocked = user.IsBlocked,
            CommunityRoles = user.CommunityRoleIds
                .Where(id => communityRoleMap.ContainsKey(id))
                .Select(id => new CommunityRoleResponse
                {
                    Id = communityRoleMap[id].Id,
                    Name = communityRoleMap[id].Name,
                    CreatedAt = communityRoleMap[id].CreatedAt
                }).ToList(),
            AmbassadorCommunity = ambassadorCommunity,
            Companions = companions?.Select(c => new CompanionResponse
            {
                Id = c.Id,
                Visibility = c.Visibility,
                ProfileImageUrl = c.ProfileImageFilename,
                Name = c.Name,
                Platform = c.Platform,
                Role = c.Role,
                DateOfBirth = c.DateOfBirth,
                Bio = c.Bio,
                Alignment = c.Alignment,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList() ?? [],
            JoinedAt = joinedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
