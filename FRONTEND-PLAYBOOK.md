# Frontend Playbook — Second Circuit Profiles

> Derived from `FRONTEND-ANALYSIS.md`. Each item is self-contained and can be worked independently unless noted. Items within a phase are ordered by impact, not mandatory sequence.

---

## Phase 1 — High Impact (do these first)

---

### PB-01: Unify the design system — stone palette everywhere

**Problem:** The Thoughts/Feed world uses `gray-*` with a hardcoded dark background. The dark mode toggle has no effect on it.

**Goal:** Every component in the app uses the `stone-*` palette and respects `dark:*` classes, or uses semantic CSS variables that switch automatically.

**Scope:**
- `src/components/thoughts/ThoughtModal.jsx`
- `src/components/thoughts/CompactThoughtCard.jsx`
- `src/components/thoughts/CommentCompose.jsx`
- `src/components/thoughts/CommentList.jsx`
- `src/components/feed/ActivityFeed.jsx`
- `src/components/feed/FeedItem.jsx`

**Migration map:**

| Old (gray, always dark) | New (stone, mode-aware) |
|---|---|
| `bg-gray-950` | `bg-white dark:bg-stone-950` |
| `bg-gray-900` | `bg-stone-50 dark:bg-stone-900` |
| `border-gray-800` | `border-stone-200 dark:border-stone-700` |
| `text-gray-300` | `text-stone-700 dark:text-stone-300` |
| `text-gray-400` | `text-stone-500 dark:text-stone-400` |
| `text-gray-500` | `text-stone-400 dark:text-stone-500` |
| `text-gray-600` | `text-stone-400 dark:text-stone-500` |
| `bg-gray-800` | `bg-stone-100 dark:bg-stone-800` |
| `bg-gray-700` | `bg-stone-200 dark:bg-stone-700` |
| `text-yellow-400` / `text-yellow-600` | `text-amber-500 dark:text-amber-400` |
| `hover:text-yellow-400` | `hover:text-amber-500 dark:hover:text-amber-400` |
| `focus:border-yellow-600` | `focus:ring-2 focus:ring-amber-300` |

**Also fix:** `WarningOverlay.jsx` — add `dark:bg-stone-800 dark:border-stone-600 dark:text-stone-100` equivalents to replace the hardcoded amber-50 shell.

**Acceptance criteria:**
- Toggle dark mode while a Thought modal is open — the modal switches correctly
- Toggle dark mode while the Landing Feed tab is visible — feed items switch correctly
- No `gray-9`, `gray-8`, `gray-7` Tailwind classes remain in any thoughts/feed file
- WarningOverlay looks correct in both modes

---

### PB-02: Add Layout (Navbar) to ThoughtPage

**Problem:** `/thoughts/:slug` has no Navbar. Users sharing a direct link are stranded with no navigation.

**Goal:** `ThoughtPage` renders within `Layout` so all shared thought links include the Navbar and footer.

**File:** `src/App.jsx` line 59, `src/pages/ThoughtPage.jsx`

**Change in App.jsx:**
```jsx
// Before
<Route path="/thoughts/:slug" element={<ThoughtPage />} />

// After
<Route path="/thoughts/:slug" element={<Layout><ThoughtPage /></Layout>} />
```

**Adjust ThoughtPage:** Currently it renders `ThoughtModal` which is a fullscreen fixed overlay. On a standalone page that overlay works, but it will now sit on top of the Layout. Two options:

- **Option A (simpler):** Keep the overlay as-is — the Layout is technically rendered beneath the fixed overlay. Navbar/footer will be unreachable while the modal is open, but on close (or if the thought fails to load) the user has navigation. Good enough.
- **Option B (better):** Render the thought inline on the page instead of as a modal. `ThoughtPage` gets its own page layout rather than reusing `ThoughtModal`. This means duplicating some rendering logic but the result is a proper page, not a layered overlay.

**Recommendation:** Start with Option A. It is a one-line change and solves the navigation loss. Option B is a future refinement.

**Acceptance criteria:**
- Visiting `/thoughts/some-slug` directly shows the Navbar
- Browser back button works from any link inside the thought
- Existing inline modal behaviour (opened from Landing/ProfileDetail) is unchanged

---

## Phase 2 — Medium Impact

---

### PB-03: Add Escape key handling to all modals

**Problem:** No modal in the app responds to the Escape key. This is standard browser/OS behaviour users expect.

**Goal:** Pressing Escape closes the topmost open modal.

**Primary fix — `ModalBase.jsx`:**
```jsx
import { useEffect } from 'react'

export default function ModalBase({ title, onClose, children, size = 'md' }) {
  const widthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // rest unchanged
}
```

**Also add to `ThoughtModal.jsx`** — same `useEffect` pattern with `onClose`.

