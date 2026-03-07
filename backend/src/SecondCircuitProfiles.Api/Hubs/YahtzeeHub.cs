using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Hubs;

[Authorize]
public class YahtzeeHub(IYahtzeeService yahtzeeService, ILogger<YahtzeeHub> logger) : Hub
{
    private string UserId =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("No user ID in token.");

    private string Username =>
        Context.User?.FindFirstValue("discord_username") ?? "Unknown";

    private string? AlternativeName =>
        Context.User?.FindFirstValue("alternative_name");

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
                await Groups.AddToGroupAsync(Context.ConnectionId, "yahtzee-list");
            else
                await Groups.AddToGroupAsync(Context.ConnectionId, $"yahtzee-{slug}");

            var (state, error) = await yahtzeeService.HandleConnectionAsync(
                slug, UserId, Username, AlternativeName, UserSlug, null, Context.ConnectionId, isListMode);

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
            logger.LogError(ex, "Error in YahtzeeHub.OnConnectedAsync for user {UserId}", UserId);
            Context.Abort();
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        try
        {
            await yahtzeeService.HandleDisconnectionAsync(GameSlug, UserId, Context.ConnectionId, IsListMode);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in YahtzeeHub.OnDisconnectedAsync for user {UserId}", UserId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task StartGame()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.StartGameAsync(slug, UserId);
    }

    public async Task CancelGame()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.CancelGameAsync(slug, UserId);
    }

    public async Task RollDice()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.RollDiceAsync(slug, UserId);
    }

    public async Task ToggleHold(int diceIndex)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.ToggleHoldAsync(slug, UserId, diceIndex);
    }

    public async Task SelectScore(string category)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.SelectScoreAsync(slug, UserId, category);
    }

    public async Task VotePlayAgain(bool vote)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.VotePlayAgainAsync(slug, UserId, vote);
    }

    public async Task InitiatePlayAgain()
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.InitiatePlayAgainAsync(slug, UserId);
    }

    public async Task SetRandomiseTurnOrder(bool value)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.SetRandomiseTurnOrderAsync(slug, UserId, value);
    }

    public async Task SendChat(string text)
    {
        var slug = GameSlug;
        if (slug is null) return;
        await yahtzeeService.SendChatAsync(slug, UserId, Username, text);
    }
}
