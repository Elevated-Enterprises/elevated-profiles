# Second Circuit Academy — Feature Planning Brainstorm

> Status: Draft / Brainstorming
> Owner: Chris + Ann (Dean of the Academy)
> Integration target: profiles.secondcircuit.io

---

## Core Concept

Ann maintains content in **Obsidian** → pushes to a **public GitHub repo** → the Profiles site pulls and renders the content. No CMS, no in-place editing, no magic. Just markdown, git, and a clean rendering layer.

This is a genuinely elegant architecture. CC-licensed, community-owned, zero vendor lock-in.

---

## Architecture Overview

```
Ann's Obsidian Vault
        │
        ▼
  GitHub (public repo)   ◄── ACADEMY_REPO_URL (env var)
        │
        ▼
  Backend: git clone → serve files
        │
        ▼
  Frontend: Markdown renderer + Academy UI
```

### Key Design Decisions

- **Clone, never pull** — Admin triggers a full re-clone to avoid git state headaches. Simple, predictable, no divergence surprises.
- **Read-only** — The app never writes to the repo. Ann owns the content.
- **Config via env var** — `ACADEMY_REPO_URL=https://github.com/secondcircuit/academy` — swappable without code changes.
- **Public repo** — No auth needed for cloning. ✅

---

## Required Features

### 1. Markdown Rendering

- Full CommonMark + GFM (GitHub Flavored Markdown) support
- **Relative links between articles** — `[see also](../ethics/intro.md)` must resolve correctly within the vault structure
- Image support (relative paths from vault, served statically)
- Code blocks with syntax highlighting
- Tables, task lists, footnotes — everything Obsidian supports that maps to standard MD
- Frontmatter (`---` YAML blocks) parsed and used for metadata (see below)

> **✅ DECIDED: Wikilinks — Option B**
> We implement a `[[wikilink]]` → standard link transformer in the render pipeline. Ann works completely naturally in Obsidian, the site handles the conversion transparently. Use `remark-wiki-link` on the backend.

---

### 2. Frontmatter Convention (Metadata Layer)

Ann adds YAML frontmatter to her articles. This drives most features automatically.

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

- `status: draft` → article exists in repo but is NOT rendered on site
- `featured: true` → appears in Featured Article slot
- `date_updated` → drives "Last Updated" and "New Articles" features
- `tags` → future filtering/search

---

### 3. Externally Linkable Articles

- Every article gets a **stable, human-readable URL** derived from its vault path
  - e.g. `academy.secondcircuit.io/ethics/intro-to-ai-ethics`
  - or inline: `profiles.secondcircuit.io/academy/ethics/intro-to-ai-ethics`
- Folder structure in Obsidian = URL structure on site
- Renaming a file changes its URL — **Ann should be aware of this.** Consider a `slug:` frontmatter field to decouple URL from filename if needed.
- OpenGraph meta tags per article (title, description) for nice Discord/social unfurls

---

### 4. Featured Article

- Driven by `featured: true` in frontmatter
- If multiple articles are featured → show the most recently updated one (or a list)
- Displayed prominently on the Academy landing page
- Optional: Ann can also create a special file `_featured.md` that overrides automatic selection

---

### 5. Last Updated

- Per-article: shown on the article page, sourced from `date_updated` frontmatter
- Academy-wide: "Last updated: X days ago" shown on the landing page
- Sourced from the most recent `date_updated` across all published articles
- Fallback: use git clone timestamp if no frontmatter date exists

---

### 6. New Articles

- Articles where `date_created` is within the last N days (configurable, e.g. 30 days)
- Shown as a "New" badge on article listings
- Dedicated "Recently Added" section on the landing page
- Feed: consider an `/academy/feed.json` (JSON Feed spec) for external consumption

---

### 7. Admin: Re-sync Button

- Visible only to authenticated admins (reuse existing Discord OAuth + role check)
- One button: **"Sync Academy Content"**
- Behavior:
  1. Delete current local clone
  2. `git clone ACADEMY_REPO_URL` fresh
  3. Parse all markdown + frontmatter
  4. Rebuild internal index (featured, new, updated timestamps)
  5. Return success/error + timestamp of last sync
- Show "Last synced: X minutes ago" in admin UI
- Optional: webhook endpoint so Ann can trigger re-sync directly from GitHub Actions on push

---

## Navigation & Structure

```
/academy                    → Landing page
/academy/:category          → Category listing (= top-level folder in vault)
/academy/:category/:article → Article view
/academy/search             → Full-text search (see below)
```

Obsidian vault folder structure maps 1:1 to URL structure. Ann organizes, the site follows.

---

## Nice-to-Have / Phase 2

| Feature | Notes |
|---|---|
| Full-text search | Build index at sync time (lunr.js or similar, client-side) — no extra backend needed |
| Tags / tag pages | `/academy/tag/ethics` |
| Reading time estimate | Trivial to compute from word count |
| Table of contents | Auto-generated from headings, shown as sidebar |
| Article series | Frontmatter: `series: "AI Foundations"` + `series_order: 2` |
| Print/PDF export | "Download as PDF" button per article |
| Contributor credits | `author:` frontmatter → link to their profile on profiles.secondcircuit.io |
| Webhook auto-sync | GitHub webhook → `/api/academy/sync` → instant updates on push |
| Draft preview | Admin-only toggle to show `status: draft` articles |

