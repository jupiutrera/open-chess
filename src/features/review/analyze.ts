import { Chess } from 'chess.js'
import { sharedEngine } from '../../engine/engine'
import { classifyMoves, gameAccuracy, terminalScore, winPercent, type PositionEval } from './classify'
import { bookChecker } from '../openings/openingsData'
import { db, put, type GameRow } from '../../db/db'
import { clearPartial, loadPartial, savePartial } from './partial'

export interface ParsedGame {
  startFen: string
  fens: string[]
  moves: { san: string; uci: string; from: string; to: string }[]
  headers: Record<string, string>
}

export function parseGame(pgn: string): ParsedGame {
  const c = new Chess()
  c.loadPgn(pgn)
  const hist = c.history({ verbose: true })
  const startFen = hist[0]?.before ?? c.fen()
  return {
    startFen,
    fens: [startFen, ...hist.map((m) => m.after)],
    moves: hist.map((m) => ({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to })),
    headers: c.getHeaders() as Record<string, string>,
  }
}

const PV_KEEP = 8

/** Runs Stockfish over every position and stores the review on the game row. */
export async function analyzeGame(
  game: GameRow,
  depth: number,
  onProgress: (done: number, total: number) => void,
  signal?: { cancelled: boolean },
): Promise<GameRow['review'] | null> {
  const parsed = parseGame(game.pgn)
  const engine = sharedEngine()
  await engine.newGame()
  const isBook = await bookChecker()
  // resume where an interrupted review of this game stopped
  const positions: PositionEval[] = loadPartial(game.id, depth, game.pgn, parsed.fens)
  const total = parsed.fens.length
  if (positions.length) onProgress(positions.length, total)
  for (let i = positions.length; i < total; i++) {
    if (signal?.cancelled) return null
    const fen = parsed.fens[i]
    const term = terminalScore(fen)
    if (term) {
      positions.push({ fen, lines: [], score: term })
    } else {
      // depth is the target; the time cap keeps a long game on a slow phone from taking minutes
      const r = await engine.search(fen, { depth, multipv: 2, movetime: 1200 })
      if (signal?.cancelled) return null
      positions.push({ fen, lines: r.lines, score: r.lines[0]?.score ?? { cp: 0 } })
      savePartial(game.id, depth, game.pgn, positions)
    }
    onProgress(i + 1, total)
  }
  const moves = classifyMoves(positions, parsed.moves, (fen, ply) => ply <= 30 && isBook(fen))
  const curve = positions.map((p) => winPercent(p.score))
  // short PVs are all the lines panel shows, and keep the synced row small
  const lines = positions.map((p) => p.lines.map((l) => ({ ...l, pv: l.pv.slice(0, PV_KEEP) })))
  const review = { depth, accuracy: gameAccuracy(curve, parsed.startFen.split(' ')[1] === 'b' ? 'b' : 'w'), moves, curve, lines }
  await put<GameRow>('games', { ...game, review })
  clearPartial(game.id)
  return review
}

export async function getGame(id: string): Promise<GameRow | undefined> {
  const g = await db.games.get(id)
  return g && !g.deleted ? g : undefined
}
