using System.Security.Cryptography;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class UserService(
    MongoDbContext db,
    ILogger<UserService> logger,
    IStatusService statusService) : IUserService
{
    public async Task<User?> GetBySlug(string slug)
    {
        return await db.Users.Find(u => u.Slug == slug).FirstOrDefaultAsync();
    }

    public async Task<User?> GetByDiscordId(string discordId)
    {
        return await db.Users.Find(u => u.DiscordId == discordId).FirstOrDefaultAsync();
    }

    public async Task<User> FindOrCreate(string discordId, string discordUsername, bool isAdmin)
    {
        var existing = await GetByDiscordId(discordId);
        if (existing is not null)
        {
            // Update Discord username and admin status on each login
            var update = Builders<User>.Update
                .Set(u => u.DiscordUsername, discordUsername)
                .Set(u => u.IsAdmin, isAdmin)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await db.Users.UpdateOneAsync(u => u.Id == existing.Id, update);

            existing.DiscordUsername = discordUsername;
            existing.IsAdmin = isAdmin;
            return existing;
        }

        var slug = await GenerateUniqueSlug();
        var now = DateTime.UtcNow;
        var user = new User
        {
            DiscordId = discordId,
            DiscordUsername = discordUsername,
            Slug = slug,
            IsAdmin = isAdmin,
            Visibility = Visibility.Private,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        await db.Users.InsertOneAsync(user);
        logger.LogInformation("Created new user {Slug} for Discord user {DiscordId}", slug, discordId);
        return user;
    }

    public async Task<User?> Update(string slug, UserUpdateRequest request)
    {
        var updateDefs = new List<UpdateDefinition<User>>();

        if (request.Visibility.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.Visibility, request.Visibility.Value));
        if (request.LocationVisibility.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.LocationVisibility, request.LocationVisibility.Value));
        if (request.DateOfBirthVisibility.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.DateOfBirthVisibility, request.DateOfBirthVisibility.Value));
        if (request.AlternativeName is not null)
            updateDefs.Add(Builders<User>.Update.Set(u => u.AlternativeName, request.AlternativeName));
        if (request.DateOfBirth.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.DateOfBirth, request.DateOfBirth.Value));
        if (request.Country is not null)
            updateDefs.Add(Builders<User>.Update.Set(u => u.Country, request.Country));
        if (request.City is not null)
            updateDefs.Add(Builders<User>.Update.Set(u => u.City, request.City));
        if (request.Bio is not null)
            updateDefs.Add(Builders<User>.Update.Set(u => u.Bio, request.Bio));
        if (request.ClearAlignment)
            updateDefs.Add(Builders<User>.Update.Set(u => u.Alignment, (Alignment?)null));
        else if (request.Alignment.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.Alignment, request.Alignment.Value));
        if (request.ClearTimezone)
            updateDefs.Add(Builders<User>.Update.Set(u => u.TimezoneOffsetMinutes, (int?)null));
        else if (request.TimezoneOffsetMinutes.HasValue)
            updateDefs.Add(Builders<User>.Update.Set(u => u.TimezoneOffsetMinutes, request.TimezoneOffsetMinutes.Value));

        if (updateDefs.Count == 0) return await GetBySlug(slug);

        var now = DateTime.UtcNow;
        updateDefs.Add(Builders<User>.Update.Set(u => u.UpdatedAt, now));
        updateDefs.Add(Builders<User>.Update.Set(u => u.ProfileUpdatedAt, now));

        var update = Builders<User>.Update.Combine(updateDefs);
        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);

        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateProfileImage(string slug, string? filename)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.ProfileImageFilename, filename)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateLanguages(string slug, List<string> languages)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.Languages, languages)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateBannerImage(string slug, string? filename)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.BannerImageFilename, filename)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateSkills(string slug, List<string> skillIds)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.SkillIds, skillIds)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateLlmExperiences(string slug, List<LlmExperience> experiences)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.LlmExperiences, experiences)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateLinks(string slug, List<UserLink> links)
    {
        var now = DateTime.UtcNow;
        var update = Builders<User>.Update
            .Set(u => u.Links, links)
            .Set(u => u.UpdatedAt, now)
            .Set(u => u.ProfileUpdatedAt, now);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> UpdateCommunityRoles(string slug, List<string> roleIds)
    {
        var update = Builders<User>.Update
            .Set(u => u.CommunityRoleIds, roleIds)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> SetAmbassadorCommunity(string slug, string? communityId)
    {
        var update = Builders<User>.Update
            .Set(u => u.AmbassadorCommunityId, communityId)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<User?> SetBlocked(string slug, bool blocked)
    {
        var update = Builders<User>.Update
            .Set(u => u.IsBlocked, blocked)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task UpdateLastSeen(string userId)
    {
        await db.Users.UpdateOneAsync(
            u => u.Id == userId,
            Builders<User>.Update.Set(u => u.LastSeenAt, DateTime.UtcNow));
    }

    public async Task TrackProfileVisit(string profileUserId, string visitorUserId)
    {
        // Increment total visit counter
        await db.Users.UpdateOneAsync(
            u => u.Id == profileUserId,
            Builders<User>.Update.Inc(u => u.VisitCount, 1));

        // Record unique visitor (ignore duplicate key)
        try
        {
            await db.ProfileVisits.InsertOneAsync(new Models.ProfileVisit
            {
                ProfileUserId = profileUserId,
                VisitorUserId = visitorUserId,
                VisitedAt = DateTime.UtcNow
            });
        }
        catch (MongoDB.Driver.MongoWriteException) { }
    }

    public async Task<(int visitCount, int uniqueVisitorCount)> GetProfileVisitStats(string profileUserId)
    {
        var user = await db.Users.Find(u => u.Id == profileUserId).FirstOrDefaultAsync();
        var unique = (int)await db.ProfileVisits.CountDocumentsAsync(
            v => v.ProfileUserId == profileUserId);
        return (user?.VisitCount ?? 0, unique);
    }

    public async Task<User?> SetPrimaryCompanion(string slug, string? companionId)
    {
        var update = Builders<User>.Update
            .Set(u => u.PrimaryCompanionId, companionId)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return await GetBySlug(slug);
    }

    public async Task<Dictionary<string, string>> GetSettings(string slug)
    {
        var user = await GetBySlug(slug);
        return user?.Settings ?? [];
    }

    public async Task<Dictionary<string, string>> PatchSettings(string slug, Dictionary<string, string?> patch)
    {
        var user = await GetBySlug(slug);
        if (user is null) return [];

        var settings = new Dictionary<string, string>(user.Settings);
        foreach (var (key, value) in patch)
        {
            if (value is null)
                settings.Remove(key);
            else
                settings[key] = value;
        }

        var update = Builders<User>.Update
            .Set(u => u.Settings, settings)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);

        await db.Users.UpdateOneAsync(u => u.Slug == slug, update);
        return settings;
    }

    public async Task<PaginatedResponse<UserListItemResponse>> GetUsersPage(
        int seed, int page, int pageSize, string? search, bool isAuthenticated, bool isAdmin,
        List<string>? skillIds = null, string? llmProviderId = null, ExperienceLevel? minExperienceLevel = null,
        string? sort = "random", bool? hasProfileImage = null, string? communityRoleId = null,
        bool? adminOnly = null, bool? ambassadorOnly = null, string? ambassadorCommunityId = null)
    {
        // Build visibility filter
        var visibilityFilter = BuildVisibilityFilter(isAuthenticated, isAdmin);

        // Build search filter
        FilterDefinition<User> searchFilter = Builders<User>.Filter.Empty;
        var companionMatchedUserIds = new HashSet<string>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var escapedSearch = Regex.Escape(search);
            var regex = new BsonRegularExpression(escapedSearch, "i");

            searchFilter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Regex(u => u.DiscordUsername, regex),
                Builders<User>.Filter.Regex(u => u.AlternativeName, regex));

            // Also search companion names
            var companionVisFilter = BuildCompanionVisibilityFilter(isAuthenticated, isAdmin);
            var companionSearchFilter = Builders<Companion>.Filter.And(
                companionVisFilter,
                Builders<Companion>.Filter.Regex(c => c.Name, regex));

            var matchingCompanions = await db.Companions
                .Find(companionSearchFilter)
                .Project(c => c.UserId)
                .ToListAsync();

            companionMatchedUserIds = matchingCompanions.ToHashSet();

            if (companionMatchedUserIds.Count > 0)
            {
                searchFilter = Builders<User>.Filter.Or(
                    searchFilter,
                    Builders<User>.Filter.In(u => u.Id, companionMatchedUserIds));
            }
        }

        // Build skills filter (AND: user must have all specified skills)
        FilterDefinition<User> skillsFilter = Builders<User>.Filter.Empty;
        if (skillIds is { Count: > 0 })
        {
            skillsFilter = Builders<User>.Filter.All(u => u.SkillIds, skillIds);
        }

        // Build LLM experience filter
        FilterDefinition<User> llmFilter = Builders<User>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(llmProviderId))
        {
            var minLevel = minExperienceLevel ?? ExperienceLevel.Beginner;
            llmFilter = Builders<User>.Filter.ElemMatch(u => u.LlmExperiences,
                Builders<LlmExperience>.Filter.And(
                    Builders<LlmExperience>.Filter.Eq(e => e.LlmProviderId, llmProviderId),
                    Builders<LlmExperience>.Filter.Gte(e => e.ExperienceLevel, minLevel)));
        }

        // Build profile image filter
        FilterDefinition<User> imageFilter = Builders<User>.Filter.Empty;
        if (hasProfileImage == true)
        {
            imageFilter = Builders<User>.Filter.And(
                Builders<User>.Filter.Ne(u => u.ProfileImageFilename, null),
                Builders<User>.Filter.Ne(u => u.ProfileImageFilename, ""));
        }

        // Build community role filter
        FilterDefinition<User> communityRoleFilter = Builders<User>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(communityRoleId))
        {
            communityRoleFilter = Builders<User>.Filter.AnyEq(u => u.CommunityRoleIds, communityRoleId);
        }

        // Build admin-only filter
        FilterDefinition<User> adminFilter = Builders<User>.Filter.Empty;
        if (adminOnly == true)
        {
            adminFilter = Builders<User>.Filter.Eq(u => u.IsAdmin, true);
        }

        // Build ambassador filters
        FilterDefinition<User> ambassadorFilter = Builders<User>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(ambassadorCommunityId))
        {
            ambassadorFilter = Builders<User>.Filter.Eq(u => u.AmbassadorCommunityId, ambassadorCommunityId);
        }
        else if (ambassadorOnly == true)
        {
            ambassadorFilter = Builders<User>.Filter.And(
                Builders<User>.Filter.Ne(u => u.AmbassadorCommunityId, null),
                Builders<User>.Filter.Ne(u => u.AmbassadorCommunityId, ""));
        }

        var combinedFilter = Builders<User>.Filter.And(
            visibilityFilter, searchFilter, skillsFilter, llmFilter, imageFilter, communityRoleFilter, adminFilter, ambassadorFilter);

        if (sort is "name_asc" or "name_desc" or "joined_desc" or "updated_desc" or "profile_updated_desc")
        {
            return await GetUsersPageSorted(
                page, pageSize, combinedFilter, isAuthenticated, isAdmin, seed, sort);
        }

        // Random sort: get all matching user IDs for deterministic randomized pagination
        var allUserIds = await db.Users
            .Find(combinedFilter)
            .Project(u => u.Id)
            .ToListAsync();

        var totalCount = allUserIds.Count;
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        // Deterministic shuffle using seed
        var rng = new Random(seed);
        var shuffled = allUserIds.OrderBy(_ => rng.Next()).ToList();

        // Paginate
        var pageIds = shuffled
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        if (pageIds.Count == 0)
        {
            return new PaginatedResponse<UserListItemResponse>
            {
                Items = [],
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                Seed = seed
            };
        }

        var items = await BuildListItems(pageIds, isAuthenticated, isAdmin);

        return new PaginatedResponse<UserListItemResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            Seed = seed
        };
    }

    private async Task<PaginatedResponse<UserListItemResponse>> GetUsersPageSorted(
        int page, int pageSize, FilterDefinition<User> combinedFilter,
        bool isAuthenticated, bool isAdmin, int seed, string sort)
    {
        // profile_updated_desc: in-memory sort so nulls land at the bottom
        if (sort == "profile_updated_desc")
        {
            var allUsers = await db.Users
                .Find(combinedFilter)
                .ToListAsync();

            var sorted = allUsers
                .OrderByDescending(u => u.ProfileUpdatedAt ?? DateTime.MinValue)
                .ToList();

            var totalCount = sorted.Count;
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            var pageUsers = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            var pageIds = pageUsers.Select(u => u.Id).ToList();
            var items = await BuildListItems(pageIds, isAuthenticated, isAdmin, pageUsers);

            return new PaginatedResponse<UserListItemResponse>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                Seed = seed
            };
        }

        // For name sorts, fetch id + name fields and sort in memory (handles null AlternativeName)
        if (sort is "name_asc" or "name_desc")
        {
            var allUsers = await db.Users
                .Find(combinedFilter)
                .Project(u => new { u.Id, u.AlternativeName, u.DiscordUsername })
                .ToListAsync();

            var sorted = sort == "name_asc"
                ? allUsers.OrderBy(u => (u.AlternativeName ?? u.DiscordUsername).ToLowerInvariant()).ToList()
                : allUsers.OrderByDescending(u => (u.AlternativeName ?? u.DiscordUsername).ToLowerInvariant()).ToList();

            var totalCount = sorted.Count;
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            var pageIds = sorted.Skip((page - 1) * pageSize).Take(pageSize).Select(u => u.Id).ToList();
            var items = await BuildListItems(pageIds, isAuthenticated, isAdmin);

            return new PaginatedResponse<UserListItemResponse>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                Seed = seed
            };
        }

        // joined_desc / updated_desc: MongoDB sort
        {
            var totalCount = (int)await db.Users.CountDocumentsAsync(combinedFilter);
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

            var query = sort == "updated_desc"
                ? db.Users.Find(combinedFilter).SortByDescending(u => u.UpdatedAt)
                : db.Users.Find(combinedFilter).SortByDescending(u => u.JoinedAt).ThenByDescending(u => u.CreatedAt);

            var users = await query
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            var pageIds = users.Select(u => u.Id).ToList();
            var items = await BuildListItems(pageIds, isAuthenticated, isAdmin, users);

            return new PaginatedResponse<UserListItemResponse>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                Seed = seed
            };
        }
    }

    private async Task<List<UserListItemResponse>> BuildListItems(
        List<string> pageIds, bool isAuthenticated, bool isAdmin,
        List<User>? preloadedUsers = null)
    {
        if (pageIds.Count == 0) return [];

        var users = preloadedUsers
            ?? await db.Users
                .Find(Builders<User>.Filter.In(u => u.Id, pageIds))
                .ToListAsync();

        // Fetch visible companion names for these users
        var companionVisibility = BuildCompanionVisibilityFilter(isAuthenticated, isAdmin);
        var userIdFilter = Builders<Companion>.Filter.In(c => c.UserId, pageIds);
        var companions = await db.Companions
            .Find(Builders<Companion>.Filter.And(companionVisibility, userIdFilter))
            .ToListAsync();

        var companionsByUser = companions
            .GroupBy(c => c.UserId)
            .ToDictionary(g => g.Key, g => g.Select(c => c.Name).ToList());

        // Build a map from userId → primary companion name (if visible)
        var companionById = companions.ToDictionary(c => c.Id);
        var primaryNameByUser = users
            .Where(u => u.PrimaryCompanionId != null && companionById.ContainsKey(u.PrimaryCompanionId!))
            .ToDictionary(u => u.Id, u => companionById[u.PrimaryCompanionId!].Name);

        // Batch-load partner community names for ambassadors
        var ambassadorCommunityIds = users
            .Where(u => u.AmbassadorCommunityId != null)
            .Select(u => u.AmbassadorCommunityId!)
            .Distinct()
            .ToList();

        Dictionary<string, string> communityNameById = [];
        if (ambassadorCommunityIds.Count > 0)
        {
            var communities = await db.PartnerCommunities
                .Find(Builders<PartnerCommunity>.Filter.In(p => p.Id, ambassadorCommunityIds))
                .Project(p => new { p.Id, p.Name })
                .ToListAsync();
            communityNameById = communities.ToDictionary(p => p.Id, p => p.Name);
        }

        var userMap = users.ToDictionary(u => u.Id);

        // Bulk-load latest status texts
        var statusMap = await statusService.GetLatestStatuses(pageIds);

        return pageIds
            .Where(id => userMap.ContainsKey(id))
            .Select(id =>
            {
                var user = userMap[id];
                var communityName = user.AmbassadorCommunityId != null
                    ? communityNameById.GetValueOrDefault(user.AmbassadorCommunityId)
                    : null;
                return new UserListItemResponse
                {
                    Slug = user.Slug,
                    DisplayName = string.IsNullOrWhiteSpace(user.AlternativeName)
                        ? user.DiscordUsername
                        : user.AlternativeName,
                    ProfileImageUrl = user.ProfileImageFilename,
                    CompanionNames = companionsByUser.GetValueOrDefault(user.Id, []),
                    Alignment = user.Alignment,
                    IsAdmin = user.IsAdmin,
                    IsBlocked = user.IsBlocked,
                    HasCommunityRoles = user.CommunityRoleIds?.Count > 0,
                    PrimaryCompanionName = primaryNameByUser.GetValueOrDefault(user.Id),
                    IsAmbassador = user.AmbassadorCommunityId != null,
                    AmbassadorCommunityName = communityName,
                    Status = statusMap.GetValueOrDefault(id),
                    IsOnline = user.LastSeenAt.HasValue
                        && (DateTime.UtcNow - user.LastSeenAt.Value).TotalMinutes < 5
                };
            })
            .ToList();
    }

    private static FilterDefinition<User> BuildVisibilityFilter(bool isAuthenticated, bool isAdmin)
    {
        if (isAdmin) return Builders<User>.Filter.Empty;

        var notBlocked = Builders<User>.Filter.Ne(u => u.IsBlocked, true);

        if (isAuthenticated)
            return Builders<User>.Filter.And(
                notBlocked,
                Builders<User>.Filter.In(u => u.Visibility,
                    new[] { Visibility.Public, Visibility.MembersOnly }));

        return Builders<User>.Filter.And(
            notBlocked,
            Builders<User>.Filter.Eq(u => u.Visibility, Visibility.Public));
    }

    private static FilterDefinition<Companion> BuildCompanionVisibilityFilter(bool isAuthenticated, bool isAdmin)
    {
        if (isAdmin) return Builders<Companion>.Filter.Empty;

        if (isAuthenticated)
            return Builders<Companion>.Filter.In(c => c.Visibility,
                new[] { Visibility.Public, Visibility.MembersOnly });

        return Builders<Companion>.Filter.Eq(c => c.Visibility, Visibility.Public);
    }

    private async Task<string> GenerateUniqueSlug()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        while (true)
        {
            var slug = RandomNumberGenerator.GetString(chars, 8);
            var existing = await db.Users.Find(u => u.Slug == slug).FirstOrDefaultAsync();
            if (existing is null) return slug;
        }
    }
}
