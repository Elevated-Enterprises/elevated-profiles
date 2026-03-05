using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.Configuration;
using SecondCircuitProfiles.Api.Hubs;
using SecondCircuitProfiles.Api.Middleware;
using SecondCircuitProfiles.Api.Models;
using SecondCircuitProfiles.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Bind configuration sections
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection(MongoDbSettings.SectionName));
builder.Services.Configure<DiscordSettings>(builder.Configuration.GetSection(DiscordSettings.SectionName));
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
builder.Services.Configure<UploadSettings>(builder.Configuration.GetSection(UploadSettings.SectionName));
builder.Services.Configure<CorsSettings>(builder.Configuration.GetSection(CorsSettings.SectionName));
builder.Services.Configure<AcademySettings>(builder.Configuration.GetSection(AcademySettings.SectionName));

// MongoDB
builder.Services.AddSingleton<MongoDbContext>();

// Services
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddSingleton<IImageService, ImageService>();
builder.Services.AddSingleton<IAuditService, AuditService>();
builder.Services.AddSingleton<ICompanionService, CompanionService>();
builder.Services.AddSingleton<IUserService, UserService>();
builder.Services.AddSingleton<ISkillService, SkillService>();
builder.Services.AddSingleton<ILlmProviderService, LlmProviderService>();
builder.Services.AddSingleton<ICommunityRoleService, CommunityRoleService>();
builder.Services.AddSingleton<IPartnerCommunityService, PartnerCommunityService>();
builder.Services.AddSingleton<IEmojiService, EmojiService>();
builder.Services.AddSingleton<ITagService, TagService>();
builder.Services.AddSingleton<ISocialService, SocialService>();
builder.Services.AddSingleton<IThoughtSettingsService, ThoughtSettingsService>();
builder.Services.AddSingleton<IFeedService, FeedService>();
builder.Services.AddSingleton<IStatusService, StatusService>();
builder.Services.AddSingleton<IReactionService, ReactionService>();
builder.Services.AddSingleton<ICommentService, CommentService>();
builder.Services.AddSingleton<IThoughtService, ThoughtService>();
builder.Services.AddHttpClient<IDiscordService, DiscordService>();
builder.Services.AddSingleton<IPigService, PigService>();
builder.Services.AddSingleton<IRuleService, RuleService>();
builder.Services.AddSingleton<IAcademyService, AcademyService>();
builder.Services.AddHostedService<PigCleanupService>();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
    ?? new JwtSettings();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings.Secret))
    };
    // Support JWT via query param for SignalR WebSocket connections
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/pig"))
                context.Token = accessToken;
            return Task.CompletedTask;
        }
    };
});

// Authorization policies
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdmin", policy =>
        policy.RequireAssertion(context =>
            context.User.FindFirst("is_admin")?.Value == "true"));

// CORS
var disableCors = builder.Configuration.GetValue<bool>("DISABLE_CORS");
var corsSettings = builder.Configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>()
    ?? new CorsSettings();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (disableCors)
        {
            policy.SetIsOriginAllowed(_ => true)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(corsSettings.AllowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

var app = builder.Build();

// -----------------------------------------------------------------------
// JoinedAt migration — backfill all users that have joinedAt == null.
// Sets joinedAt to 2026-02-20 (the date this field was introduced).
// TODO: Remove this block once all users have been migrated.
// See README.md → "JoinedAt migration" for details.
// -----------------------------------------------------------------------
{
    var db = app.Services.GetRequiredService<MongoDbContext>();
    var fallbackDate = new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc);
    var filter = Builders<User>.Filter.Eq(u => u.JoinedAt, null);
    var update = Builders<User>.Update.Set(u => u.JoinedAt, fallbackDate);
    var result = await db.Users.UpdateManyAsync(filter, update);
    if (result.ModifiedCount > 0)
    {
        app.Logger.LogInformation(
            "JoinedAt migration: set joinedAt={Date} for {Count} existing user(s).",
            fallbackDate.ToString("yyyy-MM-dd"), result.ModifiedCount);
    }
}

// -----------------------------------------------------------------------
// ProfileUpdatedAt migration — backfill all users that have profileUpdatedAt == null.
// Sets profileUpdatedAt = updatedAt (best approximation of last real profile change).
// TODO: Remove this block once all users have been migrated.
// -----------------------------------------------------------------------
{
    var db = app.Services.GetRequiredService<MongoDbContext>();
    var filter = Builders<User>.Filter.Eq(u => u.ProfileUpdatedAt, null);
    var pipeline = new EmptyPipelineDefinition<User>()
        .AppendStage<User, User, User>(
            new MongoDB.Bson.BsonDocument("$set",
                new MongoDB.Bson.BsonDocument("profileUpdatedAt", "$updatedAt")));
    var result = await db.Users.UpdateManyAsync(filter, pipeline);
    if (result.ModifiedCount > 0)
        app.Logger.LogInformation("ProfileUpdatedAt migration: backfilled {Count} user(s).", result.ModifiedCount);
}

// -----------------------------------------------------------------------
// Thought slug migration — backfill all thoughts that have no slug yet.
// TODO: Remove this block once all thoughts have been migrated.
// -----------------------------------------------------------------------
{
    const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var db = app.Services.GetRequiredService<MongoDbContext>();
    var unsluggedThoughts = await db.Thoughts
        .Find(Builders<Thought>.Filter.Eq(t => t.Slug, null))
        .Project(t => t.Id)
        .ToListAsync();

    if (unsluggedThoughts.Count > 0)
    {
        foreach (var thoughtId in unsluggedThoughts)
        {
            string slug;
            do
            {
                slug = System.Security.Cryptography.RandomNumberGenerator.GetString(chars, 8);
            } while (await db.Thoughts.Find(t => t.Slug == slug).AnyAsync());

            await db.Thoughts.UpdateOneAsync(
                t => t.Id == thoughtId,
                Builders<Thought>.Update.Set(t => t.Slug, slug));
        }
        app.Logger.LogInformation(
            "Thought slug migration: assigned slugs to {Count} existing thought(s).",
            unsluggedThoughts.Count);
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Second Circuit Profiles API");
    });
}

// app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<LastSeenMiddleware>();
app.MapControllers();
app.MapHub<PigHub>("/hubs/pig");

app.Run();
