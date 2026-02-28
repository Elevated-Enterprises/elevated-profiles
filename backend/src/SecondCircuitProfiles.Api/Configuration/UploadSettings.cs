namespace SecondCircuitProfiles.Api.Configuration;

public class UploadSettings
{
    public const string SectionName = "Upload";

    public string Path { get; set; } = "./uploads";
    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;
    public string[] AllowedExtensions { get; set; } = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
}
