import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { create } from 'zustand'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, X } from '@phosphor-icons/react'

/* Overlays (sheets, menus) stack so Escape and the Android back button close the top one first. */
const overlays: { current: () => void }[] = []

export const overlayOpen = () => overlays.length > 0

/** Closes the topmost open overlay; false when none is open. */
export function closeTopOverlay(): boolean {
  const top = overlays[overlays.length - 1]
  if (!top) return false
  top.current()
  return true
}

/** Registers an open overlay so Escape / back close it. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef({ current: onClose })
  ref.current.current = onClose
  useEffect(() => {
    if (!open) return
    const entry = ref.current
    overlays.push(entry)
    return () => {
      const i = overlays.indexOf(entry)
      if (i >= 0) overlays.splice(i, 1)
    }
  }, [open])
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeTopOverlay()) e.preventDefault()
  })
}

/** The parent route, for a back button opened from a deep link with no history. */
function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return '/' + parts.slice(0, -1).join('/')
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate()
  const { t } = useTranslation()
  const { pathname, key } = useLocation()
  // the first entry of the session has key "default": there is nothing to go back to
  const goBack = () => (typeof back === 'string' ? nav(back) : key === 'default' ? nav(parentPath(pathname)) : nav(-1))
  return (
    <header className="flex items-center gap-2 px-4 pb-3 pt-4 lg:px-6 lg:pt-6">
      {back && (
        <button className="btn btn-ghost btn-icon -ml-2" onClick={goBack} aria-label={t('common.back')}>
          <ArrowLeft size={22} weight="bold" />
        </button>
      )}
      <h1 className="text-[22px] font-extrabold tracking-tight lg:text-[26px]">{title}</h1>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[10px] bg-panel ${className}`}>{children}</section>
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
}) {
  // radio-group keys: arrows move the choice (and keep them from stepping a board behind it)
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    e.stopPropagation()
    const i = options.findIndex((o) => o.value === value)
    const next = (i + step + options.length) % options.length
    onChange(options[next].value)
    ;(e.currentTarget.children[next] as HTMLElement | undefined)?.focus()
  }
  return (
    <div className={`flex gap-1 rounded-lg bg-panel-2 p-1 ${className}`} role="radiogroup" onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[14px] font-bold transition-colors duration-150 ${
            o.value === value ? 'bg-raise-2 text-fg' : 'text-fg-3 hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-fg-3">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-raise-2'}`}
      >
        <span
          className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow"
          style={{ transform: `translateX(${checked ? 20 : 0}px)`, transition: 'transform 200ms var(--ease-out)' }}
        />
      </button>
    </label>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Keeps Tab inside `box` while mounted, focuses it, and gives focus back on unmount. */
export function useFocusTrap(box: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !box.current) return
    const el = box.current
    const previous = document.activeElement as HTMLElement | null
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [active, box])
}

export function Sheet({
  open,
  onClose,
  title,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  /** accessible name when there is no visible title */
  label?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  useDismiss(open, onClose)
  useFocusTrap(box, open)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className="pop max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-panel p-5 pb-[calc(1.25rem+var(--inset-bottom))] outline-none sm:max-w-md sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center">
            <h2 id={titleId} className="text-[19px] font-extrabold">
              {title}
            </h2>
            <button className="btn btn-ghost btn-icon ml-auto -mr-2" onClick={onClose} aria-label={t('common.close')}>
              <X size={20} weight="bold" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* Toasts */
interface ToastState {
  items: { id: number; text: string; tone: 'info' | 'error' | 'success' }[]
  push: (text: string, tone?: 'info' | 'error' | 'success') => void
}
let tid = 0
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (text, tone = 'info') => {
    const id = ++tid
    set((s) => ({ items: [...s.items, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3200)
  },
}))
export const toast = (text: string, tone?: 'info' | 'error' | 'success') => useToasts.getState().push(text, tone)

export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    // one live region that stays mounted: screen readers miss regions inserted together with their text
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+var(--inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className={`enter rounded-lg px-4 py-2.5 text-[14px] font-semibold shadow-lg ${
            i.tone === 'error' ? 'bg-[var(--danger-strong)] text-white' : i.tone === 'success' ? 'bg-[var(--success-strong)] text-white' : 'bg-raise-2 text-fg'
          }`}
        >
          {i.text}
        </div>
      ))}
    </div>
  )
}

/* Skeletons: shapes that match the content they stand in for, with a soft shimmer */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} aria-hidden />
}

/** An inline bar the height of a line of text. */
export function SkeletonText({ width = '6ch', className = '' }: { width?: string | number; className?: string }) {
  return <span className={`skeleton inline-block h-[0.8em] translate-y-[0.1em] rounded ${className}`} style={{ width }} aria-hidden />
}

/** Placeholder rows shaped like the game list. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4" style={{ width: `${62 - ((i * 17) % 24)}%` }} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </div>
  )
}

/** Board screen placeholder: player bars, board and side panel in the real layout. */
export function BoardScreenSkeleton({ side = true }: { side?: boolean }) {
  const bar = (
    <div className="flex h-12 items-center gap-2.5 px-2 lg:px-0.5">
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="ml-auto h-9 w-24" />
    </div>
  )
  return (
    <div className="board-layout" style={{ '--bars': 2, '--evalw': '0px' } as CSSProperties} aria-busy>
      <div className="bl-board">
        {bar}
        <Skeleton className="aspect-square w-full rounded" />
        {bar}
      </div>
      {side && (
        <aside className="bl-side">
          <div className="flex flex-col gap-3 rounded-[10px] bg-panel p-4 lg:h-full">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5" style={{ width: `${88 - ((i * 13) % 30)}%` }} />
            ))}
            <div className="mt-auto grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-[10px]" />
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

/** Hub page placeholder: title, a hero card and a grid of tiles. */
export function HubSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-4 lg:px-6 lg:pt-6" aria-busy>
      <Skeleton className="mb-5 h-8 w-48" />
      <Skeleton className="mb-3 h-24 rounded-[10px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-[10px]" />
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[10px] bg-panel">
        <SkeletonRows count={4} />
      </div>
    </div>
  )
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function timeAgo(ts: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const diff = (ts - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return new Date(ts).toLocaleDateString(lang)
}
