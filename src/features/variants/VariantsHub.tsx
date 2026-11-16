import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader, Panel } from '../../ui/kit'
import { FAMILIES, VARIANTS, type Variant } from './catalog'
import { parsePosition } from './fen'
import { VariantBoard } from './VariantBoard'

export default function VariantsHub() {
  const { t } = useTranslation()
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
                <VariantCard key={v.id} variant={v} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function VariantCard({ variant }: { variant: Variant }) {
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
          <Link to={`/variants/${variant.id}`} className="after:absolute after:inset-0 after:rounded-[inherit]" data-testid={`variant-${variant.id}`}>
            {t(`variants.v.${variant.id}.name`)}
          </Link>
        </h3>
        <div className="tabular text-[12px] text-fg-3">
          {position.width}×{position.height}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-fg-2">{t(`variants.v.${variant.id}.rule`)}</p>
      </div>
    </Panel>
  )
}
