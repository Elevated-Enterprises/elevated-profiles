using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Hubs;

[Authorize]
public class PigHub(IPigService pigService, ILogger<PigHub> logger) : Hub
{
    private string UserId =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("No user ID in token.");

    private string Username =>
        Context.User?.FindFirstValue("discord_username") ?? "Unknown";

    private string? UserSlug =>
        Context.User?.FindFirstValue("slug");

    private string? GameSlug =>
        Context.GetHttpContext()?.Request.Query["gameSlug"].ToString() is { Length: > 0 } s ? s : null;

    private bool IsListMode =>
        Context.GetHttpContext()?.Request.Query["mode"].ToString() == "list";

    public override async Task OnConnectedAsync()
    {
        var slug = GameSlug;
        var isListMode = IsListMode;

        if (!isListMode && string.IsNullOrEmpty(slug))
        {
            Context.Abort();
            return;
        }

        try
        {
            if (isListMode)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "pig-list");
            }
            else
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"pig-{slug}");
            }

            var (state, error) = await pigService.HandleConnectionAsync(
                slug!, UserId, Username, UserSlug, null, Context.ConnectionId, isListMode);

            if (error != null)
            {
                await Clients.Caller.SendAsync("Error", error);
                Context.Abort();
                return;
            }

            if (state != null)
                await Clients.Caller.SendAsync("GameState", state);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in PigHub.OnConnectedAsync for user {UserId}", UserId);
            Context.Abort();
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        try
        {
            await pigService.HandleDisconnectionAsync(GameSlug, UserId, Context.ConnectionId, IsListMode);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in PigHub.OnDisconnectedAsync for user {UserId}", UserId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task Roll()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.RollAsync(slug, UserId);
    }

    public async Task Hold()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.HoldAsync(slug, UserId);
    }

    public async Task StartGame()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.StartGameAsync(slug, UserId);
    }

    public async Task CancelGame()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.CancelGameAsync(slug, UserId);
    }

    public async Task KickPlayer(string targetUserId)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.KickPlayerAsync(slug, UserId, targetUserId);
    }

    public async Task LeaveGame()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.LeaveGameAsync(slug, UserId, Context.ConnectionId);
    }

    public async Task InitiatePlayAgain()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.InitiatePlayAgainAsync(slug, UserId);
    }

    public async Task PlayAgainVote(bool vote)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await pigService.PlayAgainVoteAsync(slug, UserId, vote);
    }

    public async Task SendChat(string text)
    {
        var slug = GameSlug;
        if (slug is null) return;

        var participant = await GetParticipantRoleAsync(slug);
        await pigService.SendChatAsync(slug, UserId, Username, participant, text);
    }

    private Task<string> GetParticipantRoleAsync(string slug)
    {
        // Role determination is in the service's in-memory state; we can pass "player" as default —
        // the service doesn't use this for access control, only for display in chat.
        return Task.FromResult("player");
    }
}
