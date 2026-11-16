// Checks the built rules library in Node: node test-rules.mjs [dir with ffish.js]
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = resolve(process.argv[2] ?? 'public/fairy')
const { default: load } = await import(pathToFileURL(`${dir}/ffish.js`).href)
const ffish = await load({ wasmBinary: readFileSync(`${dir}/ffish.wasm`) })

let failed = 0
const check = (name, ok, got) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: ${got}`}`)
  if (!ok) failed++
}
const board = (variant, fen) => (fen ? new ffish.Board(variant, fen) : new ffish.Board(variant))

let b = board('chess')
check('chess has 20 first moves', b.numberLegalMoves() === 20, b.numberLegalMoves())
b.push('e2e4')
check('a move is played and named', b.fen().startsWith('rnbqkbnr/pppppppp/8/8/4P3/') && !b.turn(), b.fen())
b.pop()
check('and taken back', b.fen() === ffish.startingFen('chess'), b.fen())
b.delete()

check('gardner is 5x5', ffish.startingFen('gardner') === 'rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1', ffish.startingFen('gardner'))
check('capablanca is 10x8', ffish.startingFen('capablanca').startsWith('rnabqkbcnr/'), ffish.startingFen('capablanca'))

b = board('amazon', '7k/8/6K1/8/8/8/8/4A3 w - - 0 1')
b.push('e1e8')
check('the amazon mates', b.isGameOver(true) && b.result(true) === '1-0' && b.isCheck(), b.result(true))
b.delete()

b = board('kingofthehill', '8/8/8/8/8/3K4/8/7k w - - 0 1')
b.push('d3d4')
check('the king on the hill wins', b.isGameOver(true) && b.result(true) === '1-0', b.result(true))
b.delete()

ffish.loadVariantConfig('[amazonhunt:chess]\namazon = a\nstartFen = rnbqkbnr/pppppppp/8/8/8/8/8/4A3 w kq - 0 1\n')
check('a variant defined at run time loads', ffish.startingFen('amazonhunt').endsWith('/4A3 w kq - 0 1'), ffish.startingFen('amazonhunt'))

process.exit(failed ? 1 : 0)
