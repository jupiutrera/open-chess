import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Chess } from 'chess.js'
import { Users, Shuffle, PuzzlePiece, Timer, SlidersHorizontal } from '@phosphor-icons/react'
import { BOTS, BOT_GROUPS, botById, botName, type Bot } from './bots'

const CHALLENGE_BOTS = BOTS.filter((b) => b.challenge)
import { CHALLENGES } from './challenges'
import { clearLiveGame, loadLiveGame } from './liveGame'
import { TimeControlPicker } from './TimeControlPicker'
import { timeControl } from './timeControl'
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
  // challenges get their own tab (?tab=challenges links straight to it)
  const [tab, setTab] = useState<'bots' | 'challenges'>(() => (params.get('tab') === 'challenges' ? 'challenges' : 'bots'))
  const [selected, setSelected] = useState<Bot>(() => (tab === 'challenges' ? CHALLENGE_BOTS[0] : BOTS[4]))
  const pickTab = (next: 'bots' | 'challenges') => {
    setTab(next)
    if ((next === 'challenges') !== !!selected.challenge) setSelected(next === 'challenges' ? CHALLENGE_BOTS[0] : BOTS[4])
  }
  // from a given position the user takes the side to move by default
  const [color, setColor] = useState<'w' | 'b' | 'r'>(() => (startFen ? new Chess(startFen).turn() : 'w'))
  const [tc, setTc] = useState('none')
  const [timeOpen, setTimeOpen] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)
  const record = useBotRecord(selected.id)
  const greeting = useMemo(() => botLine(selected, 'greet', lang), [selected, lang])
  const [live, setLive] = useState(() => loadLiveGame('bot'))
  const liveBot = live?.botId ? botById(live.botId) : undefined
  // a challenge may fix the start position and the user's side
  const rules = selected.challenge ? CHALLENGES[selected.challenge] : undefined
  const side = rules?.userColor ?? color
  const timeLabel = tc === 'none' ? t('play.noTime') : timeControl(tc).label
  const helps = Object.values(useSettings((s) => s.assist)).filter(Boolean).length

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
    // the page fills the screen: the bot list scrolls on its own so the play button never leaves it
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <PageHeader
        title={t('play.title')}
        right={
          <Link to="/play/local" className="btn min-h-9 px-3 text-[14px]">
            <Users size={18} weight="bold" /> {t('play.local')}
          </Link>
        }
      />
      {fenParam && (
        <div className="shrink-0 px-4 pb-3 lg:px-6">
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
        <div className="shrink-0 px-4 pb-3 lg:px-6">
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
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-5 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6 lg:pb-6">
        <div className="hidden lg:block">
          <div className="mx-auto max-w-[min(100%,calc(100dvh-160px))]">
            <div className="mb-2 flex h-12 items-center gap-2.5">
              <BotAvatar bot={selected} size={40} />
              <div className="relative min-w-0 flex-1">
                <span className="font-bold">
                  {botName(selected, lang)} <span className="font-normal text-fg-3">({selected.elo})</span>
                </span>
                <div key={selected.id} className="speech">
                  <span>{greeting}</span>
                </div>
              </div>
            </div>
            <Board fen={rules?.startFen ?? startFen ?? START_FEN} orientation={side === 'b' ? 'black' : 'white'} />
          </div>
        </div>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-3 border-b border-line p-3 lg:gap-4 lg:p-4">
            <BotAvatar bot={selected} size={56} />
            <div className="min-w-0">
              <div className="text-[18px] font-extrabold lg:text-[20px]">
                {botName(selected, lang)} <span className="tabular font-semibold text-fg-3">{selected.elo}</span>
              </div>
              {selected.challenge && <div className="text-[12px] font-bold uppercase tracking-wide text-accent">{t('bots.group.challenge')}</div>}
              <p className="line-clamp-3 text-[14px] leading-snug text-fg-2">{localize(selected.bio, lang, `bots.${selected.id}.bio`)}</p>
              {record && record.w + record.d + record.l > 0 && (
                <p className="tabular mt-1 text-[13px] text-fg-3">{t('play.record', record)}</p>
              )}
            </div>
          </div>

          <div className="shrink-0 border-b border-line p-2 lg:p-3">
            <Segmented
              value={tab}
              onChange={pickTab}
              options={[
                { value: 'bots', label: t('play.botsTab') },
                { value: 'challenges', label: t('bots.group.challenge') },
              ]}
            />
          </div>
          <div className="min-h-[132px] flex-1 overflow-y-auto p-3">
            {tab === 'bots' ? (
              BOT_GROUPS.filter((g) => g !== 'challenge').map((g) => (
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
              ))
            ) : (
              // challenge names are long and the rule is the point: a list, never truncated
              <div className="space-y-1">
                {CHALLENGE_BOTS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.99] ${
                      b.id === selected.id ? 'bg-raise-2 ring-2 ring-accent' : 'hover:bg-raise'
                    }`}
                    aria-pressed={b.id === selected.id}
                  >
                    <BotAvatar bot={b} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold leading-tight">{botName(b, lang)}</span>
                      <span className="block text-[12px] leading-snug text-fg-2">{localize(b.bio, lang, `bots.${b.id}.bio`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* colour, clock and helps stay one row each; the clock and helps open in sheets */}
          <div className="shrink-0 space-y-3 border-t border-line p-3 lg:p-4">
            <div className="grid grid-cols-2 gap-2">
              <Segmented
                label={t('play.color')}
                value={side}
                onChange={(c) => !rules?.userColor && setColor(c)}
                options={[
                  { value: 'w', label: <PieceIcon piece="k" color="w" size={24} /> },
                  { value: 'r', label: <Shuffle size={20} weight="bold" aria-label={t('common.random')} /> },
                  { value: 'b', label: <PieceIcon piece="k" color="b" size={24} /> },
                ]}
              />
              <button
                className="btn min-w-0 px-3"
                onClick={() => setTimeOpen(true)}
                aria-haspopup="dialog"
                aria-label={`${t('play.time')}: ${timeLabel}`}
              >
                <Timer size={20} weight="bold" className="shrink-0 text-fg-3" />
                <span className="tabular truncate">{timeLabel}</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-lg min-w-0 flex-1" onClick={start}>
                {t('play.play')}
              </button>
              <button
                className="btn btn-lg btn-icon relative w-14"
                onClick={() => setAssistOpen(true)}
                aria-haspopup="dialog"
                aria-label={helps ? `${t('play.assist')} (${helps})` : t('play.assist')}
              >
                <SlidersHorizontal size={24} weight="bold" />
                {/* the helps hide in a sheet now: show at a glance how many are on */}
                {helps > 0 && (
                  <span className="tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                    {helps}
                  </span>
                )}
              </button>
            </div>
          </div>
        </Panel>
      </div>
      <Sheet open={timeOpen} onClose={() => setTimeOpen(false)} title={t('play.time')}>
        <TimeControlPicker value={tc} onChange={setTc} onPreset={() => setTimeOpen(false)} />
        <button className="btn mt-4 w-full" onClick={() => setTimeOpen(false)}>
          {t('common.close')}
        </button>
      </Sheet>
      <Sheet open={assistOpen} onClose={() => setAssistOpen(false)} title={t('play.assist')}>
        <AssistToggles />
        <button className="btn mt-4 w-full" onClick={() => setAssistOpen(false)}>
          {t('common.close')}
        </button>
      </Sheet>
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
