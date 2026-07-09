# Testing the Badminton Scorer

There are two complementary ways to test this SuuntoPlus sports app. Use both:
the headless harness for fast logic checks, the GUI simulator/watch for anything
involving rendering or the real activity recording.

| What you want to check | Headless harness | GUI simulator | Real watch |
|---|:---:|:---:|:---:|
| Score logic, game/match flow | ✅ | ✅ | ✅ |
| `out` values & logged-channel timing | ✅ | ✅ | ✅ |
| `getSummaryOutputs` totals | ✅ | ✅ | ✅ |
| Template rendering / layout / CSS | ❌ | ✅ | ✅ |
| Real `$.put('/Activity/Trigger', 23)` laps | ❌ | ⚠️ partial | ✅ |
| Real FIT developer fields / HR overlay | ❌ | ❌ | ✅ |

---

## 1. Headless harness (no VS Code needed)

The official simulator is a VS Code webview and can't be driven from a terminal,
so [`sim-harness.js`](sim-harness.js) loads the app's **real `main.js`** and calls
the documented runtime callbacks the same way the watch's firmware (ESW) does.

```bash
node tools/sim-harness.js            # smoke-load the app, print initial screen + outputs
node tools/test-badminton.js         # run the full match scenario with assertions
```

`test-badminton.js` plays a 3-game match and asserts: logged-channel values and
timing, `totalPoints` never double-counts the final game, `getSummaryOutputs`
totals, `setup → score → match-over` transitions, and (statically) that
`score.html` fires a silent lap on scoring presses but not on undo.

### Harness API
```js
const { loadApp } = require('./sim-harness');
const app = loadApp('badminton-scorer');   // runs onLoad + first tick

app.event(4);            // a template button event ($.put('/Zapp/.../Event', 4))
app.tick();              // one ~1 s ESW tick (runs evaluate(), flushes + logs)
app.ui().template;       // current screen (getUserInterface)
app.output;              // current out variables
app.channel('totalPoints'); // last value recorded for a logged channel
app.samples;             // emulated FIT "record" message stream
app.summary();           // getSummaryOutputs() array
app.nativeLog;           // native calls made by main.js (unload, ...)
```

### Runtime contract it emulates
From the SDK reference (`developer-doc/reference.html` in the extension; same as
**SuuntoPlus: Open Documentation**). Callback event enum:

| id | callback | id | callback |
|---:|---|---:|---|
| 1 | `evaluate()` (~1 Hz; flush + log here) | 256 | `onExercisePause()` |
| 2 | `onLoad()` | 512 | `onExerciseContinue()` |
| 4 | `onLap()` | 1024 | `onExerciseEnd()` → `getSummaryOutputs()` |
| 8 | `onAutolap()` | 4096 | `getUserInterface()` |
| 128 | `onExerciseStart()` | 16384 | `onEvent(input, output, eventId)` |

Key behaviours baked in:
- Outputs set in `onEvent` reach ESW only on the **next** `evaluate` tick.
- A manifest `out` entry is recorded to the FIT only with `"log": true` (max 5).
  The harness captures a sample per tick when a logged channel's value changes.
- The only native global this app uses is `unload()`; stubs live in `loadApp`.
  Add more stubs there if `main.js` starts calling other natives.

### What it can't do
No template rendering, no HTML `$` resource bus — so it can't execute the real
`$.put('/Activity/Trigger', 23)` lap writes or read real HR. Those need the GUI
simulator or a watch.

---

## 2. GUI simulator (authoritative for rendering & laps)

In VS Code with the **SuuntoPlus Editor** extension, open the `badminton-scorer/`
folder and use the command palette:

- **SuuntoPlus: Open SuuntoPlus Simulator** — renders the templates, runs the app
  against a simulated workout. Load one of the sample FIT files (the extension
  ships `running.fit`, `cycling.fit`, etc.) so there's HR data. The **Output**
  panel shows live `out` values; **Summary outputs** appear after you stop the
  sim; press the mapped LAP button to drive scoring.
- **SuuntoPlus: Build SuuntoPlus App** — compiles the source to the `.fea`
  binary (the `.fea`/`.zip` in the repo are build artifacts — edit the source,
  not them).
- **Take Screenshot** — captures the simulator screen.

## 3. Real watch (only place the full pipeline is real)

To confirm laps land in the activity and the channels overlay against HR:
**SuuntoPlus: Deploy to Watch**, record a short session pressing the scoring
button a few times, then export the FIT from the Suunto mobile app. Per-point
laps appear as lap splits (with HR avg/max); logged channels appear as developer
fields / timeline graphs. `intervals.icu` also ingests both.

Caveats to watch for on-device: an undone mis-score still leaves a lap, and a
long match creates ~100+ laps.
