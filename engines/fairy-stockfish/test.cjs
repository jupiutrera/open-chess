// Plays the built engine through UCI in Node: chess, a 5x5 board, a fairy piece, a custom
// variant from an ini, and an unlimited "go", which must still end.
//
//   node engines/fairy-stockfish/test.cjs [dir with the build]     # default: public/fairy
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const dir = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '..', 'public', 'fairy'))
const lines = []

// the build is a classic script that reads a global `Module`: run it in this context
globalThis.Module = { onLine: (line) => lines.push(line) }
globalThis.require = require
globalThis.__dirname = dir
globalThis.__filename = path.join(dir, 'fairy-stockfish.js')
vm.runInThisContext(fs.readFileSync(globalThis.__filename, 'utf8'), { filename: globalThis.__filename })

const ready = () =>
  new Promise((resolve) => {
    const t = setInterval(() => Module.ready && (clearInterval(t), resolve()), 10)
  })
// every command runs to its end inside the call, so its answer is already in `lines`
function send(cmd) {
  const from = lines.length
  Module.uci(cmd)
  return lines.slice(from)
}
function bestmove(out) {
  const line = out.find((l) => l.startsWith('bestmove'))
  assert.ok(line, 'no bestmove in:\n' + out.join('\n'))
  return line.split(' ')[1]
}

const CUSTOM = `
# a lone amazon against a whole army
[amazonhunt:chess]
amazon = a
startFen = rnbqkbnr/pppppppp/8/8/8/8/8/4A3 w kq - 0 1
extinctionValue = loss
extinctionPieceTypes = a
extinctionPseudoRoyal = true
`

;(async () => {
  await ready()
  assert.ok(send('uci').includes('uciok'), 'uci handshake')
  assert.deepStrictEqual(send('isready'), ['readyok'])

  send('position startpos moves e2e4 e7e5')
  console.log('chess:', bestmove(send('go depth 8')))

  send('setoption name UCI_Variant value gardner')
  send('position startpos')
  const g = bestmove(send('go movetime 300'))
  assert.match(g, /^[a-e][1-5][a-e][1-5]/, 'a Gardner move stays on the 5x5 board')
  console.log('gardner:', g)

  // the amazon (queen + knight) mates on the back rank
  send('setoption name UCI_Variant value amazon')
  send('position fen 7k/8/6K1/8/8/8/8/4A3 w - - 0 1')
  const mate = send('go depth 6')
  assert.ok(mate.some((l) => / score mate 1 /.test(l)), 'the amazon finds mate in one')
  console.log('amazon:', bestmove(mate))

  send({ variants: CUSTOM })
  send('setoption name UCI_Variant value amazonhunt')
  send('position startpos')
  const hunt = bestmove(send('go depth 4'))
  assert.match(hunt, /^e1/, 'the only white piece is the amazon')
  console.log('custom:', hunt)

  send('setoption name UCI_Variant value chess')
  send('position startpos')
  const t0 = Date.now()
  bestmove(send('go infinite'))
  assert.ok(Date.now() - t0 < 5000, 'an unlimited go ends on its own')

  console.log('ok')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
