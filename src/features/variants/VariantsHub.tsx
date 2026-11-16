import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader, Panel, Segmented, Sheet } from '../../ui/kit'
import { DEFAULT_LEVEL, FAMILIES, LEVELS, VARIANTS, type Variant } from './catalog'
import { parsePosition } from './fen'
import { VariantBoard } from './VariantBoard'

const LEVEL_KEY = 'oc-variant-level'

function savedLevel(): number {
  try {
    const n = Number(localStorage.getItem(LEVEL_KEY))
    return LEVELS.some((l) => l.id === n) ? n : DEFAULT_LEVEL
  } catch {
    return DEFAULT_LEVEL
  }
}

type Rival = 'bot' | 'human'
type ColorChoice = 'w' | 'r' | 'b'

export default function VariantsHub() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [picked, setPicked] = useState<Variant | null>(null)
  const [rival, setRival] = useState<Rival>('bot')
  const [color, setColor] = useState<ColorChoice>('r')
  const [level, setLevel] = useState(savedLevel)

  const pick = (v: Variant) => {
    // uneven armies: start on the side the variant is usually played from
    setColor(v.suggested ?? 'r')
    setPicked(v)
  }
  const start = () => {
    if (!picked) return
    try {
      localStorage.setItem(LEVEL_KEY, String(level))
    } catch {
      // the level just isn't remembered
    }
    const query: Record<string, string> = rival === 'human' ? { vs: 'human', color: 'w' } : { color, level: String(level) }
    nav(`/variants/${picked.id}?${new URLSearchParams(query)}`)
  }

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader title={t('variants.title')} back="/play" />
      <div className="grid gap-6 px-4 lg:px-6">
        <p className="-mt-1 max-w-2xl text-fg-2">{t('variants.intro')}</p>
        {FAMILIES.map((family) => (
          <section key={family} aria-labelledby={`family-${family}`}>
            <h2 id={`family-${family}`} className="text-[18px] font-extrabold">
              {t(`variants.family.${family}.name`)}
            </h2>
            <p className="mb-3 text-[14px] text-fg-3">{t(`variants.family.${family}.hint`)}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VARIANTS.filter((v) => v.family === family).map((v) => (
                <VariantCard key={v.id} variant={v} onPick={() => pick(v)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Sheet open={!!picked} onClose={() => setPicked(null)} title={picked ? t(`variants.v.${picked.id}.name`) : ''}>
        {picked && (
          <div className="grid gap-4">
            <p className="text-fg-2">{t(`variants.v.${picked.id}.rule`)}</p>
            <Segmented<Rival>
              value={rival}
              onChange={setRival}
              label={t('variants.rival')}
              options={[
                { value: 'bot', label: t('variants.vsEngine') },
                { value: 'human', label: t('play.local') },
              ]}
            />
            {rival === 'bot' && (
              <>
                <div>
                  <div className="mb-1.5 text-[13px] font-semibold text-fg-3">{t('play.color')}</div>
                  <Segmented<ColorChoice>
                    value={color}
                    onChange={setColor}
                    label={t('play.color')}
                    options={[
                      { value: 'w', label: t('common.white') },
                      { value: 'r', label: t('common.random') },
                      { value: 'b', label: t('common.black') },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-[13px] font-semibold text-fg-3">{t('variants.levelLabel')}</div>
                  <Segmented<number> value={level} onChange={setLevel} label={t('variants.levelLabel')} options={LEVELS.map((l) => ({ value: l.id, label: String(l.id) }))} />
                  <p className="mt-1.5 text-[13px] text-fg-2">{t(`variants.level.${level}`)}</p>
                </div>
              </>
            )}
            <button className="btn btn-primary btn-lg w-full" onClick={start}>
              {t('play.play')}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function VariantCard({ variant, onPick }: { variant: Variant; onPick: () => void }) {
  const { t } = useTranslation()
  const position = useMemo(() => parsePosition(variant.fen), [variant.fen])
  return (
    <Panel className="relative flex gap-3 p-3 transition-colors duration-150 hover:bg-raise/40">
      {/* a picture of the start position: the board itself is not for playing here */}
      <div className="pointer-events-none w-24 shrink-0" aria-hidden inert>
        <VariantBoard position={position} fairy={variant.fairy} marks={variant.marks} preview />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold leading-tight">
          <button className="text-left after:absolute after:inset-0 after:rounded-[inherit]" onClick={onPick} data-testid={`variant-${variant.id}`}>
            {t(`variants.v.${variant.id}.name`)}
          </button>
        </h3>
        <div className="tabular text-[12px] text-fg-3">
          {position.width}×{position.height}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-fg-2">{t(`variants.v.${variant.id}.rule`)}</p>
      </div>
    </Panel>
  )
}
