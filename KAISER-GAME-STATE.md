# Kaiser Implementation — Session State
*Stand: 28. Februar 2026*

---

## Kontext

Wir haben das `KAISER_GAME_CONCEPT.md` (v0.1) reviewed und bewertet, ob die bestehende
Infrastruktur (aus dem Pig-Game) für eine Kaiser-Implementierung ausreicht.

**Ergebnis: Ja, die Infrastruktur reicht.** Kaiser ist deutlich komplexer im State, aber
alle Patterns (SignalR Hub, Lobby/List/Game, In-Memory + MongoDB, SemaphoreSlim, Idle/Disconnect
Timer, Play Again, Chat, React Context + useReducer) sind durch Pig bereits etabliert.

---

## Technische Entscheidungen (final)

### Card Identifier Format
Standard für alle Kartenspiele auf der Plattform:

```
{Suit}{Rank}
```

| Suit | Kürzel |
|------|--------|
| Hearts (France) | `H` |
| Spades (Germany) | `S` |
| Diamonds (England) | `D` |
| Clubs (Russia) | `C` |

Beispiele: `H5` = Joffre, `S3` = Kaiser, `DK` = Karo-König, `C7` = Kreuz-Tief-Karte.
Beide "7er" (Diamonds und Clubs) sind durch den Suit-Prefix eindeutig: `D7` vs. `C7`.

### Play Again Flow
Nur die **4 aktiven Spieler** stimmen — Watchers bekommen keinen Prompt.
(Das Konzept-Dokument sagt noch "players + watchers", das ist korrigiert.)

---

## Offene Regelfragen (warten auf Patrick)

Folgende Fragen wurden auf Englisch aufgeschrieben und gehen an Patrick (Bellechasse, QC):

**1. Tricks pro Hand**
Mit 4 Spielern × 8 Karten = 32 Karten → 8 Tricks pro Hand. Das Konzept-Dokument nennt
aber "12 tricks total per hand" in der Scoring-Tabelle (How to Play sagt korrekt 8).
Was stimmt? (Beeinflusst Gesamtpunkte: 8+5−3=10 vs. 14)

**2. Slam-Bid**
Slam wird mit 12 geboten, aber das Maximum pro Hand scheint 10 Punkte zu sein
(8 Tricks + 5 Joffre − 3 Kaiser). Bedeutet "Slam" etwas anderes — z.B. alle 8 Tricks
gewinnen als Sonderbid, unabhängig vom Punktesystem?

**3. Alle passen**
Wenn die ersten drei Spieler passen — muss der Dealer zwingend bieten? Oder kann auch
der Dealer passen, und wenn ja, was passiert dann?

---

## v1 Out-of-Scope (bereits entschieden)

- 3-Spieler-Variante
- Manuelles Team-Assignment durch GM (auto: Join-Reihenfolge 1&3 vs. 2&4)
- Custom Card Art (Styled Text-Karten für v1)
- AI companion commentary
- Persistente Match-History / Statistiken
- Spectator Hand-Reveal nach Match

---

## Nächste Schritte

1. **Antworten von Patrick abwarten** — Regelfragen klären
2. **Monorepo-Migration abschließen** — dann hier weitermachen
3. **Implementation starten** — Backend zuerst (Model, Service, Hub, Controller),
   dann Frontend (List-Page, Game-Page)

---

## Relevante Dateien

- `KAISER_GAME_CONCEPT.md` — Vollständiges Konzept-Dokument (v0.1)
- `backend/CLAUDE.md` — Backend-Architektur (ASP.NET Core 10, MongoDB)
- `frontend/CLAUDE.md` — Frontend-Architektur (React 18 + Vite + Tailwind)
- Pig-Referenz-Implementierung:
  - Backend: `Models/PigGame.cs`, `Services/PigService.cs`, `Hubs/PigHub.cs`, `Controllers/PigController.cs`
  - Frontend: `pages/PigGameList.jsx`, `pages/PigGame.jsx`
