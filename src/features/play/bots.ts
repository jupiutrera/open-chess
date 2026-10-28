import { Chess, type Move } from 'chess.js'
import type { Engine, PvLine, Score } from '../../engine/engine'
import { epd, uciOf } from '../../chess/util'
import { winPercent } from '../review/classify'
import type { ChatEvent, ChatStyle } from './botChat'
import type { ChallengeKind } from './challenges'
import type { Lang } from '../../settings'
import { localize } from '../../i18n/content'

export type BotGroup = 'beginner' | 'intermediate' | 'advanced' | 'master' | 'engine' | 'challenge'

type Lines = { es: string[]; en: string[] }

export interface Bot {
  id: string
  name: string
  elo: number
  group: BotGroup
  hue: number
  bio: { es: string; en: string }
  /** voice for the in-game chat */
  style: ChatStyle
  /** lines of their own; the rest come from the style */
  says?: Partial<Record<ChatEvent, Lines>>
  /** preferred first moves (SAN) as White, and replies to 1.e4 / 1.d4 as Black */
  book?: { white?: string[]; vsE4?: string[]; vsD4?: string[] }
  /** challenge bots: the rule they play by (see challenges.ts) */
  challenge?: ChallengeKind
  /** a name that changes with the language; `name` is the fallback */
  title?: { es: string; en: string }
  /** whose portrait to wear, when not its own */
  avatar?: string
}

/** The bot's name in the given language. */
export function botName(bot: Bot, lang: Lang): string {
  return bot.title ? localize(bot.title, lang, `bots.${bot.id}.name`) : bot.name
}


