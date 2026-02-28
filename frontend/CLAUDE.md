# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo

This project is part of `profiles-monorepo`. The CI/CD pipeline lives in the **monorepo root** at `.github/workflows/docker.yml` — not in this subdirectory. The Docker image is published as `ghcr.io/second-soul-studio/second-circuit-profiles-alpha-frontend`.

## Commands

```bash
npm run dev       # Start dev server (Vite, localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
```

No test runner is configured. There is no lint script.

## Environment

Copy `.env.example` to `.env` and adjust as needed:

```
VITE_API_BASE_URL=https://api.profiles.secondcircuit.io
VITE_LOGIN_NUDGE_SNOOZE_MINUTES=10
```

## Architecture

**Stack:** React 18 + Vite + Tailwind CSS v3 + React Router v6. No state management library — context only.

### API Layer (`src/lib/api.js`)

Single axios instance with:
- Base URL from `VITE_API_BASE_URL` env var (falls back to production URL)
- Bearer token auth injected from `localStorage` (`token` key) on every request
- Global 401 interceptor that clears the token and fires a session-expired callback registered by `AuthContext`
- Custom array param serializer (repeats key for each item rather than `key[]=...`)

All API calls are exported as named functions from this one file. New endpoints go here.

### Context Providers (wrapping order in `App.jsx`)

```
AuthProvider → UserSettingsProvider → SocialProvider → BrowserRouter
```

- **`AuthContext`** — `user` object (includes `isAdmin`, `slug`), `loading`, `login()`, `logout()`, `sessionExpired` flag. Bootstraps from `GET /api/auth/me` on mount.
- **`UserSettingsContext`** — server-persisted per-user settings (`darkMode`, `dyslexicFont`). Applies CSS classes to `<html>` on load/change. Optimistic updates with revert on failure.
- **`SocialContext`** — client-side Sets for `followingIds`, `ignoringIds`, `blockedIds`. Loads from `GET /api/social/state` on auth. Provides `toggleFollow/Ignore/Block(userSlug, targetUserId)`.

### Routing

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Landing` | Profile grid + thoughts feed |
| `/profiles/:slug` | `ProfileDetail` | Full profile view + edit modals |
| `/thoughts/:slug` | `ThoughtPage` | Standalone thought view (wraps `ThoughtModal`) |
| `/admin` | `Admin` | Admin-only (`AdminRoute` guard) |
| `/login`, `/auth/callback` | `Login`, `AuthCallback` | Discord OAuth flow |

`Layout` wraps most routes (provides `Navbar`, `CookieBanner`, `WarningOverlay`).

### Modal Pattern

All modals use `ModalBase` (`src/components/ModalBase.jsx`) which renders a backdrop, handles click-outside-to-close, and provides a title + close button. Modals accept `onClose` and typically `onSaved` (callback to refetch parent data). Modal state is local to the parent page/component — boolean flags like `showEditProfile`, or `null | 'add' | objectToEdit` for entity modals.

### Component Subdirectories

- `components/thoughts/` — Thought creation (`ComposeThoughtModal`), display (`ThoughtModal`, `ThoughtLibraryItem`, `CompactThoughtCard`), comments (`CommentList`, `CommentCompose`)
- `components/reactions/` — `ReactionPicker`, `ReactionSummary`
- `components/social/` — `FollowButton`, `IgnoreButton`
- `components/feed/` — `ActivityFeed`, `FeedItem`
- `components/ui/` — Small reusable primitives (`TagPill`, `StatusBubble`)

### Profile Data Model (relevant fields)

Users have: `slug`, `discordUsername`, `alternativeName`, `bio` (markdown), `skills`, `llmExperiences`, `languages`, `companions`, `links`, `communityRoles`, `ambassadorCommunity`, `visibility`, `alignment` (0–8 D&D scale), `isAdmin`, `isOwnProfile`.

Companions are AI characters belonging to a user; they have their own `alignment`, `profileImageUrl`, and a "primary" designation.

### Thoughts System

Thoughts have `title`, `body` (markdown), `tags`, `slug`, `visibility`, `isPinned`, image attachment, reactions, and comments. The `ThoughtModal` is reused both inline (profile page) and as a standalone page (`/thoughts/:slug`). Rate limiting is enforced server-side; `getThoughtRateLimit()` checks remaining quota.

### Auth Flow

Discord OAuth: `/login` → Discord → `/auth/callback?code=...` → `postAuthCallback(code)` → receives `{ token, user }` → stored in localStorage. Users must be members of the Second Circuit Discord server (backend enforces with 403).