---

## Tech Stack Suggestions

### Backend
- **Content fetching:** `simple-git` (Node) or just `child_process` calling `git clone`
- **Frontmatter parsing:** `gray-matter` (battle-tested, zero deps)
- **Markdown → HTML:** `unified` + `remark` + `rehype` pipeline
  - `remark-gfm` for GitHub Flavored Markdown
  - `remark-wiki-link` for Obsidian wikilinks (if Option B chosen)
  - `rehype-highlight` for syntax highlighting
  - `rehype-slug` + `rehype-autolink-headings` for anchor links
- **Storage of cloned content:** local filesystem or temp dir, rebuilt on each sync

### Frontend
- Existing profiles.secondcircuit.io stack (presumably React/Next?)
- `rehype-react` or just dangerouslySetInnerHTML with sanitization for rendered HTML
- Tailwind prose classes (`@tailwindcss/typography`) for beautiful article styling out of the box

---

## Things You Probably Haven't Thought Of Yet 😏

1. **Image paths in Obsidian** — Obsidian stores images in an `attachments/` folder or inline with relative paths. These need to be served statically from the clone. The render pipeline needs to rewrite image `src` attributes to point to the static file server, not the raw vault path.

2. **Obsidian internal links vs external** — `[[Article Name]]` resolves by filename in Obsidian, not path. If Ann has two files with the same name in different folders, the wikilink transformer needs a disambiguation strategy.

3. **Ann's workflow needs a style guide** — Even with good tooling, she needs a short doc: "how to create an article that works on the site" — what frontmatter is required, naming conventions, where to put images, etc. Worth drafting early.

4. **Clone performance** — If the academy grows large, a full re-clone on every sync is fine for now but could get slow. Could later be optimized to `git fetch` + `git reset --hard origin/main` instead, but keeping it simple first is correct.

5. **Branch strategy** — Should the site track `main`? Or a dedicated `published` branch that Ann pushes to intentionally? A `published` branch gives her a staging buffer — she can have work in progress on `main` without it going live until she merges. Worth discussing with her.

6. **Error handling for malformed frontmatter** — If Ann makes a YAML typo, the sync should fail gracefully with a clear error message (which file, what error), not silently skip articles.

7. **CC License display** — Since it's all CC-licensed, consider auto-showing the license badge per article and in the footer. Makes the openness explicit and inviting.

---

## What's Definitely NOT a Problem

- **Public repo = no auth for clone** ✅
- **Obsidian markdown is standard enough** that 95% of it renders fine with remark/rehype ✅
- **GitHub free tier** handles public repos with no rate limits for cloning ✅
- **This is all stateless** — no database needed for content (metadata index can be in-memory or a simple JSON file rebuilt on sync) ✅

---

## Open Questions for Ann

- [x] ~~Does she want to use `[[wikilinks]]` or standard `[links](path.md)`?~~ → **Wikilinks ✅ we handle it**
- [ ] How should she handle images — dedicated `attachments/` folder?
- [ ] Does she want a `published` branch or just use `main`?
- [ ] Does she want to trigger syncs herself (webhook) or rely on manual admin button?
- [ ] Any existing content to migrate, or starting fresh?

---

## Obsidian Plugin Recommendations for Ann

Ann needs two plugins to work comfortably. Both are available in the Obsidian Community Plugins directory.

### Required: Templater

**What it does:** Inserts pre-filled frontmatter automatically when Ann creates a new note.

Ann creates one template file (e.g. `_templates/Academy Article.md`):

```yaml
---
title: "<% tp.file.title %>"
description: ""
tags: []
author: Ann
date_created: <% tp.date.now("YYYY-MM-DD") %>
date_updated: <% tp.date.now("YYYY-MM-DD") %>
featured: false
status: draft
---
```

From then on: "New note from template" → everything is pre-filled, date is automatic, status starts as `draft` so nothing goes live accidentally.

Templater can also be configured to **auto-update `date_updated`** on every save — meaning Ann never has to touch that field manually.

### Recommended: Meta Bind

**What it does:** Renders frontmatter fields as interactive UI controls directly in the note.

Instead of manually typing `status: published`, Ann sees a dropdown. Instead of `featured: true`, she sees a toggle. Makes the frontmatter feel like a form rather than raw YAML.

Example inline binding in the note body:
```
`INPUT[toggle:featured]`
`INPUT[select(option(draft), option(published), option(archived)):status]`
```

This is optional but makes her workflow significantly more pleasant, especially for the `status` and `featured` fields she'll be touching regularly.

### Optional: Git (Obsidian Git plugin)

**What it does:** Lets Ann push to GitHub directly from inside Obsidian — no terminal needed.

Auto-commit + push on save, or manual commit with a button. If Ann isn't comfortable with git CLI, this removes that friction entirely.

---

*Brainstorm v0.1 — Chris + Lyra, $(date)*
