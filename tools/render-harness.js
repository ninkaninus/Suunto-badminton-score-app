'use strict';
/*
 * Headless renderer for a screen template's onActivate script.
 *
 * The GUI simulator can't run from a terminal, and sim-harness.js only executes
 * main.js — not the template JS. loadScreen() loads the REAL onActivate script
 * out of ANY screen file (score.html, match-over.html, ...) into a vm with
 * stubbed setText/setStyle/$ so a test can push output values through the actual
 * template code and read back what each element shows.
 *
 * loadScreen(appDir, file) returns { subs, text, color, marker, orange }:
 *   subs    output-channel-name -> subscribed callback (subs.game1Winner(1), ...)
 *   text    id -> last rendered text
 *   color   id -> last rendered color
 *   marker(id)  { text, state } where state comes from the serve-color map below
 *   orange()    list of ids currently colored #FF6600
 *
 * Marker colors (kept in sync with score.html):
 *   serve = #FF6600 (orange), stand = #999999 (gray), off = #555555 (faint).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const COLOR = { '#FF6600': 'serve', '#999999': 'stand', '#555555': 'off' };

// The four court-marker elements: your side (p1) and the opponent side (p2).
const DOTS = ['#dot-p1-l', '#dot-p1-r', '#dot-p2-l', '#dot-p2-r'];

// Extract and run a screen file's onActivate handler in a stubbed vm, exposing
// the subscriptions and everything it rendered.
function loadScreen(appDir, file) {
  const html = fs.readFileSync(path.join(appDir, file), 'utf8');
  const open = 'onActivate="';
  const start = html.indexOf(open);
  if (start < 0) throw new Error(file + ': onActivate handler not found');
  const from = start + open.length;
  const end = html.indexOf('"', from); // handlers use only single-quoted strings
  const code = html.slice(from, end);

  const text = {};   // id -> last rendered text
  const color = {};  // id -> last rendered color
  const style = {};  // id -> { prop: val } for every setStyle (left, opacity, ...)
  const subs = {};   // channel name -> subscribed callback

  const sandbox = {
    setText: (id, t) => { text[id] = String(t); },
    setStyle: (id, prop, val) => {
      (style[id] || (style[id] = {}))[prop] = val;
      if (prop === 'color') color[id] = val;
    },
    $: {
      subscribe: (topic, cb) => { subs[topic.slice(topic.lastIndexOf('/') + 1)] = cb; },
      put: () => undefined,
      publish: () => undefined,
    },
    Math, JSON, Array, Object, Number, String, Boolean, isNaN, parseInt, parseFloat,
  };
  vm.runInContext(code, vm.createContext(sandbox), { filename: path.join(appDir, file) });

  // { text, state } for an element id, where state is serve|stand|off.
  function marker(id) { return { text: text[id], state: COLOR[color[id]] || 'off' }; }

  // Every element currently drawn orange (#FF6600).
  function orange() { return Object.keys(color).filter((id) => color[id] === '#FF6600'); }

  return { subs, text, color, style, marker, orange };
}

// score.html-specific court renderer, built on loadScreen. apply() pushes a full
// state through the real subscriptions (updateCourt early-returns until
// activePlayer/playerOneScore/playerTwoScore are all known, so feeding every
// channel each time renders once with the complete state); orange() is narrowed
// to the four court dots so the doubles-serve test reads only server markers.
function loadCourt(appDir) {
  const screen = loadScreen(appDir, 'score.html');
  const subs = screen.subs;

  function apply(s) {
    subs.isDoubles(s.isDoubles ? 1 : 0);
    subs.youOnRight(s.youOnRight ? 1 : 0);
    subs.activePlayer(s.activePlayer);
    subs.playerOneScore(s.p1);
    subs.playerTwoScore(s.p2);
  }

  // Every court dot currently drawn orange (i.e. the server(s) on screen).
  function orange() { return DOTS.filter((id) => screen.marker(id).state === 'serve'); }

  return { apply, marker: screen.marker, orange };
}

module.exports = { loadScreen, loadCourt };
