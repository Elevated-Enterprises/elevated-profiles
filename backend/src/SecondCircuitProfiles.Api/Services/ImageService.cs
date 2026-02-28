using Microsoft.Extensions.Options;
using SecondCircuitProfiles.Api.Configuration;

namespace SecondCircuitProfiles.Api.Services;

public class ImageService : IImageService
{
    private readonly UploadSettings _settings;
    private readonly ILogger<ImageService> _logger;

    public ImageService(IOptions<UploadSettings> settings, ILogger<ImageService> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        if (!Directory.Exists(_settings.Path))
        {
            Directory.CreateDirectory(_settings.Path);
            _logger.LogInformation("Created upload directory: {Path}", _settings.Path);
        }
    }

    private static readonly Dictionary<string, byte[][]> ImageMagicBytes = new()
    {
        [".jpg"] = [[0xFF, 0xD8, 0xFF]],
        [".jpeg"] = [[0xFF, 0xD8, 0xFF]],
        [".png"] = [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
        [".gif"] = [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
        [".webp"] = [[0x52, 0x49, 0x46, 0x46]]
    };

    public async Task<string> SaveImage(IFormFile file)
    {
        if (file.Length == 0)
            throw new ArgumentException("File is empty.");

        if (file.Length > _settings.MaxFileSizeBytes)
            throw new ArgumentException(
                $"File exceeds maximum size of {_settings.MaxFileSizeBytes / 1024 / 1024}MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_settings.AllowedExtensions.Contains(extension))
            throw new ArgumentException(
                $"File type '{extension}' is not allowed. Allowed: {string.Join(", ", _settings.AllowedExtensions)}");

        // Validate file content matches extension (magic bytes check)
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var fileBytes = memoryStream.ToArray();

        if (!IsValidImageContent(extension, fileBytes))
            throw new ArgumentException("File content does not match the expected image format.");

        var filename = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(_settings.Path, filename);

        await File.WriteAllBytesAsync(filePath, fileBytes);

        _logger.LogInformation("Saved image: {Filename}", filename);
        return filename;
    }

    private static bool IsValidImageContent(string extension, byte[] fileBytes)
    {
        if (!ImageMagicBytes.TryGetValue(extension, out var validHeaders))
            return false;

        return validHeaders.Any(header =>
            fileBytes.Length >= header.Length &&
            header.SequenceEqual(fileBytes.Take(header.Length)));
    }

    public void DeleteImage(string filename)
    {
        var filePath = Path.Combine(_settings.Path, filename);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger.LogInformation("Deleted image: {Filename}", filename);
        }
    }

    public string? GetImagePath(string filename)
    {
        // Prevent directory traversal
        if (filename.Contains("..") || filename.Contains('/') || filename.Contains('\\'))
            return null;

        var filePath = Path.Combine(_settings.Path, filename);
        return File.Exists(filePath) ? filePath : null;
    }

    public string GetImageContentType(string filename)
    {
        var extension = Path.GetExtension(filename).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }
}