export const BOTS: Bot[] = [
  {
    id: 'pip',
    name: 'Pip',
    elo: 250,
    group: 'beginner',
    hue: 95,
    style: 'kid',
    bio: { es: 'Acaba de aprender cómo se mueve el caballo y le encanta usarlo.', en: 'Just learned how the knight moves and loves using it.' },
    says: {
      greet: {
        es: ['¡Hola! ¿Sabías que el caballo salta en forma de L? ¡Es mi favorito!', '¡Vamos a jugar! Yo saco el caballito.'],
        en: ['Hi! Did you know the knight jumps in an L? It’s my favourite!', 'Let’s play! I’m bringing out the horsey.'],
      },
      win: { es: ['¡¡GANÉ!! Voy a contárselo a mi madre.'], en: ['I WON!! I’m telling my mum.'] },
      lose: { es: ['Jo... ¿echamos otra? Esta vez gano yo.'], en: ['Aww... another one? I’ll win this time.'] },
    },
    book: { white: ['Nc3', 'a4', 'h4'] },
  },
  {
    id: 'lola',
    name: 'Lola',
    elo: 400,
    group: 'beginner',
    hue: 340,
    style: 'bold',
    bio: { es: 'Saca la dama muy pronto. A veces funciona.', en: 'Brings the queen out early. Sometimes it works.' },
    says: {
      greet: {
        es: ['Te aviso: mi dama sale en la jugada dos.', '¡Hola! Prepárate, que voy a por todas.'],
        en: ['Fair warning: my queen comes out on move two.', 'Hi! Get ready, I’m going all in.'],
      },
      win: { es: ['¡Te lo dije! La dama siempre gana.'], en: ['Told you! The queen always wins.'] },
      lose: { es: ['Vale, vale... quizá saqué la dama un pelín pronto.'], en: ['OK, OK... maybe the queen came out a bit early.'] },
    },
    book: { white: ['e4'], vsE4: ['e5'] },
  },
  {
    id: 'teo',
    name: 'Teo',
    elo: 600,
    group: 'beginner',
    hue: 200,
    style: 'friendly',
    bio: { es: 'Juega en el club del barrio los sábados por la mañana.', en: 'Plays at the local club on Saturday mornings.' },
    says: {
      greet: { es: ['¡Buenas! Esto es como el club, pero sin el café de la máquina.'], en: ['Hey! Just like the club, minus the vending-machine coffee.'] },
    },
    book: { white: ['e4', 'd4'], vsE4: ['e5', 'c5'], vsD4: ['d5'] },
  },
  {
    id: 'marga',
    name: 'Marga',
    elo: 800,
    group: 'intermediate',
    hue: 30,
    style: 'calm',
    bio: { es: 'Le gustan las posiciones cerradas y no tiene ninguna prisa.', en: 'Likes closed positions and is never in a hurry.' },
    says: {
      greet: { es: ['Siéntate, cielo. Sin prisas, que esto va despacito.'], en: ['Have a seat, dear. No rush, we take it slow here.'] },
      win: { es: ['Ay, lo siento, cariño. La paciencia es mi truco.'], en: ['Oh, sorry, dear. Patience is my trick.'] },
    },
    book: { white: ['d4'], vsE4: ['e6', 'c6'], vsD4: ['d5', 'Nf6'] },
  },
  {
    id: 'ivan',
    name: 'Iván',
    elo: 1000,
    group: 'intermediate',
    hue: 260,
    style: 'bold',
    bio: { es: 'Atacante nato: si hay un sacrificio, lo intentará.', en: 'Born attacker: if there is a sacrifice, he will try it.' },
    says: {
      greet: {
        es: ['¿Defenderse? Eso es para los que no saben atacar.', 'Hoy sacrifico algo. Aún no sé qué.'],
        en: ['Defend? That’s for people who can’t attack.', 'I’m sacrificing something today. Not sure what yet.'],
      },
      win: { es: ['¡Al ataque siempre! ¿Viste ese final?'], en: ['Always attack! Did you see that finish?'] },
      lose: { es: ['El sacrificio era correcto. Casi seguro.'], en: ['The sacrifice was sound. Almost certainly.'] },
    },
    book: { white: ['e4'], vsE4: ['e5'], vsD4: ['Nf6'] },
  },
  {
    id: 'noa',
    name: 'Noa',
    elo: 1200,
    group: 'intermediate',
    hue: 160,
    style: 'studious',
    bio: { es: 'Estudia aperturas cada noche y se las sabe bastante bien.', en: 'Studies openings every night and knows them quite well.' },
    says: {
      greet: { es: ['Anoche me repasé doce variantes. Sorpréndeme.'], en: ['I reviewed twelve lines last night. Surprise me.'] },
      lose: { es: ['Eso no venía en mis apuntes. Lo anoto.'], en: ['That wasn’t in my notes. Writing it down.'] },
    },
    book: { white: ['e4', 'd4', 'c4'], vsE4: ['c5', 'e5'], vsD4: ['Nf6', 'd5'] },
  },
  {
    id: 'rafa',
    name: 'Rafa',
    elo: 1400,
    group: 'advanced',
    hue: 10,
    style: 'serious',
    bio: { es: 'Jugador de torneo sólido. Castiga los errores tácticos.', en: 'Solid tournament player. Punishes tactical mistakes.' },
    says: {
      greet: { es: ['Buena suerte. Juega con cuidado.'], en: ['Good luck. Play carefully.'] },
    },
    book: { white: ['e4', 'Nf3'], vsE4: ['c5', 'e6'], vsD4: ['Nf6'] },
  },
  {
    id: 'kira',
    name: 'Kira',
    elo: 1600,
    group: 'advanced',
    hue: 300,
    style: 'cool',
    bio: { es: 'Rápida y precisa. Le encantan los finales.', en: 'Fast and precise. Loves endgames.' },
    says: {
      greet: { es: ['Cambiamos damas y nos vemos en el final.'], en: ['Let’s trade queens and meet in the endgame.'] },
      win: { es: ['Los finales no perdonan.'], en: ['Endgames don’t forgive.'] },
    },
    book: { white: ['d4', 'c4'], vsE4: ['c6', 'e5'], vsD4: ['d5'] },
  },
  {
    id: 'oscar',
    name: 'Óscar',
    elo: 1800,
    group: 'advanced',
    hue: 220,
    style: 'cool',
    bio: { es: 'Experto de club con un repertorio muy afilado.', en: 'Club expert with a sharp repertoire.' },
    says: {
      greet: { es: ['Siciliana, como siempre. Tú eliges el sufrimiento.'], en: ['Sicilian, as always. You pick the pain.'] },
    },
    book: { white: ['e4'], vsE4: ['c5'], vsD4: ['Nf6'] },
  },
  {
    id: 'vera',
    name: 'Vera',
    elo: 2000,
    group: 'master',
    hue: 120,
    style: 'calm',
    bio: { es: 'Candidata a maestra. Juega posicional y no regala nada.', en: 'Candidate master. Positional and gives nothing away.' },
    says: {
      greet: { es: ['Una casilla débil es todo lo que necesito.'], en: ['One weak square is all I need.'] },
    },
    book: { white: ['d4', 'Nf3'], vsE4: ['e5', 'c6'], vsD4: ['Nf6'] },
  },
  {
    id: 'boris',
    name: 'Boris',
    elo: 2200,
    group: 'master',
    hue: 0,
    style: 'old',
    bio: { es: 'Maestro FIDE de la vieja escuela. Cálculo profundo.', en: 'Old-school FIDE master. Deep calculation.' },
    says: {
      greet: { es: ['En mis tiempos no había motores. Solo café y cálculo.'], en: ['In my day there were no engines. Just coffee and calculation.'] },
      win: { es: ['Hm. Bien jugado hasta la jugada veinte.'], en: ['Hm. Well played until move twenty.'] },
      lose: { es: ['Hm. Bien. Muy bien. Otra.'], en: ['Hm. Good. Very good. Again.'] },
    },
    book: { white: ['e4', 'd4'], vsE4: ['e5'], vsD4: ['d5'] },
  },
  {
    id: 'elena',
    name: 'Elena',
    elo: 2500,
    group: 'master',
    hue: 45,
    style: 'gm',
    bio: { es: 'Gran maestra. Prepárate para sufrir.', en: 'Grandmaster. Get ready to suffer.' },
    says: {
      greet: { es: ['Adelante. Enséñame lo que sabes.'], en: ['Go ahead. Show me what you know.'] },
      lose: { es: ['Impresionante. De verdad.'], en: ['Impressive. Truly.'] },
    },
    book: { white: ['e4', 'd4', 'c4', 'Nf3'], vsE4: ['c5', 'e5'], vsD4: ['Nf6', 'd5'] },
  },
  {
    id: 'stockfish',
    name: 'Stockfish',
    elo: 3200,
    group: 'engine',
    hue: 140,
    style: 'machine',
    bio: { es: 'El motor a máxima fuerza. Nadie le gana.', en: 'The engine at full strength. Nobody beats it.' },
  },
  // challenges: Stockfish with a funny handicap; `elo` is where it starts
  ...challengeBots([
    ['sf-fading', 'drain', 3200, 200, 'Meltfish', 'Meltfish', 'Empieza a 3200 y pierde 50 de Elo en cada jugada.', 'Starts at 3200 and loses 50 Elo every move.'],
    ['sf-rising', 'climb', 0, 90, 'Growfish', 'Growfish', 'Empieza a 0 de Elo y gana 50 en cada jugada, hasta 3200.', 'Starts at 0 Elo and gains 50 every move, up to 3200.'],
    ['sf-jealous', 'punishBest', 3200, 280, 'Envyfish', 'Envyfish', 'Pierde 300 de Elo cada vez que haces la mejor jugada.', 'Loses 300 Elo every time you play the best move.'],
    ['sf-kind', 'punishWorst', 3200, 330, 'Pityfish', 'Pityfish', 'Pierde 500 de Elo cada vez que haces la peor jugada.', 'Loses 500 Elo every time you play the worst move.'],
    ['sf-ticklish', 'punishCheck', 3200, 20, 'Ticklefish', 'Ticklefish', 'Pierde 300 de Elo cada vez que le das jaque.', 'Loses 300 Elo every time you give check.'],
    ['drawfish', 'drawfish', 3200, 50, 'Drawfish', 'Drawfish', 'Siempre busca la jugada más cercana al 0.00 y acepta cualquier oferta de tablas.', 'Always plays the move closest to 0.00 and accepts any draw offer.'],
    ['checkfish', 'checkfish', 3200, 0, 'Checkfish', 'Checkfish', 'Si puede dar jaque, da jaque. Si no, juega la mejor.', 'If it can give check, it gives check. Otherwise it plays the best move.'],
    ['sf-glutton', 'glutton', 3200, 30, 'Greedfish', 'Greedfish', 'Si puede capturar, captura: siempre la pieza más valiosa.', 'If it can capture, it captures: always the most valuable piece.'],
    ['sf-clumsy', 'clumsy', 3200, 180, 'Oopsfish', 'Oopsfish', 'Juega a tope, pero cada jugada tiene un 5 % de ser la peor posible.', 'Full strength, but every move has a 5% chance of being the worst one.'],
    ['sf-indecisive', 'top3', 3200, 240, 'Dicefish', 'Dicefish', 'Elige al azar una de sus tres mejores jugadas.', 'Picks one of its three best moves at random.'],
    ['sf-halfhearted', 'halving', 3200, 160, 'Coinfish', 'Coinfish', 'Juega su mejor jugada la mitad de las veces, la segunda una de cada cuatro, y así.', 'Plays its best move half the time, its second best a quarter of the time, and so on.'],
    ['sf-rollercoaster', 'captureSwing', 3200, 300, 'Yoyofish', 'Yoyofish', 'Cambia entre 3200 y 250 de Elo con cada captura, sea de quien sea.', 'Switches between 3200 and 250 Elo on every capture, by either side.'],
    ['sf-mirror', 'mirror', 3200, 190, 'Copyfish', 'Copyfish', 'Copia la calidad de tu última jugada: si fallas, falla; si aciertas, acierta.', 'Copies the quality of your last move: blunder and it blunders, play well and so does it.'],
    ['sf-queenless', 'noQueen', 3200, 120, 'Oddsfish', 'Oddsfish', 'Stockfish a tope, pero empieza sin dama. Tú llevas blancas.', 'Full-strength Stockfish, but it starts without its queen. You play White.'],
  ]),
]

