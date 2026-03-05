# Second Circuit Academy — Design Document

> Status: Approved
> Date: 2026-03-05
> Authors: Chris + Claude
> Based on brainstorm: `obsidian/Ideas/academy-brainstorming.md`

---

## Overview

The Second Circuit Academy is a knowledge-base section of `profiles.secondcircuit.io`, accessible at `/academy`. Ann (Dean of the Academy) authors content in Obsidian, pushes it to a public GitHub repository, and admins trigger a sync that makes it live on the site.

---

## Architecture

```
Ann's Obsidian Vault
        |
        v
  GitHub (public repo, main branch)   <- ACADEMY_REPO_URL env var
        |
        v
  Backend: git clone -> parse frontmatter -> serve raw markdown + images
        |
        v
  Frontend: remark/rehype pipeline -> DOMPurify -> rendered article UI
```

### Key Design Decisions

- **C# backend handles**: git cloning, frontmatter parsing, index building, raw file serving
- **React frontend handles**: markdown rendering (remark/rehype pipeline)
- **Branch**: `main` — whatever Ann pushes to main is what the site shows
- **Sync**: manual admin button only (Phase 1); no webhook
- **Content index**: in-memory, rebuilt on every sync — no MongoDB for content
- **Read-only**: the app never writes to the repo; Ann owns all content

---

## Backend Design (ASP.NET Core 10)

### New Files

- `Controllers/AcademyController.cs`
- `Services/AcademyService.cs`
- `Models/AcademyModels.cs` (DTOs + index models)

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/academy/sync` | Admin | Re-clone repo, rebuild index |
| `GET` | `/api/academy/index` | Public | Full article index (categories, featured, recent) |
| `GET` | `/api/academy/article` | Public | `?path=ethics/intro` -> raw markdown + metadata |
| `GET` | `/api/academy/images/*` | Public | Static file serving from clone |

### Sync Flow

1. Delete existing clone directory (if present)
2. `git clone {ACADEMY_REPO_URL} {clonePath}` via `Process.Start`
3. Recursively find all `.md` files
4. Parse YAML frontmatter with **YamlDotNet**
5. Filter: only `status: published` articles included in index
6. Build in-memory index: categories, featured article, recently added
7. Return sync result (success/error, timestamp, article count)

### Frontmatter Schema

```yaml
---
title: "Introduction to AI Ethics"
description: "A foundational overview of ethical frameworks in AI."
tags: [ethics, foundations, beginner]
author: Ann
date_created: 2025-01-15
date_updated: 2025-03-01
featured: true
status: published   # draft | published | archived
---
```

- `status: draft` -> excluded from index (not visible on site)
- `featured: true` -> appears in the Featured Article slot (most recently updated wins if multiple)
- `date_created` within last 30 days -> "New" badge in listings

### Configuration

```
Academy__RepoUrl     (required) — e.g. https://github.com/secondcircuit/academy
Academy__ClonePath   (optional) — default: ./academy-content
```

### Error Handling

- Malformed frontmatter: log which file failed, skip the article, sync continues
- Clone failure: return error with git output, preserve previous clone if present
- Missing `status` field: treat as `draft` (safe default, nothing goes live accidentally)

---

## Frontend Design (React 18 + Vite + Tailwind CSS v3)

### New Routes

```
/academy                         -> AcademyLanding
/academy/:category               -> AcademyCategory
/academy/:category/:article      -> AcademyArticle
```

Added to `App.jsx` inside the existing `Layout` wrapper.

### New Dependencies

```
remark
remark-parse
remark-gfm
remark-wiki-link
remark-rehype
rehype-highlight
rehype-slug
rehype-stringify
dompurify
@tailwindcss/typography
```

### Markdown Rendering Pipeline

```
raw markdown string
  -> remark-parse
  -> remark-gfm          (tables, task lists, strikethrough, etc.)
  -> remark-wiki-link    ([[wikilinks]] -> /academy/path URLs)
  -> remark-rehype
  -> rehype-highlight    (syntax highlighting via highlight.js)
  -> rehype-slug         (heading anchor IDs)
  -> rehype-stringify
  -> HTML string
  -> DOMPurify.sanitize(html)   (XSS prevention)
  -> <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} className="prose ..." />
```

Note on sanitisation: content comes from Ann's controlled GitHub repo, not from user input.
DOMPurify is applied as a defence-in-depth measure. The `prose` plugin tags (highlight.js classes,
heading anchors) must be whitelisted in the DOMPurify config.

Image `src` rewriting: a custom remark plugin transforms relative image paths to
`{VITE_API_BASE_URL}/api/academy/images/{path}` so images served from the clone load correctly.

Styling: `@tailwindcss/typography` `prose` classes provide beautiful article typography with no custom CSS.

### New Components

- `src/components/academy/AcademyLanding.jsx` — landing page
- `src/components/academy/AcademyCategory.jsx` — category article listing
- `src/components/academy/AcademyArticle.jsx` — single article renderer
- `src/components/academy/MarkdownRenderer.jsx` — reusable remark/rehype pipeline
- `src/lib/academy.js` — API calls (`getAcademyIndex`, `getArticle`, `syncAcademy`)

### UI Layout

**`/academy` Landing:**
```
Featured Article (prominent card)
  Title, description, [Read ->] link

Recently Added (list)       |  Categories (grid)
  * Article A [New]         |  [Ethics] (12 articles)
  * Article B               |  [AI Foundations] (8 articles)
```

**`/academy/:category` Category:**
```
<- Back to Academy
# Category Name

Article listing with: title, description, tags, date, [New] badge
```

**`/academy/:category/:article` Article:**
```
<- Category Name
# Article Title
by Ann — 15 January 2025

[Rendered markdown with prose styling]

Tags: [ethics] [beginner]
```

**`/admin` addition:**
```
Academy
  Last synced: 2 hours ago  (or "Never")
  [Sync Academy Content]    (spinner + disable during sync)
```

---

## URL Structure

Obsidian vault folder structure maps 1:1 to URLs:
- Folder `ethics/` -> `/academy/ethics`
- File `ethics/intro-to-ai-ethics.md` -> `/academy/ethics/intro-to-ai-ethics`

Ann should be aware: renaming a file changes its URL. A `slug:` frontmatter field can be added later to decouple filename from URL (Phase 2).

---

## Out of Scope (Phase 1)

- Full-text search
- Tag pages (`/academy/tag/:tag`)
- Webhook auto-sync
- Reading time estimate
- Table of contents sidebar
- Article series support
- PDF export
- Draft preview toggle for admins
- OpenGraph meta tags per article

---

## Open Questions for Ann

- How should she handle images — dedicated `attachments/` folder at vault root?
- Any existing content to migrate, or starting fresh?

---

## Recommended Obsidian Setup for Ann

See `obsidian/Ideas/academy-brainstorming.md` -> "Obsidian Plugin Recommendations" section.
Summary: **Templater** (auto frontmatter), **Meta Bind** (UI controls for status/featured), **Obsidian Git** (push from within Obsidian).
