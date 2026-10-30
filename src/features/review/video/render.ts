import { Chess } from 'chess.js'
import { QUALITIES, QUALITY_SYMBOL, type Quality } from '../classify'
import type { PieceSet } from '../../../settings'
import type { Moment } from './timeline'

/**
 * Draws one frame of the vertical review video (1080×1920) on a canvas: player bars, the board
 * with the move sliding in, an eval bar, the move's quality and a title and closing card. Colours
 * come from the app's own tokens, so the video looks like the review screen.
 */

export const WIDTH = 1080
export const HEIGHT = 1920

const MARGIN = 48
const BAR = 34
const GAP = 14
const BOARD = WIDTH - MARGIN * 2 - BAR - GAP
const BOARD_X = MARGIN + BAR + GAP
const BOARD_Y = 470
const SQ = BOARD / 8

export interface VideoGame {
  white: string
  black: string
  result: string
  accuracy?: { white: number; black: number }
  /** every position, start first */
  fens: string[]
  moves: { from: string; to: string; san: string }[]
  qualities: Quality[]
  /** win% for White, one per position; empty hides the eval bar */
  curve: number[]
  orientation: 'white' | 'black'
}

/** The words the video shows, already in the user's language. */
export interface VideoText {
  quality: Record<Quality, string>
  accuracy: (value: number) => string
  moveNumber: (ply: number) => string
  result: string
  footer: string
  vs: string
}

export interface VideoTheme {
  light: string
  dark: string
  last: string
  bg: string
  panel: string
  text: string
  text2: string
  text3: string
  accent: string
  quality: Record<Quality, string>
  font: string
  pieces: Map<string, HTMLImageElement>
}

// loaded on demand: only the chosen set is fetched
const PIECE_URLS = import.meta.glob<string>('../../../assets/pieces/*/*.svg', { query: '?url', import: 'default' })

async function image(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

/** Reads the current theme's colours and font, and loads the chosen piece set. */
export async function loadTheme(set: PieceSet): Promise<VideoTheme> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const pieces = new Map<string, HTMLImageElement>()
  await Promise.all(
    ['w', 'b'].flatMap((c) =>
      ['K', 'Q', 'R', 'B', 'N', 'P'].map(async (p) => {
        const load = PIECE_URLS[`../../../assets/pieces/${set}/${c}${p}.svg`]
        if (load) pieces.set(c + p, await image(await load()))
      }),
    ),
  )
  return {
    light: v('--sq-light', '#ebecd0'),
    dark: v('--sq-dark', '#739552'),
    last: v('--sq-last', 'rgba(255, 255, 51, 0.42)'),
    bg: v('--bg-rail', '#262421'),
    panel: v('--panel', '#262522'),
    text: v('--text', '#f1f0ef'),
    text2: v('--text-2', '#c3c2c1'),
    text3: v('--text-3', '#989795'),
    accent: v('--accent', '#81b64c'),
    quality: Object.fromEntries(QUALITIES.map((q) => [q, v(`--q-${q}`, '#888')])) as Record<Quality, string>,
    font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    pieces,
  }
}

const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3

/** Top-left corner of a square on the canvas. */
function squareXY(sq: string, orientation: 'white' | 'black'): [number, number] {
  const f = sq.charCodeAt(0) - 97
  const r = Number(sq[1]) - 1
  const col = orientation === 'white' ? f : 7 - f
  const row = orientation === 'white' ? 7 - r : r
  return [BOARD_X + col * SQ, BOARD_Y + row * SQ]
}

type Placed = { key: string; square: string }

/** Boards parsed once per position: a frame is drawn 30 times a second. */
const boards = new Map<string, Placed[]>()
function placed(fen: string): Placed[] {
  let list = boards.get(fen)
  if (!list) {
    list = new Chess(fen)
      .board()
      .flat()
      .flatMap((p) => (p ? [{ key: p.color + p.type.toUpperCase(), square: p.square }] : []))
    if (boards.size > 500) boards.clear()
    boards.set(fen, list)
  }
  return list
}

/** What slides in a move: the piece, plus the rook when castling; and a pawn taken en passant, which goes at once. */
interface Slide {
  pieces: { key: string; from: string; to: string }[]
  gone?: string
}
const slides = new Map<string, Slide>()
function slideOf(fen: string, from: string, to: string): Slide {
  const id = `${fen}|${from}${to}`
  let s = slides.get(id)
  if (!s) {
    const c = new Chess(fen)
    const m = c.moves({ verbose: true }).find((x) => x.from === from && x.to === to)
    const key = (m?.color ?? 'w') + (m?.piece ?? 'p').toUpperCase()
    s = { pieces: [{ key, from, to }] }
    if (m && /[kq]/.test(m.flags)) {
      const rank = from[1]
      const king = m.flags.includes('k')
      s.pieces.push({ key: m.color + 'R', from: (king ? 'h' : 'a') + rank, to: (king ? 'f' : 'd') + rank })
    }
    if (m?.flags.includes('e')) s.gone = to[0] + from[1]
    if (slides.size > 500) slides.clear()
    slides.set(id, s)
  }
  return s
}

