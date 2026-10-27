import type { ReactNode } from 'react'
import { PieceIcon } from './QualityIcon'

export function Avatar({ label, hue, size = 40, children }: { label: string; hue?: number; size?: number; children?: ReactNode }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-md font-extrabold text-white/95"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: hue === undefined ? 'var(--raise-2)' : `linear-gradient(160deg, hsl(${hue} 42% 48%), hsl(${hue} 46% 32%))`,
      }}
      aria-hidden
    >
      {children ?? label.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function formatClock(ms: number): string {
  const total = Math.max(0, ms)
  const s = Math.floor(total / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (total < 20_000) return `${m}:${String(sec).padStart(2, '0')}.${Math.floor((total % 1000) / 100)}`
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function PlayerBar({
  name,
  rating,
  hue,
  captured,
  color,
  advantage,
  clock,
  clockActive,
  thinking,
  avatar,
}: {
  name: string
  rating?: number | string
  hue?: number
  /** pieces this player has captured (opponent colour) */
  captured: string[]
  color: 'w' | 'b'
  advantage?: number
  clock?: number
  clockActive?: boolean
  thinking?: string
  avatar?: ReactNode
}) {
  const oppColor = color === 'w' ? 'b' : 'w'
  const low = clock !== undefined && clock < 20_000
  return (
    <div className="flex h-12 items-center gap-2.5 px-0.5">
      {avatar ?? <Avatar label={name} hue={hue} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 truncate text-[15px] font-bold">
          <span className="truncate">{name}</span>
          {rating !== undefined && <span className="tabular font-normal text-fg-3">({rating})</span>}
          {thinking && <span className="ml-1 animate-pulse text-[12px] font-semibold text-fg-3">{thinking}</span>}
        </div>
        <div className="flex h-4 items-center">
          {captured.map((p, i) => (
            <span key={i} className={i > 0 && captured[i - 1] === p ? '-ml-2.5' : ''}>
              <PieceIcon piece={p} color={oppColor} size={16} />
            </span>
          ))}
          {advantage !== undefined && advantage > 0 && <span className="tabular ml-1 text-[12px] font-semibold text-fg-3">+{advantage}</span>}
        </div>
      </div>
      {clock !== undefined && (
        <div
          className={`tabular min-w-[96px] rounded-md px-3 py-1.5 text-right font-mono text-[22px] font-bold transition-colors duration-150 ${
            clockActive ? (low ? 'bg-danger text-white' : 'bg-[#f1f1f1] text-[#262421]') : 'bg-panel-2 text-fg-3'
          }`}
        >
          {formatClock(clock)}
        </div>
      )}
    </div>
  )
}
