import { useEffect, useState, type ReactNode } from 'react'
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

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-raise/70 ${className}`} />
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
