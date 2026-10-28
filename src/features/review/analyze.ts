import { Chess } from 'chess.js'
import { sharedEngine } from '../../engine/engine'
import { classifyMoves, gameAccuracy, terminalScore, winPercent, type PositionEval } from './classify'
import { bookChecker } from '../openings/openingsData'
import { db, put, type GameRow } from '../../db/db'

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
  const positions: PositionEval[] = []
  const total = parsed.fens.length
  for (let i = 0; i < total; i++) {
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
    }
    onProgress(i + 1, total)
  }
  const moves = classifyMoves(positions, parsed.moves, (fen, ply) => ply <= 30 && isBook(fen))
  const curve = positions.map((p) => winPercent(p.score))
  const review = { depth, accuracy: gameAccuracy(curve, parsed.startFen.split(' ')[1] === 'b' ? 'b' : 'w'), moves, curve }
  await put<GameRow>('games', { ...game, review })
  return review
}

export async function getGame(id: string): Promise<GameRow | undefined> {
  const g = await db.games.get(id)
  return g && !g.deleted ? g : undefined
}
