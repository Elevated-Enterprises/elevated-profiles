namespace SecondCircuitProfiles.Api.DTOs;

public class ErrorResponse
{
    public string Error { get; set; } = null!;
}

public class ImageUploadResponse
{
    public string ProfileImageUrl { get; set; } = null!;
}
