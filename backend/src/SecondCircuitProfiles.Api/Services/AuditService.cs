using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class AuditService(MongoDbContext db, ILogger<AuditService> logger) : IAuditService
{
    public async Task LogAction(string adminDiscordId, string adminDiscordUsername,
        string action, string targetType, string targetId,
        string? details = null, object? previousValues = null, object? newValues = null)
    {
        var entry = new AuditLogEntry
        {
            AdminDiscordId = adminDiscordId,
            AdminDiscordUsername = adminDiscordUsername,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Details = details,
            PreviousValues = previousValues is not null
                ? BsonDocument.Parse(JsonSerializer.Serialize(previousValues))
                : null,
            NewValues = newValues is not null
                ? BsonDocument.Parse(JsonSerializer.Serialize(newValues))
                : null,
            Timestamp = DateTime.UtcNow
        };

        await db.AuditLog.InsertOneAsync(entry);
        logger.LogInformation(
            "Audit: {Admin} performed {Action} on {TargetType} {TargetId}",
            adminDiscordUsername, action, targetType, targetId);
    }

    public async Task<PaginatedResponse<AuditLogEntryResponse>> GetAuditLog(int page, int pageSize)
    {
        var totalCount = (int)await db.AuditLog.CountDocumentsAsync(Builders<AuditLogEntry>.Filter.Empty);
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var entries = await db.AuditLog
            .Find(Builders<AuditLogEntry>.Filter.Empty)
            .SortByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var items = entries.Select(e => new AuditLogEntryResponse
        {
            Id = e.Id,
            AdminDiscordId = e.AdminDiscordId,
            AdminDiscordUsername = e.AdminDiscordUsername,
            Action = e.Action,
            TargetType = e.TargetType,
            TargetId = e.TargetId,
            Details = e.Details,
            PreviousValues = e.PreviousValues?.ToJson(),
            NewValues = e.NewValues?.ToJson(),
            Timestamp = e.Timestamp
        }).ToList();

        return new PaginatedResponse<AuditLogEntryResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }
}
