import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users } from '@phosphor-icons/react'
import { PageHeader, Panel } from '../../ui/kit'
import { NotFound } from '../../ui/NotFound'
import { useSettings } from '../../settings'
import { botName, type Bot } from '../play/bots'
import { BotAvatar } from '../play/BotAvatar'
import { BotGrid, ColorPicker, type ColorChoice } from '../play/BotGrid'
import { botLine } from '../play/botChat'
import { variantById, type Variant } from './catalog'
import { parsePosition } from './fen'
import { rememberRival, savedRival } from './rival'
import { VariantBoard } from './VariantBoard'

/** Before a variant game: who to play and with which colour. The twin of the Play screen. */
export default function VariantSetup() {
  const { id } = useParams()
  const variant = variantById(id)
  if (!variant) return <NotFound />
  return <Setup key={variant.id} variant={variant} />
}

function Setup({ variant }: { variant: Variant }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const nav = useNavigate()
  const [selected, setSelected] = useState<Bot>(savedRival)
  // uneven armies: start on the side the variant is usually played from
  const [color, setColor] = useState<ColorChoice>(variant.suggested ?? 'w')
  const position = useMemo(() => parsePosition(variant.fen), [variant.fen])
  const greeting = useMemo(() => botLine(selected, 'greet', lang), [selected, lang])
  const name = t(`variants.v.${variant.id}.name`)

  const start = () => {
    rememberRival(selected)
    nav(`/variants/${variant.id}/play?${new URLSearchParams({ bot: selected.id, color })}`)
  }

  return (
    // the page fills the screen: the bot list scrolls on its own so the play button never leaves it
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <PageHeader
        title={name}
        back="/variants"
        right={
          <Link to={`/variants/${variant.id}/play?vs=human`} className="btn min-h-9 px-3 text-[14px]" aria-label={t('play.local')} title={t('play.local')}>
            <Users size={18} weight="bold" /> <span className="max-sm:hidden">{t('play.local')}</span>
          </Link>
        }
      />
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
            {/* a picture of the start position: the game is played on the next screen */}
            <div className="pointer-events-none" aria-hidden inert>
              <VariantBoard position={position} fairy={variant.fairy} marks={variant.marks} orientation={color === 'b' ? 'b' : 'w'} preview />
            </div>
          </div>
        </div>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-3 border-b border-line p-3 lg:gap-4 lg:p-4">
            <BotAvatar bot={selected} size={56} />
            <div className="min-w-0">
              <div className="text-[18px] font-extrabold lg:text-[20px]">
                {botName(selected, lang)} <span className="tabular font-semibold text-fg-3">{selected.elo}</span>
              </div>
              <div className="tabular text-[12px] font-bold uppercase tracking-wide text-accent">
                {t(`variants.family.${variant.family}.name`)} · {position.width}×{position.height}
              </div>
              {/* the rule is what the game is about: it takes the place of the bot's own story */}
              <p className="line-clamp-3 text-[14px] leading-snug text-fg-2">{t(`variants.v.${variant.id}.rule`)}</p>
            </div>
          </div>

          <div className="min-h-[132px] flex-1 overflow-y-auto p-3">
            <BotGrid selected={selected} onSelect={setSelected} />
            <p className="px-1 text-[12px] leading-snug text-fg-3">{t('variants.ratingNote')}</p>
          </div>

          <div className="shrink-0 space-y-3 border-t border-line p-3 lg:p-4">
            <ColorPicker value={color} onChange={setColor} />
            <button className="btn btn-primary btn-lg w-full" onClick={start}>
              {t('play.play')}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
