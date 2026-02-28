using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface ISkillService
{
    Task<List<Skill>> GetAll();
    Task<Skill?> GetById(string id);
    Task<List<Skill>> GetByIds(IEnumerable<string> ids);
    Task<Skill> Create(string name);
    Task<bool> Delete(string id);
}
