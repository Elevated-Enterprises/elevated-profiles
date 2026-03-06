using Microsoft.Extensions.Options;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.Configuration;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class MongoDbContext
{
    public IMongoCollection<User> Users { get; }
    public IMongoCollection<Companion> Companions { get; }
    public IMongoCollection<AuditLogEntry> AuditLog { get; }
    public IMongoCollection<Skill> Skills { get; }
    public IMongoCollection<LlmProvider> LlmProviders { get; }
    public IMongoCollection<CommunityRole> CommunityRoles { get; }
    public IMongoCollection<PartnerCommunity> PartnerCommunities { get; }
    public IMongoCollection<Thought> Thoughts { get; }
    public IMongoCollection<Comment> Comments { get; }
    public IMongoCollection<Reaction> Reactions { get; }
    public IMongoCollection<AvailableEmoji> AvailableEmojis { get; }
    public IMongoCollection<SocialEdge> SocialEdges { get; }
    public IMongoCollection<StatusUpdate> StatusUpdates { get; }
    public IMongoCollection<ThoughtTag> Tags { get; }
    public IMongoCollection<ThoughtSettings> ThoughtSettings { get; }
    public IMongoCollection<FeedEvent> FeedEvents { get; }
    public IMongoCollection<PigGame> PigGames { get; }
    public IMongoCollection<Rule> Rules { get; }
    public IMongoCollection<RuleRead> RuleReads { get; }
    public IMongoCollection<ThoughtRead> ThoughtReads { get; }
    public IMongoCollection<ProfileVisit> ProfileVisits { get; }
    public IMongoCollection<AcademyRead> AcademyReads { get; }

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);

        Users = database.GetCollection<User>("users");
        Companions = database.GetCollection<Companion>("companions");
        AuditLog = database.GetCollection<AuditLogEntry>("audit_log");
        Skills = database.GetCollection<Skill>("skills");
        LlmProviders = database.GetCollection<LlmProvider>("llm_providers");
        CommunityRoles = database.GetCollection<CommunityRole>("community_roles");
        PartnerCommunities = database.GetCollection<PartnerCommunity>("partner_communities");
        Thoughts = database.GetCollection<Thought>("thoughts");
        Comments = database.GetCollection<Comment>("comments");
        Reactions = database.GetCollection<Reaction>("reactions");
        AvailableEmojis = database.GetCollection<AvailableEmoji>("available_emojis");
        SocialEdges = database.GetCollection<SocialEdge>("social_edges");
        StatusUpdates = database.GetCollection<StatusUpdate>("status_updates");
        Tags = database.GetCollection<ThoughtTag>("tags");
        ThoughtSettings = database.GetCollection<ThoughtSettings>("thought_settings");
        FeedEvents = database.GetCollection<FeedEvent>("feed_events");
        PigGames = database.GetCollection<PigGame>("pig_games");
        Rules = database.GetCollection<Rule>("rules");
        RuleReads = database.GetCollection<RuleRead>("rule_reads");
        ThoughtReads = database.GetCollection<ThoughtRead>("thought_reads");
        ProfileVisits = database.GetCollection<ProfileVisit>("profile_visits");
        AcademyReads = database.GetCollection<AcademyRead>("academy_reads");

        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        Users.Indexes.CreateMany([
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.Slug),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.DiscordId),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.Visibility)),
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.SkillIds))
        ]);

        Companions.Indexes.CreateMany([
            new CreateIndexModel<Companion>(
                Builders<Companion>.IndexKeys.Ascending(c => c.UserId)),
            new CreateIndexModel<Companion>(
                Builders<Companion>.IndexKeys.Ascending(c => c.Visibility))
        ]);

        AuditLog.Indexes.CreateOne(new CreateIndexModel<AuditLogEntry>(
            Builders<AuditLogEntry>.IndexKeys.Descending(a => a.Timestamp)));

        Skills.Indexes.CreateOne(new CreateIndexModel<Skill>(
            Builders<Skill>.IndexKeys.Ascending(s => s.Name),
            new CreateIndexOptions { Unique = true }));

        LlmProviders.Indexes.CreateOne(new CreateIndexModel<LlmProvider>(
            Builders<LlmProvider>.IndexKeys.Ascending(l => l.Name),
            new CreateIndexOptions { Unique = true }));

        CommunityRoles.Indexes.CreateOne(new CreateIndexModel<CommunityRole>(
            Builders<CommunityRole>.IndexKeys.Ascending(r => r.Name),
            new CreateIndexOptions { Unique = true }));

        PartnerCommunities.Indexes.CreateOne(new CreateIndexModel<PartnerCommunity>(
            Builders<PartnerCommunity>.IndexKeys.Ascending(p => p.Name),
            new CreateIndexOptions { Unique = true }));

        Thoughts.Indexes.CreateMany([
            new CreateIndexModel<Thought>(
                Builders<Thought>.IndexKeys
                    .Ascending(t => t.AuthorUserId)
                    .Descending(t => t.CreatedAt)),
            new CreateIndexModel<Thought>(
                Builders<Thought>.IndexKeys.Ascending(t => t.Tags)),
            new CreateIndexModel<Thought>(
                Builders<Thought>.IndexKeys.Descending(t => t.CreatedAt))
        ]);

        Comments.Indexes.CreateOne(new CreateIndexModel<Comment>(
            Builders<Comment>.IndexKeys
                .Ascending(c => c.ThoughtId)
                .Ascending(c => c.CreatedAt)));

        Reactions.Indexes.CreateMany([
            new CreateIndexModel<Reaction>(
                Builders<Reaction>.IndexKeys
                    .Ascending(r => r.TargetId)
                    .Ascending(r => r.TargetType)
                    .Ascending(r => r.UserId)
                    .Ascending(r => r.EmojiKey),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<Reaction>(
                Builders<Reaction>.IndexKeys.Ascending(r => r.TargetId))
        ]);

        SocialEdges.Indexes.CreateMany([
            new CreateIndexModel<SocialEdge>(
                Builders<SocialEdge>.IndexKeys
                    .Ascending(e => e.FromUserId)
                    .Ascending(e => e.ToUserId)
                    .Ascending(e => e.EdgeType),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<SocialEdge>(
                Builders<SocialEdge>.IndexKeys.Ascending(e => e.FromUserId))
        ]);

        StatusUpdates.Indexes.CreateOne(new CreateIndexModel<StatusUpdate>(
            Builders<StatusUpdate>.IndexKeys
                .Ascending(s => s.UserId)
                .Descending(s => s.CreatedAt)));

        AvailableEmojis.Indexes.CreateOne(new CreateIndexModel<AvailableEmoji>(
            Builders<AvailableEmoji>.IndexKeys.Ascending(e => e.Key),
            new CreateIndexOptions { Unique = true }));

        Tags.Indexes.CreateOne(new CreateIndexModel<ThoughtTag>(
            Builders<ThoughtTag>.IndexKeys.Ascending(t => t.Name),
            new CreateIndexOptions { Unique = true }));

        FeedEvents.Indexes.CreateOne(new CreateIndexModel<FeedEvent>(
            Builders<FeedEvent>.IndexKeys.Descending(f => f.CreatedAt)));

        PigGames.Indexes.CreateMany([
            new CreateIndexModel<PigGame>(
                Builders<PigGame>.IndexKeys.Ascending(g => g.Slug),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<PigGame>(
                Builders<PigGame>.IndexKeys.Ascending(g => g.Status)),
            new CreateIndexModel<PigGame>(
                Builders<PigGame>.IndexKeys.Descending(g => g.LastActivity))
        ]);

        Rules.Indexes.CreateOne(new CreateIndexModel<Rule>(
            Builders<Rule>.IndexKeys.Ascending(r => r.SortOrder)));

        RuleReads.Indexes.CreateOne(new CreateIndexModel<RuleRead>(
            Builders<RuleRead>.IndexKeys
                .Ascending(r => r.UserId)
                .Ascending(r => r.RuleId),
            new CreateIndexOptions { Unique = true }));

        ThoughtReads.Indexes.CreateMany([
            new CreateIndexModel<ThoughtRead>(
                Builders<ThoughtRead>.IndexKeys
                    .Ascending(r => r.ThoughtId)
                    .Ascending(r => r.UserId),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<ThoughtRead>(
                Builders<ThoughtRead>.IndexKeys.Ascending(r => r.ThoughtId))
        ]);

        ProfileVisits.Indexes.CreateMany([
            new CreateIndexModel<ProfileVisit>(
                Builders<ProfileVisit>.IndexKeys
                    .Ascending(v => v.ProfileUserId)
                    .Ascending(v => v.VisitorUserId),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<ProfileVisit>(
                Builders<ProfileVisit>.IndexKeys.Ascending(v => v.ProfileUserId))
        ]);

        AcademyReads.Indexes.CreateMany([
            new CreateIndexModel<AcademyRead>(
                Builders<AcademyRead>.IndexKeys.Ascending(r => r.ArticlePath)),
            new CreateIndexModel<AcademyRead>(
                Builders<AcademyRead>.IndexKeys
                    .Ascending(r => r.ArticlePath)
                    .Descending(r => r.ReadAt))
        ]);
    }
}
