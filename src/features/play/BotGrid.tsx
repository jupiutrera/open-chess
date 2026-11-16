import { useTranslation } from 'react-i18next'
import { Shuffle } from '@phosphor-icons/react'
import { PieceIcon } from '../../board/QualityIcon'
import { Segmented } from '../../ui/kit'
import { useSettings } from '../../settings'
import { BOTS, BOT_GROUPS, botName, type Bot } from './bots'
import { BotAvatar } from './BotAvatar'

/** The bots by group, each with its portrait and rating: where a game picks its opponent. */
export function BotGrid({ selected, onSelect }: { selected: Bot; onSelect: (bot: Bot) => void }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  return BOT_GROUPS.filter((g) => g !== 'challenge').map((g) => (
    <div key={g} className="mb-3">
      <h2 className="mb-1.5 px-1 text-[13px] font-bold text-fg-3">{t(`bots.group.${g}`)}</h2>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {BOTS.filter((b) => b.group === g).map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
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
}

export type ColorChoice = 'w' | 'r' | 'b'

/** White, random or black, as the kings of the piece set. */
export function ColorPicker({ value, onChange }: { value: ColorChoice; onChange: (c: ColorChoice) => void }) {
  const { t } = useTranslation()
  return (
    <Segmented
      label={t('play.color')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'w', label: <PieceIcon piece="k" color="w" size={24} /> },
        { value: 'r', label: <Shuffle size={20} weight="bold" aria-label={t('common.random')} /> },
        { value: 'b', label: <PieceIcon piece="k" color="b" size={24} /> },
      ]}
    />
  )
}
