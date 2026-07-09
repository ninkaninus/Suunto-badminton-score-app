# Badminton Scorer — SuuntoPlus Sports App

A SuuntoPlus sports app for the **Suunto Race 2** that tracks score during a badminton match.

## Project structure

```
badminton-scorer/
├── manifest.json          # App metadata, data sources, output variables
├── main.js                # Game logic (evaluate, getUserInterface, onLoad)
└── templates/
    ├── score.html         # In-game score screen
    ├── score.css
    ├── match-over.html    # Final result screen
    └── match-over.css
```

## How to develop

1. Install [VS Code](https://code.visualstudio.com/) and the **SuuntoPlus Editor** extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor).
2. Open the `badminton-scorer/` folder in VS Code.
3. Use **SuuntoPlus: Open in Simulator** to test with simulated data.
4. Use **SuuntoPlus: Deploy to Watch** to push to a connected Suunto Race 2.

## Controls (in-activity)

| Button | Action |
|--------|--------|
| **LAP** | Score a point for the active (orange) player |
| **BACK** | Switch which player is active (serving) |

## Scoring rules

- First to **21 points**, win by 2 (cap at 30)
- Best of **3 games**
- Active player is highlighted in orange

## Known TODOs

- Confirm the exact API for back-button press callbacks (`onButtonPress`?)
- Add persistent state so a match can survive an accidental pause/resume
- Add undo-last-point feature
- Verify `getUserInterface` template name binding against editor docs
