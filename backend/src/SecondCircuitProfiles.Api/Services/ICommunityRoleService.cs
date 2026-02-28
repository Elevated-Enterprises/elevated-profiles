using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface ICommunityRoleService
{
    Task<List<CommunityRole>> GetAll();
    Task<List<CommunityRole>> GetByIds(IEnumerable<string> ids);
    Task<CommunityRole> Create(string name);
    Task<bool> Delete(string id);
}