function challengeBots(rows: [string, ChallengeKind, number, number, string, string, string, string][]): Bot[] {
  return rows.map(([id, challenge, elo, hue, es, en, bioEs, bioEn]) => ({
    id,
    name: en,
    title: { es, en },
    elo,
    group: 'challenge',
    hue,
    style: 'machine',
    avatar: 'stockfish',
    challenge,
    bio: { es: bioEs, en: bioEn },
  }))
}

export const BOT_GROUPS: BotGroup[] = ['beginner', 'intermediate', 'advanced', 'master', 'engine', 'challenge']

export function botById(id: string): Bot | undefined {
  return BOTS.find((b) => b.id === id)
}

/** Weakness model for ratings below Stockfish's UCI_Elo floor. */
function weakParams(elo: number) {
  if (elo < 150) return { depth: 1, randomP: 0.5, temp: 400, topN: 10 }
  if (elo <= 300) return { depth: 2, randomP: 0.35, temp: 260, topN: 8 }
  if (elo <= 450) return { depth: 3, randomP: 0.22, temp: 180, topN: 6 }
  if (elo <= 650) return { depth: 4, randomP: 0.14, temp: 120, topN: 5 }
  if (elo <= 850) return { depth: 5, randomP: 0.08, temp: 80, topN: 5 }
  if (elo <= 1050) return { depth: 6, randomP: 0.05, temp: 50, topN: 4 }
  return { depth: 8, randomP: 0.025, temp: 30, topN: 3 }
}

