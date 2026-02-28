using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface ITokenService
{
    string GenerateToken(User user);
}
