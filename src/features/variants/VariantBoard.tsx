import { memo, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { PieceSprite } from '../../board/QualityIcon'
import { useSettings } from '../../settings'
import type { FairyKind } from './catalog'
import { FILES, movesByOrigin, pieceKind, squareCoords, squareName, type Position, type VariantMove } from './fen'

/**
 * Fairy pieces are drawn with the piece set the user already has: the piece they move
 * like most, with a small second piece for the extra power (rook + knight = chancellor).
 */
const COMPOSITE: Record<FairyKind, [base: string, badge: string]> = {
  amazon: ['queen', 'knight'],
  chancellor: ['rook', 'knight'],
  archbishop: ['bishop', 'knight'],
  commoner: ['king', 'pawn'],
  royalKnight: ['knight', 'king'],
}
const STANDARD = new Set(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'])

/** The translation key of a piece's name in a variant. */
export function pieceNameKey(letter: string, fairy?: Record<string, FairyKind>): string {
  const kind = pieceKind(letter, fairy)
  return STANDARD.has(kind) ? `common.piece.${kind}` : `variants.piece.${kind}`
}

export function VariantPiece({ letter, color, fairy }: { letter: string; color: 'w' | 'b'; fairy?: Record<string, FairyKind> }) {
  const kind = pieceKind(letter, fairy)
  const [base, badge] = STANDARD.has(kind) ? [kind, null] : COMPOSITE[kind as FairyKind]
  return (
    <>
      <span className="vart cg-wrap">
        <PieceSprite role={base} color={color} />
      </span>
      {badge && (
        <span className="vbadge cg-wrap">
          <PieceSprite role={badge} color={color} />
        </span>
      )}
    </>
  )
}

export interface VariantBoardProps {
  position: Position
  fairy?: Record<string, FairyKind>
  orientation?: 'w' | 'b'
  /** the moves the user may play now; none locks the board */
  moves?: VariantMove[]
  lastMove?: [string, string] | null
  /** royal pieces in check */
  checked?: string[]
  /** squares the variant's goal is about */
  marks?: string[]
  onMove?: (from: string, to: string) => void
  /** a small picture of a position: no coordinates */
  preview?: boolean
  className?: string
}

const NO_MOVES: VariantMove[] = []

/** A board of any size for the variants (chessground only draws 8x8). Tap or drag to move; every square is a button. */
export const VariantBoard = memo(function VariantBoard({
  position,
  fairy,
  orientation = 'w',
  moves = NO_MOVES,
  lastMove,
  checked,
  marks,
  onMove,
  preview = false,
  className = '',
}: VariantBoardProps) {
  const { t } = useTranslation()
  const settings = useSettings(useShallow((s) => ({ coords: s.coords, animation: s.animation, showDests: s.showDests })))
  const reducedMotion = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { width, height, pieces } = position
  const byOrigin = useMemo(() => movesByOrigin(moves), [moves])
  const [picked, setPicked] = useState<string | null>(null)
  // a selection only lasts while its piece can still move
  const selected = picked && byOrigin.has(picked) ? picked : null
  const dests = useMemo(() => new Set(selected ? byOrigin.get(selected)!.map((m) => m.to) : []), [selected, byOrigin])
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ from: string; x: number; y: number; el: HTMLElement | null; moved: boolean; wasSelected: boolean } | null>(null)
  // a piece dropped by hand is already where it goes: sliding it in again would look like a second move
  const dropped = useRef<string | null>(null)

  const flip = orientation === 'b'
  const col = (file: number) => (flip ? width - 1 - file : file)
  const row = (rank: number) => (flip ? rank : height - 1 - rank)

  const squareAt = (e: { clientX: number; clientY: number }): string | null => {
    const box = root.current?.getBoundingClientRect()
    if (!box) return null
    const c = Math.floor(((e.clientX - box.left) / box.width) * width)
    const r = Math.floor(((e.clientY - box.top) / box.height) * height)
    if (c < 0 || c >= width || r < 0 || r >= height) return null
    return squareName(flip ? width - 1 - c : c, flip ? r : height - 1 - r)
  }

  const move = (from: string, to: string, byDrag = false) => {
    dropped.current = byDrag ? from + to : null
    setPicked(null)
    onMove?.(from, to)
  }

  /** A tap, a keyboard press or the start of a drag on `sq`. */
  const press = (sq: string): boolean => {
    if (selected && dests.has(sq)) {
      move(selected, sq)
      return false
    }
    if (byOrigin.has(sq)) {
      setPicked(sq)
      return true
    }
    setPicked(null)
    return false
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const sq = squareAt(e)
    if (!sq) return
    const wasSelected = selected === sq
    if (!press(sq)) return
    drag.current = { from: sq, x: e.clientX, y: e.clientY, el: root.current?.querySelector<HTMLElement>(`[data-sq="${sq}"] .vpiece`) ?? null, moved: false, wasSelected }
    root.current?.setPointerCapture(e.pointerId)
  }
  const dragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d?.el) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    d.el.classList.add('drag')
    d.el.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.el) {
      d.el.classList.remove('drag')
      d.el.style.transform = ''
    }
    const sq = e.type === 'pointercancel' ? null : squareAt(e)
    if (d.moved && sq && sq !== d.from && byOrigin.get(d.from)?.some((m) => m.to === sq)) move(d.from, sq, true)
    // a second tap on the selected piece puts it down
    else if (!d.moved && d.wasSelected) setPicked(null)
  }

  const lastKey = lastMove ? lastMove.join('') : ''
  const slide = settings.animation && !reducedMotion && lastMove && dropped.current !== lastKey ? lastMove : null
  const slideFrom = slide ? squareCoords(slide[0]) : null
  const pieceName = (letter: string) => t(pieceNameKey(letter, fairy))
  const showCoords = settings.coords && !preview

  const squares = []
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const file = flip ? width - 1 - c : c
      const rank = flip ? r : height - 1 - r
      const sq = squareName(file, rank)
      const piece = pieces.get(sq)
      const isDest = dests.has(sq)
      const cls = [
        'vsq',
        (file + rank) % 2 === 0 ? 'dark' : '',
        lastMove?.includes(sq) ? 'last' : '',
        selected === sq ? 'sel' : '',
        checked?.includes(sq) ? 'check' : '',
        marks?.includes(sq) ? 'mark' : '',
      ]
      const sliding = slide && slideFrom && sq === slide[1]
      const offset = sliding ? ({ '--dx': col(slideFrom.file) - c, '--dy': row(slideFrom.rank) - r } as CSSProperties) : undefined
      const label = piece ? `${sq}, ${t(piece.color === 'w' ? 'common.white' : 'common.black')} ${pieceName(piece.letter)}` : sq
      squares.push(
        <button
          key={sq}
          type="button"
          data-sq={sq}
          className={cls.join(' ')}
          aria-label={label}
          aria-pressed={selected === sq || undefined}
          // pointer presses are handled on the board; this is the keyboard (a click with no pointer behind it)
          onClick={(e) => e.detail === 0 && press(sq)}
        >
          {showCoords && c === 0 && <span className="vcoord rank">{rank + 1}</span>}
          {showCoords && r === height - 1 && <span className="vcoord file">{FILES[file]}</span>}
          {piece && (
            <span key={sliding ? lastKey : 'still'} className={`vpiece ${sliding ? 'vslide' : ''}`} style={offset}>
              <VariantPiece letter={piece.letter} color={piece.color} fairy={fairy} />
            </span>
          )}
          {isDest && settings.showDests && <span className={`vdest ${piece ? 'capture' : ''}`} />}
        </button>,
      )
    }

  return (
    // boards that are not square sit centred in the square space the layout gives a board
    <div className={`grid aspect-square w-full place-items-center ${className}`}>
      <div
        ref={root}
        className="vboard"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width} / ${height}`, width: width >= height ? '100%' : `${(width / height) * 100}%` }}
        onPointerDown={down}
        onPointerMove={dragMove}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {squares}
      </div>
    </div>
  )
})
