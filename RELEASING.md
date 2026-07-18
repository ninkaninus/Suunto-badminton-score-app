# Releasing Badminton Scorer to the SuuntoPlus store

This is the full, step-by-step guide to publishing **Badminton Scorer** to the
official SuuntoPlus catalog (the one that appears in the Suunto mobile app).

> **How publishing works, in one line:** there is **no self-service upload**.
> You build a *source package* in VS Code and submit it to Suunto, who **review
> it by hand** and publish it. Everything below prepares that submission and
> gets it through review on the first try.

Everything is done from **VS Code with the SuuntoPlus Editor extension**
installed. Commands are run from the Command Palette (`Ctrl/Cmd+Shift+P`) or the
**SuuntoPlus Apps** view.

---

## 0. Pre-flight checklist

Confirm all of these before you build the submission:

- [ ] **Manifest is clean** (`badminton-scorer/manifest.json`):
  - `name` ≤ 60 chars — currently `Badminton Scorer` ✅
  - `description` ≤ 100 chars — currently 90 chars ✅
  - `version` set to **4.0** (first major release), `author` set,
    `type: "feature"`, `usage: "workout"` ✅
  - `out` has ≤ 5 logged channels — currently 3 (`playerOneScore`,
    `playerTwoScore`, `totalPoints`) ✅
- [ ] **Logic tests pass**: `node tools/test-badminton.js` → *All checks passed*.
- [ ] **Store text ready**: the short + long description in `README.md`
      → *Store listing* section.
- [ ] **On-watch smoke test done** (Step 2 below) — this is the one thing the
      simulator and the Node harness **cannot** verify for you.

---

## 1. Build & validate

The build is also the validator — it fails loudly on anything the reviewer
would reject.

1. Open the `badminton-scorer/` folder in VS Code.
2. Run **`SuuntoPlus: Build SuuntoPlus App`**.
3. The build minifies `main.js`, converts the HTML/CSS, and packages a `.fea`.
   **Fix every error and warning it reports.** Do not submit with warnings.

If you support more than one language later, use **Build … For All Languages**.
For now the app is single-language, so the default build is correct.

---

## 2. Test on a real Suunto Race 2 (required)

The simulator and the Node harness only cover UI and logic. The things that
*only* work on-device — and that a reviewer will actually exercise — are the
activity recording and the native buttons. Test these on hardware:

1. Connect the Race 2 (USB or Bluetooth) → run **`SuuntoPlus: Deploy to Watch`**.
2. Start a workout with the app and play/simulate a full match:
   - Score with both right-side buttons; confirm serve/court markers track
     correctly in **singles and doubles** — including the **partner-serving**
     case in doubles (an orange `o` on your side).
   - **Long-press to undo** — including undo across a finished game (hold either
     right button during play).
   - On the **match-over screen** neither button captures its *tap*, so taps
     fall through to the native controls: **tap top = pause, then tap bottom =
     stop & save**. The app overrides only the *holds*: **hold top = new match**,
     **hold bottom = undo**. Verify the native pause→stop→save flow completes
     from this screen (this is the finicky bit — the whole point of leaving taps
     uncaptured), and that a hold does the in-app action instead.
3. Save the workout, sync to the Suunto app, and confirm:
   - **Graphs** for *Your score*, *Opp score*, and *Total points* appear.
   - **Laps** exist — one per rally (used for HR correlation).
   - The **end-of-exercise summary** shows *Your/Opp games* and *Your/Opp
     points*.
4. Sanity-check a **long 3-game match** (many laps) doesn't misbehave.

If anything here is wrong, fix it and go back to Step 1.

---

## 3. Capture store imagery

Suunto's listing shows a preview of the app. Produce clean images:

- **`SuuntoPlus: Open Simulator`** → set it to the **Race 2** profile → drive the
  app to a representative screen (a mid-game score with serve markers reads
  best) → **Take Screenshot**.
- Optionally use the **Render … image** command from the SuuntoPlus Apps view to
  generate the app's rendered preview.
- Grab a couple of shots: setup, an in-game score, and the match-over summary.

Keep them; you'll attach them to the submission.

---

## 4. Create the source package

1. In the **SuuntoPlus Apps** view (or Command Palette), run
   **`SuuntoPlus: Create Source Package`** on the `badminton-scorer` app.
2. This bundles the source files (including PNGs) into the package Suunto
   requires for review. Note where it's written.

> Do **not** submit the raw `.fea` or the repo `.zip`. The *source package* from
> this command is the correct artifact.

---

## 5. Submit to Suunto for review

The extension produces the package but does not upload it — submission goes
through **Suunto's developer program**.

1. Go to the Suunto developer portal: **https://apizone.suunto.com** and sign in
   (create/enable a developer account if you haven't).
2. Find the **SuuntoPlus Sports App submission** flow and follow it. Provide:
   - the **source package** from Step 4,
   - the **name** and **descriptions** (short + long from `README.md`),
   - the **screenshots** from Step 3,
   - author/contact details and target device (**Suunto Race 2**).
3. If the portal doesn't expose a submission form, use the **developer contact
   listed on apizone.suunto.com** to send the source package and listing details.
   *(Confirm the current submission channel there — Suunto sets it, and it is not
   hard-coded in the editor.)*

Then **Suunto reviews it manually.** Expect back-and-forth: they may request
tweaks (wording, edge-case behavior, imagery). Address feedback, re-run Steps
1–4, and resubmit the updated source package.

---

## 6. After approval

- The app appears in the **SuuntoPlus catalog in the Suunto mobile app**; users
  add it to their Race 2 from there.
- Keep the source package and screenshots you submitted for your records.

---

## Shipping an update later

1. Make the change; keep tests green (`node tools/test-badminton.js`).
2. **Bump `version`** in `manifest.json` (e.g. `4.0` → `4.1`; max 4 chars).
3. Repeat Steps 1–5 with the new source package.

---

## Gotchas specific to this app

- **`.fea` is a build artifact.** Edit the source (`main.js`, `manifest.json`,
  `*.html`, `*.css`); the editor regenerates the `.fea`. Never hand-edit it.
- **No app-callable stop/pause.** Stop/save relies on the uncaptured upper
  button; this is deliberate and must be verified on-device (Step 2).
- **Laps scale with rallies.** A long best-of-3 can create 100+ laps. Confirmed
  fine, but worth a glance in the exported activity.
- **`tools/` never ships.** It lives at the repo root (outside
  `badminton-scorer/`) so it's never packaged into the app.
</content>
