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

console.log(`\nAll ${passed} checks passed.`);
