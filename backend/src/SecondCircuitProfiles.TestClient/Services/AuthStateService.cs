namespace SecondCircuitProfiles.TestClient.Services;

public class AuthStateService
{
    public string? Token { get; private set; }
    public string? Slug { get; private set; }
    public string? DiscordUsername { get; private set; }
    public bool IsAdmin { get; private set; }
    public bool IsLoggedIn => Token is not null;

    public event Action? OnChange;

    public void Login(string token, string slug, string discordUsername, bool isAdmin)
    {
        Token = token;
        Slug = slug;
        DiscordUsername = discordUsername;
        IsAdmin = isAdmin;
        OnChange?.Invoke();
    }

    public void Logout()
    {
        Token = null;
        Slug = null;
        DiscordUsername = null;
        IsAdmin = false;
        OnChange?.Invoke();
    }
}
