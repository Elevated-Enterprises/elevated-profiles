# Poker — Ideas & Concept

## Why Poker Fits the Platform

The existing games (Pig, Yahtzee) already establish the core pattern:
**SignalR hub + lobby + turn-based state machine + MongoDB persistence.**
Poker maps onto this cleanly — it's turn-based, real-time, needs a lobby, and the state
machine (deal → bet → draw → bet → showdown) is self-contained per game.

Player range of 2–6 fits naturally alongside the existing games.

---

## Proposed Variant: Five Card Draw (Phase 1)

Five Card Draw is the right starting point:
- Everyone knows it; no explanation needed
- Simple structure: deal → betting round → draw → betting round → showdown
- All cards are private (no shared board to render)
- Hand evaluation is straightforward — exactly five cards, no combinations across a board
- Solid foundation to build Stud on later (see below)

### Game Flow

```
Lobby (waiting for 2–6 players)
  ↓
Deal (5 private cards per player)
  ↓
Betting Round 1  (check / call / raise / fold)
  ↓
Draw Phase  (each player discards 0–5 cards, receives replacements)
  ↓
Betting Round 2  (check / call / raise / fold)
  ↓
Showdown  (remaining players reveal hands, best hand wins pot)
  ↓
Next Round / Leave Table
```

### Simplifications to Keep It Manageable

- **No side pots** — if a player can't cover a bet they fold (keeps the state machine clean)
- **Fixed chip stack per game** — e.g. 1 000 chips each, no persistent bankroll
- **Blinds**: small blind + big blind to force action; no ante
- **Raise cap**: 3 raises per round to prevent infinite loops
- **No split pots** on tied hands (rare edge case; one winner takes all, tie-break by suit order if needed)

---

## Backend Architecture

Follows the established PigHub / YahtzeeHub pattern exactly:

### SignalR Hub — `PokerHub.cs`
- Route: `/hubs/poker?gameSlug=xyz`
- Groups: `poker-{slug}` (game), `poker-list` (lobby updates)
- Auth: `[Authorize]` (JWT, same as other games)

**Server methods (client → server):**
- `JoinGame(slug)` / `LeaveGame()`
- `StartGame()`
- `PlaceBet(amount)` / `Check()` / `Call()` / `Raise(amount)` / `Fold()`
- `SelectDiscards(cardIndices[])` — draw phase
- `VotePlayAgain()`

**Client events (server → client):**
- `GameState` — full state snapshot (sent on every change)
- `Error` — validation failures
- `OpenGamesUpdated` — lobby list refresh

### Game Model — `PokerGame.cs`

```
Status: Lobby | Dealing | BettingRound1 | DrawPhase | BettingRound2 | Showdown | Finished
Participants[]: userId, username, avatarUrl, chipStack, currentBet, hasFolded, isDealer, cards[]
Deck: Card[] (suit + rank, shuffled server-side)
Pot: int
CurrentPlayerIndex: int
DealerIndex: int
SmallBlindIndex: int
BigBlindIndex: int
LastRaiseAmount: int
RaiseCount: int  (capped at 3)
```

### Card Model

```
Card: { Suit: Clubs | Diamonds | Hearts | Spades, Rank: 2–14 (14 = Ace) }
```

Cards are **never sent to the frontend for other players' hands** — only the current player's own hand, plus `cardCount` for opponents (how many cards they hold).

### Hand Evaluation

Standard poker hand rankings (server-side only):
`Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card`

This is a well-solved algorithm; a simple lookup-table approach works fine.

---

## Frontend

### Card Visual Design

Cards should be **tall rectangles** (portrait aspect ratio, roughly 2:3), strongly stylised to match the platform aesthetic — not photorealistic.

Suggested approach using Tailwind + inline SVG or CSS:
- **Frame**: `rounded-xl border-2` in stone/white, `shadow-md`
- **Suit symbol**: large, centred, rendered as SVG or Unicode (♠ ♥ ♦ ♣)
- **Red suits** (Hearts, Diamonds): `text-red-500`
- **Black suits** (Clubs, Spades): `text-stone-800 dark:text-stone-100`
- **Rank**: top-left and bottom-right corners, small, same colour as suit
- **Card back**: solid amber (`bg-amber-500`) with a subtle pattern or the platform logo — no need for ornate designs
- **Face-down cards** (opponents): show only the back
- **Selected for discard**: dimmed + red ring (`ring-2 ring-red-400 opacity-60`)
- **Winning hand highlight**: green ring (`ring-2 ring-emerald-400`)

Card size: roughly `w-14 h-20` (56×80px) inline, `w-20 h-28` when a hand is displayed prominently.

### Pages

- `/games/poker` — lobby list (same pattern as PigGameList / YahtzeeGameList)
- `/games/poker/:slug` — game view

### Game View Layout

```
Top bar: pot size, blind info, round indicator
Opponent area: avatars + face-down card stacks + chip counts
Table centre: pot display, community info (phase name)
Player hand: 5 cards (face up), tap/click to mark for discard
Action bar: Check / Call / Raise / Fold buttons + chip slider
```

---

## What Needs Building

| Area | Work |
|------|------|
| Backend model | `PokerGame.cs`, `Card.cs`, `HandEvaluator.cs` |
| Hub | `PokerHub.cs` (deal, betting, draw, showdown logic) |
| Service | `PokerService.cs` (game state transitions) |
| Frontend lobby | `PokerGameList.jsx` |
| Frontend game | `PokerGame.jsx` + `PokerCard` component |
| Backend wiring | Register hub in `Program.cs`, add to `MongoDbContext` |
| Games page | Add Poker entry to `Games.jsx` |

---

## Later Extensions (Phase 2+)

### Five Card Stud
The infrastructure above handles Stud with minimal changes:
- No draw phase; instead cards are revealed one at a time with a betting round between each
- Some cards are face-up (visible to all), one card stays face-down
- The `GameState` message would include `faceUp: bool` per card in opponent hands
- `Status` enum gains `RevealCard1..4` states; draw-phase logic is replaced by reveal logic
- Hand evaluation reuses the same `HandEvaluator`

### Texas Hold'em
More involved — shared community cards (flop/turn/river), 4 betting rounds, best 5-of-7 hand evaluation. Worth a separate design document when the time comes.

### Bot Players
Following the Pig game pattern, bots can be added as a "fill empty seats" option in the lobby. A simple bot strategy (call with decent hands, fold with weak ones) is enough for casual play.

---

*This document is a conversation starter, not a spec. Open questions, alternative ideas, and concerns welcome.*
