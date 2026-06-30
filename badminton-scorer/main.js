var currentTemplate = 'setup';

var state = {
  phase: 'setup',
  setupField: 'mode',
  mode: 'doubles',
  p1Score: 0,
  p2Score: 0,
  p1Games: 0,
  p2Games: 0,
  gameHistory: [],
  servingTeam: 2,
  youOnRight: true,
  youOnRightAtGameStart: true,
  matchOver: false,
  pointStack: []
};

var checkGameOver = function() {
  var p1 = state.p1Score;
  var p2 = state.p2Score;
  var gameWon =
    (p1 >= 21 && p1 - p2 >= 2) ||
    (p2 >= 21 && p2 - p1 >= 2) ||
    p1 == 30 ||
    p2 == 30;
  if (!gameWon) return;
  state.gameHistory.push({ p1: p1, p2: p2, winner: p1 > p2 ? 1 : 2 });
  if (p1 > p2) { state.p1Games++; } else { state.p2Games++; }
  if (state.p1Games == 2 || state.p2Games == 2) {
    state.matchOver = true;
    currentTemplate = 'match-over';
    unload('_cm');
  } else {
    state.servingTeam = p1 > p2 ? 1 : 2;
    state.youOnRight = state.youOnRightAtGameStart;
    state.p1Score = 0;
    state.p2Score = 0;
  }
};

// Cumulative points across the whole match. The current game is only pushed
// into gameHistory when it is won; on match over the final game's scores are
// left in p1Score/p2Score *and* present in gameHistory, so only add the live
// game while the match is still running to avoid double-counting it.
var matchTotals = function() {
  var p1 = 0, p2 = 0;
  for (var i = 0; i < state.gameHistory.length; i++) {
    p1 += state.gameHistory[i].p1;
    p2 += state.gameHistory[i].p2;
  }
  if (!state.matchOver) {
    p1 += state.p1Score;
    p2 += state.p2Score;
  }
  return { p1: p1, p2: p2, total: p1 + p2 };
};

// Snapshot taken before every point so undo can fully restore the prior state
// (score, serving team, your side, games). The stack lets the user press undo
// repeatedly to walk back several points, even across a finished game — which
// is also how a wrong server is corrected.
var pushUndo = function() {
  state.pointStack.push({
    p1Score: state.p1Score, p2Score: state.p2Score,
    servingTeam: state.servingTeam, youOnRight: state.youOnRight,
    p1Games: state.p1Games, p2Games: state.p2Games,
    ghLen: state.gameHistory.length, matchOver: state.matchOver
  });
};

var popUndo = function() {
  if (state.pointStack.length == 0) return;
  var s = state.pointStack.pop();
  state.p1Score = s.p1Score; state.p2Score = s.p2Score;
  state.servingTeam = s.servingTeam; state.youOnRight = s.youOnRight;
  state.p1Games = s.p1Games; state.p2Games = s.p2Games;
  state.matchOver = s.matchOver;
  while (state.gameHistory.length > s.ghLen) state.gameHistory.pop();
};

var sync = function(output) {
  output.playerOneScore = state.p1Score;
  output.playerTwoScore = state.p2Score;
  output.totalPoints    = matchTotals().total;
  output.activePlayer   = state.servingTeam;
  output.game1Winner    = state.gameHistory.length >= 1 ? state.gameHistory[0].winner : 0;
  output.game2Winner    = state.gameHistory.length >= 2 ? state.gameHistory[1].winner : 0;
  output.game1P1Score   = state.gameHistory.length >= 1 ? state.gameHistory[0].p1 : 0;
  output.game1P2Score   = state.gameHistory.length >= 1 ? state.gameHistory[0].p2 : 0;
  output.game2P1Score   = state.gameHistory.length >= 2 ? state.gameHistory[1].p1 : 0;
  output.game2P2Score   = state.gameHistory.length >= 2 ? state.gameHistory[1].p2 : 0;
  output.youOnRight     = state.youOnRight ? 1 : 0;

  output.setupFieldIdx      = state.setupField == 'mode' ? 0 : state.setupField == 'serve' ? 1 : state.setupField == 'court' ? 2 : 3;
  output.isDoubles          = state.mode == 'doubles' ? 1 : 0;
  output.setupServesFirst   = state.servingTeam == 1 ? 1 : 0;
  output.setupYouServeFirst = state.youOnRightAtGameStart ? 1 : 0;
};

