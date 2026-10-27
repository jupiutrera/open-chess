import { db, type GameRow } from '../../db/db'
import type { Quality } from '../review/classify'
import { parseGame } from '../review/analyze'
import type { Puzzle } from './puzzlesData'

export interface MistakePuzzle extends Puzzle {
  gameId: string
  /** the move that was played instead */
  san: string
  quality: Quality
  opponent: string
}

const BAD: Quality[] = ['blunder', 'miss', 'mistake']

/**
 * Exercises from the user's own reviewed games: the position after the opponent's move,
 * where the user went wrong, and the engine's best move as the answer.
 */
export function mistakesFromGame(game: GameRow): MistakePuzzle[] {
  const review = game.review
  if (!review || !game.userColor) return []
  let parsed: ReturnType<typeof parseGame>
  try {
    parsed = parseGame(game.pgn)
  } catch {
    return []
  }
  const out: MistakePuzzle[] = []
  for (const m of review.moves) {
    if (m.color !== game.userColor || !BAD.includes(m.quality) || !m.bestUci || m.ply < 2) continue
    // puzzles start one move earlier: the opponent's move is the setup, as in the Lichess set
    out.push({
      id: `m:${game.id}:${m.ply}`,
      fen: parsed.fens[m.ply - 2],
      moves: [parsed.moves[m.ply - 2].uci, m.bestUci],
      rating: 0,
      themes: [],
      gameId: game.id,
      san: m.san,
      quality: m.quality,
      opponent: game.userColor === 'w' ? game.black : game.white,
    })
  }
  return out
}

/** All of them, worst first, the ones not solved yet before the rest. */
export async function mistakePuzzles(): Promise<MistakePuzzle[]> {
  const [games, attempts] = await Promise.all([
    db.games.filter((g) => !g.deleted && !!g.review && !!g.userColor).toArray(),
    db.puzzleAttempts.where('mode').equals('mistakes').toArray(),
  ])
  const solved = new Set(attempts.filter((a) => a.solved && !a.deleted).map((a) => a.puzzleId))
  const rank = (q: Quality) => BAD.indexOf(q)
  return games
    .sort((a, b) => b.date - a.date)
    .flatMap(mistakesFromGame)
    .sort((a, b) => Number(solved.has(a.id)) - Number(solved.has(b.id)) || rank(a.quality) - rank(b.quality))
}
