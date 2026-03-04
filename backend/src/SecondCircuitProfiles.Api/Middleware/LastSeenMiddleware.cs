using System.Collections.Concurrent;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Middleware;

public class LastSeenMiddleware(RequestDelegate next)
{
    // In-memory rate limit: avoid hammering MongoDB on every request
    private static readonly ConcurrentDictionary<string, DateTime> _lastUpdated = new();
    private static readonly TimeSpan UpdateInterval = TimeSpan.FromSeconds(60);

    public async Task InvokeAsync(HttpContext context, IUserService userService)
    {
        await next(context);

        var userId = context.User.FindFirst("sub")?.Value;
        if (userId == null) return;

        var now = DateTime.UtcNow;
        if (_lastUpdated.TryGetValue(userId, out var lastUpdate) && now - lastUpdate < UpdateInterval)
            return;

        _lastUpdated[userId] = now;
        _ = userService.UpdateLastSeen(userId);
    }
}
