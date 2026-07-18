# Badminton Scorer — SuuntoPlus Sports App

Keep score on your wrist while you play. **Badminton Scorer** turns your
**Suunto Race 2** into a full match scoreboard — official BWF 3×15 rally scoring,
a live serve-and-position guide, one-tap scoring, and instant undo — then saves
the result alongside your workout so you can see how your heart rate tracked the
match.

No phone, no notebook, no arguing about the score. Start the app, pick singles
or doubles, and play.

## Features

- **Official BWF 3×15 scoring** — game to **15**, **win by 2**, hard cap at **21**,
  best of **3 games**. Games and match are decided automatically.
- **Singles & doubles** — choose the format in setup; scoring and positioning
  adapt to each.
- **Live serve & court guide** — on every point a marker shows who is serving
  and where to stand: you are a `Y` (orange when it's your serve), and every
  other server — your doubles partner or either opponent — lights up as an
  orange `o` on their court. No more losing track of sides mid-rally.
- **One-tap scoring** — a single button press adds the point to the right side
  and updates the serve automatically.
- **Undo anything** — held a button by mistake? Undo walks back point by point,
  even across a finished game, so a wrong score or wrong server is always
  recoverable.
- **Match summary** — an end-of-match screen shows the winner and a per-game
  breakdown, each game stacked with its winner highlighted (opponent score on
  top, yours on the bottom).
- **Saved with your workout** — your score, opponent score and total rallies are
  recorded as graphs in the Suunto app, each rally is marked as a lap so you can
  correlate **heart rate with the flow of the match**, and a summary of games and
  points won is written to the exercise.

## Controls

**Setup**

| Button | Action |
|--------|--------|
| Top-right | Next setting |
| Bottom-right | Change value (doubles/singles, who serves, your side) |
| Hold bottom-right | Start the match |

**During play**

| Button | Action |
|--------|--------|
| Bottom-right | Point for **you** |
| Top-right | Point for the **opponent** |
| Hold either right button | Undo the last point |
| Top-left (watch button) | Pause / stop & save the workout |

**Match over**

| Button | Action |
|--------|--------|
| Tap top-right | Pause the workout (native) |
| Tap bottom-right (while paused) | Stop & save the workout (native) |
| Hold top-right | Start a new match |
| Hold bottom-right | Undo the last point (resume the match) |

Both in-app actions are on **hold**, so a plain tap always falls through to the
watch's native pause/stop flow — the app never intercepts the stop button, and a
stray tap can neither wipe the match nor block saving.

Undoing past the first point returns to the setup screen.

## Scoring rules (BWF 3×15, effective 2027 — approved April 2026)

- Rally scoring — every rally is a point.
- Game to **15** points, **win by 2**.
- At **14–14**: play continues until a two-point lead, or **21** ends the game
  (at **20–20** the next point wins).
- **Best of 3 games** wins the match.
- Serving side and your court position (doubles) are tracked automatically.

## Store listing (for Suunto submission)

**Name:** Badminton Scorer

**Short description (shown in the app list):**
> Full badminton scorer: BWF 3x15 games, live serve & court position, undo, and match stats.

**Long description:**
> Keep score on your wrist while you play. Badminton Scorer is a complete match
> scoreboard for the Suunto Race 2: official BWF 3×15 rally scoring (game to 15,
> win by 2, best of 3), singles and doubles, and a live guide that shows who
> serves and where to stand on every point. Score with a single tap, undo any
> mistake, and get a clean end-of-match summary with a per-game breakdown. Every
> match is saved with your workout — score and rally graphs plus per-rally laps
> let you see how your heart rate tracked the game.

## Compatibility

- **Suunto Race 2** (SuuntoPlus Sports App).

---

## For developers

### Project structure

```
badminton-scorer/
├── manifest.json      # App metadata, output variables, logged channels
├── main.js            # Game logic (onEvent, getUserInterface, getSummaryOutputs)
├── setup.html         # Pre-match setup screen
├── score.html         # In-game score + serve/position screen
└── match-over.html    # Final result screen
```

Styling uses the SuuntoPlus built-in system CSS classes (`sp-*`, `cm-*`,
`f-num`, `p-hc`) — the packaged app ships no custom CSS. The `.fea` and the
source package contain only `manifest.json`, `main.js`, and the three HTML
templates.

`tools/` (repo root, never packaged) holds a headless Node test harness — run
`node tools/test-badminton.js` for the full match-scenario assertions.

### Build & test

1. Install [VS Code](https://code.visualstudio.com/) and the
   [**SuuntoPlus Editor**](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor)
   extension.
2. Open the `badminton-scorer/` folder in VS Code.
3. **SuuntoPlus: Open Simulator** to test the UI, or **Deploy to Watch** to try it
   on a connected Race 2.

### Releasing to the SuuntoPlus store

There is no self-service upload. Publishing goes through Suunto's review — see
[RELEASING.md](RELEASING.md) for the full step-by-step guide. In short:

1. **SuuntoPlus: Build SuuntoPlus App** — must complete with no validation errors.
2. **SuuntoPlus: Create Source Package** — produces the package Suunto requires
   for submission.
3. **Submit the source package to Suunto** for review. Once approved, it appears
   in the SuuntoPlus catalog in the Suunto mobile app.
