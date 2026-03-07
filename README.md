# Community Profiles Platform

A self-hosted community profiles platform built for AI-adjacent communities. Members log in with Discord, build a profile showcasing their skills, AI companions, and experience, and engage with each other through a social feed, thoughts (posts), reactions, and comments.

Built by [Second Circuit](https://secondcircuit.io) and released under the **GPL-3.0 licence** — fork it, adapt it, make it yours.

---

## What's included

- **Discord OAuth login** — membership in your Discord server is required to sign up
- **User profiles** — bio, skills, LLM experience, language, links, alignment (yes, D&D-style), companions
- **Thoughts** — posts with markdown, tags, visibility controls, reactions, and comments
- **Social graph** — follow, ignore, block
- **Activity feed** — timeline of thoughts from followed users
- **Application forms** — structured onboarding with admin review workflow
- **Academy** — render a community knowledge base from an Obsidian vault hosted on GitHub
- **Admin panel** — user management, application review, content sync
- **Full Docker deployment** — frontend (nginx), backend (ASP.NET Core 10), MongoDB

---

## Fork & deploy guide

> This guide assumes you are using **Claude Code** to work with the codebase. It knows the architecture and will answer questions, implement features, and help you adapt the platform to your community.

### 1. Prerequisites

- A **Discord application** with OAuth2 configured ([discord.com/developers](https://discord.com/developers/applications))
- A server (VPS, cloud VM, etc.) with **Docker** and **Docker Compose** installed
- A domain name pointing to your server
- (Optional) A public GitHub repository for your Academy content

### 2. Fork the repository

Fork this repo on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_ORG/YOUR_FORK.git
cd YOUR_FORK
```

### 3. Configure GitHub Actions repository variables

The frontend image is built with your API URL baked in at compile time. Before your first push, set these in your fork's GitHub repository settings under **Settings → Secrets and variables → Actions → Variables**:

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `https://api.profiles.yourcommunity.io` | URL of your backend API |
| `VITE_LOGIN_NUDGE_SNOOZE_MINUTES` | `10` | Minutes before re-showing the login prompt (optional, defaults to 10) |

Once set, push to `main` — GitHub Actions will build and publish both Docker images to your GitHub Container Registry automatically.

### 4. Configure your Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and create (or open) your application.
2. Under **OAuth2**, add a redirect URI: `https://profiles.yourcommunity.io/auth/callback`
3. Note your **Client ID** and generate a **Client Secret**.
4. Enable the **Server Members Intent** under **Bot** (required for guild membership checks).
5. Find your Discord server's **Guild ID**: right-click your server in Discord → Copy Server ID (requires Developer Mode to be enabled).

### 5. Prepare your server

Copy the environment file template and fill in your values:

```bash
cp .env.example .env
nano .env   # or your editor of choice
```

| Variable | Description |
|----------|-------------|
| `DISCORD_CLIENT_ID` | Your Discord application's Client ID |
| `DISCORD_CLIENT_SECRET` | Your Discord application's Client Secret |
| `DISCORD_REDIRECT_URI` | Full callback URL, e.g. `https://profiles.yourcommunity.io/auth/callback` |
| `DISCORD_GUILD_ID` | Your Discord server's ID — only members can log in |
| `JWT_SECRET` | Random string, minimum 32 characters — keep this secret and stable |
| `ACADEMY_REPO_URL` | URL of your public Academy GitHub repo (optional) |

### 6. Update compose.yml with your image names

Open `compose.yml` and replace the placeholder image names with your actual GHCR image paths:

```yaml
frontend:
  image: ghcr.io/YOUR_ORG/YOUR_FORK-frontend:latest

backend:
  image: ghcr.io/YOUR_ORG/YOUR_FORK-backend:latest
```

Match these to what GitHub Actions publishes (check the Actions tab after your first push).

### 7. Deploy

```bash
docker compose pull
docker compose up -d
```

The backend exposes port `8080`, the frontend port `80`. Put a reverse proxy (nginx, Caddy, Traefik) in front to handle TLS and route traffic.

**Minimal Caddy example:**

```
profiles.yourcommunity.io {
    reverse_proxy frontend:80
}

api.profiles.yourcommunity.io {
    reverse_proxy backend:8080
}
```

---

## Academy setup

The Academy is a community knowledge base rendered from a public GitHub repository containing an **Obsidian vault**. Content is authored in Obsidian, pushed to GitHub, and synced to the platform via an admin button.

### Architecture

```
Author's Obsidian Vault
        │
        ▼ (git push)
  Public GitHub repo   ◄── ACADEMY_REPO_URL
        │
        ▼ (admin sync)
  Backend clones repo
        │
        ▼
  Frontend renders markdown
```

### Setting up the content repository

Create a **public** GitHub repository for your Academy content. The repository should be an Obsidian vault. Folder structure maps directly to URL structure on the site.

Every article that should appear on the site needs YAML frontmatter:

```yaml
---
title: "Introduction to AI Ethics"
description: "A foundational overview of ethical frameworks in AI."
tags: [ethics, foundations, beginner]
author: Your Name
date_created: 2025-01-15
date_updated: 2025-03-01
featured: false
status: published   # draft | published | archived
---
```

- `status: draft` — article exists in the repo but is not shown on the site
- `status: published` — visible to all
- `featured: true` — highlighted on the Academy landing page
- `date_created` / `date_updated` — drives "new articles" badges and "last updated" display

### Recommended Obsidian plugins for content authors

**Templater** (required) — automatically inserts pre-filled frontmatter when creating a new note. Create a template file (e.g. `_templates/Academy Article.md`):

```yaml
---
title: "<% tp.file.title %>"
description: ""
tags: []
author: Your Name
date_created: <% tp.date.now("YYYY-MM-DD") %>
date_updated: <% tp.date.now("YYYY-MM-DD") %>
featured: false
status: draft
---
```

Templater can also auto-update `date_updated` on every save — meaning authors never have to touch it manually.

**Meta Bind** (recommended) — renders frontmatter fields as interactive UI controls (dropdowns, toggles) directly in the note. Makes managing `status` and `featured` much more pleasant.

**Obsidian Git** (optional) — lets authors push to GitHub directly from inside Obsidian without needing a terminal.

### Syncing content

Once `ACADEMY_REPO_URL` is set in your environment, an admin can trigger a sync from the admin panel. This performs a fresh clone of the repository and rebuilds the content index.

---

## Local development

### Frontend

```bash
cd frontend
cp .env.example .env     # set VITE_API_BASE_URL=http://localhost:5246
npm install
npm run dev              # http://localhost:5173
```

### Backend

```bash
cd backend

# Set required secrets
cd src/SecondCircuitProfiles.Api
dotnet user-secrets set "Discord:ClientSecret" "your-secret"
dotnet user-secrets set "Jwt:Secret" "at-least-32-characters-long-key"
cd ../..

# Run (DISABLE_CORS allows the frontend dev server to connect)
DISABLE_CORS=true dotnet run --project src/SecondCircuitProfiles.Api
# → http://localhost:5246

# Tests
dotnet test
```

MongoDB defaults to `mongodb://localhost:27017`, database `second_circuit_profiles`. Override with `MongoDB__ConnectionString` and `MongoDB__DatabaseName` environment variables.

---

## Adapting the platform to your community

A few things you will almost certainly want to change:

- **Branding** — colours, logo, site name: edit `frontend/src/` components and Tailwind config
- **Profile fields** — what skills, tags, or roles are relevant to your community: update the backend models and frontend forms
- **Discord server enforcement** — the backend checks guild membership on every login; your `DISCORD_GUILD_ID` controls which server
- **Admin users** — the first admin must be set directly in MongoDB (`isAdmin: true` on the user document); subsequent admins can be promoted via the admin panel

Claude Code understands the full codebase. Ask it to make changes and it will find the right files.

---

## Licence

GPL-3.0 — see [LICENSE](LICENSE).
