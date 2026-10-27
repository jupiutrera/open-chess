import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Puzzle rating over attempts: one series, crosshair + tooltip on hover. */
export function RatingChart({ points, lang }: { points: { date: number; rating: number }[]; lang: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 180
  const pad = { l: 40, r: 8, t: 10, b: 20 }
  const { path, xs, ys, ticks, min, max } = useMemo(() => {
    const vals = points.map((p) => p.rating)
    const lo = Math.floor((Math.min(...vals) - 20) / 50) * 50
    const hi = Math.ceil((Math.max(...vals) + 20) / 50) * 50
    const xs = points.map((_, i) => pad.l + (i / Math.max(1, points.length - 1)) * (W - pad.l - pad.r))
    const ys = vals.map((v) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b))
    const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    const step = Math.max(50, Math.round((hi - lo) / 4 / 50) * 50)
    const ticks: number[] = []
    for (let v = lo; v <= hi; v += step) ticks.push(v)
    return { path, xs, ys, ticks, min: lo, max: hi }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  const y = (v: number) => pad.t + (1 - (v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b)
  const onMove = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i
    setHover(best)
  }

  return (
    <div ref={ref} className="relative" onPointerMove={(e) => onMove(e.clientX)} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label={t('profile.puzzleRating')}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={xs[hover]} x2={xs[hover]} y1={pad.t} y2={H - pad.b} stroke="var(--text-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {ticks.map((v) => (
        <span key={v} className="tabular pointer-events-none absolute left-0 -translate-y-1/2 text-[11px] text-fg-3" style={{ top: (y(v) / H) * 180 }}>
          {v}
        </span>
      ))}
      {hover !== null && (
        <>
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-panel"
            style={{ left: `${(xs[hover] / W) * 100}%`, top: (ys[hover] / H) * 180 }}
          />
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-raise-2 px-2 py-1 text-[12px] font-semibold shadow-lg"
            style={{ left: `${Math.min(90, Math.max(10, (xs[hover] / W) * 100))}%` }}
          >
            <span className="tabular">{points[hover].rating}</span>
            <span className="ml-1.5 text-fg-3">{new Date(points[hover].date).toLocaleDateString(lang)}</span>
          </div>
        </>
      )}
    </div>
  )
}
