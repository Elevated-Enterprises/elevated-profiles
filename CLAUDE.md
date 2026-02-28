# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

Monorepo for [profiles.secondcircuit.io](https://profiles.secondcircuit.io) — two independent projects:

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | React 18 + Vite + Tailwind CSS v3 | SPA frontend |
| `backend/` | ASP.NET Core 10 + MongoDB | REST API backend |

Each subdirectory has its own `CLAUDE.md` with detailed architecture notes. Read it before working in that project.

## CI/CD

Single workflow at `.github/workflows/docker.yml` builds both projects in parallel on every push to `main`. Images are published to GHCR with `latest` + `sha` + semver tags:

- `ghcr.io/second-soul-studio/second-circuit-profiles-alpha-frontend`
- `ghcr.io/second-soul-studio/second-circuit-profiles-backend`

Docker build contexts are the subdirectory roots. The backend uses `backend/Dockerfile` (not the one inside `src/`).

## Local Development

**Frontend** (`frontend/`):
```bash
npm run dev      # localhost:5173
npm run build
```
Needs `.env` (copy from `.env.example`) with `VITE_API_BASE_URL`.

**Backend** (`backend/`):
```bash
dotnet run --project src/SecondCircuitProfiles.Api   # localhost:5246
dotnet test
dotnet test --filter "ClassName=ModelTests"
DISABLE_CORS=true dotnet run --project src/SecondCircuitProfiles.Api  # dev with frontend
```
Needs user-secrets for `Discord:ClientSecret` and `Jwt:Secret` (min 32 chars).

MongoDB defaults to `mongodb://localhost:27017`, database `second_circuit_profiles`.

## How the Two Projects Connect

The frontend talks to the backend exclusively via `VITE_API_BASE_URL`. Auth is Discord OAuth2 → JWT stored in `localStorage`. The backend enforces Discord server membership (403 if not a member of the Second Circuit server).
