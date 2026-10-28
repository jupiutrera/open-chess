/**
 * Thin UCI client around Stockfish running in a Web Worker.
 * Jobs are serialized: a new search stops the running one first.
 */

export interface Score {
  /** centipawns from White's point of view */
  cp?: number
  /** mate in N from White's point of view (negative: Black mates) */
  mate?: number
}

export interface PvLine {
  multipv: number
  depth: number
  score: Score
  pv: string[]
}

export interface SearchResult {
  bestmove: string | null
  lines: PvLine[]
  depth: number
}

export interface SearchOptions {
  depth?: number
  movetime?: number
  multipv?: number
  /** UCI_Elo limiting (1320-3190) */
  elo?: number
  /** Skill Level 0-20 */
  skill?: number
  /**
   * How the game reached `fen` (UCI moves from `startFen`), sent so the engine sees repetitions.
   * `fen` must be the position after those moves.
   */
  history?: { startFen: string; moves: string[] }
  onInfo?: (lines: PvLine[], depth: number) => void
}

import { Chess } from 'chess.js'

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

export class Engine {
  private worker: Worker
  private ready: Promise<void>
  private listeners = new Set<(line: string) => void>()
  /** rejecters of every promise waiting on the worker, failed together if it dies */
  private pending = new Set<(err: Error) => void>()
  private error: Error | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private gen = 0
  private current: { multipv: number; elo?: number; skill?: number } = { multipv: 1 }

