import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Chess } from 'chess.js'
import { Users, Shuffle, PuzzlePiece } from '@phosphor-icons/react'
import { BOTS, BOT_GROUPS, botById, botName, type Bot } from './bots'
import { CHALLENGES } from './challenges'
import { clearLiveGame, loadLiveGame } from './liveGame'
import { TimeControlPicker } from './TimeControlPicker'
import { BotAvatar } from './BotAvatar'
import { botLine } from './botChat'
import { PieceIcon } from '../../board/QualityIcon'
import { PageHeader, Panel, Segmented, Sheet } from '../../ui/kit'
import { AssistToggles } from './AssistToggles'
import { Board } from '../../board/Board'
import { db } from '../../db/db'
import { useSettings } from '../../settings'
import { localize } from '../../i18n/content'
import { START_FEN } from '../../chess/util'
import { customStartFen } from './startPosition'


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
  const [params, setParams] = useSearchParams()
  // "play this position" from analysis links here with ?fen=
  const fenParam = params.get('fen')
  const startFen = useMemo(() => customStartFen(fenParam), [fenParam])
  const [selected, setSelected] = useState<Bot>(BOTS[4])
  // from a given position the user takes the side to move by default
  const [color, setColor] = useState<'w' | 'b' | 'r'>(() => (startFen ? new Chess(startFen).turn() : 'w'))
  const [tc, setTc] = useState('none')
  const record = useBotRecord(selected.id)
  const greeting = useMemo(() => botLine(selected, 'greet', lang), [selected, lang])
  const [live, setLive] = useState(() => loadLiveGame('bot'))
  const liveBot = live?.botId ? botById(live.botId) : undefined
  // a challenge may fix the start position and the user's side
  const rules = selected.challenge ? CHALLENGES[selected.challenge] : undefined
  const side = rules?.userColor ?? color

  // a new game would replace the saved one: ask first
  const [confirmNew, setConfirmNew] = useState(false)
  const begin = () => {
    clearLiveGame('bot')
    const q = new URLSearchParams({ color: side, tc })
    if (startFen) q.set('fen', startFen)
    nav(`/play/bot/${selected.id}?${q}`)
  }
  const start = () => (live && liveBot ? setConfirmNew(true) : begin())

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('play.title')} />
      {fenParam && (
        <div className="px-4 pb-4 lg:px-6">
          <Panel className="flex flex-wrap items-center gap-3 p-3">
            <PuzzlePiece size={22} weight="bold" className="shrink-0 text-fg-3" />
            <div className="min-w-0 flex-1 text-[14px] font-semibold">{startFen ? t('play.customStart') : t('play.invalidStart')}</div>
            {startFen && (
              <button
                className="btn"
                onClick={() =>
                  setParams(
                    (p) => {
                      p.delete('fen')
                      return p
                    },
                    { replace: true },
                  )
                }
              >
                {t('play.standardStart')}
              </button>
            )}
          </Panel>
        </div>
      )}
      {live && liveBot && (
        <div className="px-4 pb-4 lg:px-6">
          <Panel className="flex flex-wrap items-center gap-3 p-3">
            <BotAvatar bot={liveBot} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{t('play.inProgress', { name: botName(liveBot, lang) })}</div>
              <div className="tabular text-[13px] text-fg-3">{t('play.movesPlayed', { count: Math.ceil(live.sans.length / 2) })}</div>
            </div>
            <button
              className="btn"
              onClick={() => {
                clearLiveGame('bot')
                setLive(null)
              }}
            >
              {t('play.discard')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => nav(`/play/bot/${liveBot.id}?${new URLSearchParams({ tc: live.tc, color: live.userColor ?? 'w', resume: '1' })}`)}
            >
              {t('play.continue')}
            </button>
          </Panel>
        </div>
      )}
      <div className="grid gap-5 px-4 pb-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
        <div className="hidden lg:block">
          <div className="mx-auto max-w-[min(100%,calc(100dvh-180px))]">
            <div className="relative mb-2 flex h-12 items-center gap-2.5">
              <BotAvatar bot={selected} size={40} />
              <span className="font-bold">
                {botName(selected, lang)} <span className="font-normal text-fg-3">({selected.elo})</span>
              </span>
              <div key={selected.id} className="speech">
                {greeting}
              </div>
            </div>
            <Board fen={rules?.startFen ?? startFen ?? START_FEN} orientation={side === 'b' ? 'black' : 'white'} />
          </div>
        </div>

        <Panel className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line p-4">
            <BotAvatar bot={selected} size={64} />
            <div className="min-w-0">
              <div className="text-[20px] font-extrabold">
                {botName(selected, lang)} <span className="tabular font-semibold text-fg-3">{selected.elo}</span>
              </div>
              {selected.challenge && <div className="text-[12px] font-bold uppercase tracking-wide text-accent">{t('bots.group.challenge')}</div>}
              <p className="text-[14px] text-fg-2">{localize(selected.bio, lang, `bots.${selected.id}.bio`)}</p>
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
                      <BotAvatar bot={b} size={48} />
                      <span className="w-full truncate text-center text-[12px] font-semibold">{botName(b, lang)}</span>
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
                value={side}
                onChange={(c) => !rules?.userColor && setColor(c)}
                options={[
                  { value: 'w', label: <PieceIcon piece="k" color="w" size={26} /> },
                  { value: 'r', label: <Shuffle size={22} weight="bold" aria-label={t('common.random')} /> },
                  { value: 'b', label: <PieceIcon piece="k" color="b" size={26} /> },
                ]}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('play.time')}</div>
              <TimeControlPicker value={tc} onChange={setTc} />
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
      <Sheet open={confirmNew} onClose={() => setConfirmNew(false)} title={t('play.newGame')}>
        <p className="mb-4 text-fg-2">{t('play.replaceSaved', { name: liveBot ? botName(liveBot, lang) : '' })}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setConfirmNew(false)}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={begin}>
            {t('play.discard')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
