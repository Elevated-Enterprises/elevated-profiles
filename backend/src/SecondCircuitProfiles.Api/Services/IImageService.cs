namespace SecondCircuitProfiles.Api.Services;

public interface IImageService
{
    Task<string> SaveImage(IFormFile file);
    void DeleteImage(string filename);
    string? GetImagePath(string filename);
    string GetImageContentType(string filename);
}
