// Downloads the board sound sets into public/sounds/<set>/<kind>.mp3.
// - wood: recorded wooden pieces from pychess (GPL-3.0), converted to mp3 and
//   peak-normalised with ffmpeg, which must be on PATH.
// - sfx, piano, nes, futuristic: Lichess sets by Enigmahack (AGPL-3.0+).
// Run with `npm run data:sounds`.
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KINDS = ['move', 'capture', 'check', 'castle', 'promote', 'start', 'end', 'win', 'lose', 'draw', 'correct', 'wrong', 'lowtime']

const LICHESS = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound'
const lichessMap = {
  move: 'Move',
  capture: 'Capture',
  check: 'Check',
  castle: 'Move',
  promote: 'Move',
  start: 'GenericNotify',
  end: 'GenericNotify',
  win: 'Victory',
  lose: 'Defeat',
  draw: 'Draw',
  correct: 'Confirmation',
  wrong: 'Error',
  lowtime: 'LowTime',
}

const PYCHESS = 'https://raw.githubusercontent.com/pychess/pychess/master/sounds'
const pychessMap = {
  move: 'move1',
  capture: 'capture2',
  check: 'check1',
  castle: 'castle',
  promote: 'mov2',
  start: 'start1',
  end: 'obs_end',
  win: 'win1',
  lose: 'lose1',
  draw: 'draw1',
  correct: 'success',
  wrong: 'invalid',
}

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

for (const set of ['sfx', 'piano', 'nes', 'futuristic']) {
  const dir = `public/sounds/${set}`
  mkdirSync(dir, { recursive: true })
  for (const kind of KINDS) {
    const file = `${dir}/${kind}.mp3`
    if (!existsSync(file)) writeFileSync(file, await get(`${LICHESS}/${set}/${lichessMap[kind]}.mp3`))
  }
}

const dir = 'public/sounds/wood'
mkdirSync(dir, { recursive: true })
const tmp = join(tmpdir(), 'oc-sounds')
mkdirSync(tmp, { recursive: true })
for (const kind of KINDS) {
  const file = `${dir}/${kind}.mp3`
  if (existsSync(file)) continue
  if (kind === 'lowtime') {
    // pychess has no low-time cue; borrow the Lichess one
    writeFileSync(file, await get(`${LICHESS}/sfx/LowTime.mp3`))
    continue
  }
  const wav = join(tmp, `${kind}.wav`)
  writeFileSync(wav, await get(`${PYCHESS}/${pychessMap[kind]}.wav`))
  // ffmpeg reports levels on stderr
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(probe)?.[1] ?? 0)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-af', `volume=${-3 - peak}dB`, '-ac', '1', '-ar', '44100', '-b:a', '128k', file])
}
rmSync(tmp, { recursive: true, force: true })
console.log('sounds written to public/sounds')
