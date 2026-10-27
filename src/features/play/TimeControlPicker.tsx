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
  // the fields keep what is typed (even empty); only valid numbers change the clock
  const [minText, setMinText] = useState(String(min))
  const [incText, setIncText] = useState(String(inc))
  const field = (text: string, setText: (s: string) => void, lo: number, hi: number, apply: (v: number) => void) => ({
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value)
      const v = Number(e.target.value)
      if (e.target.value !== '' && Number.isInteger(v) && v >= lo && v <= hi) apply(v)
    },
    onBlur: () => {
      const v = Math.min(hi, Math.max(lo, Math.round(Number(text)) || lo))
      setText(String(v))
      apply(v)
    },
  })
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
              {...field(minText, setMinText, 1, 180, (v) => {
                setMin(v)
                pick(v, inc)
              })}
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
              {...field(incText, setIncText, 0, 60, (v) => {
                setInc(v)
                pick(min, v)
              })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
