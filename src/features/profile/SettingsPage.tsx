import { useTranslation } from 'react-i18next'
import { PageHeader, Panel, Segmented, Toggle } from '../../ui/kit'
import { useSettings, PIECE_SETS, SOUND_SETS, LANGS, LANG_NAMES, type BoardTheme } from '../../settings'
import { play, preloadSounds } from '../../chess/sounds'

const KNIGHTS = import.meta.glob('../../assets/pieces/*/wN.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const KINGS = import.meta.glob('../../assets/pieces/*/bK.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const pieceUrl = (all: Record<string, string>, set: string) => Object.entries(all).find(([k]) => k.includes(`/${set}/`))?.[1]

const BOARDS: { id: BoardTheme; light: string; dark: string }[] = [
  { id: 'green', light: '#ebecd0', dark: '#739552' },
  { id: 'brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'gray', light: '#d9d9d9', dark: '#a1a1a1' },
  { id: 'purple', light: '#e8e1ef', dark: '#9a7fb3' },
]

export default function SettingsPage() {
  const { t } = useTranslation()
  const s = useSettings()
  return (
    <div className="mx-auto max-w-2xl pb-8">
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-4 px-4 lg:px-6">
        <Panel className="grid gap-4 p-4">
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('settings.language')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l}
                  lang={l}
                  onClick={() => s.set({ lang: l })}
                  aria-pressed={s.lang === l}
                  className={`min-h-10 rounded-md text-[14px] font-bold transition-colors duration-150 ${
                    s.lang === l ? 'bg-raise-2 text-fg ring-2 ring-accent' : 'bg-panel-2 text-fg-2 hover:bg-raise'
                  }`}
                >
                  {LANG_NAMES[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('settings.theme')}</div>
            <Segmented
              value={s.theme}
              onChange={(theme) => s.set({ theme })}
              options={[
                { value: 'system', label: t('settings.system') },
                { value: 'dark', label: t('settings.dark') },
                { value: 'light', label: t('settings.light') },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('settings.board')}</div>
            <div className="grid grid-cols-5 gap-2">
              {BOARDS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => s.set({ board: b.id })}
                  className={`grid aspect-square grid-cols-2 overflow-hidden rounded-md transition-transform duration-150 active:scale-[0.97] ${
                    s.board === b.id ? 'ring-3 ring-accent ring-offset-2 ring-offset-panel' : ''
                  }`}
                  aria-label={t(`settings.boardColors.${b.id}`)}
                  aria-pressed={s.board === b.id}
                >
                  <span style={{ background: b.light }} />
                  <span style={{ background: b.dark }} />
                  <span style={{ background: b.dark }} />
                  <span style={{ background: b.light }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('settings.pieces')}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PIECE_SETS.map((p) => (
                <button
                  key={p}
                  onClick={() => s.set({ pieces: p })}
                  aria-pressed={s.pieces === p}
                  className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-[background-color,transform] duration-150 active:scale-[0.97] ${
                    s.pieces === p ? 'bg-raise-2 ring-2 ring-accent' : 'bg-panel-2 hover:bg-raise'
                  }`}
                >
                  <span className="flex">
                    <img src={pieceUrl(KNIGHTS, p)} width={38} height={38} alt="" />
                    <img src={pieceUrl(KINGS, p)} width={38} height={38} alt="" />
                  </span>
                  <span className="text-[12px] font-semibold capitalize text-fg-2">{p}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="divide-y divide-line px-4">
          <Toggle checked={s.sound} onChange={(v) => s.set({ sound: v })} label={t('settings.sound')} />
          {s.sound && (
            <div className="py-3">
              <div className="mb-1.5 text-[13px] font-bold text-fg-3">{t('settings.soundSet')}</div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {SOUND_SETS.map((set) => (
                  <button
                    key={set}
                    onClick={() => {
                      s.set({ soundSet: set })
                      preloadSounds(set)
                      // let the user hear it: a move, then a capture
                      play('move')
                      setTimeout(() => play('capture'), 380)
                    }}
                    aria-pressed={s.soundSet === set}
                    className={`min-h-10 rounded-md text-[14px] font-bold transition-colors duration-150 ${
                      s.soundSet === set ? 'bg-raise-2 text-fg ring-2 ring-accent' : 'bg-panel-2 text-fg-2 hover:bg-raise'
                    }`}
                  >
                    {t(`settings.soundSets.${set}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Toggle checked={s.haptics} onChange={(v) => s.set({ haptics: v })} label={t('settings.haptics')} />
          <Toggle checked={s.coords} onChange={(v) => s.set({ coords: v })} label={t('settings.coords')} />
          <Toggle checked={s.showDests} onChange={(v) => s.set({ showDests: v })} label={t('settings.showDests')} />
          <Toggle checked={s.animation} onChange={(v) => s.set({ animation: v })} label={t('settings.animation')} />
          <Toggle checked={s.highContrast} onChange={(v) => s.set({ highContrast: v })} label={t('settings.highContrast')} hint={t('settings.highContrastHint')} />
          <Toggle checked={s.autoQueen} onChange={(v) => s.set({ autoQueen: v })} label={t('settings.autoQueen')} />
        </Panel>

        <Panel className="grid gap-4 p-4">
          <div>
            <label htmlFor="depth" className="flex items-center justify-between font-semibold">
              {t('settings.reviewDepth')} <span className="tabular text-fg-2">{s.reviewDepth}</span>
            </label>
            <input
              id="depth"
              type="range"
              min={10}
              max={20}
              value={s.reviewDepth}
              onChange={(e) => s.set({ reviewDepth: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
            <p className="text-[13px] text-fg-3">{t('settings.reviewDepthHelp')}</p>
          </div>
          <div>
            <label htmlFor="lichess-token" className="font-semibold">
              {t('settings.lichessToken')}
            </label>
            <input
              id="lichess-token"
              type="password"
              autoComplete="off"
              className="field mt-2 font-mono text-[13px]"
              value={s.lichessToken}
              onChange={(e) => s.set({ lichessToken: e.target.value })}
              placeholder="lip_…"
            />
            <p className="mt-1 text-[13px] text-fg-3">
              {t('settings.lichessTokenHelp')}{' '}
              <a href="https://lichess.org/account/oauth/token" target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
                lichess.org/account/oauth/token
              </a>
            </p>
          </div>
        </Panel>

        <p className="px-1 text-[13px] text-fg-3">{t('settings.about')}</p>
      </div>
    </div>
  )
}
