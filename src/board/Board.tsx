import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { Chess } from 'chess.js'
import { useTranslation } from 'react-i18next'
import { toDests, isPromotion } from '../chess/util'
import { useSettings } from '../settings'
import type { Quality } from '../features/review/classify'
import { QualityBadge, PieceSprite } from './QualityIcon'
import { OutcomeMarks } from './OutcomeMarks'

export interface BoardProps {
  fen: string
  orientation?: 'white' | 'black'
  /** which side may move; 'none' locks the board */
  movable?: 'white' | 'black' | 'both' | 'none'
  lastMove?: [string, string] | null
  onMove?: (from: string, to: string, promotion?: string) => void
  shapes?: DrawShape[]
  badge?: { square: string; quality: Quality } | null
  /** extra square classes, e.g. hints or wrong-move flashes */
  highlights?: Map<string, string>
  premoves?: boolean
  /** finished game: marks both kings with the outcome, chess.com style */
  outcome?: { result: '1-0' | '0-1' | '1/2-1/2'; reason: string } | null
  className?: string
}

const FILES = 'abcdefgh'

/** Re-renders only when what it shows changes; `onMove` is read through a ref, so a new callback doesn't count. */
export const Board = memo(BoardView, (a, b) => {
  for (const k of Object.keys({ ...a, ...b }) as (keyof BoardProps)[]) if (k !== 'onMove' && a[k] !== b[k]) return false
  return true
})

function BoardView({
  fen,
  orientation = 'white',
  movable = 'none',
  lastMove,
  onMove,
  shapes,
  badge,
  highlights,
  premoves = false,
  outcome,
  className = '',
}: BoardProps) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const fenRef = useRef(fen)
  fenRef.current = fen
  const settings = useSettings(useShallow((s) => ({ coords: s.coords, animation: s.animation, showDests: s.showDests })))
  // honour the OS setting even when piece animation is on in the app
  const reducedMotion = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)

  const chess = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [fen])

  const config: Config = useMemo(() => {
    const turn = chess?.turn() === 'b' ? 'black' : 'white'
    const canMove = movable !== 'none' && chess && !chess.isGameOver()
    return {
      fen,
      orientation,
      turnColor: turn,
      check: chess?.inCheck() ? turn : false,
      lastMove: (lastMove ?? undefined) as Key[] | undefined,
      coordinates: settings.coords,
      animation: { enabled: settings.animation && !reducedMotion, duration: 180 },
      highlight: { lastMove: true, check: true, custom: highlights as Map<Key, string> | undefined },
      movable: {
        free: false,
        color: canMove ? (movable === 'both' ? turn : movable) : undefined,
        dests: canMove && chess ? toDests(chess) : new Map(),
        showDests: settings.showDests,
      },
      premovable: { enabled: premoves && movable !== 'both' },
      draggable: { enabled: true, showGhost: true },
      drawable: { enabled: true, autoShapes: shapes ?? [] },
    }
  }, [fen, orientation, movable, lastMove, settings.coords, settings.animation, settings.showDests, shapes, highlights, chess, premoves, reducedMotion])

  // mount once
  useEffect(() => {
    if (!el.current) return
    api.current = Chessground(el.current, {
      ...config,
      movable: {
        ...config.movable,
        events: {
          after: (orig, dest) => {
            const c = new Chess(fenRef.current)
            if (isPromotion(c, orig, dest)) {
              if (useSettings.getState().autoQueen) onMoveRef.current?.(orig, dest, 'q')
              else setPromo({ from: orig, to: dest })
            } else onMoveRef.current?.(orig, dest)
          },
        },
      },
    })
    const stopKnightArrows = bendKnightArrows(el.current)
    return () => {
      stopKnightArrows()
      api.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    api.current?.set(config)
    // premoves fire as soon as it's our turn again
    if (premoves) api.current?.playPremove()
  }, [config, premoves])

  // Badge position as a percentage of the board
  const badgePos = useMemo(() => {
    if (!badge) return null
    const f = FILES.indexOf(badge.square[0])
    const r = Number(badge.square[1]) - 1
    const col = orientation === 'white' ? f : 7 - f
    const row = orientation === 'white' ? 7 - r : r
    return { left: `${((col + 1) / 8) * 100 - 1.5}%`, top: `${(row / 8) * 100 + 1.5}%` }
  }, [badge, orientation])

  const promoColor = chess?.turn() === 'b' ? 'b' : 'w'

  return (
    <div className={`relative aspect-square w-full select-none ${className}`}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {badge && badgePos && <QualityBadge quality={badge.quality} style={badgePos} />}
      {outcome && chess && <OutcomeMarks chess={chess} outcome={outcome} orientation={orientation} />}
      {promo && (
        <PromotionPicker
          color={promoColor}
          file={promo.to[0]}
          orientation={orientation}
          onPick={(p) => {
            const m = promo
            setPromo(null)
            if (p) onMoveRef.current?.(m.from, m.to, p)
            else api.current?.set(config)
          }}
        />
      )}
    </div>
  )
}

