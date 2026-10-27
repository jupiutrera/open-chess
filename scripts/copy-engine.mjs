// Copies the Stockfish WASM build into public/ so it can run as a Web Worker.
import { cpSync, mkdirSync } from 'node:fs'
const src = 'node_modules/stockfish/bin'
const dst = 'public/stockfish'
mkdirSync(dst, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  cpSync(`${src}/${f}`, `${dst}/${f}`)
}
console.log('stockfish copied to', dst)
