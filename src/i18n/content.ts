import type { Lang } from '../settings'
import fr from './content/fr.json'
import it from './content/it.json'
import zh from './content/zh.json'
import ja from './content/ja.json'

/**
 * Lesson and bot texts live next to their data in Spanish and English; the
 * other languages come from overlay files in ./content, keyed by a dotted path
 * (e.g. "lessons.forks.title"). Anything missing falls back to English.
 */
const OVERLAYS: Partial<Record<Lang, unknown>> = { fr, it, zh, ja }

function lookup(lang: Lang, path: string): unknown {
  let node = OVERLAYS[lang]
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

export function localize(v: { es: string; en: string }, lang: Lang, path: string): string {
  if (lang === 'es' || lang === 'en') return v[lang]
  const hit = lookup(lang, path)
  return typeof hit === 'string' ? hit : v.en
}

export function localizeList(v: { es: string[]; en: string[] }, lang: Lang, path: string): string[] {
  if (lang === 'es' || lang === 'en') return v[lang]
  const hit = lookup(lang, path)
  return Array.isArray(hit) && hit.length ? (hit as string[]) : v.en
}