  constructor() {
    this.worker = new Worker(ENGINE_URL)
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      for (const l of this.listeners) l(line)
    }
    this.worker.onerror = (e: ErrorEvent) => {
      e.preventDefault()
      this.fail(new Error(e.message || 'Stockfish failed to load'))
    }
    this.ready = (async () => {
      this.send('uci')
      await this.waitFor((l) => l === 'uciok')
      // phones with little memory get a smaller hash (several engines can be alive at once)
      const lowMemory = ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4
      this.send(`setoption name Hash value ${lowMemory ? 16 : 32}`)
      await this.isReady()
    })()
    // callers see the failure through search(); this only keeps it from being reported as unhandled
    this.ready.catch(() => undefined)
  }

  /** Set once the worker has crashed or failed to load; every search rejects from then on. */
  get failed(): Error | null {
    return this.error
  }

  private fail(err: Error) {
    if (this.error) return
    this.error = err
    this.listeners.clear()
    for (const reject of this.pending) reject(err)
    this.pending.clear()
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd)
  }

  /** Resolves on the first line matching `pred`; rejects if the worker dies first. */
  private waitFor(pred: (line: string) => boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.error) return reject(this.error)
      const fn = (l: string) => {
        if (pred(l)) {
          this.listeners.delete(fn)
          this.pending.delete(reject)
          resolve(l)
        }
      }
      this.listeners.add(fn)
      this.pending.add(reject)
    })
  }

  private async isReady() {
    this.send('isready')
    await this.waitFor((l) => l === 'readyok')
  }

  /** Clears the hash for a new game; queued so it never lands in the middle of a search. */
  newGame(): Promise<void> {
    this.stop()
    const job = this.queue.then(async () => {
      await this.ready
      this.send('ucinewgame')
      await this.isReady()
    })
    this.queue = job.catch(() => undefined)
    return job
  }

  /** Stops the running search (its promise resolves with partial results). */
  stop() {
    this.gen++
    this.send('stop')
  }

  search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    this.stop()
    const gen = this.gen
    const job = this.queue.then(() => this.run(fen, opts, gen))
    this.queue = job.catch(() => undefined)
    return job
  }

  private async run(fen: string, opts: SearchOptions, gen: number): Promise<SearchResult> {
    await this.ready
    if (gen !== this.gen) return { bestmove: null, lines: [], depth: 0 }
    // Stockfish never reports more lines than there are legal moves
    const multipv = Math.max(1, Math.min(opts.multipv ?? 1, legalMoveCount(fen)))
    if (multipv !== this.current.multipv) {
      this.send(`setoption name MultiPV value ${multipv}`)
      this.current.multipv = multipv
    }
    if (opts.elo !== this.current.elo) {
      if (opts.elo) {
        this.send('setoption name UCI_LimitStrength value true')
        this.send(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, opts.elo))}`)
      } else {
        this.send('setoption name UCI_LimitStrength value false')
      }
      this.current.elo = opts.elo
    }
    const skill = opts.skill ?? 20
    if (skill !== this.current.skill) {
      this.send(`setoption name Skill Level value ${skill}`)
      this.current.skill = skill
    }
    await this.isReady()

    // a newer search may have arrived while waiting for readyok
    if (gen !== this.gen) return { bestmove: null, lines: [], depth: 0 }

    const whiteToMove = fen.split(' ')[1] !== 'b'
    const lines = new Map<number, PvLine>()
    let lastDepth = 0

    const done = new Promise<SearchResult>((resolve, reject) => {
      if (this.error) return reject(this.error)
      const fn = (l: string) => {
        if (l.startsWith('info') && l.includes(' pv ')) {
          const parsed = parseInfo(l, whiteToMove)
          if (!parsed) return
          if (parsed.depth > lastDepth && parsed.multipv === 1) {
            lastDepth = parsed.depth
          }
          lines.set(parsed.multipv, parsed)
          if (parsed.multipv === multipv || multipv === 1) {
            opts.onInfo?.(sortedLines(lines), lastDepth)
          }
        } else if (l.startsWith('bestmove')) {
          this.listeners.delete(fn)
          this.pending.delete(reject)
          const bm = l.split(' ')[1]
          resolve({
            bestmove: bm && bm !== '(none)' ? bm : null,
            lines: sortedLines(lines),
            depth: lastDepth,
          })
        }
      }
      this.listeners.add(fn)
      this.pending.add(reject)
    })

    const h = opts.history
    this.send(h?.moves.length ? `position fen ${h.startFen} moves ${h.moves.join(' ')}` : `position fen ${fen}`)
    if (opts.movetime) this.send(`go movetime ${opts.movetime}${opts.depth ? ` depth ${opts.depth}` : ''}`)
    else if (opts.depth) this.send(`go depth ${opts.depth}`)
    else this.send('go infinite')
    return done
  }

  /** Terminates the worker; anything still waiting on it rejects instead of hanging. */
  destroy() {
    this.fail(new Error('Engine destroyed'))
    this.worker.terminate()
  }
}

/** Legal moves in `fen`; unknown (Infinity) when chess.js can't read it. */
export function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length
  } catch {
    return Infinity
  }
}

function sortedLines(lines: Map<number, PvLine>): PvLine[] {
  return [...lines.values()].sort((a, b) => a.multipv - b.multipv)
}

export function parseInfo(line: string, whiteToMove: boolean): PvLine | null {
  const tok = line.split(' ')
  const get = (k: string) => {
    const i = tok.indexOf(k)
    return i >= 0 ? tok[i + 1] : undefined
  }
  const depth = Number(get('depth'))
  const multipv = Number(get('multipv') ?? 1)
  const scoreIdx = tok.indexOf('score')
  if (scoreIdx < 0 || !depth) return null
  // fail-high/low bounds are not real scores
  if (tok.includes('lowerbound') || tok.includes('upperbound')) return null
  const kind = tok[scoreIdx + 1]
  const val = Number(tok[scoreIdx + 2])
  const sign = whiteToMove ? 1 : -1
  const score: Score = kind === 'mate' ? { mate: val * sign } : { cp: val * sign }
  const pvIdx = tok.indexOf('pv')
  const pv = pvIdx >= 0 ? tok.slice(pvIdx + 1) : []
  return { multipv, depth, score, pv }
}

let shared: Engine | null = null
/** One engine instance for background work (bots, review). A crashed worker is replaced. */
export function sharedEngine(): Engine {
  if (!shared || shared.failed) {
    // a crashed worker may still be alive (e.g. a load error): don't leave it running
    shared?.destroy()
    shared = new Engine()
  }
  return shared
}

export function formatScore(s: Score | undefined): string {
  if (!s) return '0.0'
  if (s.mate !== undefined) return s.mate === 0 ? '#' : `${s.mate > 0 ? '' : '-'}M${Math.abs(s.mate)}`
  const v = (s.cp ?? 0) / 100
  // decide the precision on the rounded value, so 9.96 prints "+10", not "+10.0"
  const digits = Math.abs(v) >= 9.95 ? 0 : 1
  const text = Math.abs(v).toFixed(digits)
  // anything that rounds to zero is plain "0.0", never "-0.0" or "+0.0"
  if (Number(text) === 0) return '0.0'
  return `${v > 0 ? '+' : '-'}${text}`
}
