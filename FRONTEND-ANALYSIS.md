# Frontend Analysis — Second Circuit Profiles

> Snapshot: March 2026. Analysis covers design system consistency, component architecture, UX patterns, and code organisation. Visual aesthetics are out of scope — this is a technical design review.

---

## Summary

The frontend is generally well-structured for its stage and follows clear patterns in most areas. The biggest issues are a **split design system** (two incompatible colour palettes coexisting), **inconsistent modal architecture**, and a **standalone Thought page that drops the Navbar**. Everything else is fixable at low risk.

---

## 1. Design System Split (High Priority)

### The Problem

The app has two completely separate visual languages that do not communicate:

| Area | Palette | Dark Mode |
|---|---|---|
| Core app (profiles, landing, modals) | `stone-*` + amber accents | Full `dark:*` support |
| Thoughts / Feed world | `gray-*`, hardcoded `gray-950` | Always dark — ignores the toggle |

The dark mode toggle in the Navbar (stored server-side in `UserSettingsContext`) has zero effect on `ThoughtModal`, `ActivityFeed`, `FeedItem`, `CompactThoughtCard`, and `CommentCompose`. These components use `bg-gray-950 border-gray-800 text-gray-300` unconditionally. A user on light mode opens a Thought and is thrown into a fully dark UI.

**Root cause:** The Thoughts system was built with its own visual identity and was never integrated into the `stone-*` system.

**Files affected:**
- `src/components/thoughts/ThoughtModal.jsx` — entire shell (`bg-gray-950`)
- `src/components/feed/ActivityFeed.jsx` — `text-gray-500`, `hover:text-gray-300`
- `src/components/feed/FeedItem.jsx` — assumed same
- `src/components/thoughts/CompactThoughtCard.jsx` — assumed same
- `src/components/thoughts/CommentCompose.jsx` — assumed same

**Also:** `WarningOverlay.jsx` has no dark mode classes at all (`bg-amber-50`, `text-stone-800` only). It always renders light-styled, even for users with dark mode active.

---

## 2. Modal Architecture Inconsistency (Medium Priority)

There is a shared `ModalBase` component but it is not universally used.

### What uses ModalBase
All edit/manage modals: `EditProfileModal`, `SkillsModal`, `LLMExperienceModal`, `EditCompanionModal`, `EditLinksModal`, `LanguagesModal`, `CommunityRolesModal`, `AmbassadorModal`, `ComposeThoughtModal`, `RuleModal`

### What does NOT use ModalBase
| Component | Own shell | Reason |
|---|---|---|
| `ThoughtModal` | `bg-gray-950 border-gray-800 rounded-2xl` | Different visual identity |
| `WarningOverlay` | amber blocking overlay | Intentional blocking UX |
| Session expired (in `Layout`) | inline JSX | Not a reusable modal |

This is fine for `WarningOverlay` and the session dialog (they have special behaviour). But `ThoughtModal` being separate from `ModalBase` means:

- Close button is styled and positioned differently (top-right absolute `✕` vs header row `×`)
- No click-outside to close is present... actually `ThoughtModal` **does** handle click-outside but it's reimplemented inline
- The two close buttons look different: `ModalBase` uses a `×` (multiplication sign, `text-2xl`) centred in the header; `ThoughtModal` uses a floating `✕` (cross mark) top-right
- `ModalBase` has `aria-label="Close"` on its button; `ThoughtModal`'s close button has none

### Missing: Escape key handling
Neither `ModalBase` nor `ThoughtModal` handle the `Escape` key. This is expected browser behaviour for dialogs and its absence is a usability gap.

---

## 3. Routing: Pages Without Navigation (Medium Priority)

### `/thoughts/:slug` — `ThoughtPage`
```jsx
// App.jsx line 59
<Route path="/thoughts/:slug" element={<ThoughtPage />} />
```
No `<Layout>` wrapper. When a user follows a shared link to a Thought, they land on a page with **no Navbar, no footer, no CookieBanner**. They can click an author's name to get to a profile, but there is no way back to the homepage or any other part of the app without using the browser back button.

This is likely unintentional — the page uses `ThoughtModal` which was designed as an overlay, and it looks like one (dark modal on a dark background), but it is being used as a standalone page.

### `/pig/:slug` — `PigGame`
```jsx
// App.jsx line 58
<Route path="/pig/:slug" element={<PigGame />} />
```
Also no Layout. This appears intentional — it is a fullscreen game. Acceptable.

### Inconsistent context wrapping in App.jsx
The provider indentation is inconsistent (cosmetic but affects readability):
```jsx
<AuthProvider>
  <UserSettingsProvider>   // ← misaligned
  <SocialProvider>         // ← misaligned
  <RulesProvider>
    <BrowserRouter>
```
`UserSettingsProvider` and `SocialProvider` are not indented to their children level.

---

## 4. State Storage Inconsistency (Low Priority)

User preferences on the Landing page are stored across three different mechanisms with no clear rationale:

| Preference | Storage | Why? |
|---|---|---|
| `sc_sort` | Cookie | — |
| `sc_has_profile_image` | Cookie | — |
| `sc_page_size` | `localStorage` | — |
| `sc_members_expanded` | `localStorage` | — |

The `getCookie` / `setCookie` helpers live inside `Landing.jsx` rather than in `src/lib/`. If cookie-based preferences are used elsewhere, this will lead to duplication.

Additionally, the advanced filter state (`selectedSkillIds`, `llmProviderId`, `minExperienceLevel`, etc.) is not persisted at all — it resets on page load even though all other preferences survive.

---

