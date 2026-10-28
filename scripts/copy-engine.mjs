// Copies the Stockfish WASM build into public/ so it can run as a Web Worker.
// Runs on postinstall and again before every build, so a build never ships without the engine.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
const src = 'node_modules/stockfish/bin'
const dst = 'public/stockfish'
mkdirSync(dst, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  if (!existsSync(`${src}/${f}`)) {
    console.error(`missing ${src}/${f}: the stockfish package changed its file names or is not installed`)
    process.exit(1)
  }
  cpSync(`${src}/${f}`, `${dst}/${f}`)
}
console.log('stockfish copied to', dst)
