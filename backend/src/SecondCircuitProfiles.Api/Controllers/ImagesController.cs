using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/images")]
public class ImagesController(IImageService imageService) : ControllerBase
{
    [HttpGet("{filename}")]
    [ResponseCache(Duration = 86400)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetImage(string filename)
    {
        var filePath = imageService.GetImagePath(filename);
        if (filePath is null) return NotFound();

        var contentType = imageService.GetImageContentType(filename);
        return PhysicalFile(filePath, contentType);
    }
}
