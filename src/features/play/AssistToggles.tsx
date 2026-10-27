import { useTranslation } from 'react-i18next'
import { useSettings, type AssistSettings } from '../../settings'
import { Toggle } from '../../ui/kit'

const KEYS: (keyof AssistSettings)[] = ['eval', 'threats', 'suggest', 'feedback', 'engine']

/** The five in-game helps, stored in settings so they carry over between games. */
export function AssistToggles() {
  const { t } = useTranslation()
  const assist = useSettings((s) => s.assist)
  const set = useSettings((s) => s.set)
  return (
    <div className="divide-y divide-line">
      {KEYS.map((k) => (
        <Toggle
          key={k}
          checked={assist[k]}
          onChange={(v) => set({ assist: { ...assist, [k]: v } })}
          label={t(`play.assistOpt.${k}`)}
          hint={t(`play.assistHint.${k}`)}
        />
      ))}
    </div>
  )
}
