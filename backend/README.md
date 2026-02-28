# second-circuit-profiles-backend

C# backend for profiles.secondcircuit.io

## Requirements

- .NET 10.0 SDK
- MongoDB

## Local Development

```bash
# API (http://localhost:5246)
dotnet run --project src/SecondCircuitProfiles.Api

# Test Client (http://localhost:5247)
dotnet run --project src/SecondCircuitProfiles.TestClient
```

Configure secrets for local dev:

```bash
cd src/SecondCircuitProfiles.Api
dotnet user-secrets set "Discord:ClientSecret" "your-secret"
dotnet user-secrets set "Jwt:Secret" "mindestens-32-zeichen-langer-key-hier"
```

## Docker Compose

```yaml
services:
  api:
    build:
      context: .
      dockerfile: src/SecondCircuitProfiles.Api/Dockerfile
    ports:
      - "8080:8080"
    volumes:
      - uploads:/app/uploads
    environment:
      - MongoDB__ConnectionString=mongodb://mongo:27017
      - MongoDB__DatabaseName=second_circuit_profiles
      - Discord__ClientId=${DISCORD_CLIENT_ID}
      - Discord__ClientSecret=${DISCORD_CLIENT_SECRET}
      - Discord__GuildId=${DISCORD_GUILD_ID}
      - Discord__RedirectUri=${DISCORD_REDIRECT_URI}
      - Jwt__Secret=${JWT_SECRET}
      - Jwt__Issuer=SecondCircuitProfiles
      - Jwt__Audience=SecondCircuitProfiles
      - Cors__AllowedOrigins__0=${CORS_ORIGIN:-http://localhost:3000}
      - Upload__Path=/app/uploads
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  uploads:
  mongo-data:
```

Create a `.env` file in the project root:

```env
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_GUILD_ID=your-guild-id
DISCORD_REDIRECT_URI=https://profiles.secondcircuit.io/callback
JWT_SECRET=mindestens-32-zeichen-langer-key-hier
CORS_ORIGIN=https://profiles.secondcircuit.io
```

Then run:

```bash
docker compose up -d
```

## JoinedAt Migration

On startup, the API automatically sets `joinedAt = 2026-02-20` for any existing user document that has `joinedAt == null`. This was the date the `joinedAt` field was introduced.

**Once all users in production have been migrated** (i.e. after the first successful startup post-deployment), the migration block in `Program.cs` (marked with `// TODO: Remove this block`) can be safely removed to avoid the unnecessary DB query on every restart.

---

## Development Helpers

### Disable CORS (for frontend development)

Set `DISABLE_CORS=true` to allow requests from any origin:

```bash
DISABLE_CORS=true dotnet run --project src/SecondCircuitProfiles.Api
```

Or in Docker: `-e DISABLE_CORS=true`

### Override Discord Redirect URI

For frontend developers using a different callback URL, there are three options (in order of priority):

1. **Query parameter**: `GET /api/auth/config?redirectUri=http://localhost:3000/callback`
2. **Environment variable**: `Discord__RedirectUriOverride=http://localhost:3000/callback`
3. **Default config**: `Discord__RedirectUri`

Note: The override URL must still be registered in the Discord Developer Portal under OAuth2 -> Redirects.

## API Endpoints

### Auth
- `GET /api/auth/config?redirectUri=` - Discord OAuth config (client ID, auth URL). Optional `redirectUri` query param to override callback URL.
- `POST /api/auth/callback` - Exchange Discord code for JWT
- `GET /api/auth/me` - Current user info (requires auth)

### Users
- `GET /api/users?seed=&page=&pageSize=&search=` - Paginated user list (randomized by seed)
- `GET /api/users/{slug}` - User profile with companions
- `PUT /api/users/{slug}` - Update profile (own or admin)
- `POST /api/users/{slug}/image` - Upload profile image
- `DELETE /api/users/{slug}/image` - Delete profile image

### Companions
- `GET /api/users/{slug}/companions` - List companions
- `POST /api/users/{slug}/companions` - Create companion
- `GET /api/users/{slug}/companions/{id}` - Get companion
- `PUT /api/users/{slug}/companions/{id}` - Update companion
- `DELETE /api/users/{slug}/companions/{id}` - Delete companion
- `POST /api/users/{slug}/companions/{id}/image` - Upload companion image
- `DELETE /api/users/{slug}/companions/{id}/image` - Delete companion image

### Images
- `GET /api/images/{filename}` - Serve uploaded image

### Admin
- `GET /api/admin/audit?page=&pageSize=` - Audit log (admin only)

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MongoDB__ConnectionString` | MongoDB connection string | `mongodb://localhost:27017` |
| `MongoDB__DatabaseName` | Database name | `second_circuit_profiles` |
| `Discord__ClientId` | Discord OAuth2 application client ID | |
| `Discord__ClientSecret` | Discord OAuth2 client secret | |
| `Discord__GuildId` | Discord server ID | |
| `Discord__RedirectUri` | OAuth2 redirect URI | |
| `Discord__RedirectUriOverride` | Override redirect URI (for dev) | |
| `DISABLE_CORS` | Set to `true` to allow all origins | `false` |
| `Jwt__Secret` | JWT signing key (min 32 chars) | |
| `Jwt__Issuer` | JWT issuer | `SecondCircuitProfiles` |
| `Jwt__Audience` | JWT audience | `SecondCircuitProfiles` |
| `Jwt__ExpirationMinutes` | JWT token lifetime | `1440` |
| `Upload__Path` | Image upload directory | `./uploads` |
| `Upload__MaxFileSizeBytes` | Max image file size | `5242880` (5MB) |
| `Cors__AllowedOrigins__0` | Allowed CORS origin | `http://localhost:3000` |
