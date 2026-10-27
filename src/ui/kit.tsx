import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { create } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from '@phosphor-icons/react'

export function PageHeader({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="flex items-center gap-2 px-4 pb-3 pt-4 lg:px-6 lg:pt-6">
      {back && (
        <button
          className="btn btn-ghost btn-icon -ml-2"
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          aria-label="Volver"
        >
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
  return (
    <div className={`flex gap-1 rounded-lg bg-panel-2 p-1 ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
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

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="pop max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-panel p-5 pb-[calc(1.25rem+var(--inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center">
            <h2 className="text-[19px] font-extrabold">{title}</h2>
            <button className="btn btn-ghost btn-icon ml-auto -mr-2" onClick={onClose} aria-label="Cerrar">
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+var(--inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((i) => (
        <div
          key={i.id}
          role="status"
          className={`enter rounded-lg px-4 py-2.5 text-[14px] font-semibold shadow-lg ${
            i.tone === 'error' ? 'bg-danger text-white' : i.tone === 'success' ? 'bg-accent text-white' : 'bg-raise-2 text-fg'
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