/**
 * A score as one number from the mover's side, on a centipawn scale: mates sit beyond any
 * eval and a shorter mate is worth more, so decisive positions still rank their moves.
 */
export function moverValue(score: Score, whiteToMove: boolean): number {
  const sign = whiteToMove ? 1 : -1
  if (score.mate !== undefined) {
    const m = score.mate * sign
    if (m === 0) return (score.cp ?? 0) * sign > 0 ? 20000 : -20000
    return m > 0 ? 20000 - 100 * m : -20000 - 100 * m
  }
  return Math.max(-10000, Math.min(10000, (score.cp ?? 0) * sign))
}

/** Win% (0-100) from the mover's side. */
export function moverWin(score: Score, whiteToMove: boolean): number {
  const w = winPercent(score)
  return whiteToMove ? w : 100 - w
}

/** A legal move that mates on the spot, if there is one. */
export function mateInOne(fen: string): string | null {
  for (const m of new Chess(fen).moves({ verbose: true })) {
    if (m.san.endsWith('#')) return m.from + m.to + (m.promotion ?? '')
  }
  return null
}

/**
 * Softmax choice among engine lines; `temp` sets how far it strays from the best. Level
 * positions compare win% (a pawn matters less once winning), but win% saturates in decisive
 * ones, so there raw centipawns and mate distance decide and a won game keeps being pushed.
 */
export function softPick(lines: PvLine[], whiteToMove: boolean, temp: number, rnd = Math.random): string | null {
  if (!lines.length) return null
  const wins = lines.map((l) => moverWin(l.score, whiteToMove))
  const decisive = Math.max(...wins) >= 95
  const values = decisive ? lines.map((l) => moverValue(l.score, whiteToMove)) : wins.map((w) => w * 10)
  const best = Math.max(...values)
  const weights = values.map((v) => Math.exp((v - best) / temp))
  const total = weights.reduce((a, b) => a + b, 0)
  let x = rnd() * total
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]
    if (x <= 0) return lines[i].pv[0] ?? null
  }
  return lines[0].pv[0] ?? null
}

function bookMove(bot: Bot, chess: Chess, hist: string[]): string | null {
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
  if (hist.length > 1) return null
  // a game from a custom position: the book only knows the standard start
  const fromStart = new Chess()
  try {
    for (const san of hist) fromStart.move(san)
  } catch {
    return null
  }
  if (epd(fromStart.fen()) !== epd(chess.fen())) return null
  if (hist.length === 0) return pick(bot.book?.white)
  if (hist.length === 1) {
    if (hist[0] === 'e4') return pick(bot.book?.vsE4)
    if (hist[0] === 'd4') return pick(bot.book?.vsD4)
  }
  return null
}

