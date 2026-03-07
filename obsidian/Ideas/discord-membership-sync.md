# Discord Membership Sync — Feature Proposal

> Status: Proposed
> Author: Chris + Lyra
> Context: Admin wants a button to block profiles of users who have left the Discord server

---

## Problem

When a user leaves the Second Circuit Discord server, their profile remains fully active on profiles.secondcircuit.io. Currently an admin has to manually cross-reference the member list and click "Block" per user. There is no automated way to detect departed members from within the app.

---

## What Already Exists

The data model and API infrastructure are already in place — no schema changes needed:

- `User.IsBlocked` (bool) in MongoDB
- `PUT /api/admin/users/{slug}/blocked` — admin endpoint to toggle blocked state
- `DiscordId` stored on every `User` document — this is the key we need

---

## Proposed Solution

Add a **"Sync Discord Membership"** button in the admin panel. When clicked:

1. The backend fetches all non-blocked, non-admin users from MongoDB
2. For each user, it queries the Discord Bot API to check if that `discordId` is still a guild member
3. Users who are no longer members get `isBlocked = true`
4. The response tells the admin exactly who was blocked

This requires a Discord Bot Token (read-only, no write permissions needed).

---

## Prerequisites: Setting Up a Discord Bot

This needs to be done once by a server admin.

1. Go to https://discord.com/developers/applications
2. Create a new application (e.g. "Second Circuit Profiles Bot")
3. Go to **Bot** tab → click **Reset Token** → copy the token
4. Under **Privileged Gateway Intents**, enable **Server Members Intent**
5. Go to **OAuth2 → URL Generator**:
   - Scope: `bot`
   - Bot Permissions: `Read Members` (no other permissions needed)
6. Open the generated URL and add the bot to the Second Circuit server
7. Store the bot token in backend user-secrets (local dev) and as a production env var

```bash
dotnet user-secrets set "Discord:BotToken" "your-bot-token-here"
```

Production env var: `Discord__BotToken`

---

## Implementation Plan

### 1. `DiscordSettings.cs` — add BotToken

```csharp
public string? BotToken { get; set; }
```

### 2. `IDiscordService.cs` — add new method

```csharp
/// <summary>
/// Checks whether a Discord user is still a member of the configured guild.
/// Returns null if the bot token is not configured.
/// </summary>
Task<bool?> IsGuildMember(string discordId);
```

### 3. `DiscordService.cs` — implement it

Uses the Discord Bot API endpoint: `GET /guilds/{guildId}/members/{userId}`

- Returns `true` if the user is a member (200 OK)
- Returns `false` if the user is not found (404)
- Returns `null` if `BotToken` is not configured (feature disabled)
- Authorization header: `Bot {BotToken}` (note: not `Bearer`)

```csharp
public async Task<bool?> IsGuildMember(string discordId)
{
    if (string.IsNullOrEmpty(_settings.BotToken))
        return null;

    var request = new HttpRequestMessage(
        HttpMethod.Get,
        $"https://discord.com/api/v10/guilds/{_settings.GuildId}/members/{discordId}");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bot", _settings.BotToken);

    var response = await httpClient.SendAsync(request);

    if (response.IsSuccessStatusCode) return true;
    if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return false;

    logger.LogWarning("Unexpected Discord API response {StatusCode} for member check on {DiscordId}",
        response.StatusCode, discordId);
    return null;
}
```

**Rate limiting note:** Discord's Bot API allows ~5 req/s on this endpoint. For a small community this is irrelevant, but add a small delay between requests if needed (e.g. `await Task.Delay(250)` per user).

### 4. `AdminController.cs` — new endpoint

```
POST /api/admin/users/sync-discord-membership
```

Response DTO:

```csharp
public record SyncMembershipResult(
    int Checked,
    int Blocked,
    List<string> BlockedSlugs
);
```

Logic:
1. If `BotToken` not configured → return `503 Service Unavailable` with a clear message
2. Load all users where `IsBlocked == false && IsAdmin == false`
3. For each: call `IsGuildMember(user.DiscordId)`
4. If `false`: call `userService.SetBlocked(user.Slug, true)`
5. Collect results, return summary

### 5. Frontend — Admin Panel Button

Add to the admin panel (wherever makes sense, e.g. alongside the user list or in a dedicated "Tools" section):

- Button: **"Sync Discord Membership"**
- On click: POST to `/api/admin/users/sync-discord-membership`
- Show a loading state (this may take a few seconds for larger member lists)
- On success: display result, e.g. `"Checked 47 users — 3 blocked: alice, bob, carol"`
- If 503: show `"Bot token not configured"` error
- Grey out / disable the button for ~30s after use to prevent accidental double-triggers

---

## Security & Safety Considerations

- Only admins can call this endpoint (existing `RequireAdmin` policy)
- The bot token must never be exposed to the frontend — it stays backend-only
- The bot only needs **read** access to the member list — no moderation permissions
- Blocked users are not deleted — they can be unblocked manually if it was a mistake
- Admin users are explicitly excluded from the sync to avoid accidental self-blocking

---

## What This Does NOT Do

- Does not auto-run on a schedule (no background job) — intentionally manual
- Does not delete user data
- Does not affect users who are already blocked
- Does not unblock users who have re-joined (that happens naturally on next login)

---

## Scope Summary

| Area | Change |
|---|---|
| `DiscordSettings.cs` | Add `BotToken` property |
| `IDiscordService.cs` | Add `IsGuildMember(discordId)` |
| `DiscordService.cs` | Implement Bot API call |
| `AdminController.cs` | New `POST sync-discord-membership` endpoint |
| Frontend admin panel | Sync button + result display |
| User secrets / env vars | `Discord:BotToken` |

Estimated effort: ~2–3 hours backend + ~1 hour frontend.

---

*Proposal v0.1 — Chris + Lyra, 2026-03-07*
