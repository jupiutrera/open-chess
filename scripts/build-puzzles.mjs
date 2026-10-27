// Streams the Lichess puzzle database (CC0) and writes a curated sample to
// public/data/puzzles/r<rating-bucket>.json, plus an index file.
// Each puzzle: [id, fen, moves, rating, themes]
import { mkdirSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync, constants } from 'node:zlib'

const NL = /\r?\n/
const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 4000)
const MIN = 400
const MAX = 3000
const STEP = 100
const buckets = new Map()
for (let r = MIN; r < MAX; r += STEP) buckets.set(r, [])
const total = buckets.size * PER_BUCKET

/**
 * The file is pzstd output: every zstd frame is preceded by a skippable frame
 * whose 4-byte payload is the compressed size of the next frame.
 */
async function* lines(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  let buf = Buffer.alloc(0)
  let carry = ''
  const reader = res.body.getReader()
  const opts = { params: { [constants.ZSTD_d_windowLogMax]: 31 } }
  let done = false
  try {
    while (!done) {
      const r = await reader.read()
      done = r.done
      if (r.value) buf = Buffer.concat([buf, Buffer.from(r.value)])
      for (;;) {
        if (buf.length < 8) break
        const magic = buf.readUInt32LE(0)
        let frame
        if ((magic & 0xfffffff0) === 0x184d2a50) {
          const size = buf.readUInt32LE(4)
          if (buf.length < 8 + size) break
          const frameSize = size === 4 ? buf.readUInt32LE(8) : 0
          if (buf.length < 8 + size + frameSize) break
          frame = buf.subarray(8 + size, 8 + size + frameSize)
          buf = buf.subarray(8 + size + frameSize)
          if (!frameSize) continue
        } else {
          // a plain zstd stream: only decodable once fully downloaded
          if (!done) break
          frame = buf
          buf = Buffer.alloc(0)
        }
        const parts = (carry + zstdDecompressSync(frame, opts).toString('utf8')).split(NL)
        carry = parts.pop()
        yield* parts
      }
    }
    if (carry) yield carry
  } finally {
    await reader.cancel().catch(() => {})
  }
}

let seen = 0
let kept = 0
for await (const line of lines(URL)) {
  if (seen++ === 0 && line.startsWith('PuzzleId')) continue
  const [id, fen, moves, rating, , popularity, nbPlays, themes] = line.split(',')
  const r = Number(rating)
  if (Number(popularity) < 85 || Number(nbPlays) < 300) continue
  const b = Math.floor(Math.max(MIN, Math.min(MAX - 1, r)) / STEP) * STEP
  const list = buckets.get(b)
  if (!list || list.length >= PER_BUCKET) continue
  list.push([id, fen, moves, r, themes])
  kept++
  if (kept % 10000 === 0) console.log(`kept ${kept}/${total} (scanned ${seen})`)
  if (kept >= total) break
}

mkdirSync('public/data/puzzles', { recursive: true })
const index = {}
for (const [b, list] of buckets) {
  writeFileSync(`public/data/puzzles/r${b}.json`, JSON.stringify(list))
  index[b] = list.length
}
writeFileSync('public/data/puzzles/index.json', JSON.stringify({ step: STEP, min: MIN, max: MAX, buckets: index }))
console.log('done', kept, 'puzzles from', seen, 'rows')
process.exit(0)
