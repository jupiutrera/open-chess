import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { forMover, mateInMoves, pieceCount, tablebase, TB_MAX_PIECES, type TbCategory, type TbResult } from './tablebase'

const TONE: Record<string, string> = { win: 'text-accent', loss: 'text-danger', draw: 'text-fg-2' }
const tone = (c: TbCategory) => TONE[c.replace(/^(cursed|blessed|maybe)-/, '')] ?? 'text-fg-2'

/** Exact result and best moves for positions with seven pieces or fewer. */
export function TablebasePanel({ fen, onPlay }: { fen: string; onPlay: (uci: string) => void }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<{ fen: string; tb: TbResult | null } | null>(null)
  const small = pieceCount(fen) <= TB_MAX_PIECES
  useEffect(() => {
    if (!small) return
    let alive = true
    void tablebase(fen).then((tb) => alive && setResult({ fen, tb }))
    return () => {
      alive = false
    }
  }, [fen, small])
  if (!small) return null
  const tb = result?.fen === fen ? result.tb : undefined
  const distance = (d: { category: TbCategory; dtm?: number | null; dtz?: number | null }, move = false) =>
    // dtm is in plies; players count mate in moves. A draw has no mate to count.
    d.category === 'draw' || d.category === 'unknown'
      ? ''
      : d.dtm != null
        ? t('analysis.tb.mateIn', { count: mateInMoves(d.dtm, move) })
        : d.dtz != null
          ? t('analysis.tb.dtz', { count: Math.abs(d.dtz) })
          : ''
  return (
    <div className="border-b border-line px-3 py-2 text-[13px]">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-fg-3">{t('analysis.tb.title')}</span>
        {tb === undefined ? (
          <span className="text-fg-3">…</span>
        ) : tb === null ? (
          <span className="text-fg-3">{t('common.offline')}</span>
        ) : (
          <span className={`font-semibold ${tone(tb.category)}`}>
            {t(`analysis.tb.${tb.category}`)} {distance(tb)}
          </span>
        )}
      </div>
      {tb && tb.moves.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tb.moves.slice(0, 6).map((m) => {
            const c = forMover(m.category)
            return (
              <button key={m.uci} className="rounded bg-panel-2 px-2 py-0.5 hover:bg-raise" onClick={() => onPlay(m.uci)} title={t(`analysis.tb.${c}`)}>
                <span className="font-bold">{m.san}</span> <span className={tone(c)}>{distance(m, true)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
