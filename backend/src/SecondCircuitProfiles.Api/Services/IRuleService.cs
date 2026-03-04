using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IRuleService
{
    Task<List<RuleResponse>> GetAll();
    Task<RuleResponse?> GetById(string id);
    Task<RuleResponse> Create(RuleRequest request);
    Task<RuleResponse?> Update(string id, RuleRequest request);
    Task<bool> Delete(string id);
    Task ReorderAsync(List<string> ruleIds);
}
