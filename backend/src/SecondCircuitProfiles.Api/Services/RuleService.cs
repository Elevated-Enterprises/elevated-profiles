using System.Security.Claims;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class RuleService(MongoDbContext db) : IRuleService
{
    public async Task<List<RuleResponse>> GetAll(string? userId = null)
    {
        var rules = await db.Rules.Find(_ => true).SortBy(r => r.SortOrder).ToListAsync();

        if (userId == null)
            return rules.Select(r => MapToResponse(r)).ToList();

        var reads = await db.RuleReads.Find(r => r.UserId == userId).ToListAsync();
        var readMap = reads.ToDictionary(r => r.RuleId, r => r.ReadAt);

        return rules.Select(r => MapToResponse(r,
            isUnread: !readMap.ContainsKey(r.Id) || readMap[r.Id] < r.UpdatedAt
        )).ToList();
    }

    public async Task<RuleResponse?> GetById(string id, string? userId = null)
    {
        var rule = await db.Rules.Find(r => r.Id == id).FirstOrDefaultAsync();
        if (rule == null) return null;

        if (userId == null)
            return MapToResponse(rule);

        var read = await db.RuleReads
            .Find(r => r.UserId == userId && r.RuleId == id)
            .FirstOrDefaultAsync();

        return MapToResponse(rule,
            isUnread: read == null || read.ReadAt < rule.UpdatedAt);
    }

    public async Task<RuleResponse> Create(RuleRequest request)
    {
        var count = (int)await db.Rules.CountDocumentsAsync(_ => true);
        var rule = new Rule
        {
            Title = request.Title.Trim(),
            Summary = request.Summary.Trim(),
            Body = request.Body.Trim(),
            SortOrder = count,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        await db.Rules.InsertOneAsync(rule);
        return MapToResponse(rule);
    }

    public async Task<RuleResponse?> Update(string id, RuleRequest request)
    {
        var update = Builders<Rule>.Update
            .Set(r => r.Title, request.Title.Trim())
            .Set(r => r.Summary, request.Summary.Trim())
            .Set(r => r.Body, request.Body.Trim())
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        var result = await db.Rules.FindOneAndUpdateAsync(
            r => r.Id == id,
            update,
            new FindOneAndUpdateOptions<Rule> { ReturnDocument = ReturnDocument.After });

        return result == null ? null : MapToResponse(result);
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.Rules.DeleteOneAsync(r => r.Id == id);
        if (result.DeletedCount == 0) return false;

        // Clean up read records for this rule
        await db.RuleReads.DeleteManyAsync(r => r.RuleId == id);
        return true;
    }

    public async Task ReorderAsync(List<string> ruleIds)
    {
        if (ruleIds.Count == 0) return;

        var writes = ruleIds
            .Select((id, index) => new UpdateOneModel<Rule>(
                Builders<Rule>.Filter.Eq(r => r.Id, id),
                Builders<Rule>.Update.Set(r => r.SortOrder, index)
            ))
            .ToList<WriteModel<Rule>>();

        await db.Rules.BulkWriteAsync(writes);
    }

    public async Task MarkReadAsync(string userId, string ruleId)
    {
        var filter = Builders<RuleRead>.Filter.And(
            Builders<RuleRead>.Filter.Eq(r => r.UserId, userId),
            Builders<RuleRead>.Filter.Eq(r => r.RuleId, ruleId));

        var update = Builders<RuleRead>.Update
            .Set(r => r.ReadAt, DateTime.UtcNow)
            .SetOnInsert(r => r.UserId, userId)
            .SetOnInsert(r => r.RuleId, ruleId);

        await db.RuleReads.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
    }

    public async Task<int> GetUnreadCountAsync(string userId)
    {
        var rules = await db.Rules.Find(_ => true).ToListAsync();
        var reads = await db.RuleReads.Find(r => r.UserId == userId).ToListAsync();
        var readMap = reads.ToDictionary(r => r.RuleId, r => r.ReadAt);

        return rules.Count(r => !readMap.ContainsKey(r.Id) || readMap[r.Id] < r.UpdatedAt);
    }

    private static RuleResponse MapToResponse(Rule rule, bool? isUnread = null) => new()
    {
        Id = rule.Id,
        Title = rule.Title,
        Summary = rule.Summary,
        Body = rule.Body,
        SortOrder = rule.SortOrder,
        CreatedAt = rule.CreatedAt,
        UpdatedAt = rule.UpdatedAt,
        IsUnread = isUnread,
    };
}
