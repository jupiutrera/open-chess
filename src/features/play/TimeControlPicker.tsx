import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TIME_CONTROLS, timeControl } from './timeControl'

/** Presets plus a custom minutes + increment clock. */
export function TimeControlPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation()
  const isPreset = TIME_CONTROLS.some((c) => c.id === value)
  const [custom, setCustom] = useState(!isPreset)
  const current = timeControl(value)
  const [min, setMin] = useState(isPreset ? 10 : current.base / 60)
  const [inc, setInc] = useState(isPreset ? 5 : current.inc)
  const pick = (m: number, i: number) => onChange(timeControl(`${m}+${i}`).id)
  const chip = (active: boolean) =>
    `tabular min-h-10 rounded-md text-[14px] font-bold transition-colors duration-150 ${
      active ? 'bg-raise-2 text-fg ring-2 ring-accent' : 'bg-panel-2 text-fg-2 hover:bg-raise'
    }`
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {TIME_CONTROLS.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCustom(false)
              onChange(c.id)
            }}
            className={chip(!custom && value === c.id)}
            aria-pressed={!custom && value === c.id}
            aria-label={c.id === 'none' ? t('play.noTime') : c.label}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => {
            setCustom(true)
            pick(min, inc)
          }}
          className={chip(custom)}
          aria-pressed={custom}
        >
          {t('play.custom')}
        </button>
      </div>
      {custom && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[13px] font-semibold text-fg-3">
            {t('play.minutes')}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              className="field mt-1"
              value={min}
              onChange={(e) => {
                const v = Math.min(180, Math.max(1, Number(e.target.value) || 1))
                setMin(v)
                pick(v, inc)
              }}
            />
          </label>
          <label className="text-[13px] font-semibold text-fg-3">
            {t('play.increment')}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              className="field mt-1"
              value={inc}
              onChange={(e) => {
                const v = Math.min(60, Math.max(0, Number(e.target.value) || 0))
                setInc(v)
                pick(min, v)
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