**Also add to `WarningOverlay.jsx`** — Escape should not dismiss it (it's intentionally blocking), so no change needed there.

**Acceptance criteria:**
- Escape closes any `ModalBase`-based modal
- Escape closes `ThoughtModal`
- Pressing Escape when no modal is open does nothing

---

### PB-04: Standardise modal close buttons

**Problem:** `ModalBase` and `ThoughtModal` have different close button placement and styling.

| | ModalBase | ThoughtModal |
|---|---|---|
| Position | Header row, right-aligned | Absolute top-right, overlapping content |
| Character | `×` (U+00D7) | `✕` (U+2715) |
| `aria-label` | Yes | No |
| Size | `text-2xl` | `text-lg` |

**Goal:** Both use the same visual close button. `ModalBase` is the canonical reference.

**Change in `ThoughtModal.jsx`:** Remove the absolute-positioned toolbar div. Move the close button into a proper header row (alongside the copy-link button). Add `aria-label="Close"`.

This can be done without adopting `ModalBase` for the whole thought shell — just the header pattern.

**Acceptance criteria:**
- Close button in ThoughtModal looks identical to ModalBase close button
- `aria-label="Close"` present on ThoughtModal close button
- Copy-link button remains accessible alongside it

---

### PB-05: Accessibility baseline

**Problem:** Missing `aria` roles and labels in key interactive areas.

**Goal:** All modals are properly announced to screen readers; all interactive controls have labels.

**Checklist by file:**

**`ModalBase.jsx`:**
- Add `role="dialog"` and `aria-modal="true"` to the inner container
- Add `aria-labelledby` pointing to the `<h2>` title (give it an `id`)

**`ThoughtModal.jsx`:**
- Add `role="dialog"` and `aria-modal="true"` to the inner container
- Add `aria-label="Close"` to the close button (see PB-04)
- Add `aria-label="Add a reaction"` to the `+ React` button

**`Landing.jsx` filter section:**
- Skill toggle buttons: `aria-pressed={active}` (already have text content, so labelling is implicit — `aria-pressed` is the key addition)
- Community role buttons: same

**`Navbar.jsx`:**
- Nav links are already text-labelled, no changes needed

**Do not add `aria-live` everywhere** — only add it where users take an action that produces an async result with no visual loading indicator (currently: reaction toggle in ThoughtModal).

**Acceptance criteria:**
- Opening a modal: screen reader announces the dialog role and title
- Escape closes modal (PB-03 covers this)
- Skill filter buttons communicate pressed state

---

### PB-06: Fix Navbar mobile overflow

**Problem:** At narrow widths the left nav links (Pig, Academy, Rules) and right controls may run out of space with no fallback.

**Goal:** The Navbar works cleanly down to 375px without wrapping or clipping.

**Options (pick one):**

**Option A — Reduce nav items at small widths:** Hide text of secondary links below `sm:`, keep only the brand. Academy and Rules become accessible via a `sm:flex hidden` row or a menu icon.

**Option B — Hamburger drawer:** Add a `<button>` that shows a slide-in drawer below `md:`. More work but more scalable as the nav grows.

**Option C — Horizontal scroll on the nav links:** Wrap left links in `overflow-x-auto` — cheap fix, bad UX.

**Recommendation:** Option A for now. The brand link + icons-only for secondary links on mobile. Pig's emoji can serve as its icon. Academy and Rules can be text-truncated or hidden behind a `...` overflow.

**Acceptance criteria:**
- Navbar does not overflow or clip on a 375px viewport
- All nav destinations remain reachable on mobile
- Brand name is always visible

---

## Phase 3 — Low Impact / Cleanup

---

### PB-07: Unify preference storage

**Problem:** `sc_sort` and `sc_has_profile_image` use cookies; `sc_page_size` and `sc_members_expanded` use `localStorage`. Mix has no rationale.

**Goal:** All user preferences use a single mechanism. Pick one.

**Recommendation:** `localStorage` for everything. Cookies make sense when the server needs to read the value; these preferences are purely client-side. Cookies also expire; `localStorage` is permanent until cleared.

**Steps:**
1. Create `src/lib/prefs.js` with `getPreference(key, default)` and `setPreference(key, value)` backed by `localStorage`
2. Move `getCookie`/`setCookie` out of `Landing.jsx`
3. Migrate `sc_sort` and `sc_has_profile_image` to `localStorage`
4. Replace inline cookie logic in `Landing.jsx` with `getPreference`/`setPreference`

**Also:** Decide whether to persist the advanced filter state (`selectedSkillIds`, `llmProviderId`, etc.) — currently it resets on every page load even though sort and profile-picture filter survive. Likely worth persisting to match user expectation.

**Acceptance criteria:**
- Preferred sort survives a hard page reload
- No `document.cookie` calls remain in `Landing.jsx`
- `src/lib/prefs.js` is the single place for preference read/write

---

### PB-08: Fix Context provider indentation in App.jsx

**Problem:** `UserSettingsProvider` and `SocialProvider` are not indented to their children level.

**File:** `src/App.jsx` lines 43–47.

**Fix:**
```jsx
<AuthProvider>
  <UserSettingsProvider>
    <SocialProvider>
      <RulesProvider>
        <BrowserRouter>
```

Trivial. Do it in the same commit as any other App.jsx change.

---

### PB-09: Unify Rules unread indicator

**Problem:** The navbar shows an animated pulsing dot; the footer shows a static `!` circle. Same state, different signals.

**Goal:** Both render identically or at least visually consistently.

**Options:**
- Make the footer use the same pulsing dot as the navbar (matches visual weight)
- Extract a `<UnreadBadge />` component used in both places

**Suggested `UnreadBadge` (if extracted):**
```jsx
export default function UnreadBadge() {
  return (
    <span className="flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
    </span>
  )
}
```

Used in both `Navbar.jsx` and `Layout.jsx` footer.

---

### PB-10: Add error feedback to silent API failures

**Problem:** Most async calls swallow errors silently. Users get no feedback if something fails.

**Goal:** At minimum, the most user-visible operations show an error state.

**Priority order within this item:**

1. **ThoughtModal** — if `loadThought()` fails after a reaction, the reaction appears not to have worked. Show a brief error or toast.
2. **CommentCompose** — if posting a comment fails, the user should see a message (they already typed something).
3. **ActivityFeed** — if the feed fails to load, show an empty state with a retry button (not just silence).
4. **Landing filter data** (skills, providers, roles) — if these fail, the filter panel just appears empty. A subtle "failed to load" note would help.

**Not needed:** Init fetches like `getStats()` — these are enhancement data, not blocking.

**Approach:** No global toast library needed. A simple local `error` state rendered inline near the action is sufficient. Reserve a toast/notification system for Phase 4 if the pattern grows.

---

### PB-11: Optimistic reaction updates in ThoughtModal

**Problem:** Toggling a reaction fires the API then reloads the whole thought. There is a noticeable lag and the count flashes.

**Goal:** Reaction counts update instantly; the API call reconciles in the background.

**Pattern:**
1. On toggle, immediately update `thought.reactions` in local state (increment/decrement count, flip `userHasReacted`)
2. Fire the API call
3. On success: do nothing (state is already correct)
4. On error: revert the local state change and show a brief error

This removes the `loadThought()` call from the reaction handler for the happy path.

---

### PB-12: Break Landing.jsx into sub-components

**Problem:** ~510 lines and 30+ state variables in one component.

**Goal:** Three focused components that are easier to read and test independently.

**Proposed split:**

```
src/pages/Landing.jsx            — thin orchestrator, stats fetch, shared state
src/components/MembersSection.jsx — grid, search, sort, filters, pagination, collapse
src/components/ThoughtsTab.jsx   — infinite-scroll thoughts list with tag filter
```

`ActivityFeed` is already its own component, so the Feed tab is already extracted.

`MembersSection` would own: `profiles`, `loading`, `error`, `search`, `sort`, `page`, `pageSize`, `seed`, all filter state, `membersExpanded`.

`ThoughtsTab` would own: `thoughts`, `thoughtsLoading`, `openThoughtId`, `thoughtCursor`, `thoughtsHasMore`, `activeThoughtTag`.

**Do this last** — it is a pure refactor with no user-visible change and highest risk of introducing regressions.

---

## Reference: File Change Map

| Playbook Item | Files |
|---|---|
| PB-01 | `ThoughtModal`, `CompactThoughtCard`, `CommentCompose`, `CommentList`, `ActivityFeed`, `FeedItem`, `WarningOverlay` |
| PB-02 | `App.jsx`, `ThoughtPage.jsx` |
| PB-03 | `ModalBase.jsx`, `ThoughtModal.jsx` |
| PB-04 | `ThoughtModal.jsx` |
| PB-05 | `ModalBase.jsx`, `ThoughtModal.jsx`, `Landing.jsx` |
| PB-06 | `Navbar.jsx` |
| PB-07 | `Landing.jsx`, new `src/lib/prefs.js` |
| PB-08 | `App.jsx` |
| PB-09 | `Navbar.jsx`, `Layout.jsx`, optional new `UnreadBadge.jsx` |
| PB-10 | `ThoughtModal.jsx`, `CommentCompose.jsx`, `ActivityFeed.jsx`, `Landing.jsx` |
| PB-11 | `ThoughtModal.jsx` |
| PB-12 | `Landing.jsx`, new `MembersSection.jsx`, new `ThoughtsTab.jsx` |