/** Thinking time for a search, shrunk so the bot never flags: about 1/30 of its clock plus the increment. */
export function budgetMs(wanted: number, clock?: { left: number; inc: number }): number {
  if (!clock) return wanted
  return Math.max(50, Math.min(wanted, clock.left / 30 + clock.inc * 0.8))
}

/** How the game got to the position: the start and the moves played (chess.js moves fit). */
export interface GameHistory {
  startFen: string
  moves: Pick<Move, 'san' | 'from' | 'to' | 'promotion'>[]
}

/** The history in the engine's form (UCI moves), so it sees repetitions. */
export function engineHistory(h?: GameHistory): { startFen: string; moves: string[] } | undefined {
  return h?.moves.length ? { startFen: h.startFen, moves: h.moves.map(uciOf) } : undefined
}

export interface RankedMove {
  uci: string
  score: Score
  /** moverValue of the score */
  value: number
  /** win% for the mover */
  win: number
}

/**
 * Every legal move with its score, best first, from one shallow search with a line per move.
 * A search cut short can miss moves (`complete` false); a superseded one returns none.
 */
export async function rankMoves(
  engine: Engine,
  fen: string,
  opts: { history?: GameHistory; depth?: number; movetime?: number } = {},
): Promise<{ moves: RankedMove[]; complete: boolean }> {
  const legal = new Chess(fen).moves().length
  const r = await engine.search(fen, { depth: opts.depth ?? 8, movetime: opts.movetime, multipv: legal, history: engineHistory(opts.history) })
  const whiteToMove = fen.split(' ')[1] !== 'b'
  const seen = new Set<string>()
  const moves: RankedMove[] = []
  for (const l of r.lines) {
    const uci = l.pv[0]
    if (!uci || seen.has(uci)) continue
    seen.add(uci)
    moves.push({ uci, score: l.score, value: moverValue(l.score, whiteToMove), win: moverWin(l.score, whiteToMove) })
  }
  moves.sort((a, b) => b.value - a.value)
  return { moves, complete: moves.length >= legal }
}

/**
 * Plays at any rating from 0 to 3200: full strength from 3200, Stockfish's own UCI_Elo limiter
 * from 1350, and below that a shallow search with a softmax over its best lines plus the odd
 * random move. Weak bots still never miss a mate in one.
 */
export async function playAtElo(
  engine: Engine,
  fen: string,
  elo: number,
  history?: GameHistory,
  clock?: { left: number; inc: number },
): Promise<string | null> {
  const chess = new Chess(fen)
  const legal = chess.moves({ verbose: true })
  if (!legal.length) return null
  const hist = engineHistory(history)
  if (elo >= 3200) {
    const r = await engine.search(fen, { movetime: budgetMs(1200, clock), history: hist })
    return r.bestmove
  }
  if (elo >= 1350) {
    const movetime = budgetMs(elo >= 2000 ? 900 : 500, clock)
    const r = await engine.search(fen, { movetime, elo, history: hist })
    return r.bestmove
  }

  const mate = mateInOne(fen)
  if (mate) return mate
  const p = weakParams(elo)
  if (Math.random() < p.randomP) {
    const m = legal[Math.floor(Math.random() * legal.length)]
    return m.from + m.to + (m.promotion ?? '')
  }
  const r = await engine.search(fen, { depth: p.depth, multipv: p.topN, history: hist })
  if (!r.lines.length) return r.bestmove
  return softPick(r.lines, chess.turn() === 'w', p.temp) ?? r.bestmove
}

/**
 * Picks the bot's move for the given position. `history` is how the game got there (the opening
 * book reads its SAN, the engine sees repetitions); `clock` is the bot's time left in ms.
 */
export async function botMove(
  bot: Bot,
  engine: Engine,
  fen: string,
  history?: GameHistory,
  clock?: { left: number; inc: number },
): Promise<string | null> {
  const chess = new Chess(fen)
  if (!chess.moves().length) return null
  const book = bookMove(bot, chess, history?.moves.map((m) => m.san) ?? [])
  if (book) return book
  return playAtElo(engine, fen, bot.group === 'engine' ? 3200 : bot.elo, history, clock)
}

/** Bots occasionally accept a draw when the position is level or worse for them. */
export function botAcceptsDraw(whiteWin: number, botColor: 'w' | 'b'): boolean {
  const mine = botColor === 'w' ? whiteWin : 100 - whiteWin
  return mine <= 48
}
