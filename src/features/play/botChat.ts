import type { Bot } from './bots'

export type ChatStyle = 'kid' | 'bold' | 'friendly' | 'calm' | 'studious' | 'serious' | 'cool' | 'old' | 'gm' | 'machine'

export type ChatEvent =
  /** game start */
  | 'greet'
  /** the bot took one of the user's pieces */
  | 'capture'
  /** the user took a minor piece or more from the bot */
  | 'lostPiece'
  /** the bot gives check */
  | 'check'
  /** the user's move was rated a blunder */
  | 'blunder'
  | 'win'
  | 'lose'
  | 'draw'

type Pool = Record<ChatEvent, { es: string[]; en: string[] }>

/** Shared lines per personality; each bot can override any event with its own. */
const POOLS: Record<ChatStyle, Pool> = {
  kid: {
    greet: { es: ['¡Hola! ¿Jugamos?'], en: ['Hi! Wanna play?'] },
    capture: { es: ['¡Ñam! Me la quedo.', '¡Te pillé!'], en: ['Yum! I’m keeping that.', 'Gotcha!'] },
    lostPiece: { es: ['¡Eh! ¡Esa era mía!', 'Ups... no la había visto.'], en: ['Hey! That was mine!', 'Oops... didn’t see that.'] },
    check: { es: ['¡Jaque! ¡Jaque! ¡Jaque!'], en: ['Check! Check! Check!'] },
    blunder: { es: ['Uy, ¿seguro que querías hacer eso?'], en: ['Uh, are you sure you wanted that?'] },
    win: { es: ['¡Gané, gané!'], en: ['I won, I won!'] },
    lose: { es: ['Jo, otra vez...'], en: ['Aww, not again...'] },
    draw: { es: ['¿Empate? ¡Pues chócala!'], en: ['A draw? High five!'] },
  },
  bold: {
    greet: { es: ['¡Que empiece la batalla!'], en: ['Let the battle begin!'] },
    capture: { es: ['¡Material para la cazuela!', 'Gracias por el regalo.'], en: ['More material for the pot!', 'Thanks for the gift.'] },
    lostPiece: { es: ['Bah, era un sacrificio. Obviamente.', 'Calculado. Más o menos.'], en: ['Bah, it was a sacrifice. Obviously.', 'Calculated. Roughly.'] },
    check: { es: ['¡Jaque! ¿Notas el calor?', '¡A por el rey!'], en: ['Check! Feeling the heat?', 'Go for the king!'] },
    blunder: { es: ['¡Ja! Eso lo he visto hasta yo.'], en: ['Ha! Even I saw that one.'] },
    win: { es: ['¡Victoria! Así se ataca.'], en: ['Victory! That’s how you attack.'] },
    lose: { es: ['Me pasé de valiente. Revancha.'], en: ['Too brave for my own good. Rematch.'] },
    draw: { es: ['¿Tablas? Qué aburrido... pero vale.'], en: ['A draw? Boring... but fine.'] },
  },
  friendly: {
    greet: { es: ['¡Que gane el mejor!'], en: ['May the best player win!'] },
    capture: { es: ['Perdona, no he podido resistirme.'], en: ['Sorry, couldn’t resist.'] },
    lostPiece: { es: ['¡Bien visto!', 'Vaya, buena jugada.'], en: ['Nicely spotted!', 'Wow, good move.'] },
    check: { es: ['Jaque, ¡cuidado con el rey!'], en: ['Check, watch your king!'] },
    blunder: { es: ['Mmm, ¿quieres pensarlo otra vez?'], en: ['Hmm, want to think that over?'] },
    win: { es: ['¡Buena partida! Casi me ganas.'], en: ['Good game! You nearly had me.'] },
    lose: { es: ['¡Enhorabuena! Has jugado genial.'], en: ['Congrats! You played great.'] },
    draw: { es: ['Tablas justas. ¡Buena partida!'], en: ['A fair draw. Good game!'] },
  },
  calm: {
    greet: { es: ['Tranquilidad. El ajedrez no tiene prisa.'], en: ['Easy now. Chess is never in a hurry.'] },
    capture: { es: ['Gracias.', 'Esto ya es mío.'], en: ['Thank you.', 'That’s mine now.'] },
    lostPiece: { es: ['Bien. Muy bien.'], en: ['Good. Very good.'] },
    check: { es: ['Jaque, con calma.'], en: ['Check, calmly.'] },
    blunder: { es: ['Despacito. Mira bien el tablero.'], en: ['Slowly. Look at the board.'] },
    win: { es: ['Paso a paso se llega lejos.'], en: ['Step by step gets you far.'] },
    lose: { es: ['Muy bien jugado. Me lo merecía.'], en: ['Very well played. I deserved that.'] },
    draw: { es: ['Un empate equilibrado.'], en: ['A balanced draw.'] },
  },
  studious: {
    greet: { es: ['Veamos qué apertura eliges.'], en: ['Let’s see which opening you pick.'] },
    capture: { es: ['Según mis apuntes, esto era gratis.'], en: ['According to my notes, that was free.'] },
    lostPiece: { es: ['Interesante. Eso no lo tenía preparado.'], en: ['Interesting. I hadn’t prepared that.'] },
    check: { es: ['Jaque. Teoría pura.'], en: ['Check. Pure theory.'] },
    blunder: { es: ['Eso es una imprecisión de manual.'], en: ['That’s a textbook inaccuracy.'] },
    win: { es: ['La preparación siempre compensa.'], en: ['Preparation always pays off.'] },
    lose: { es: ['Tengo que repasar esta línea.'], en: ['I need to review this line.'] },
    draw: { es: ['Tablas teóricas, como era de esperar.'], en: ['A theoretical draw, as expected.'] },
  },
  serious: {
    greet: { es: ['Empecemos.'], en: ['Let’s begin.'] },
    capture: { es: ['Error castigado.'], en: ['Mistake punished.'] },
    lostPiece: { es: ['Bien jugado.'], en: ['Well played.'] },
    check: { es: ['Jaque.'], en: ['Check.'] },
    blunder: { es: ['Eso se paga.'], en: ['That will cost you.'] },
    win: { es: ['Buena partida.'], en: ['Good game.'] },
    lose: { es: ['Merecido. Enhorabuena.'], en: ['Deserved. Congratulations.'] },
    draw: { es: ['Tablas. Correcto.'], en: ['Draw. Fair.'] },
  },
  cool: {
    greet: { es: ['A ver qué tienes.'], en: ['Let’s see what you’ve got.'] },
    capture: { es: ['Gracias.', 'Demasiado fácil.'], en: ['Thanks.', 'Too easy.'] },
    lostPiece: { es: ['Vaya. No está mal.'], en: ['Huh. Not bad.'] },
    check: { es: ['Jaque.', '¿Lo ves venir?'], en: ['Check.', 'See it coming?'] },
    blunder: { es: ['Eso ha sido un regalo.'], en: ['That was a gift.'] },
    win: { es: ['GG.'], en: ['GG.'] },
    lose: { es: ['Bien jugado. En serio.'], en: ['Well played. Seriously.'] },
    draw: { es: ['Tablas. Nos vemos.'], en: ['Draw. See you.'] },
  },
  old: {
    greet: { es: ['Ah, juventud. Veamos.'], en: ['Ah, youth. Let’s see.'] },
    capture: { es: ['Hm. Gratis.', 'En mis tiempos eso no se regalaba.'], en: ['Hm. Free.', 'In my day we didn’t give those away.'] },
    lostPiece: { es: ['Hm. Bien visto, chico.'], en: ['Hm. Well spotted, kid.'] },
    check: { es: ['Jaque. Mira bien.'], en: ['Check. Look carefully.'] },
    blunder: { es: ['Hm. Eso no lo enseñan en ningún libro.'], en: ['Hm. No book teaches that.'] },
    win: { es: ['La experiencia es un grado.'], en: ['Experience counts.'] },
    lose: { es: ['Hm. Me haces sentir joven otra vez.'], en: ['Hm. You make me feel young again.'] },
    draw: { es: ['Tablas. Como en los viejos tiempos.'], en: ['A draw. Like the old days.'] },
  },
  gm: {
    greet: { es: ['Juega tu mejor ajedrez.'], en: ['Play your best chess.'] },
    capture: { es: ['Gracias.'], en: ['Thank you.'] },
    lostPiece: { es: ['Precisa jugada.'], en: ['Precise.'] },
    check: { es: ['Jaque.'], en: ['Check.'] },
    blunder: { es: ['Eso ya no tiene arreglo.'], en: ['There’s no fixing that.'] },
    win: { es: ['Buena partida. Sigue entrenando.'], en: ['Good game. Keep training.'] },
    lose: { es: ['Excelente. Me has superado.'], en: ['Excellent. You outplayed me.'] },
    draw: { es: ['Tablas merecidas.'], en: ['A deserved draw.'] },
  },
  machine: {
    greet: { es: ['Iniciando búsqueda. Profundidad: suficiente.'], en: ['Search started. Depth: sufficient.'] },
    capture: { es: ['Material +1. Evaluación actualizada.'], en: ['Material +1. Evaluation updated.'] },
    lostPiece: { es: ['Sacrificio calculado hace 23 jugadas.'], en: ['Sacrifice calculated 23 moves ago.'] },
    check: { es: ['Jaque. Mate en camino.'], en: ['Check. Mate incoming.'] },
    blunder: { es: ['Error detectado. Evaluación: −4.2.'], en: ['Error detected. Evaluation: −4.2.'] },
    win: { es: ['Resultado previsto. Fin del proceso.'], en: ['Result as predicted. Process ended.'] },
    lose: { es: ['ERROR: resultado imposible.'], en: ['ERROR: impossible result.'] },
    draw: { es: ['Tablas. Inusual.'], en: ['Draw. Unusual.'] },
  },
}

export function botLine(bot: Bot, event: ChatEvent, lang: 'es' | 'en'): string {
  const own = bot.says?.[event]?.[lang]
  const list = own?.length ? own : POOLS[bot.style][event][lang]
  return list[Math.floor(Math.random() * list.length)]
}
