import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { Chess } from 'chess.js'
import { toDests, isPromotion } from '../chess/util'
import { useSettings } from '../settings'
import type { Quality } from '../features/review/classify'
import { QualityBadge, PieceSprite } from './QualityIcon'

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
  className?: string
}

const FILES = 'abcdefgh'

export function Board({
  fen,
  orientation = 'white',
  movable = 'none',
  lastMove,
  onMove,
  shapes,
  badge,
  highlights,
  premoves = false,
  className = '',
}: BoardProps) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const fenRef = useRef(fen)
  fenRef.current = fen
  const settings = useSettings()
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
      animation: { enabled: settings.animation, duration: 180 },
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
  }, [fen, orientation, movable, lastMove, settings.coords, settings.animation, settings.showDests, shapes, highlights, chess, premoves])

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
    return () => api.current?.destroy()
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
            aria-label={role[p]}
          >
            <PieceSprite role={role[p]} color={color} />
          </button>
        ))}
      </div>
    </div>
  )
}

