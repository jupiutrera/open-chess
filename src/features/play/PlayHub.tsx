import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Users, Shuffle } from '@phosphor-icons/react'
import { BOTS, BOT_GROUPS, type Bot } from './bots'
import { Avatar } from '../../board/PlayerBar'
import { PieceIcon } from '../../board/QualityIcon'
import { PageHeader, Panel, Segmented } from '../../ui/kit'
import { AssistToggles } from './AssistToggles'
import { Board } from '../../board/Board'
import { db } from '../../db/db'
import { useSettings } from '../../settings'

export const TIME_CONTROLS = [
  { id: 'none', label: '∞', base: 0, inc: 0 },
  { id: '1+0', label: '1 min', base: 60, inc: 0 },
  { id: '3+2', label: '3 | 2', base: 180, inc: 2 },
  { id: '5+0', label: '5 min', base: 300, inc: 0 },
  { id: '10+0', label: '10 min', base: 600, inc: 0 },
  { id: '15+10', label: '15 | 10', base: 900, inc: 10 },
  { id: '30+0', label: '30 min', base: 1800, inc: 0 },
]

export function useBotRecord(botId: string) {
  return useLiveQuery(async () => {
    const games = await db.games.where('source').equals('bot').toArray()
    const r = { w: 0, d: 0, l: 0 }
    for (const g of games) {
      if (g.deleted || g.botId !== botId || !g.userColor) continue
      if (g.result === '1/2-1/2') r.d++
      else if ((g.result === '1-0') === (g.userColor === 'w')) r.w++
      else r.l++
    }
    return r
  }, [botId])
}

export default function PlayHub() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const nav = useNavigate()
  const [selected, setSelected] = useState<Bot>(BOTS[4])
  const [color, setColor] = useState<'w' | 'b' | 'r'>('w')
  const [tc, setTc] = useState('none')
  const record = useBotRecord(selected.id)

  const start = () => {
    const q = new URLSearchParams({ color, tc })
    nav(`/play/bot/${selected.id}?${q}`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('play.title')} />
      <div className="grid gap-5 px-4 pb-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
        <div className="hidden lg:block">
          <div className="mx-auto max-w-[min(100%,calc(100dvh-180px))]">
            <div className="mb-2 flex items-center gap-2.5">
              <Avatar label={selected.name} hue={selected.hue} size={40} />
              <span className="font-bold">
                {selected.name} <span className="font-normal text-fg-3">({selected.elo})</span>
              </span>
            </div>
            <Board fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" orientation={color === 'b' ? 'black' : 'white'} />
          </div>
        </div>

        <Panel className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line p-4">
            <Avatar label={selected.name} hue={selected.hue} size={64} />
            <div className="min-w-0">
              <div className="text-[20px] font-extrabold">
                {selected.name} <span className="tabular font-semibold text-fg-3">{selected.elo}</span>
              </div>
              <p className="text-[14px] text-fg-2">{selected.bio[lang]}</p>
              {record && record.w + record.d + record.l > 0 && (
                <p className="tabular mt-1 text-[13px] text-fg-3">{t('play.record', record)}</p>
              )}
            </div>
          </div>

          <div className="max-h-[42dvh] overflow-y-auto p-3 lg:max-h-[340px]">
            {BOT_GROUPS.map((g) => (
              <div key={g} className="mb-3">
                <h2 className="mb-1.5 px-1 text-[13px] font-bold text-fg-3">{t(`bots.group.${g}`)}</h2>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                  {BOTS.filter((b) => b.group === g).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelected(b)}
                      className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-[background-color,transform] duration-150 active:scale-[0.97] ${
                        b.id === selected.id ? 'bg-raise-2 ring-2 ring-accent' : 'hover:bg-raise'
                      }`}
                      aria-pressed={b.id === selected.id}
                    >
                      <Avatar label={b.name} hue={b.hue} size={48} />
                      <span className="w-full truncate text-center text-[12px] font-semibold">{b.name}</span>
                      <span className="tabular -mt-1 text-[11px] text-fg-3">{b.elo}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-line p-4">
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('play.color')}</div>
              <Segmented
                value={color}
                onChange={setColor}
                options={[
                  { value: 'w', label: <PieceIcon piece="k" color="w" size={26} /> },
                  { value: 'r', label: <Shuffle size={22} weight="bold" aria-label={t('common.random')} /> },
                  { value: 'b', label: <PieceIcon piece="k" color="b" size={26} /> },
                ]}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('play.time')}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_CONTROLS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTc(c.id)}
                    className={`tabular min-h-10 rounded-md text-[14px] font-bold transition-colors duration-150 ${
                      tc === c.id ? 'bg-raise-2 text-fg ring-2 ring-accent' : 'bg-panel-2 text-fg-2 hover:bg-raise'
                    }`}
                    aria-label={c.id === 'none' ? t('play.noTime') : c.label}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer list-none text-[13px] font-bold text-fg-3 hover:text-fg">{t('play.assist')} ›</summary>
              <AssistToggles />
            </details>
            <button className="btn btn-primary btn-lg w-full" onClick={start}>
              {t('play.play')}
            </button>
            <Link to="/play/local" className="btn w-full">
              <Users size={20} weight="bold" /> {t('play.local')}
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
