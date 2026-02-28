using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IAuditService
{
    Task LogAction(string adminDiscordId, string adminDiscordUsername,
        string action, string targetType, string targetId,
        string? details = null, object? previousValues = null, object? newValues = null);

    Task<PaginatedResponse<AuditLogEntryResponse>> GetAuditLog(int page, int pageSize);
}