function onLoad(input, output) {
  sync(output);
}

// Undo works while playing and on the match-over screen. Undoing the last
// remaining point (nothing left on the stack) drops back to setup for a fresh
// start. Undoing the match-winning point un-ends the match.
var undoLastPoint = function(output) {
  if (state.pointStack.length == 0) {
    state.phase = 'setup';
    state.setupField = 'mode';
    currentTemplate = 'setup';
    sync(output);
    unload('_cm');
    return;
  }
  var wasOver = state.matchOver;
  popUndo();
  sync(output);
  if (wasOver) {
    currentTemplate = 'score';
    unload('_cm');
  }
};

// Reset for a new match. The current match's data is lost (a recording keeps a
// single match's summary). Returns to setup to reconfigure serve/mode.
var newMatch = function(output) {
  state.p1Score = 0; state.p2Score = 0;
  state.p1Games = 0; state.p2Games = 0;
  state.gameHistory = [];
  state.pointStack = [];
  state.matchOver = false;
  state.phase = 'setup';
  state.setupField = 'mode';
  currentTemplate = 'setup';
  sync(output);
  unload('_cm');
};

function onEvent(input, output, eventId) {
  if (state.phase == 'setup') {
    if (eventId == 1) {
      if (state.setupField == 'mode') {
        state.setupField = 'serve';
      } else if (state.setupField == 'serve') {
        state.setupField = (state.mode == 'doubles' && state.servingTeam == 1) ? 'court' : 'mode';
      } else {
        state.setupField = 'mode';
      }
    } else if (eventId == 2) {
      if (state.setupField == 'mode') {
        state.mode = state.mode == 'singles' ? 'doubles' : 'singles';
      } else if (state.setupField == 'serve') {
        state.servingTeam = state.servingTeam == 1 ? 2 : 1;
      } else {
        state.youOnRightAtGameStart = !state.youOnRightAtGameStart;
        state.youOnRight = state.youOnRightAtGameStart;
      }
    } else if (eventId == 4) {
      state.phase = 'playing';
      sync(output);
      currentTemplate = 'score';
      unload('_cm');
      return;
    }
    sync(output);
    return;
  }

  // Playing, or the match-over screen.
  if (eventId == 1 || eventId == 2) {
    if (state.matchOver) return;            // no more scoring once the match is over
    pushUndo();
    if (eventId == 1) {
      state.p2Score++;
      if (state.servingTeam != 2) { state.servingTeam = 2; }
    } else {
      state.p1Score++;
      if (state.servingTeam == 1) {
        state.youOnRight = !state.youOnRight;
      } else {
        state.servingTeam = 1;
      }
    }
    checkGameOver();
  } else if (eventId == 3 || eventId == 4) {
    undoLastPoint(output);                   // also handles match-over and 0-0
    return;
  } else if (eventId == 5) {
    newMatch(output);                        // "new match" from the match-over screen
    return;
  }
  sync(output);
}

function getUserInterface() {
  return { template: currentTemplate };
}

// Shown on the watch end-of-exercise summary and in the Suunto mobile app.
// Kept to 4 fields (practical limit is ~4-5).
function getSummaryOutputs(input, output) {
  var t = matchTotals();
  return [
    { id: 'yg', name: 'Your games',  format: 'Count_Twodigits',   value: state.p1Games },
    { id: 'og', name: 'Opp games',   format: 'Count_Twodigits',   value: state.p2Games },
    { id: 'yp', name: 'Your points', format: 'Count_Threedigits', value: t.p1 },
    { id: 'op', name: 'Opp points',  format: 'Count_Threedigits', value: t.p2 }
  ];
}
