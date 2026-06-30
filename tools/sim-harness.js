'use strict';
/*
 * Headless SuuntoPlus sports-app runtime emulator.
 *
 * The official simulator ("SuuntoPlus: Open Simulator") is a VS Code webview and
 * cannot be driven from a terminal. This harness instead loads an app's REAL
 * main.js and invokes the documented runtime callbacks the same way the watch's
 * ESW does, so the app *logic* (outputs, logged channels, summary outputs,
 * template transitions) can be exercised and asserted from Node.
 *
 * Contract (from the SDK reference bundled with the extension,
 * developer-doc/reference.html — event enum + lifecycle):
 *   1: evaluate()              ~1 Hz tick; output flush + channel logging happen here
 *   2: onLoad()                once, when the app is selected
 *   4: onLap()  8: onAutolap()
 *   128: onExerciseStart()     ... 1024: onExerciseEnd() (then getSummaryOutputs)
 *   4096: getUserInterface()   returns { template }
 *   16384: onEvent()           button events from templates ($.put('/Zapp/.../Event', id))
 *
 * Notes baked in:
 *  - Outputs set in onEvent are flushed to ESW only on the NEXT evaluate tick.
 *  - A manifest `out` entry is recorded to the FIT only if it has `"log": true`
 *    (max 5). We emulate that as "record messages": a sample is captured per tick
 *    when a logged channel's value has changed.
 *
 * Limits: this emulates app logic only. It does NOT render templates, does NOT
 * execute the HTML `$` resource bus, and therefore cannot observe real
 * `$.put('/Activity/Trigger', 23)` lap writes or real HR. Use the GUI simulator
 * or a watch for those. See tools/README.md.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EVENT = {
  evaluate: 1, onLoad: 2, onLap: 4, onAutolap: 8, onInterval: 16,
  onPoolLength: 32, onExerciseStart: 128, onExercisePause: 256,
  onExerciseContinue: 512, onExerciseEnd: 1024, onActivityChange: 2048,
  getUserInterface: 4096, onEvent: 16384, onAccelerometer: 32768,
};

class App {
  constructor(context, manifest, nativeLog) {
    this.ctx = context;
    this.manifest = manifest;
    this.nativeLog = nativeLog;                       // calls to unload()/etc.
    this.loggedChannels = (manifest.out || []).filter((o) => o.log).map((o) => o.name);
    this.input = {};                                  // watch -> app resources (this app reads none)
    this.output = {};                                 // app -> watch resources
    this.samples = [];                                // FIT "record" message emulation
    this.lastLogged = {};                             // per-channel last logged value
    this.t = 0;                                        // simulated seconds since load

    if (this.loggedChannels.length > 5) {
      throw new Error(`Manifest logs ${this.loggedChannels.length} channels; max is 5`);
    }

    this._call('onLoad');                             // lifecycle: onLoad runs first
    this.tick();                                       // ESW flushes/logs after load
  }

  has(name) { return typeof this.ctx[name] === 'function'; }

  _call(name, ...extra) {
    if (this.has(name)) return this.ctx[name](this.input, this.output, ...extra);
    return undefined;
  }

  /** One ESW tick (~1 s): run evaluate() if present, then flush + log channels. */
  tick() {
    this.t += 1;
    this._call('evaluate');
    this._logChangedChannels();
    return this.snapshot();
  }

  /** A button event from a template; outputs flush on the following tick. */
  event(eventId) {
    this._call('onEvent', eventId);
    return this.tick();
  }

  ui() { return this._call('getUserInterface') || {}; }

  summary() {
    return this.has('getSummaryOutputs') ? this.ctx.getSummaryOutputs(this.input, this.output) : [];
  }

  _logChangedChannels() {
    for (const name of this.loggedChannels) {
      const v = this.output[name];
      if (!(name in this.lastLogged) || this.lastLogged[name] !== v) {
        this.samples.push({ t: this.t, channel: name, value: v });
        this.lastLogged[name] = v;
      }
    }
  }

  /** Latest value recorded for a logged channel (or undefined). */
  channel(name) { return this.lastLogged[name]; }

  snapshot() {
    return { t: this.t, template: this.ui().template, output: Object.assign({}, this.output) };
  }
}

function loadApp(appDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'manifest.json'), 'utf8'));
  const src = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');

  const nativeLog = [];
  // Native globals the ESW exposes to main.js. Add stubs here as apps grow.
  const sandbox = {
    unload: (view) => nativeLog.push({ fn: 'unload', view }),
    playIndication: (name) => nativeLog.push({ fn: 'playIndication', name }),
    evalFile: () => undefined,
    Math, JSON, Array, Object, Number, String, Boolean, isNaN, parseInt, parseFloat,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(src, context, { filename: path.join(appDir, 'main.js') });

  return new App(context, manifest, nativeLog);
}

module.exports = { loadApp, App, EVENT };

// `node tools/sim-harness.js <appDir>` -> quick smoke load
if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, '..', 'badminton-scorer');
  const app = loadApp(dir);
  console.log(`Loaded "${app.manifest.name}" v${app.manifest.version}`);
  console.log('Logged channels:', app.loggedChannels.join(', ') || '(none)');
  console.log('Initial screen:', app.ui().template, '| output:', app.output);
}
