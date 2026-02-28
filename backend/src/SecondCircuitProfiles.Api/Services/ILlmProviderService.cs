using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface ILlmProviderService
{
    Task<List<LlmProvider>> GetAll();
    Task<LlmProvider?> GetById(string id);
    Task<List<LlmProvider>> GetByIds(IEnumerable<string> ids);
    Task<LlmProvider> Create(string name);
    Task<bool> Delete(string id);
}
