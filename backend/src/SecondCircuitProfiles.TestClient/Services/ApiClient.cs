using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SecondCircuitProfiles.TestClient.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private readonly AuthStateService _auth;
    private readonly string _apiBaseUrl;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public ApiClient(HttpClient http, AuthStateService auth, IConfiguration config)
    {
        _http = http;
        _auth = auth;
        _apiBaseUrl = config["ApiBaseUrl"] ?? "http://localhost:5246";
    }

    public string ImageUrl(string? filename) =>
        string.IsNullOrEmpty(filename) ? "" : $"{_apiBaseUrl}/api/images/{filename}";

    private void ApplyAuth()
    {
        _http.DefaultRequestHeaders.Authorization = _auth.Token is not null
            ? new AuthenticationHeaderValue("Bearer", _auth.Token)
            : null;
    }

    // --- Auth ---

    public async Task<AuthConfigDto?> GetAuthConfig()
    {
        return await _http.GetFromJsonAsync<AuthConfigDto>("/api/auth/config", JsonOpts);
    }

    public async Task<AuthResponseDto?> ExchangeCode(string code)
    {
        var resp = await _http.PostAsJsonAsync("/api/auth/callback", new { code });
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<AuthResponseDto>(JsonOpts);
    }

    public async Task<UserDto?> GetMe()
    {
        ApplyAuth();
        var resp = await _http.GetAsync("/api/auth/me");
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<UserDto>(JsonOpts);
    }

    // --- Users ---

    public async Task<PaginatedDto<UserListItemDto>?> GetUsers(
        int? seed = null, int page = 1, int pageSize = 12, string? search = null)
    {
        ApplyAuth();
        var qs = $"?page={page}&pageSize={pageSize}";
        if (seed.HasValue) qs += $"&seed={seed}";
        if (!string.IsNullOrEmpty(search)) qs += $"&search={Uri.EscapeDataString(search)}";

        var resp = await _http.GetAsync($"/api/users{qs}");
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<PaginatedDto<UserListItemDto>>(JsonOpts);
    }

    public async Task<UserDto?> GetUser(string slug)
    {
        ApplyAuth();
        var resp = await _http.GetAsync($"/api/users/{slug}");
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<UserDto>(JsonOpts);
    }

    public async Task<(bool Ok, string? Error)> UpdateUser(string slug, object updateRequest)
    {
        ApplyAuth();
        var resp = await _http.PutAsJsonAsync($"/api/users/{slug}", updateRequest);
        if (resp.IsSuccessStatusCode) return (true, null);
        var err = await resp.Content.ReadAsStringAsync();
        return (false, err);
    }

    public async Task<(bool Ok, string? Error)> UploadUserImage(string slug, Stream fileStream, string fileName)
    {
        ApplyAuth();
        using var content = new MultipartFormDataContent();
        content.Add(new StreamContent(fileStream), "file", fileName);
        var resp = await _http.PostAsync($"/api/users/{slug}/image", content);
        if (resp.IsSuccessStatusCode) return (true, null);
        var err = await resp.Content.ReadAsStringAsync();
        return (false, err);
    }

    public async Task<bool> DeleteUserImage(string slug)
    {
        ApplyAuth();
        var resp = await _http.DeleteAsync($"/api/users/{slug}/image");
        return resp.IsSuccessStatusCode;
    }

    // --- Companions ---

    public async Task<List<CompanionDto>?> GetCompanions(string slug)
    {
        ApplyAuth();
        var resp = await _http.GetAsync($"/api/users/{slug}/companions");
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<List<CompanionDto>>(JsonOpts);
    }

    public async Task<(bool Ok, string? Error)> CreateCompanion(string slug, object createRequest)
    {
        ApplyAuth();
        var resp = await _http.PostAsJsonAsync($"/api/users/{slug}/companions", createRequest);
        if (resp.IsSuccessStatusCode) return (true, null);
        var err = await resp.Content.ReadAsStringAsync();
        return (false, err);
    }

    public async Task<(bool Ok, string? Error)> UpdateCompanion(string slug, string id, object updateRequest)
    {
        ApplyAuth();
        var resp = await _http.PutAsJsonAsync($"/api/users/{slug}/companions/{id}", updateRequest);
        if (resp.IsSuccessStatusCode) return (true, null);
        var err = await resp.Content.ReadAsStringAsync();
        return (false, err);
    }

    public async Task<bool> DeleteCompanion(string slug, string id)
    {
        ApplyAuth();
        var resp = await _http.DeleteAsync($"/api/users/{slug}/companions/{id}");
        return resp.IsSuccessStatusCode;
    }

    public async Task<(bool Ok, string? Error)> UploadCompanionImage(
        string slug, string id, Stream fileStream, string fileName)
    {
        ApplyAuth();
        using var content = new MultipartFormDataContent();
        content.Add(new StreamContent(fileStream), "file", fileName);
        var resp = await _http.PostAsync($"/api/users/{slug}/companions/{id}/image", content);
        if (resp.IsSuccessStatusCode) return (true, null);
        var err = await resp.Content.ReadAsStringAsync();
        return (false, err);
    }

    public async Task<bool> DeleteCompanionImage(string slug, string id)
    {
        ApplyAuth();
        var resp = await _http.DeleteAsync($"/api/users/{slug}/companions/{id}/image");
        return resp.IsSuccessStatusCode;
    }

    // --- Admin ---

    public async Task<PaginatedDto<AuditLogEntryDto>?> GetAuditLog(int page = 1, int pageSize = 20)
    {
        ApplyAuth();
        var resp = await _http.GetAsync($"/api/admin/audit?page={page}&pageSize={pageSize}");
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadFromJsonAsync<PaginatedDto<AuditLogEntryDto>>(JsonOpts);
    }
}

// --- DTOs ---

public class AuthConfigDto
{
    public string ClientId { get; set; } = "";
    public string RedirectUri { get; set; } = "";
    public string AuthorizationUrl { get; set; } = "";
}

public class AuthResponseDto
{
    public string Token { get; set; } = "";
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public string Slug { get; set; } = "";
    public string DiscordUsername { get; set; } = "";
    public int Visibility { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? AlternativeName { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? Bio { get; set; }
    public bool IsOwnProfile { get; set; }
    public bool IsAdmin { get; set; }
    public List<CompanionDto> Companions { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public string VisibilityLabel => Visibility switch
    {
        0 => "Private",
        1 => "Members Only",
        2 => "Public",
        _ => "Unknown"
    };
}

public class UserListItemDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? ProfileImageUrl { get; set; }
    public List<string> CompanionNames { get; set; } = [];
}

public class CompanionDto
{
    public string Id { get; set; } = "";
    public int Visibility { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string Name { get; set; } = "";
    public string? Platform { get; set; }
    public string? Role { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Bio { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public string VisibilityLabel => Visibility switch
    {
        0 => "Private",
        1 => "Members Only",
        2 => "Public",
        _ => "Unknown"
    };
}

public class PaginatedDto<T>
{
    public List<T> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public int? Seed { get; set; }
}

public class AuditLogEntryDto
{
    public string Id { get; set; } = "";
    public string AdminDiscordId { get; set; } = "";
    public string AdminDiscordUsername { get; set; } = "";
    public string Action { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; }
}
