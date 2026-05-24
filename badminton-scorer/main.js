// Badminton Scorer — SuuntoPlus Sports App
// Scoring rules: first to 21 (win by 2, cap at 30), best of 3 games.
//
// Controls:
//   Lap button  → score a point for the active player
//   Back button → switch active player (TODO: confirm back-button API)

var state = {
  p1Score: 0,
  p2Score: 0,
  p1Games: 0,
  p2Games: 0,
  activePlayer: 1,       // 1 or 2 — who gets the point on next lap press
  prevLapCount: 0,
  matchOver: false
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function onLoad(settings) {
  // TODO: load persisted state if resuming mid-match
  // Example: var saved = loadData(); if (saved) state = saved;
  state.prevLapCount = 0;
}

// ---------------------------------------------------------------------------
// Main loop — called once per second by the platform
// ---------------------------------------------------------------------------

function evaluate(input) {
  if (state.matchOver) {
    return buildOutput(getMatchWinner() + " wins!");
  }

  var lapCount = input.lapButtonPress || 0;

  if (lapCount > state.prevLapCount) {
    // Lap button was pressed — add a point for the active player
    addPoint();
    state.prevLapCount = lapCount;
  }

  return buildOutput(statusText());
}

// ---------------------------------------------------------------------------
// UI — called by the platform to pick which template to render
// ---------------------------------------------------------------------------

function getUserInterface(input) {
  if (state.matchOver) {
    return { template: "match-over" };
  }
  return { template: "score" };
}

// ---------------------------------------------------------------------------
// Scoring logic
// ---------------------------------------------------------------------------

function addPoint() {
  if (state.activePlayer === 1) {
    state.p1Score++;
  } else {
    state.p2Score++;
  }
  checkGameOver();
}

function checkGameOver() {
  var p1 = state.p1Score;
  var p2 = state.p2Score;

  var gameWon =
    (p1 >= 21 && p1 - p2 >= 2) ||
    (p2 >= 21 && p2 - p1 >= 2) ||
    p1 === 30 ||
    p2 === 30;

  if (!gameWon) return;

  if (p1 > p2) {
    state.p1Games++;
  } else {
    state.p2Games++;
  }

  if (state.p1Games === 2 || state.p2Games === 2) {
    state.matchOver = true;
  } else {
    // Start next game — server switches to the player who won
    state.activePlayer = p1 > p2 ? 1 : 2;
    state.p1Score = 0;
    state.p2Score = 0;
  }
}

function getMatchWinner() {
  return state.p1Games > state.p2Games ? "Player 1" : "Player 2";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusText() {
  return "P" + state.activePlayer + " serving";
}

function buildOutput(text) {
  return {
    playerOneScore: state.p1Score,
    playerTwoScore: state.p2Score,
    playerOneGames: state.p1Games,
    playerTwoGames: state.p2Games,
    activePlayer:   state.activePlayer,
    statusText:     text
  };
}

// TODO: wire up a "switch active player" action to the back button or a
// touch gesture once the exact API for button callbacks is confirmed.
// Likely: function onButtonPress(button) { if (button === 'back') switchPlayer(); }

function switchPlayer() {
  state.activePlayer = state.activePlayer === 1 ? 2 : 1;
}
