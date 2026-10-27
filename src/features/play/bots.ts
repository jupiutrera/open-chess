import { Chess } from 'chess.js'
import type { Engine, PvLine } from '../../engine/engine'
import { winPercent } from '../review/classify'

export type BotGroup = 'beginner' | 'intermediate' | 'advanced' | 'master' | 'engine'

export interface Bot {
  id: string
  name: string
  elo: number
  group: BotGroup
  hue: number
  bio: { es: string; en: string }
  /** preferred first moves (SAN) as White, and replies to 1.e4 / 1.d4 as Black */
  book?: { white?: string[]; vsE4?: string[]; vsD4?: string[] }
}

export const BOTS: Bot[] = [
  { id: 'pip', name: 'Pip', elo: 250, group: 'beginner', hue: 95, bio: { es: 'Acaba de aprender cómo se mueve el caballo y le encanta usarlo.', en: 'Just learned how the knight moves and loves using it.' }, book: { white: ['Nc3', 'a4', 'h4'] } },
  { id: 'lola', name: 'Lola', elo: 400, group: 'beginner', hue: 340, bio: { es: 'Saca la dama muy pronto. A veces funciona.', en: 'Brings the queen out early. Sometimes it works.' }, book: { white: ['e4'], vsE4: ['e5'] } },
  { id: 'teo', name: 'Teo', elo: 600, group: 'beginner', hue: 200, bio: { es: 'Juega en el club del barrio los sábados por la mañana.', en: 'Plays at the local club on Saturday mornings.' }, book: { white: ['e4', 'd4'], vsE4: ['e5', 'c5'], vsD4: ['d5'] } },
  { id: 'marga', name: 'Marga', elo: 800, group: 'intermediate', hue: 30, bio: { es: 'Le gustan las posiciones cerradas y no tiene ninguna prisa.', en: 'Likes closed positions and is never in a hurry.' }, book: { white: ['d4'], vsE4: ['e6', 'c6'], vsD4: ['d5', 'Nf6'] } },
  { id: 'ivan', name: 'Iván', elo: 1000, group: 'intermediate', hue: 260, bio: { es: 'Atacante nato: si hay un sacrificio, lo intentará.', en: 'Born attacker: if there is a sacrifice, he will try it.' }, book: { white: ['e4'], vsE4: ['e5'], vsD4: ['Nf6'] } },
  { id: 'noa', name: 'Noa', elo: 1200, group: 'intermediate', hue: 160, bio: { es: 'Estudia aperturas cada noche y se las sabe bastante bien.', en: 'Studies openings every night and knows them quite well.' }, book: { white: ['e4', 'd4', 'c4'], vsE4: ['c5', 'e5'], vsD4: ['Nf6', 'd5'] } },
  { id: 'rafa', name: 'Rafa', elo: 1400, group: 'advanced', hue: 10, bio: { es: 'Jugador de torneo sólido. Castiga los errores tácticos.', en: 'Solid tournament player. Punishes tactical mistakes.' }, book: { white: ['e4', 'Nf3'], vsE4: ['c5', 'e6'], vsD4: ['Nf6'] } },
  { id: 'kira', name: 'Kira', elo: 1600, group: 'advanced', hue: 300, bio: { es: 'Rápida y precisa. Le encantan los finales.', en: 'Fast and precise. Loves endgames.' }, book: { white: ['d4', 'c4'], vsE4: ['c6', 'e5'], vsD4: ['d5'] } },
  { id: 'oscar', name: 'Óscar', elo: 1800, group: 'advanced', hue: 220, bio: { es: 'Experto de club con un repertorio muy afilado.', en: 'Club expert with a sharp repertoire.' }, book: { white: ['e4'], vsE4: ['c5'], vsD4: ['Nf6'] } },
  { id: 'vera', name: 'Vera', elo: 2000, group: 'master', hue: 120, bio: { es: 'Candidata a maestra. Juega posicional y no regala nada.', en: 'Candidate master. Positional and gives nothing away.' }, book: { white: ['d4', 'Nf3'], vsE4: ['e5', 'c6'], vsD4: ['Nf6'] } },
  { id: 'boris', name: 'Boris', elo: 2200, group: 'master', hue: 0, bio: { es: 'Maestro FIDE de la vieja escuela. Cálculo profundo.', en: 'Old-school FIDE master. Deep calculation.' }, book: { white: ['e4', 'd4'], vsE4: ['e5'], vsD4: ['d5'] } },
  { id: 'elena', name: 'Elena', elo: 2500, group: 'master', hue: 45, bio: { es: 'Gran maestra. Prepárate para sufrir.', en: 'Grandmaster. Get ready to suffer.' }, book: { white: ['e4', 'd4', 'c4', 'Nf3'], vsE4: ['c5', 'e5'], vsD4: ['Nf6', 'd5'] } },
  { id: 'stockfish', name: 'Stockfish', elo: 3200, group: 'engine', hue: 140, bio: { es: 'El motor a máxima fuerza. Nadie le gana.', en: 'The engine at full strength. Nobody beats it.' } },
]

