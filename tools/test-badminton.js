'use strict';
/*
 * Scenario test for the Badminton Scorer using the headless harness.
 * Run: node tools/test-badminton.js
 *
 * Scoring under test: BWF 3x15 — game to 15, win by 2 from 14-all, hard cap at
 * 21 (at 20-20 the next point wins), best of 3 games.
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
const { loadScreen, loadCourt } = require('./render-harness');

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

// Win a game with clean BWF scores. The loser's total must stay below 15 so
// their points, sent first, never trigger an early game end; then the winner's
// points run up to 15 (>=2 margin), whose last point fires checkGameOver.
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

console.log('\nGame 1 (you win 15-10):');
playGame(15, 10);
check('p1 (you) games = 1', app.output.game1Winner === 1 && app.output.playerOneScore === 0);
check('totalPoints = 25 after game 1', app.output.totalPoints === 25);
check("still on 'score' screen", app.ui().template === 'score');

console.log('\nGame 2 (opp win 11-15):');
playGame(11, 15);
check('totalPoints = 51 after game 2 (25 + 26)', app.output.totalPoints === 51);
check("still on 'score' screen", app.ui().template === 'score');

console.log('\nGame 3 (you win 15-13) -> match over:');
// before the final point, prove totalPoints is monotonic and not double-counted
for (let i = 0; i < 13; i++) oppScore();
for (let i = 0; i < 14; i++) youScore();
check('totalPoints = 78 just before match point', app.output.totalPoints === 78);
youScore(); // 15th point -> match over
check('totalPoints = 79 after match point (+1, no double-count)', app.output.totalPoints === 79);
check("screen switches to 'match-over'", app.ui().template === 'match-over');
check('unload() native was called on match end', app.nativeLog.some((c) => c.fn === 'unload'));

console.log('\nSummary outputs (FIT session / summary screen):');
const summary = Object.fromEntries(app.summary().map((o) => [o.id, o.value]));
check('your games = 2', summary.yg === 2);
check('opp games  = 1', summary.og === 1);
check('your points = 41 (15+11+15)', summary.yp === 41);
check('opp points  = 38 (10+15+13)', summary.op === 38);

console.log('\nLogged channels (FIT record messages):');
const tp = app.samples.filter((s) => s.channel === 'totalPoints').map((s) => s.value);
check('totalPoints channel is non-decreasing', tp.every((v, i) => i === 0 || v >= tp[i - 1]));
check('totalPoints channel reaches 79', tp[tp.length - 1] === 79);
check('exactly 3 channels are logged (<=5 limit)', app.loggedChannels.length === 3);

console.log('\nDeuce game caps at 21 (BWF: 20-20 -> next point wins):');
const c = loadApp(APP_DIR);
c.event(4); // start
for (let i = 0; i < 20; i++) { c.event(2); c.event(1); } // alternate to 20-20, no early win
check('20-20 reached without a game win',
  c.output.playerOneScore === 20 && c.output.playerTwoScore === 20 && c.output.game1Winner === 0);
c.event(2); // 21-20: hard cap, you win game 1
check('21st point wins at the cap (game1 winner = you, reset to 0-0, totalPoints 41)',
  c.output.game1Winner === 1 && c.output.playerOneScore === 0 && c.output.totalPoints === 41);

console.log('\nLap wiring in score.html (static check):');
const html = fs.readFileSync(path.join(APP_DIR, 'score.html'), 'utf8');
const onClicks = [...html.matchAll(/onClick="([^"]*)"/g)].map((m) => m[1]);
const longPresses = [...html.matchAll(/onLongPressStart="([^"]*)"/g)].map((m) => m[1]);
check('both scoring onClick handlers fire silent lap (Trigger 23)',
  onClicks.length === 2 && onClicks.every((h) => /\/Activity\/Trigger',\s*23/.test(h)));
check('no undo (long-press) handler fires a lap',
  longPresses.length === 2 && longPresses.every((h) => !/\/Activity\/Trigger/.test(h)));

console.log('\nMatch-over controls (static check):');
const moHtml = fs.readFileSync(path.join(APP_DIR, 'match-over.html'), 'utf8');
const moButtons = [...moHtml.matchAll(/<pushButton\b([\s\S]*?)\/>/g)].map((m) => m[1]);
const moUp = moButtons.find((b) => /name="up"/.test(b)) || '';
const moDown = moButtons.find((b) => /name="down"/.test(b)) || '';
// Neither button captures its click: taps fall through to the native pause/stop
// flow. Only the holds are app actions (hold up = new match, hold down = undo).
check('up hold starts a new match (Event 5), with no onClick (tap stays native)',
  /onLongPressStart="[^"]*Event',\s*5\b/.test(moUp) && !/onClick=/.test(moUp));
check('down hold undoes (Event 4), with no onClick (tap stays native)',
  /onLongPressStart="[^"]*Event',\s*4\b/.test(moDown) && !/onClick=/.test(moDown));
check('no button captures onClick (native pause/stop preserved on tap)',
  !/onClick=/.test(moHtml));
check('"not saved" text is gone', !/not saved/.test(moHtml));
check('the big 2-0/2-1 tally (#score-line) is gone', !/id="score-line"/.test(moHtml));
check('per-game score ids exist (g1/g2/g3, p1/p2)',
  ['g1-p1', 'g1-p2', 'g2-p1', 'g2-p2', 'g3-p1', 'g3-p2']
    .every((id) => moHtml.indexOf('id="' + id + '"') >= 0));

console.log('\nMatch-over screen render (real match-over.html):');
// Feed a finished match's outputs through the REAL match-over.html onActivate,
// then read back what each per-game column and the winner line show. Winners are
// pushed last so update() renders once with every score already in place.
function renderMatchOver(out) {
  const s = loadScreen(APP_DIR, 'match-over.html');
  const feed = s.subs;
  feed.game1P1Score(out.game1P1Score);
  feed.game1P2Score(out.game1P2Score);
  feed.game2P1Score(out.game2P1Score);
  feed.game2P2Score(out.game2P2Score);
  feed.playerOneScore(out.playerOneScore);
  feed.playerTwoScore(out.playerTwoScore);
  feed.game1Winner(out.game1Winner);
  feed.game2Winner(out.game2Winner);
  return s;
}

// THREE-GAME: the top-of-file `app` finished a 2-1 win (g1 15-10, g2 opp 11-15,
// g3 15-13). app.output is unchanged by the later fresh-loadApp sections.
const mo3 = renderMatchOver(app.output);
check('3-game: #g1-p1 shows your 15 in winner orange',
  mo3.text['#g1-p1'] === '15' && mo3.color['#g1-p1'] === '#FF6600');
check('3-game: #g1-p2 shows opp 10 in loser gray',
  mo3.text['#g1-p2'] === '10' && mo3.color['#g1-p2'] === '#888888');
check('3-game: #g2-p2 shows opp 15 in winner orange',
  mo3.text['#g2-p2'] === '15' && mo3.color['#g2-p2'] === '#FF6600');
check('3-game: #g2-p1 shows your 11 in loser gray',
  mo3.text['#g2-p1'] === '11' && mo3.color['#g2-p1'] === '#888888');
check('3-game: #g3-p1 shows your 15 in winner orange',
  mo3.text['#g3-p1'] === '15' && mo3.color['#g3-p1'] === '#FF6600');
check('3-game: #g3-p2 shows opp 13 in loser gray',
  mo3.text['#g3-p2'] === '13' && mo3.color['#g3-p2'] === '#888888');
check('3-game: game-3 divider is shown (on-screen, #666666)',
  mo3.style['#g3-sep'].background === '#666666' && mo3.style['#g3-sep'].left === '65%');
check('3-game: winner line "YOU WIN" in orange',
  mo3.text['#winner-line'] === 'YOU WIN' && mo3.color['#winner-line'] === '#FF6600');

// The SWEEP cases need fresh apps, but playGame() is bound to the top-of-file
// `app`. Mirror its "loser's points first, then winner's" order (so the loser
// never crosses 15 early) on a given instance to drive a 2-game sweep to 2-0.
function playSweep(a, you, opp) {
  a.event(4); // start
  const ys = () => a.event(2), os = () => a.event(1);
  for (let g = 0; g < 2; g++) {
    if (you > opp) { for (let i = 0; i < opp; i++) os(); for (let i = 0; i < you; i++) ys(); }
    else           { for (let i = 0; i < you; i++) ys(); for (let i = 0; i < opp; i++) os(); }
  }
  return a.output;
}

// SWEEP: you win 2-0 (15-10, 15-10). Game 3 column stays untouched (#000000).
const moSweep = renderMatchOver(playSweep(loadApp(APP_DIR), 15, 10));
check('sweep: #g1-p1 your 15 orange', moSweep.text['#g1-p1'] === '15' && moSweep.color['#g1-p1'] === '#FF6600');
check('sweep: #g1-p2 opp 10 gray', moSweep.text['#g1-p2'] === '10' && moSweep.color['#g1-p2'] === '#888888');
check('sweep: #g2-p1 your 15 orange', moSweep.text['#g2-p1'] === '15' && moSweep.color['#g2-p1'] === '#FF6600');
check('sweep: #g2-p2 opp 10 gray', moSweep.text['#g2-p2'] === '10' && moSweep.color['#g2-p2'] === '#888888');
check('sweep: #g3-p1 blanked - no third column', moSweep.text['#g3-p1'] === '' && moSweep.color['#g3-p1'] === '#000000');
check('sweep: #g3-p2 blanked - no third column', moSweep.text['#g3-p2'] === '' && moSweep.color['#g3-p2'] === '#000000');
check('sweep: game-3 divider is hidden (moved off-screen)', moSweep.style['#g3-sep'].left === '120%');
check('sweep: winner line "YOU WIN" in orange',
  moSweep.text['#winner-line'] === 'YOU WIN' && moSweep.color['#winner-line'] === '#FF6600');

// OPP-SWEEP: opponent wins 2-0 (10-15, 10-15).
const moOpp = renderMatchOver(playSweep(loadApp(APP_DIR), 10, 15));
check('opp sweep: winner line "OPP WINS" in white',
  moOpp.text['#winner-line'] === 'OPP WINS' && moOpp.color['#winner-line'] === '#FFFFFF');

// RIGHT-ALIGNMENT: the watch ignores CSS text-align, so single-digit scores are
// right-aligned by position (shifted right by one digit-width). A 3-game match
// with single-digit scores: g1 you 15 / opp 9, g2 you 11 / opp 15, g3 you 15 / opp 8.
const moAlign = renderMatchOver({
  game1Winner: 1, game1P1Score: 15, game1P2Score: 9,
  game2Winner: 2, game2P1Score: 11, game2P2Score: 15,
  playerOneScore: 15, playerTwoScore: 8,
});
check('align: two-digit rows share the column base (no shift)',
  moAlign.style['#g2t'].left === moAlign.style['#g2b'].left);
check('align: single-digit opp (9) is shifted right of the two-digit you (15)',
  parseInt(moAlign.style['#g1t'].left) > parseInt(moAlign.style['#g1b'].left));
check('align: single-digit opp (8) in game 3 is shifted right of its two-digit row',
  parseInt(moAlign.style['#g3t'].left) > parseInt(moAlign.style['#g3b'].left));

console.log('\nDoubles serve indicator (real score.html render):');
// The bug: when your side serves but your PARTNER is the server, nothing lit up.
// Reach that state through real game logic: in doubles your side wins the serve
// at 1-0, and with an odd team score the left-court player (your partner) serves.
const dbl = loadApp(APP_DIR);
check('doubles is the default mode', dbl.output.isDoubles === 1);
dbl.event(4); // start; defaults -> opponents serve first
dbl.event(2); // you score -> your side wins the serve at 1-0; partner is the server
check('your side is serving at 1-0 (partner, not you)',
  dbl.output.activePlayer === 1 && dbl.output.playerOneScore === 1 && dbl.output.youOnRight === 1);

const court = loadCourt(APP_DIR);
court.apply({ isDoubles: 1, youOnRight: dbl.output.youOnRight,
  activePlayer: dbl.output.activePlayer, p1: dbl.output.playerOneScore, p2: dbl.output.playerTwoScore });
check("partner serving -> partner 'o' marker is orange (like an opponent server)",
  court.marker('#dot-p1-l').text === 'o' && court.marker('#dot-p1-l').state === 'serve');
check("partner serving -> your 'Y' marker is gray (standing)",
  court.marker('#dot-p1-r').text === 'Y' && court.marker('#dot-p1-r').state === 'stand');
check('partner serving -> exactly one orange (server) marker on screen',
  court.orange().length === 1 && court.orange()[0] === '#dot-p1-l');

court.apply({ isDoubles: 1, youOnRight: 1, activePlayer: 1, p1: 0, p2: 0 });
check("you serving -> your 'Y' orange, partner court idle ('.'), one server",
  court.marker('#dot-p1-r').text === 'Y' && court.marker('#dot-p1-r').state === 'serve' &&
  court.marker('#dot-p1-l').text === '.' &&
  court.orange().length === 1 && court.orange()[0] === '#dot-p1-r');

court.apply({ isDoubles: 1, youOnRight: 1, activePlayer: 2, p1: 0, p2: 0 });
check("opponents serving -> one orange on their side; your 'Y' gray, partner court idle",
  court.orange().length === 1 && court.orange()[0].indexOf('#dot-p2') === 0 &&
  court.marker('#dot-p1-r').text === 'Y' && court.marker('#dot-p1-r').state === 'stand' &&
  court.marker('#dot-p1-l').text === '.' && court.marker('#dot-p1-l').state === 'off');

court.apply({ isDoubles: 0, youOnRight: 1, activePlayer: 1, p1: 0, p2: 0 });
check("singles unaffected -> only your 'Y' serves, no partner marker",
  court.marker('#dot-p1-r').text === 'Y' && court.marker('#dot-p1-r').state === 'serve' &&
  court.marker('#dot-p1-l').text === '.' && court.orange().length === 1);

console.log('\nLive-score finished-set alignment (real score.html render):');
// The history slots use the same position-based right-alignment as match-over.
// Two finished games: g1 you 15 / opp 9 (single digit), g2 you 11 / opp 15.
const hist = loadScreen(APP_DIR, 'score.html');
hist.subs.game1P1Score(15); hist.subs.game1P2Score(9);
hist.subs.game2P1Score(11); hist.subs.game2P2Score(15);
hist.subs.game1Winner(1); hist.subs.game2Winner(2);
check('history: two-digit rows in a slot share the base (no shift)',
  hist.style['#h1t'].left === hist.style['#h1b'].left);
check('history: single-digit score (9) in the older set is shifted right',
  parseInt(hist.style['#h2t'].left) > parseInt(hist.style['#h2b'].left));

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
for (let i = 0; i < 14; i++) g.event(2); // you -> 14-0
g.event(2); // 15-0: game won, resets to 0-0, games 1-0
check('game won: reset to 0-0, totalPoints 15, game1 winner = you',
  g.output.playerOneScore === 0 && g.output.totalPoints === 15 && g.output.game1Winner === 1);
g.event(3); // undo the game-winning point
check('undo rewinds the finished game back to 14-0',
  g.output.playerOneScore === 14 && g.output.totalPoints === 14 && g.output.game1Winner === 0);

console.log('\nUndo on the match-over screen un-ends the match:');
const m = loadApp(APP_DIR);
m.event(4); // start
for (let i = 0; i < 15; i++) m.event(2); // game 1: 15-0
for (let i = 0; i < 15; i++) m.event(2); // game 2: 15-0 -> match over
check('two games won -> match-over screen', m.ui().template === 'match-over');
m.event(4); // hold "down" on match-over = undo
check('undo un-ends the match -> back to score screen', m.ui().template === 'score');
check('final game restored to 14-0, game 2 not recorded',
  m.output.playerOneScore === 14 && m.output.playerTwoScore === 0 && m.output.game2Winner === 0);
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
for (let i = 0; i < 15; i++) r.event(2);
for (let i = 0; i < 15; i++) r.event(2); // match over
check('match-over reached', r.ui().template === 'match-over');
r.event(5); // new match
check('new match clears score and returns to setup',
  r.ui().template === 'setup' && r.output.totalPoints === 0 && r.output.game1Winner === 0);

console.log(`\nAll ${passed} checks passed.`);
