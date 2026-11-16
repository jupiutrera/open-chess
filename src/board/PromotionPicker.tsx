import { useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismiss, useFocusTrap } from '../ui/kit'

export interface PromotionOption {
  id: string
  /** the piece's name, for screen readers */
  label: string
  /** the piece's sprite; it fills the square */
  piece: ReactNode
}

/**
 * The pieces a pawn may become, stacked on its file from the promotion square inwards.
 * Lives inside a board's own box (which must be positioned) and covers it.
 */
export function PromotionPicker({
  columns = 8,
  col,
  fromTop,
  options,
  onPick,
}: {
  /** how many files the board has */
  columns?: number
  /** the promotion file, counted from the left as the board is seen */
  col: number
  /** the promotion square is on the top edge as the board is seen */
  fromTop: boolean
  options: PromotionOption[]
  onPick: (id: string | null) => void
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  // a modal like any sheet: focus moves in, Escape and the Android back button cancel
  useDismiss(true, () => onPick(null))
  useFocusTrap(box, true)
  // the tap that played the pawn may end on top of the picker it opened: only a press that began
  // here (or the keyboard, which has no press) chooses or cancels
  const pressed = useRef(false)
  const own = (e: ReactMouseEvent) => e.detail === 0 || pressed.current
  return (
    <div className="absolute inset-0 z-20 bg-black/45" onPointerDown={() => (pressed.current = true)} onClick={(e) => own(e) && onPick(null)}>
      <div
        ref={box}
        role="dialog"
        aria-modal
        aria-label={t('common.promotion')}
        tabIndex={-1}
        className="pop absolute flex flex-col overflow-hidden rounded-md bg-[#f2f1ee] shadow-xl outline-none"
        style={{
          width: `${100 / columns}%`,
          left: `${(col * 100) / columns}%`,
          top: fromTop ? 0 : 'auto',
          bottom: fromTop ? 'auto' : 0,
          flexDirection: fromTop ? 'column' : 'column-reverse',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((o, i) => (
          <button
            key={o.id}
            data-autofocus={i === 0 ? '' : undefined}
            className="cg-wrap aspect-square w-full transition-colors duration-100 hover:bg-[#ddd]"
            style={{ position: 'relative' }}
            onClick={(e) => own(e) && onPick(o.id)}
            aria-label={o.label}
          >
            {o.piece}
          </button>
        ))}
      </div>
    </div>
  )
}
