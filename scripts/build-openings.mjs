// Builds public/data/openings.json from lichess-org/chess-openings (CC0).
// Output: { "<epd>": [eco, name, pgnMoves] }
import { writeFileSync, mkdirSync } from 'node:fs'
import { Chess } from 'chess.js'

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/'
const out = {}
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${BASE}${f}.tsv`)
  if (!res.ok) throw new Error(`${f}.tsv: ${res.status}`)
  const lines = (await res.text()).trim().split('\n').slice(1)
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t')
    const c = new Chess()
    try {
      c.loadPgn(pgn)
    } catch {
      continue
    }
    const epd = c.fen().split(' ').slice(0, 4).join(' ')
    // keep the shortest line for each position (the most canonical name)
    const sans = c.history().join(' ')
    if (!out[epd] || out[epd][2].split(' ').length > sans.split(' ').length) out[epd] = [eco, name, sans]
  }
  console.log(f, Object.keys(out).length)
}
mkdirSync('public/data', { recursive: true })
writeFileSync('public/data/openings.json', JSON.stringify(out))
console.log('openings:', Object.keys(out).length)
