using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IPartnerCommunityService
{
    Task<List<PartnerCommunity>> GetAll();
    Task<PartnerCommunity?> GetById(string id);
    Task<PartnerCommunity> Create(string name, string discordInviteUrl);
    Task<bool> Delete(string id);
}
