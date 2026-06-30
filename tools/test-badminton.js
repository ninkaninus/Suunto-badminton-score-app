'use strict';
/*
 * Scenario test for the Badminton Scorer using the headless harness.
 * Run: node tools/test-badminton.js
 *
 * Verifies the HR-correlation features:
 *  - logged channels (playerOneScore / playerTwoScore / totalPoints) record at the
 *    right times and totalPoints never double-counts the final game;
 *  - getSummaryOutputs returns correct end-of-match totals;
 *  - template transitions setup -> score -> match-over;
 *  - score.html fires a silent lap (/Activity/Trigger 23) on each scoring press
 *    and NOT on undo (static check, since the HTML bus isn't executed here).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadApp } = require('./sim-harness');

const APP_DIR = path.join(__dirname, '..', 'badminton-scorer');
let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  console.log('  ✓ ' + label);
  passed++;
}

const app = loadApp(APP_DIR);

// Event ids handled by main.js in the playing phase:
//   1 = opponent (P2) scores, 2 = you (P1) score, 3 = undo opp, 4 = undo you
const youScore = () => app.event(2);
const oppScore = () => app.event(1);

// Win a game with clean (>=2 margin, <=21) scores. The loser's points are sent
// first (they never reach a winning count), then the winner's points; the
// winner's last point triggers checkGameOver.
function playGame(you, opp) {
  const youWins = you > opp;
  if (youWins) { for (let i = 0; i < opp; i++) oppScore(); for (let i = 0; i < you; i++) youScore(); }
  else         { for (let i = 0; i < you; i++) youScore(); for (let i = 0; i < opp; i++) oppScore(); }
}

console.log('Badminton Scorer — headless sim test\n');

console.log('Setup & start:');
check("starts on 'setup' screen", app.ui().template === 'setup');
check('initial totalPoints logged as 0', app.channel('totalPoints') === 0);
app.event(4); // confirm setup with defaults -> playing
check("LAP/confirm starts match -> 'score' screen", app.ui().template === 'score');

console.log('\nGame 1 (you win 21-10):');
playGame(21, 10);
check('p1 (you) games = 1', app.output.game1Winner === 1 && app.output.playerOneScore === 0);
check('totalPoints = 31 after game 1', app.output.totalPoints === 31);
check("still on 'score' screen", app.ui().template === 'score');

console.log('\nGame 2 (opp win 15-21):');
playGame(15, 21);
check('totalPoints = 67 after game 2 (31 + 36)', app.output.totalPoints === 67);
check("still on 'score' screen", app.ui().template === 'score');

console.log('\nGame 3 (you win 21-18) -> match over:');
// before the final point, prove totalPoints is monotonic and not double-counted
for (let i = 0; i < 18; i++) oppScore();
for (let i = 0; i < 20; i++) youScore();
check('totalPoints = 105 just before match point', app.output.totalPoints === 105);
youScore(); // 21st point -> match over
check('totalPoints = 106 after match point (+1, no double-count)', app.output.totalPoints === 106);
check("screen switches to 'match-over'", app.ui().template === 'match-over');
check('unload() native was called on match end', app.nativeLog.some((c) => c.fn === 'unload'));

console.log('\nSummary outputs (FIT session / summary screen):');
const summary = Object.fromEntries(app.summary().map((o) => [o.id, o.value]));
check('your games = 2', summary.yg === 2);
check('opp games  = 1', summary.og === 1);
check('your points = 57 (21+15+21)', summary.yp === 57);
check('opp points  = 49 (10+21+18)', summary.op === 49);

console.log('\nLogged channels (FIT record messages):');
const tp = app.samples.filter((s) => s.channel === 'totalPoints').map((s) => s.value);
check('totalPoints channel is non-decreasing', tp.every((v, i) => i === 0 || v >= tp[i - 1]));
check('totalPoints channel reaches 106', tp[tp.length - 1] === 106);
check('exactly 3 channels are logged (<=5 limit)', app.loggedChannels.length === 3);

console.log('\nLap wiring in score.html (static check):');
const html = fs.readFileSync(path.join(APP_DIR, 'score.html'), 'utf8');
const onClicks = [...html.matchAll(/onClick="([^"]*)"/g)].map((m) => m[1]);
const longPresses = [...html.matchAll(/onLongPressStart="([^"]*)"/g)].map((m) => m[1]);
check('both scoring onClick handlers fire silent lap (Trigger 23)',
  onClicks.length === 2 && onClicks.every((h) => /\/Activity\/Trigger',\s*23/.test(h)));
check('no undo (long-press) handler fires a lap',
  longPresses.length === 2 && longPresses.every((h) => !/\/Activity\/Trigger/.test(h)));

console.log('\nUndo restores score + serve + side (fresh match):');
const u = loadApp(APP_DIR);
u.event(4); // start; defaults -> opponent serves first (activePlayer 2)
check('opponent serves first (activePlayer = 2)', u.output.activePlayer === 2);
u.event(2); // you score -> you win the serve
check('your point wins serve (activePlayer = 1, 1-0)',
  u.output.activePlayer === 1 && u.output.playerOneScore === 1 && u.output.youOnRight === 1);
u.event(2); // serving again -> your side switches
check('serving again switches your side (youOnRight 1 -> 0, 2-0)',
  u.output.youOnRight === 0 && u.output.playerOneScore === 2);
u.event(3); // undo last point (long-press up)
check('undo restores side + score (youOnRight 1, 1-0, you still serving)',
  u.output.youOnRight === 1 && u.output.playerOneScore === 1 && u.output.activePlayer === 1);
u.event(4); // undo again (long-press down) - both buttons undo
check('second undo restores serve to opponent (activePlayer 2, 0-0)',
  u.output.activePlayer === 2 && u.output.playerOneScore === 0);
u.event(3); // nothing left to undo
check('undo at 0-0 is a no-op', u.output.playerOneScore === 0 && u.output.playerTwoScore === 0);

console.log('\nUndo rewinds across a finished game:');
const g = loadApp(APP_DIR);
g.event(4); // start
for (let i = 0; i < 20; i++) g.event(2); // you -> 20-0
g.event(2); // 21-0: game won, resets to 0-0, games 1-0
check('game won: reset to 0-0, totalPoints 21, game1 winner = you',
  g.output.playerOneScore === 0 && g.output.totalPoints === 21 && g.output.game1Winner === 1);
g.event(3); // undo the game-winning point
check('undo rewinds the finished game back to 20-0',
  g.output.playerOneScore === 20 && g.output.totalPoints === 20 && g.output.game1Winner === 0);

console.log('\nUndo on the match-over screen un-ends the match:');
const m = loadApp(APP_DIR);
m.event(4); // start
for (let i = 0; i < 21; i++) m.event(2); // game 1: 21-0
for (let i = 0; i < 21; i++) m.event(2); // game 2: 21-0 -> match over
check('two games won -> match-over screen', m.ui().template === 'match-over');
m.event(4); // hold "down" on match-over = undo
check('undo un-ends the match -> back to score screen', m.ui().template === 'score');
check('final game restored to 20-0, game 2 not recorded',
  m.output.playerOneScore === 20 && m.output.playerTwoScore === 0 && m.output.game2Winner === 0);
m.event(2); // re-score the match point
check('re-scoring wins the match again', m.ui().template === 'match-over');

console.log('\nUndo past 0-0 returns to setup:');
const s = loadApp(APP_DIR);
s.event(4); // start -> score
s.event(2); // 1-0
s.event(3); // undo -> 0-0, still on score
check('undo to 0-0 stays on score screen',
  s.ui().template === 'score' && s.output.playerOneScore === 0);
s.event(3); // undo with empty stack -> setup
check('undo past 0-0 returns to setup', s.ui().template === 'setup');

console.log('\nNew match (UP on match-over) resets to setup:');
const r = loadApp(APP_DIR);
r.event(4);
for (let i = 0; i < 21; i++) r.event(2);
for (let i = 0; i < 21; i++) r.event(2); // match over
check('match-over reached', r.ui().template === 'match-over');
r.event(5); // new match
check('new match clears score and returns to setup',
  r.ui().template === 'setup' && r.output.totalPoints === 0 && r.output.game1Winner === 0);

console.log(`\nAll ${passed} checks passed.`);
