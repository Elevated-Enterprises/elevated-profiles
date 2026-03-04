using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class RuleService(MongoDbContext db) : IRuleService
{
    public async Task<List<RuleResponse>> GetAll()
    {
        var rules = await db.Rules.Find(_ => true).SortBy(r => r.SortOrder).ToListAsync();
        return rules.Select(MapToResponse).ToList();
    }

    public async Task<RuleResponse?> GetById(string id)
    {
        var rule = await db.Rules.Find(r => r.Id == id).FirstOrDefaultAsync();
        return rule == null ? null : MapToResponse(rule);
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
        return result.DeletedCount > 0;
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

    private static RuleResponse MapToResponse(Rule rule) => new()
    {
        Id = rule.Id,
        Title = rule.Title,
        Summary = rule.Summary,
        Body = rule.Body,
        SortOrder = rule.SortOrder,
        CreatedAt = rule.CreatedAt,
        UpdatedAt = rule.UpdatedAt,
    };
}
