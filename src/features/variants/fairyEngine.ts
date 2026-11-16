/**
 * The variants' opponent: Fairy-Stockfish in a Web Worker (see engines/fairy-stockfish).
 * The build is single-threaded, so a search cannot be interrupted: cancelling terminates
 * the worker, and the next search starts a fresh one.
 */
import { VARIANTS_INI, type Level, type Variant } from './catalog'

const ENGINE_URL = `${import.meta.env.BASE_URL}fairy/fairy-stockfish.js`

export class FairyEngine {
  private worker: Worker | null = null
  private waiting: { resolve: (move: string | null) => void; reject: (e: Error) => void } | null = null
  private variant: string | null = null

  private start(): Worker {
    const w = new Worker(ENGINE_URL)
    w.onmessage = (e: MessageEvent) => {
      const line = String(e.data)
      if (!line.startsWith('bestmove')) return
      const move = line.split(' ')[1]
      this.waiting?.resolve(move && move !== '(none)' ? move : null)
      this.waiting = null
    }
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault()
      this.waiting?.reject(new Error(e.message || 'Fairy-Stockfish failed to load'))
      this.waiting = null
      this.drop()
    }
    w.postMessage({ variants: VARIANTS_INI })
    w.postMessage('uci')
    this.variant = null
    return w
  }

  private drop() {
    this.worker?.terminate()
    this.worker = null
  }

  /** The engine's move in the position after `moves`, or null when there is none. A newer call cancels this one. */
  bestMove(v: Variant, startFen: string, moves: string[], level: Level): Promise<string | null> {
    this.cancel()
    const w = (this.worker ??= this.start())
    if (this.variant !== v.engine) {
      w.postMessage(`setoption name UCI_Variant value ${v.engine}`)
      w.postMessage('ucinewgame')
      this.variant = v.engine
    }
    w.postMessage(`setoption name Skill Level value ${level.skill}`)
    w.postMessage(`position fen ${startFen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`)
    w.postMessage(`go movetime ${level.movetime}`)
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject }
    })
  }

  /** Abandons the running search; its promise resolves with null. */
  cancel() {
    if (!this.waiting) return
    this.waiting.resolve(null)
    this.waiting = null
    this.drop()
  }

  destroy() {
    this.cancel()
    this.drop()
  }
}
