using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface IRuleService
{
    Task<List<RuleResponse>> GetAll(string? userId = null);
    Task<RuleResponse?> GetById(string id, string? userId = null);
    Task<RuleResponse> Create(RuleRequest request);
    Task<RuleResponse?> Update(string id, RuleRequest request);
    Task<bool> Delete(string id);
    Task ReorderAsync(List<string> ruleIds);
    Task MarkReadAsync(string userId, string ruleId);
    Task<int> GetUnreadCountAsync(string userId);
}
