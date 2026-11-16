# Fairy-Stockfish, single-threaded

The engine behind the chess variants: [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish) compiled to WebAssembly without threads, and its rules library (ffish.js) built from the same source.

## Why a build of our own

The official browser package (`fairy-stockfish-nnue.wasm`) needs `SharedArrayBuffer`, which browsers only give to pages served with cross-origin isolation headers. GitHub Pages cannot send them and the Android WebView does not offer it, so that package would not run where Open Chess runs. This build searches on the calling thread instead, as the Stockfish build used for standard chess does.

The rules library has a package too (`ffish-es6` on npm), but its bindings create functions with `new Function`, which the app's content security policy forbids. Building it here with `DYNAMIC_EXECUTION=0` leaves that out, and makes the board's rules and the engine's come from one commit.

## What is here

- `single-thread.patch`: the change to the upstream source, all of it behind `#ifdef SINGLE_THREAD`. No OS thread is created, the search runs on the caller's stack, and the engine takes one UCI command per call (`fsf_command`) instead of reading stdin.
- `pre.js`: the glue that turns worker messages into those calls and the engine's output into messages.
- `build.sh`: fetches the pinned upstream commit, applies the patch and compiles the engine and the rules library with Emscripten.
- `test.cjs`: plays the engine through UCI in Node.
- `test-rules.mjs`: asks the rules library for moves and results in Node.

The built files live in `public/fairy/`. The `Fairy engine` workflow rebuilds them on every pull request that touches this folder and fails if the committed files are not byte for byte that build, so what ships is always what this source produces.

## Limits of a single thread

- Every `go` needs a limit (`movetime`, `depth`, `nodes` or a clock). An unlimited one searches for two seconds.
- `stop` cannot interrupt a search: terminate the worker and start another.
- The evaluation is the classical one. No NNUE network ships with the build.

## Updating it

1. Change `FSF_COMMIT` in `build.sh` (and the patch, if it no longer applies).
2. Open a pull request: the workflow builds it and uploads the result as the `fairy-stockfish` artifact.
3. Copy the artifact's four files to `public/fairy/` and push. The workflow now checks them against its own build.

## License

Fairy-Stockfish is GPL-3.0-or-later, like Open Chess. This folder plus the pinned upstream commit is the corresponding source of `public/fairy/`. The single-thread approach follows [fairy-stockfish-single](https://github.com/VibesDIY/fairy-stockfish-single) (GPL-3.0-or-later).
