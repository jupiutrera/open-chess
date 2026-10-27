import { useTranslation } from 'react-i18next'
import { formatScore, type Score } from '../engine/engine'
import { winPercent } from '../features/review/classify'

/** Vertical evaluation bar; White's share grows from White's side of the board. */
export function EvalBar({ score, orientation = 'white', className = '' }: { score?: Score; orientation?: 'white' | 'black'; className?: string }) {
  const { t } = useTranslation()
  const white = score ? winPercent(score) : 50
  const whiteAhead = white >= 50
  const label = formatScore(score).replace('+', '')
  const flipped = orientation === 'black'
  // the white fill is anchored to the bottom (white's side) unless flipped
  const shift = flipped ? -(100 - white) : 100 - white
  return (
    <div
      className={`relative w-6 shrink-0 overflow-hidden rounded-[3px] bg-[#403d39] ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-label={t('common.evaluation', { score: label })}
    >
      <div
        className="absolute inset-0 bg-[#f1f1f1]"
        style={{
          transform: `translateY(${shift}%)`,
          transition: 'transform 420ms var(--ease-out)',
        }}
      />
      <span
        className={`tabular absolute left-0 right-0 text-center text-[10px] font-bold ${
          whiteAhead ? 'text-[#403d39]' : 'text-[#f1f1f1]'
        }`}
        style={whiteAhead !== flipped ? { bottom: 4 } : { top: 4 }}
      >
        {label}
      </span>
    </div>
  )
}

/** Horizontal variant for narrow screens, placed above the board. */
export function EvalStrip({ score, orientation = 'white' }: { score?: Score; orientation?: 'white' | 'black' }) {
  const white = score ? winPercent(score) : 50
  const flipped = orientation === 'black'
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-[#403d39]" aria-hidden>
      <div
        className="absolute inset-0 bg-[#f1f1f1]"
        style={{
          transform: `translateX(${flipped ? 100 - white : -(100 - white)}%)`,
          transition: 'transform 420ms var(--ease-out)',
        }}
      />
    </div>
  )
}