function drawBoard(ctx: CanvasRenderingContext2D, theme: VideoTheme, fen: string, orientation: 'white' | 'black', opts: { last?: [string, string]; hide?: string[] } = {}) {
  for (let i = 0; i < 64; i++) {
    const x = BOARD_X + (i % 8) * SQ
    const y = BOARD_Y + Math.floor(i / 8) * SQ
    ctx.fillStyle = (Math.floor(i / 8) + (i % 8)) % 2 ? theme.dark : theme.light
    ctx.fillRect(x, y, SQ, SQ)
  }
  if (opts.last) {
    ctx.fillStyle = theme.last
    for (const sq of opts.last) {
      const [x, y] = squareXY(sq, orientation)
      ctx.fillRect(x, y, SQ, SQ)
    }
  }
  for (const p of placed(fen)) {
    if (opts.hide?.includes(p.square)) continue
    drawPiece(ctx, theme, p.key, ...squareXY(p.square, orientation))
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, theme: VideoTheme, key: string, x: number, y: number) {
  const img = theme.pieces.get(key)
  if (img) ctx.drawImage(img, x, y, SQ, SQ)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** The quality's mark: its symbol (!!, ?…) or a small drawn icon, white on its colour. */
function drawBadge(ctx: CanvasRenderingContext2D, theme: VideoTheme, quality: Quality, cx: number, cy: number, size: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = size * 0.2
  ctx.fillStyle = theme.quality[quality]
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.3)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = size * 0.1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const s = size * 0.28
  const symbol = QUALITY_SYMBOL[quality]
  if (symbol) {
    ctx.font = `800 ${size * 0.5}px ${theme.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(symbol, cx, cy + size * 0.03)
  } else if (quality === 'best') {
    // a star
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? s * 0.45 : s
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    ctx.fill()
  } else if (quality === 'excellent') {
    // a four-point sparkle
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4
      const r = i % 2 ? s * 0.3 : s
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    ctx.fill()
  } else if (quality === 'good') {
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.8, cy)
    ctx.lineTo(cx - s * 0.2, cy + s * 0.6)
    ctx.lineTo(cx + s * 0.85, cy - s * 0.6)
    ctx.stroke()
  } else if (quality === 'book') {
    ctx.fillRect(cx - s * 0.8, cy - s * 0.6, s * 0.7, s * 1.2)
    ctx.fillRect(cx + s * 0.1, cy - s * 0.6, s * 0.7, s * 1.2)
  } else if (quality === 'miss') {
    ctx.beginPath()
    ctx.arc(cx, cy, s * 0.7, 0, Math.PI * 2)
    ctx.moveTo(cx, cy - s)
    ctx.lineTo(cx, cy + s)
    ctx.moveTo(cx - s, cy)
    ctx.lineTo(cx + s, cy)
    ctx.stroke()
  } else {
    // forced: an arrow
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.8, cy)
    ctx.lineTo(cx + s * 0.8, cy)
    ctx.moveTo(cx + s * 0.2, cy - s * 0.6)
    ctx.lineTo(cx + s * 0.8, cy)
    ctx.lineTo(cx + s * 0.2, cy + s * 0.6)
    ctx.stroke()
  }
  ctx.restore()
}

function drawEvalBar(ctx: CanvasRenderingContext2D, whiteWin: number, orientation: 'white' | 'black') {
  const x = MARGIN
  ctx.save()
  roundRect(ctx, x, BOARD_Y, BAR, BOARD, 8)
  ctx.clip()
  ctx.fillStyle = '#403d39'
  ctx.fillRect(x, BOARD_Y, BAR, BOARD)
  const h = (BOARD * whiteWin) / 100
  ctx.fillStyle = '#f1f1f1'
  // White's share grows from White's side of the board
  if (orientation === 'white') ctx.fillRect(x, BOARD_Y + BOARD - h, BAR, h)
  else ctx.fillRect(x, BOARD_Y, BAR, h)
  ctx.restore()
  // outlined, so a bar that is all white still shows on a light background
  ctx.strokeStyle = 'rgba(128,128,128,0.6)'
  ctx.lineWidth = 2
  roundRect(ctx, x, BOARD_Y, BAR, BOARD, 8)
  ctx.stroke()
}

function playerBar(ctx: CanvasRenderingContext2D, theme: VideoTheme, name: string, accuracy: string | null, y: number, color: 'w' | 'b') {
  ctx.fillStyle = color === 'w' ? '#f1f1f1' : '#1b1a18'
  roundRect(ctx, MARGIN, y, 56, 56, 12)
  ctx.fill()
  ctx.fillStyle = theme.text
  ctx.font = `800 44px ${theme.font}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(fit(ctx, name, WIDTH - MARGIN * 2 - 80 - (accuracy ? 300 : 0)), MARGIN + 80, y + 30)
  if (accuracy) {
    ctx.fillStyle = theme.text2
    ctx.font = `600 36px ${theme.font}`
    ctx.textAlign = 'right'
    ctx.fillText(accuracy, WIDTH - MARGIN, y + 30)
  }
}

/** Shortens a text with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

function centered(ctx: CanvasRenderingContext2D, text: string, y: number, font: string, color: string) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(fit(ctx, text, WIDTH - MARGIN * 2), WIDTH / 2, y)
}

/** Draws what is on screen at one moment of the timeline. */
export function drawMoment(ctx: CanvasRenderingContext2D, game: VideoGame, text: VideoText, theme: VideoTheme, m: Moment) {
  const { beat, phase, progress } = m
  const o = game.orientation
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // players: the side at the bottom of the board is the orientation's
  const acc = (c: 'w' | 'b') => (game.accuracy ? text.accuracy(c === 'w' ? game.accuracy.white : game.accuracy.black) : null)
  const top = o === 'white' ? 'b' : 'w'
  const bottom = o === 'white' ? 'w' : 'b'
  playerBar(ctx, theme, top === 'w' ? game.white : game.black, acc(top), BOARD_Y - 92, top)
  playerBar(ctx, theme, bottom === 'w' ? game.white : game.black, acc(bottom), BOARD_Y + BOARD + 36, bottom)

  // the match on top; the result waits for the closing card
  centered(ctx, `${game.white} ${text.vs} ${game.black}`, 230, `800 56px ${theme.font}`, theme.text)

  const ply = beat.ply
  const move = game.moves[ply - 1]
  const quality = game.qualities[ply - 1]
  const win = (i: number) => game.curve[i] ?? 50

  if (phase === 'move' && move) {
    const slide = slideOf(game.fens[ply - 1], move.from, move.to)
    drawBoard(ctx, theme, game.fens[ply - 1], o, { hide: [...slide.pieces.map((p) => p.from), ...(slide.gone ? [slide.gone] : [])] })
    const e = easeOut(progress)
    for (const p of slide.pieces) {
      const [x0, y0] = squareXY(p.from, o)
      const [x1, y1] = squareXY(p.to, o)
      drawPiece(ctx, theme, p.key, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e)
    }
    if (game.curve.length) drawEvalBar(ctx, win(ply - 1) + (win(ply) - win(ply - 1)) * e, o)
  } else if (phase === 'lead') {
    drawBoard(ctx, theme, game.fens[ply - 1], o)
    if (game.curve.length) drawEvalBar(ctx, win(ply - 1), o)
  } else {
    const fen = game.fens[phase === 'intro' ? 0 : ply]
    drawBoard(ctx, theme, fen, o, move && phase !== 'intro' ? { last: [move.from, move.to] } : {})
    if (game.curve.length) drawEvalBar(ctx, win(phase === 'intro' ? 0 : ply), o)
  }

  // the move and its quality under the board
  const textY = BOARD_Y + BOARD + 200
  if (move && (phase === 'move' || phase === 'hold' || phase === 'lead')) {
    const label = phase === 'lead' ? text.moveNumber(ply) : `${text.moveNumber(ply)} ${move.san}`
    centered(ctx, label, textY, `800 92px ${theme.font}`, theme.text)
    if (phase === 'hold' && quality) {
      const pop = easeOut(progress * 4)
      ctx.globalAlpha = pop
      centered(ctx, text.quality[quality], textY + 110, `800 60px ${theme.font}`, theme.quality[quality])
      const [x, y] = squareXY(move.to, o)
      drawBadge(ctx, theme, quality, x + SQ - 6, y + 6, 64 * (0.85 + 0.15 * pop))
      ctx.globalAlpha = 1
    }
  }

  // title and closing cards over a dimmed board
  if (phase === 'intro' || phase === 'outro') {
    const fade = phase === 'intro' ? 1 - easeOut((progress - 0.75) * 4) : easeOut(progress * 4)
    ctx.globalAlpha = fade
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, BOARD_Y, WIDTH, BOARD)
    if (phase === 'intro') {
      centered(ctx, game.white, BOARD_Y + BOARD / 2 - 110, `800 80px ${theme.font}`, '#fff')
      centered(ctx, text.vs, BOARD_Y + BOARD / 2, `600 48px ${theme.font}`, 'rgba(255,255,255,0.75)')
      centered(ctx, game.black, BOARD_Y + BOARD / 2 + 110, `800 80px ${theme.font}`, '#fff')
    } else {
      centered(ctx, game.result, BOARD_Y + BOARD / 2 - 50, `800 140px ${theme.font}`, '#fff')
      centered(ctx, text.result, BOARD_Y + BOARD / 2 + 80, `600 52px ${theme.font}`, 'rgba(255,255,255,0.8)')
    }
    ctx.globalAlpha = 1
  }

  centered(ctx, text.footer, HEIGHT - 90, `800 44px ${theme.font}`, theme.accent)
}
