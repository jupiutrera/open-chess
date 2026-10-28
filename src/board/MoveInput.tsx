import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseMoveInput } from './parseMove'

/**
 * Keyboard move entry for desktop: a move typed in SAN or UCI goes through the same
 * handler as one played on the board. Hidden on phones, where the board is the input.
 */
export function MoveInput({
  fen,
  disabled,
  onMove,
  className = '',
}: {
  /** the live position */
  fen: string
  /** not the user's move: a typed move waits (Enter again once it is) */
  disabled?: boolean
  onMove: (from: string, to: string, promotion?: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className={`hidden lg:block ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (disabled || !text.trim()) return
        const m = parseMoveInput(fen, text)
        if (!m) {
          setError(t('play.illegalMove', { move: text.trim() }))
          return
        }
        setText('')
        setError(null)
        onMove(m.from, m.to, m.promotion)
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t('play.typeMove')}
      </label>
      <input
        id={id}
        className="field font-mono text-[14px]"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        placeholder={t('play.typeMove')}
        // not `disabled`: that would drop focus every time the opponent is to move
        aria-disabled={disabled || undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[12px] font-semibold text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
