using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using SecondCircuitProfiles.Api.Configuration;

namespace SecondCircuitProfiles.Api.Services;

public class DiscordService(
    HttpClient httpClient,
    IOptions<DiscordSettings> discordSettings,
    ILogger<DiscordService> logger) : IDiscordService
{
    private readonly DiscordSettings _settings = discordSettings.Value;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const long AdministratorPermission = 0x8;

    public async Task<DiscordAuthResult?> AuthenticateUser(string code)
    {
        // 1. Exchange code for access token
        var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _settings.ClientId,
            ["client_secret"] = _settings.ClientSecret,
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = _settings.RedirectUri
        });

        var tokenResponse = await httpClient.PostAsync(
            "https://discord.com/api/v10/oauth2/token", tokenRequest);

        if (!tokenResponse.IsSuccessStatusCode)
        {
            var error = await tokenResponse.Content.ReadAsStringAsync();
            logger.LogWarning("Discord token exchange failed: {Error}", error);
            return null;
        }

        var tokenData = await tokenResponse.Content.ReadFromJsonAsync<DiscordTokenResponse>(JsonOptions);
        if (tokenData?.AccessToken is null) return null;

        var authHeader = new AuthenticationHeaderValue("Bearer", tokenData.AccessToken);

        // 2. Get user info
        var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/v10/users/@me");
        userRequest.Headers.Authorization = authHeader;

        var userResponse = await httpClient.SendAsync(userRequest);
        if (!userResponse.IsSuccessStatusCode)
        {
            logger.LogWarning("Failed to get Discord user info");
            return null;
        }

        var userData = await userResponse.Content.ReadFromJsonAsync<DiscordApiUser>(JsonOptions);
        if (userData is null) return null;

        // 3. Get user's guilds (includes permissions per guild)
        var guildsRequest = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/v10/users/@me/guilds");
        guildsRequest.Headers.Authorization = authHeader;

        var guildsResponse = await httpClient.SendAsync(guildsRequest);
        if (!guildsResponse.IsSuccessStatusCode)
        {
            logger.LogWarning("Failed to get Discord guilds for user {UserId}", userData.Id);
            return null;
        }

        var guilds = await guildsResponse.Content.ReadFromJsonAsync<List<DiscordPartialGuild>>(JsonOptions);

        // 4. Find our guild and check membership + admin
        var ourGuild = guilds?.Find(g => g.Id == _settings.GuildId);

        var isMember = ourGuild is not null;
        var isAdmin = false;

        if (ourGuild is not null)
        {
            // Guild owner is always admin
            if (ourGuild.Owner == true)
            {
                isAdmin = true;
            }
            else if (long.TryParse(ourGuild.Permissions, out var perms))
            {
                isAdmin = (perms & AdministratorPermission) != 0;
            }
        }

        logger.LogInformation(
            "Discord auth for {Username} ({UserId}): member={IsMember}, admin={IsAdmin}",
            userData.GlobalName ?? userData.Username, userData.Id, isMember, isAdmin);

        return new DiscordAuthResult
        {
            Id = userData.Id,
            Username = userData.GlobalName ?? userData.Username,
            Avatar = userData.Avatar,
            IsMember = isMember,
            IsAdmin = isAdmin
        };
    }

    private class DiscordTokenResponse
    {
        public string? AccessToken { get; set; }
        public string? TokenType { get; set; }
    }

    private class DiscordApiUser
    {
        public string Id { get; set; } = null!;
        public string Username { get; set; } = null!;
        public string? GlobalName { get; set; }
        public string? Avatar { get; set; }
    }

    private class DiscordPartialGuild
    {
        public string Id { get; set; } = null!;
        public string? Name { get; set; }
        public bool? Owner { get; set; }
        public string? Permissions { get; set; }
    }
}