## 5. Landing.jsx — God Component (Low Priority)

`Landing.jsx` is ~510 lines with 30+ state variables covering three largely independent features: the Members grid, the Feed tab, and the Thoughts tab. The page works correctly, but the component is difficult to reason about in isolation.

Natural extraction candidates:
- `<MembersSection />` — the grid, search, filters, pagination, and collapse toggle
- `<ThoughtsTab />` — the thoughts list with tag filtering and infinite scroll

The `getInitialPageSize()` and `getInitialSort()` initialisers at module level are fine but could live in a `lib/prefs.js`.

---

## 6. Rules Unread Indicator — Two Visual Styles (Low Priority)

The same piece of state (`unreadCount` from `RulesContext`) is displayed differently in two places:

- **Navbar** (`Navbar.jsx:31`): animated pulsing amber dot (no count)
- **Footer** (`Layout.jsx:67`): static amber circle with "!" text

Both communicate "there are unread rules" but look completely different. A user could reasonably wonder if they are showing different information.

---

## 7. Navbar: Mobile Overflow Risk (Low Priority)

The Navbar left side has four links: **Second Circuit** (brand), **Pig**, **Academy**, **Rules**. On the right: dark mode toggle, dyslexic font toggle, username (hidden on `sm`), My Profile, Admin (conditional), Sign out.

On screens between 375–640px, the left links may overflow the available space before the `sm:` breakpoint hides the username. There is no hamburger/drawer menu fallback. This is currently mitigated by `hidden sm:block` on the separator and username, but the nav links themselves are always visible.

---

## 8. ProfileCard: Badge Overlap Logic (Low Priority)

The bottom-right badges on `ProfileCard` (community role star, admin crown) use conditional `right-*` offsets to avoid overlap:

```jsx
// ProfileCard.jsx line 100
className={`... ${isAdmin ? 'right-8' : 'right-1.5'}`}
```

This works for the current two-badge scenario but will break if a third badge is added. The top-right area has the same issue (online dot and thought bubble use `right-6` when both are present).

The status bubble (`StatusBubble`) is positioned as a sibling of the card container (outside the card's `border/shadow` box), relying on `relative` on the parent `<Link>`. The element will render outside the card's visual bounds. This is intentional but fragile — any wrapping element that disrupts stacking context would break it.

---

## 9. Accessibility Gaps (Medium Priority)

| Issue | Location |
|---|---|
| Close button has no `aria-label` | `ThoughtModal` close `✕` button |
| React picker button has no `aria-label` | `ThoughtModal` `+ React` button |
| Filter skill/role toggle buttons have no `aria-label` | `Landing.jsx` filter section |
| `ThoughtModal` is not a `role="dialog"` with `aria-modal` | `ThoughtModal` |
| `ModalBase` is not a `role="dialog"` with `aria-modal` | `ModalBase.jsx` |
| No `aria-live` region for loading states or errors | All pages |
| No Escape key handler on any modal | All modals |

`ModalBase`'s close button does have `aria-label="Close"` — that is good. The dark/dyslexic toggle buttons in the Navbar also have proper `aria-label` and `title`. These are the only examples of complete accessible button labelling in the codebase.

---

## 10. Silent Error Handling (Low Priority)

The majority of API calls silently swallow errors:

```js
.catch(() => {})        // Landing.jsx init fetches
catch { /* ignore */ }  // ThoughtModal, ActivityFeed, ComposeThoughtModal
```

The profiles grid on Landing shows an error state. Almost everything else does not. Users who encounter a network failure mid-session get no feedback.

---

## 11. Reaction UX: No Optimistic Update (Low Priority)

In `ThoughtModal`, clicking a reaction fires the API, then calls `loadThought()` to refresh. There is no optimistic state update, no loading indicator, and no error toast on failure. The thought reloads after the round-trip, which adds perceptible latency and a flash of the old state.

---

## What is Well Done

- **`api.js`** — clean single-file API layer, all endpoints in one place, no duplication
- **Context architecture** — `AuthContext`, `UserSettingsContext`, `SocialContext`, `RulesContext` are each focused and clean
- **`AuthContext` 401 handling** — the deferred registration of the session-expired handler (after initial auth check) is a smart detail that prevents a popup on stale-token page load
- **`ModalBase`** — consistent, reusable, handles click-outside
- **`ProfileCard`** — deterministic gradient fallback for missing avatars (hash-based, stable across renders)
- **Dark mode** — applied correctly to the `<html>` element via CSS class, works throughout the stone/amber world
- **Route guards** — `ProtectedRoute` and `AdminRoute` are minimal and correct
- **`UserSettingsContext`** — optimistic updates with revert on failure is good UX
- **Login page** — clean, focused, handles the loading and error states properly

---

## Priority Summary

| # | Issue | Priority |
|---|---|---|
| 1 | Design system split (stone vs gray, dark mode ignored in Thoughts) | High |
| 2 | ThoughtPage has no Navbar / navigation | High |
| 3 | Modal architecture inconsistency + no Escape key handler | Medium |
| 4 | Accessibility gaps (aria roles, labels, keyboard nav) | Medium |
| 5 | Navbar mobile overflow risk | Medium |
| 6 | Preference storage inconsistency (cookie vs localStorage) | Low |
| 7 | Rules unread indicator inconsistency (dot vs badge) | Low |
| 8 | ProfileCard badge overlap logic (fragile offsets) | Low |
| 9 | Silent error handling | Low |
| 10 | Reaction UX — no optimistic update | Low |
| 11 | Landing.jsx god component | Low |
| 12 | WarningOverlay has no dark mode classes | Low |
