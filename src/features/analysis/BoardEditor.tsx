import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chess } from 'chess.js'
import { Eraser } from '@phosphor-icons/react'
import { PieceIcon } from '../../board/QualityIcon'
import { START_FEN } from '../../chess/util'
import { Segmented, toast } from '../../ui/kit'

type Grid = (string | null)[][] // [rank 8..1][file a..h], FEN letters

function parseBoard(fen: string): Grid {
  return fen
    .split(' ')[0]
    .split('/')
    .map((row) => {
      const out: (string | null)[] = []
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null)
        else out.push(ch)
      }
      return out
    })
}

function boardToFen(g: Grid): string {
  return g
    .map((row) => {
      let s = ''
      let empty = 0
      for (const c of row) {
        if (!c) empty++
        else {
          if (empty) s += empty
          empty = 0
          s += c
        }
      }
      return s + (empty ? empty : '')
    })
    .join('/')
}

const PALETTE = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']

export function BoardEditor({ initialFen, onDone }: { initialFen: string; onDone: (fen: string) => void }) {
  const { t } = useTranslation()
  const [grid, setGrid] = useState<Grid>(() => parseBoard(initialFen))
  const [turn, setTurn] = useState<'w' | 'b'>(initialFen.split(' ')[1] === 'b' ? 'b' : 'w')
  const [tool, setTool] = useState<string>('P')
  const [castling, setCastling] = useState(initialFen.split(' ')[2] ?? '-')

  const place = (r: number, f: number) => {
    setGrid((g) => {
      const next = g.map((row) => [...row])
      next[r][f] = tool === 'x' || next[r][f] === tool ? null : tool
      return next
    })
  }

  const fen = () => {
    // only keep castling rights that the position still allows
    const g = grid
    const ok = (flag: string) =>
      ({
        K: g[7][4] === 'K' && g[7][7] === 'R',
        Q: g[7][4] === 'K' && g[7][0] === 'R',
        k: g[0][4] === 'k' && g[0][7] === 'r',
        q: g[0][4] === 'k' && g[0][0] === 'r',
      })[flag]
    const c = castling.split('').filter((f) => f !== '-' && ok(f)).join('') || '-'
    return `${boardToFen(grid)} ${turn} ${c} - 0 1`
  }

  const done = () => {
    const f = fen()
    try {
      new Chess(f)
      onDone(f)
    } catch {
      toast(t('analysis.invalidFen'), 'error')
    }
  }

  const toggleCastle = (flag: string) =>
    setCastling((c) => {
      const set = new Set(c.replace('-', '').split('').filter(Boolean))
      if (set.has(flag)) set.delete(flag)
      else set.add(flag)
      return ['K', 'Q', 'k', 'q'].filter((x) => set.has(x)).join('') || '-'
    })

  return (
    <div>
      <p className="mb-3 text-[13px] text-fg-3">{t('analysis.editHelp')}</p>
      <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded">
        {grid.map((row, r) =>
          row.map((p, f) => (
            <button
              key={`${r}${f}`}
              onClick={() => place(r, f)}
              className="relative grid place-items-center"
              style={{ background: (r + f) % 2 ? 'var(--sq-dark)' : 'var(--sq-light)' }}
              aria-label={`${'abcdefgh'[f]}${8 - r}`}
            >
              {p && <PieceIcon piece={p.toLowerCase()} color={p === p.toUpperCase() ? 'w' : 'b'} size={38} />}
            </button>
          )),
        )}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {PALETTE.map((p) => (
          <button
            key={p}
            onClick={() => setTool(p)}
            className={`grid aspect-square place-items-center rounded-md ${tool === p ? 'bg-raise-2 ring-2 ring-accent' : 'bg-panel-2'}`}
          >
            <PieceIcon piece={p.toLowerCase()} color={p === p.toUpperCase() ? 'w' : 'b'} size={30} />
          </button>
        ))}
        <button
          onClick={() => setTool('x')}
          className={`col-start-7 row-start-1 grid aspect-square place-items-center rounded-md ${tool === 'x' ? 'bg-raise-2 ring-2 ring-accent' : 'bg-panel-2'}`}
          aria-label={t('analysis.eraser')}
        >
          <Eraser size={24} weight="bold" />
        </button>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('analysis.toMove')}</div>
        <Segmented
          value={turn}
          onChange={setTurn}
          options={[
            { value: 'w', label: t('common.white') },
            { value: 'b', label: t('common.black') },
          ]}
        />
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('analysis.castling')}</div>
        <div className="grid grid-cols-4 gap-1">
          {[
            ['K', 'O-O'],
            ['Q', 'O-O-O'],
            ['k', 'O-O'],
            ['q', 'O-O-O'],
          ].map(([flag, label]) => (
            <button
              key={flag}
              onClick={() => toggleCastle(flag)}
              className={`flex min-h-9 items-center justify-center gap-1 rounded-md text-[12px] font-bold ${castling.includes(flag) ? 'bg-raise-2 ring-2 ring-accent' : 'bg-panel-2 text-fg-3'}`}
            >
              <PieceIcon piece="k" color={flag === flag.toUpperCase() ? 'w' : 'b'} size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => {
            setGrid(parseBoard(START_FEN))
            setCastling('KQkq')
          }}
        >
          {t('analysis.reset')}
        </button>
        <button className="btn" onClick={() => setGrid(parseBoard('8/8/8/8/8/8/8/8 w - - 0 1'))}>
          {t('analysis.clear')}
        </button>
        <button className="btn btn-primary col-span-2" onClick={done}>
          {t('analysis.done')}
        </button>
      </div>
    </div>
  )
}
