import { Chess } from 'chess.js'
import type { Engine, PvLine } from '../../engine/engine'
import { winPercent } from '../review/classify'
import type { Look } from './BotAvatar'
import type { ChatEvent, ChatStyle } from './botChat'

export type BotGroup = 'beginner' | 'intermediate' | 'advanced' | 'master' | 'engine'

type Lines = { es: string[]; en: string[] }

export interface Bot {
  id: string
  name: string
  elo: number
  group: BotGroup
  hue: number
  bio: { es: string; en: string }
  /** portrait; Stockfish has none and is drawn as a robot fish */
  look?: Look
  /** voice for the in-game chat */
  style: ChatStyle
  /** lines of their own; the rest come from the style */
  says?: Partial<Record<ChatEvent, Lines>>
  /** preferred first moves (SAN) as White, and replies to 1.e4 / 1.d4 as Black */
  book?: { white?: string[]; vsE4?: string[]; vsD4?: string[] }
}

const SKIN = { light: '#f6d2b8', fair: '#eec1a0', tan: '#d9a27a', brown: '#b07850', dark: '#7a4e32' }

export const BOTS: Bot[] = [
  {
    id: 'pip',
    name: 'Pip',
    elo: 250,
    group: 'beginner',
    hue: 95,
    style: 'kid',
    bio: { es: 'Acaba de aprender cómo se mueve el caballo y le encanta usarlo.', en: 'Just learned how the knight moves and loves using it.' },
    look: { skin: SKIN.fair, hair: 'messy', hairColor: '#7a4a24', shirt: '#f2994a', hat: 'propeller', hatColor: '#4b8de3', blush: true },
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
    look: { skin: SKIN.light, hair: 'long', hairColor: '#c2552b', shirt: '#7b61ff', hat: 'bow', hatColor: '#ff5c8a', blush: true },
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
    look: { skin: SKIN.tan, hair: 'short', hairColor: '#e0b94f', shirt: '#2d9cdb', hat: 'cap', hatColor: '#e35d4b' },
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
    look: { skin: SKIN.light, hair: 'bun', hairColor: '#c9c6c1', shirt: '#6fa37a', glasses: 'round', eyes: 'sleepy', earrings: true },
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
    look: { skin: SKIN.fair, hair: 'spiky', hairColor: '#2b2b2b', shirt: '#e35d4b', hat: 'headband', hatColor: '#f2f2f2', brows: 'bold' },
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
    look: { skin: SKIN.brown, hair: 'bob', hairColor: '#1f1a17', shirt: '#f2c94c', glasses: 'round' },
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
    look: { skin: SKIN.tan, hair: 'short', hairColor: '#3b2a20', shirt: '#33475b', beard: 'stubble', brows: 'bold' },
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
    look: { skin: SKIN.light, hair: 'ponytail', hairColor: '#2a1f3d', shirt: '#1f1d2b', eyes: 'sharp', earrings: true },
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
    look: { skin: SKIN.fair, hair: 'slick', hairColor: '#4a3426', shirt: '#2f3c4f', glasses: 'square', beard: 'mustache' },
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
    look: { skin: SKIN.dark, hair: 'curly', hairColor: '#1b1411', shirt: '#9b6b43', earrings: true },
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
    look: { skin: SKIN.light, hair: 'bald', hairColor: '#b9b5ae', shirt: '#5a4636', beard: 'full', brows: 'bold' },
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
    look: { skin: SKIN.fair, hair: 'bun', hairColor: '#3a2418', shirt: '#1d1d1f', eyes: 'sharp', earrings: true },
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
