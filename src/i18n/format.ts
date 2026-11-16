import i18next from 'i18next'

/** Locale-aware numbers: "87,5" in Spanish, "87.5" in English. */
export function fmtDecimal(n: number, digits = 1, lang = i18next.language): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

/** YYYY-MM-DD of the local calendar day, for file names (toISOString would give the UTC day, off by one late at night). */
export function localDay(ms: number = Date.now()): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** Short counts for tables: 1,2 mil / 3.4M / 12万. */
export function fmtCompact(n: number, lang = i18next.language): string {
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