export const BOT_GROUPS: BotGroup[] = ['beginner', 'intermediate', 'advanced', 'master', 'engine']

export function botById(id: string): Bot | undefined {
  return BOTS.find((b) => b.id === id)
}

/** Weakness model for ratings below Stockfish's UCI_Elo floor. */
function weakParams(elo: number) {
  if (elo <= 300) return { depth: 2, randomP: 0.35, temp: 260, topN: 8 }
  if (elo <= 450) return { depth: 3, randomP: 0.22, temp: 180, topN: 6 }
  if (elo <= 650) return { depth: 4, randomP: 0.14, temp: 120, topN: 5 }
  if (elo <= 850) return { depth: 5, randomP: 0.08, temp: 80, topN: 5 }
  if (elo <= 1050) return { depth: 6, randomP: 0.05, temp: 50, topN: 4 }
  return { depth: 8, randomP: 0.025, temp: 30, topN: 3 }
}

function scoreForMover(line: PvLine, whiteToMove: boolean): number {
  // convert to a centipawn-like number from the mover's side
  const w = winPercent(line.score)
  return whiteToMove ? w : 100 - w
}

function bookMove(bot: Bot, chess: Chess): string | null {
  const hist = chess.history()
  const pick = (list?: string[]) => {
    if (!list?.length) return null
    const san = list[Math.floor(Math.random() * list.length)]
    try {
      const m = new Chess(chess.fen()).move(san)
      return m.from + m.to + (m.promotion ?? '')
    } catch {
      return null
    }
  }
  if (hist.length === 0) return pick(bot.book?.white)
  if (hist.length === 1) {
    if (hist[0] === 'e4') return pick(bot.book?.vsE4)
    if (hist[0] === 'd4') return pick(bot.book?.vsD4)
  }
  return null
}

/** Picks the bot's move for the given position. */
export async function botMove(bot: Bot, engine: Engine, fen: string): Promise<string | null> {
  const chess = new Chess(fen)
  const legal = chess.moves({ verbose: true })
  if (!legal.length) return null
  const book = bookMove(bot, chess)
  if (book) return book

  if (bot.group === 'engine') {
    const r = await engine.search(fen, { movetime: 1200 })
    return r.bestmove
  }
  if (bot.elo >= 1350) {
    const movetime = bot.elo >= 2000 ? 900 : 500
    const r = await engine.search(fen, { movetime, elo: bot.elo })
    return r.bestmove
  }

  const p = weakParams(bot.elo)
  if (Math.random() < p.randomP) {
    const m = legal[Math.floor(Math.random() * legal.length)]
    return m.from + m.to + (m.promotion ?? '')
  }
  const r = await engine.search(fen, { depth: p.depth, multipv: p.topN })
  if (!r.lines.length) return r.bestmove
  const whiteToMove = chess.turn() === 'w'
  const scores = r.lines.map((l) => scoreForMover(l, whiteToMove))
  const best = Math.max(...scores)
  // softmax over win% with a temperature: weaker bots spread their choices
  const weights = scores.map((s) => Math.exp(((s - best) * 100) / p.temp / 10))
  const total = weights.reduce((a, b) => a + b, 0)
  let x = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]
    if (x <= 0) return r.lines[i].pv[0] ?? r.bestmove
  }
  return r.bestmove
}

/** Bots occasionally accept a draw when the position is level or worse for them. */
export function botAcceptsDraw(whiteWin: number, botColor: 'w' | 'b'): boolean {
  const mine = botColor === 'w' ? whiteWin : 100 - whiteWin
  return mine <= 48
}
