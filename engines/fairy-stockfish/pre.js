// Glue between the single-threaded Fairy-Stockfish build and its host.
// Emscripten pastes this file in front of its own output (--pre-js), so it runs
// first and sets up `Module` before the engine starts.
//
// In a Web Worker:
//   - a string posted by the page is one or more UCI lines, run in order;
//   - every line the engine prints is posted back as a string;
//   - posting { variants: "<variants.ini text>" } loads custom variants.
// In Node (the smoke test): set Module.onLine before loading the script and call
// Module.uci("go depth 5") once Module.ready is true.
//
// A "go" runs to its end inside the call (there is no second thread), so every
// search needs a limit and "stop" cannot interrupt it: terminate the worker instead.
//
// Based on fairy-stockfish-single by Vibes DIY (GPL-3.0-or-later).

(function () {
  var isWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope

  function emit(line) {
    if (typeof Module.onLine === 'function') Module.onLine(line)
    else if (isWorker) self.postMessage(line)
    else console.log(line)
  }
  Module.print = emit
  Module.printErr = function (line) {
    emit('info string ' + line)
  }

  var pending = []
  Module.ready = false

  function runLine(line) {
    Module.ccall('fsf_command', null, ['string'], [line])
  }

  function handle(message) {
    if (message && typeof message === 'object' && typeof message.variants === 'string') {
      // the names defined in the ini become valid values of UCI_Variant
      Module.FS.writeFile('/variants.ini', message.variants)
      runLine('setoption name VariantPath value /variants.ini')
      return
    }
    String(message)
      .split('\n')
      .forEach(function (line) {
        line = line.trim()
        if (line) runLine(line)
      })
  }

  Module.uci = function (message) {
    if (Module.ready) handle(message)
    else pending.push(message)
  }

  // postRun fires after main() has initialised the engine: only then can it take commands
  Module.postRun = [].concat(Module.postRun || [], function () {
    Module.ready = true
    pending.splice(0).forEach(handle)
  })

  if (isWorker) {
    self.onmessage = function (event) {
      Module.uci(event.data)
    }
  }
})()
