import type { CSSProperties } from 'react'
import { Crown, Sparkle, Check, BookOpen, Crosshair, ArrowRight } from '@phosphor-icons/react'
import { QUALITY_SYMBOL, type Quality } from '../features/review/classify'

export const qualityColor = (q: Quality) => `var(--q-${q})`

function Glyph({ quality, size }: { quality: Quality; size: number }) {
  const text = QUALITY_SYMBOL[quality]
  if (text) return <span className="leading-none tracking-tighter">{text}</span>
  const props = { size, weight: 'bold' as const }
  switch (quality) {
    case 'best':
      return <Crown {...props} weight="fill" />
    case 'excellent':
      return <Sparkle {...props} weight="fill" />
    case 'good':
      return <Check {...props} />
    case 'book':
      return <BookOpen {...props} weight="fill" />
    case 'miss':
      return <Crosshair {...props} />
    default:
      return <ArrowRight {...props} />
  }
}

export function QualityIcon({ quality, size = 20, className = '' }: { quality: Quality; size?: number; className?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-[30%] font-extrabold text-white ${className}`}
      style={{ width: size, height: size, background: qualityColor(quality), fontSize: size * 0.5 }}
      aria-hidden
    >
      <Glyph quality={quality} size={size * 0.6} />
    </span>
  )
}

export function QualityBadge({ quality, style }: { quality: Quality; style: CSSProperties }) {
  return (
    <span className="q-badge pop" style={{ ...style, background: qualityColor(quality) }} aria-hidden>
      <Glyph quality={quality} size={14} />
    </span>
  )
}

/** A single cburnett piece rendered with the board's sprite CSS. */
export function PieceIcon({ piece, color, size = 20 }: { piece: string; color: 'w' | 'b'; size?: number }) {
  const role: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
  return (
    <span className="cg-wrap relative inline-block shrink-0" style={{ width: size, height: size }}>
      <PieceSprite role={role[piece]} color={color} />
    </span>
  )
}

/** chessground's sprite CSS targets a <piece> element, which React can't create directly. */
export function PieceSprite({ role, color }: { role: string; color: 'w' | 'b' }) {
  return (
    <span
      style={{ position: 'absolute', inset: 0 }}
      dangerouslySetInnerHTML={{
        __html: `<piece class="${role} ${color === 'w' ? 'white' : 'black'}" style="position:absolute;inset:0;width:100%;height:100%;transform:none"></piece>`,
      }}
    />
  )
}
