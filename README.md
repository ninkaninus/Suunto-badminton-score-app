# Badminton Scorer — SuuntoPlus Sports App

A SuuntoPlus sports app for the **Suunto Race 2** that tracks score during a badminton match, using the new BWF **3×15** scoring system.

## Project structure

```
badminton-scorer/
├── manifest.json      # App metadata, templates, logged output variables
├── main.js            # Game logic (onLoad, onEvent, getUserInterface, getSummaryOutputs)
├── setup.html         # Pre-match setup (mode, first serve, court side)
├── score.html/.css    # In-game score screen
└── match-over.html/.css  # Final result screen
```

## How to develop

1. Install [VS Code](https://code.visualstudio.com/) and the **SuuntoPlus Editor** extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor).
2. Open the `badminton-scorer/` folder in VS Code.
3. Use **SuuntoPlus: Open in Simulator** to test with simulated data.
4. Use **SuuntoPlus: Deploy to Watch** to push to a connected Suunto Race 2.

## Controls (physical buttons)

| Screen | Button | Action |
|--------|--------|--------|
| Setup | UP | Next field |
| Setup | DOWN | Toggle value · hold to start match |
| Playing | UP | Point to opponent · hold to undo |
| Playing | DOWN | Point to you · hold to undo |
| Match over | DOWN | New match · hold to undo last point |

Undoing past the first point returns to the setup screen.

## Scoring rules (BWF 3×15, effective 2027 — approved April 2026)

- Game to **15 points**, rally scoring
- At **14–14**: win by 2, hard cap at **21** (at 20–20 next point wins)
- Best of **3 games**
- Serving side and your court position (doubles) tracked automatically

## Publishing

Submit the packaged app via your [APIzone](https://apizone.suunto.com/) profile page with a store description and screenshots. After Suunto review it appears in the SuuntoPlus Store under "Made by Suunto Community".
