namespace SecondCircuitProfiles.Api.Services;

public class DiscordAuthResult
{
    public string Id { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? Avatar { get; set; }
    public bool IsMember { get; set; }
    public bool IsAdmin { get; set; }
}

public interface IDiscordService
{
    Task<DiscordAuthResult?> AuthenticateUser(string code);
}
