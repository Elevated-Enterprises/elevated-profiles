# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo

This project is part of `profiles-monorepo`. The CI/CD pipeline lives in the **monorepo root** at `.github/workflows/docker.yml` — not in this subdirectory. The Docker image is published as `ghcr.io/second-soul-studio/second-circuit-profiles-backend`.

## Commands

```bash
# Run the API (http://localhost:5246)
dotnet run --project src/SecondCircuitProfiles.Api

# Run tests
dotnet test

# Run a single test class
dotnet test --filter "ClassName=ModelTests"

# Build
dotnet build

# Run test client (http://localhost:5247)
dotnet run --project src/SecondCircuitProfiles.TestClient
```

### Local Secrets (required for Discord OAuth and JWT)

```bash
cd src/SecondCircuitProfiles.Api
dotnet user-secrets set "Discord:ClientSecret" "your-secret"
dotnet user-secrets set "Jwt:Secret" "mindestens-32-zeichen-langer-key-hier"
```

### Dev Helpers

```bash
# Disable CORS for frontend development
DISABLE_CORS=true dotnet run --project src/SecondCircuitProfiles.Api
```

Discord redirect URI can be overridden via query param `GET /api/auth/config?redirectUri=...`, env var `Discord__RedirectUriOverride`, or the default config `Discord__RedirectUri`.

## Architecture

**ASP.NET Core 10 REST API** backed by MongoDB. The app is at `src/SecondCircuitProfiles.Api/`.

### Layer Structure

- **Controllers** → thin route handlers, delegate to services
- **Services** → all business logic; registered as singletons in `Program.cs`
- **Models** → MongoDB document models
- **DTOs** → request/response shapes (separate from models)
- **Configuration** → settings classes for MongoDB, Discord, JWT, CORS, Upload

### Authentication

Discord OAuth2 flow → JWT Bearer tokens. Token includes `userId` and `isAdmin` claims. Authorization is enforced via:
- `[Authorize]` attribute for authenticated endpoints
- `[Authorize(Policy = "RequireAdmin")]` for admin-only endpoints
- Manual ownership checks in controllers (`userId == resource.UserId || isAdmin`)

### MongoDB

- Default: `mongodb://localhost:27017`, database `second_circuit_profiles`
- `MongoDbContext` holds all collection references and creates indexes at startup
- Startup migrations run in `Program.cs` (backfill `joinedAt`, `profileUpdatedAt`, thought slugs)
- Production overrides via `MongoDB__ConnectionString` / `MongoDB__DatabaseName` env vars

### Key Domain Concepts

- **Users** — profile with slug, avatar, bio, skills, LLM providers
- **Companions** — characters/AI assistants belonging to a user
- **Thoughts** — posts with visibility controls (Public/Followers/Private), slugs, pinning
- **Social** — follow/block relationships via `social_edges` collection
- **Feed** — timeline of thoughts from followed users
- **Reactions/Comments** — interactions on Thoughts

### Tests

MSTest framework at `tests/SecondCircuitProfiles.Api.Tests/`. Currently covers model default values and enum mappings. Test project references the API project directly.

### Image Uploads

Images served at `GET /api/images/{filename}`, stored at `Upload__Path` (default `./uploads`). Max 5MB, controlled via `Upload__MaxFileSizeBytes`.

### CI/CD

GitHub Actions at `../.github/workflows/docker.yml` (monorepo root) builds and publishes a Docker image. The Dockerfile used is `backend/Dockerfile` (repo root of this subdirectory, not the one inside `src/`).
