using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface ITagService
{
    Task<List<TagResponse>> GetAll();
    Task<TagResponse> Create(TagCreateRequest request);
    Task<bool> Delete(string id);
}
