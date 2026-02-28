namespace SecondCircuitProfiles.Api.DTOs;

public class UserSettingsUpdateRequest
{
    /// <summary>
    /// Key/value pairs to merge into the user's settings.
    /// Set a value to null to delete that key.
    /// </summary>
    public Dictionary<string, string?> Settings { get; set; } = [];
}
