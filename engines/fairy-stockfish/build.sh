#!/usr/bin/env bash
# Builds Fairy-Stockfish as single-threaded WebAssembly, so it runs in any Web Worker
# without SharedArrayBuffer (GitHub Pages cannot send the headers it needs, and the
# Android WebView does not offer it).
#
# Needs git and Emscripten's emcc on PATH; CI uses the emscripten/emsdk image named in
# .github/workflows/fairy-engine.yml, and the committed files come from that build.
#
#   engines/fairy-stockfish/build.sh [output dir]     # default: public/fairy
set -euo pipefail

FSF_REPO="https://github.com/fairy-stockfish/Fairy-Stockfish"
# the upstream commit the patch was written against
FSF_COMMIT="4e3d0147d5b8da1b780a29f0b3e1d24311d028fa"

here="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$here/../../public/fairy}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git init -q "$work/fsf"
git -C "$work/fsf" fetch -q --depth 1 "$FSF_REPO" "$FSF_COMMIT"
git -C "$work/fsf" checkout -q FETCH_HEAD
git -C "$work/fsf" apply "$here/single-thread.patch"

cd "$work/fsf/src"

# the sources of upstream's own WebAssembly library (Makefile_js) with main.cpp in place of its bindings
SRCS="main.cpp benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp
  material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp position.cpp psqt.cpp
  search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp
  nnue/evaluate_nnue.cpp nnue/features/half_ka_v2.cpp
  partner.cpp parser.cpp piece.cpp variant.cpp xboard.cpp
  nnue/features/half_ka_v2_variants.cpp"

# SINGLE_THREAD       the patch: the search runs on the caller's stack, no std::thread
# LARGEBOARDS         boards up to 12x10 (Capablanca, Grand)
# ALLVARS             every built-in variant, as in the rules library (ffish)
# NNUE_EMBEDDING_OFF  no network is baked in: the evaluation is the classical one
# STACK_SIZE          the search recurses deeply; Emscripten's default is 64 KB
emcc -O3 -std=c++17 -Wall \
  -DNDEBUG -DSINGLE_THREAD -DLARGEBOARDS -DPRECOMPUTED_MAGICS -DALLVARS -DNNUE_EMBEDDING_OFF \
  $SRCS \
  -s ENVIRONMENT=worker,node \
  -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=64MB -s MAXIMUM_MEMORY=1GB \
  -s STACK_SIZE=8MB \
  -s FORCE_FILESYSTEM=1 \
  -s EXPORTED_FUNCTIONS=_main,_fsf_command \
  -s EXPORTED_RUNTIME_METHODS=ccall,FS \
  --pre-js "$here/pre.js" \
  -o "$out/fairy-stockfish.js"

ls -la "$out"