/**
 * chessground draws every arrow straight; knight jumps read better as an L.
 * Arrows are SVG lines in square units, so any line spanning (1,2) or (2,1)
 * squares is swapped for a path that runs the long leg first, keeping the
 * stroke, marker and the end margin chessground applied.
 */
function bendKnightArrows(root: HTMLElement): () => void {
  const bend = () => {
    for (const line of root.querySelectorAll<SVGLineElement>('svg.cg-shapes line')) {
      const x1 = Number(line.getAttribute('x1'))
      const y1 = Number(line.getAttribute('y1'))
      const x2 = Number(line.getAttribute('x2'))
      const y2 = Number(line.getAttribute('y2'))
      const tx = Math.round(x2 - x1)
      const ty = Math.round(y2 - y1)
      const ax = Math.abs(tx)
      const ay = Math.abs(ty)
      if (!((ax === 1 && ay === 2) || (ax === 2 && ay === 1))) continue
      // chessground stops the line short of the target centre by this margin
      const margin = Math.hypot(x1 + tx - x2, y1 + ty - y2)
      const horizontalFirst = ax > ay
      const cx = horizontalFirst ? x1 + tx : x1
      const cy = horizontalFirst ? y1 : y1 + ty
      const ex = horizontalFirst ? x1 + tx : x1 + tx - Math.sign(tx) * margin
      const ey = horizontalFirst ? y1 + ty - Math.sign(ty) * margin : y1 + ty
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      for (const attr of line.getAttributeNames()) {
        if (!['x1', 'y1', 'x2', 'y2'].includes(attr)) path.setAttribute(attr, line.getAttribute(attr)!)
      }
      path.setAttribute('d', `M${x1},${y1} L${cx},${cy} L${ex},${ey}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-linejoin', 'round')
      line.replaceWith(path)
    }
  }
  const obs = new MutationObserver(bend)
  obs.observe(root, { childList: true, subtree: true })
  bend()
  return () => obs.disconnect()
}

function PromotionPicker({
  color,
  file,
  orientation,
  onPick,
}: {
  color: 'w' | 'b'
  file: string
  orientation: 'white' | 'black'
  onPick: (piece: string | null) => void
}) {
  const f = FILES.indexOf(file)
  const col = orientation === 'white' ? f : 7 - f
  const fromTop = (color === 'w') === (orientation === 'white')
  const pieces = ['q', 'n', 'r', 'b']
  const role: Record<string, string> = { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' }
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 z-20 bg-black/45" onClick={() => onPick(null)}>
      <div
        className="pop absolute flex w-[12.5%] flex-col overflow-hidden rounded-md bg-[#f2f1ee] shadow-xl"
        style={{
          left: `${col * 12.5}%`,
          top: fromTop ? 0 : 'auto',
          bottom: fromTop ? 'auto' : 0,
          flexDirection: fromTop ? 'column' : 'column-reverse',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {pieces.map((p) => (
          <button
            key={p}
            className="cg-wrap aspect-square w-full transition-colors duration-100 hover:bg-[#ddd]"
            style={{ position: 'relative' }}
            onClick={() => onPick(p)}
            aria-label={t(`common.piece.${role[p]}`)}
          >
            <PieceSprite role={role[p]} color={color} />
          </button>
        ))}
      </div>
    </div>
  )
}

