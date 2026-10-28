import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MoveReview } from './classify'
import { qualityColor } from '../../board/QualityIcon'
import { formatScore } from '../../engine/engine'
import { moveNumberLabel } from './moveNumber'

const KEY: MoveReview['quality'][] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']

/**
 * White's win probability over the game. The light area is White's share,
 * the dark remainder Black's; key moves sit on the curve as dots.
 */
export function EvalGraph({
  curve,
  moves,
  ply,
  onSelect,
  startFen,
  height = 84,
}: {
  curve: number[]
  moves: MoveReview[]
  ply: number
  onSelect: (ply: number) => void
  /** the game's first position, for move numbers of games set up from a FEN */
  startFen: string
  height?: number
}) {
  const { t } = useTranslation()
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = height
  const n = Math.max(1, curve.length - 1)
  const x = (i: number) => (i / n) * W
  const y = (w: number) => H - (w / 100) * H

  const area = useMemo(() => {
    if (!curve.length) return ''
    let d = `M0,${H} `
    curve.forEach((w, i) => (d += `L${x(i).toFixed(1)},${y(w).toFixed(1)} `))
    d += `L${W},${H} Z`
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, H])

  const pick = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const i = Math.round(((clientX - r.left) / r.width) * n)
    return Math.max(0, Math.min(n, i))
  }

  const hv = hover ?? null
  const hoverMove = hv && hv > 0 ? moves[hv - 1] : null

  // a slider over the plies for keyboards and screen readers; it handles its own arrows
  // so the board's window-level keys don't step twice
  const onKeyDown = (e: React.KeyboardEvent) => {
    const to =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? ply - 1
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? ply + 1
          : e.key === 'PageDown'
            ? ply - 10
            : e.key === 'PageUp'
              ? ply + 10
              : e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? n
                  : null
    if (to === null) return
    e.preventDefault()
    e.stopPropagation()
    onSelect(Math.max(0, Math.min(n, to)))
  }
  const current = ply > 0 ? moves[ply - 1] : undefined
  const valueText = current
    ? t('review.graphValue', {
        move: moveNumberLabel(ply, startFen, '...'),
        san: current.san,
        score: formatScore(current.scoreAfter),
        quality: t(`review.q.${current.quality}`),
      })
    : t('review.graphStart')

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full cursor-pointer touch-none rounded-md bg-[#403d39]"
        style={{ height: H }}
        role="slider"
        tabIndex={0}
        aria-label={t('review.evalGraph')}
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={ply}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setHover(pick(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => onSelect(pick(e.clientX))}
      >
        <path d={area} fill="#f1f1f1" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#8b8987" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6} />
        <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {hv !== null && hv !== ply && (
          <line x1={x(hv)} x2={x(hv)} y1={0} y2={H} stroke="#8b8987" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* dots drawn in HTML so they stay round under the stretched viewBox */}
      {moves.map((m, i) =>
        KEY.includes(m.quality) ? (
          <span
            key={i}
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#403d39]"
            style={{ left: `${(x(i + 1) / W) * 100}%`, top: y(curve[i + 1]), background: qualityColor(m.quality) }}
          />
        ) : null,
      )}
      {hoverMove && hv !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-raise-2 px-2 py-1 text-[12px] font-semibold shadow-lg"
          style={{ left: `${Math.min(92, Math.max(8, (x(hv) / W) * 100))}%` }}
        >
          <span className="tabular text-fg-3">{moveNumberLabel(hv, startFen)}</span>{' '}
          {hoverMove.san} <span className="tabular text-fg-3">{formatScore(hoverMove.scoreAfter)}</span>{' '}
          <span style={{ color: qualityColor(hoverMove.quality) }}>{t(`review.q.${hoverMove.quality}`)}</span>
        </div>
      )}
    </div>
  )
}
