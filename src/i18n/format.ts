import i18next from 'i18next'

/** Locale-aware numbers: "87,5" in Spanish, "87.5" in English. */
export function fmtDecimal(n: number, digits = 1, lang = i18next.language): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

/** Short counts for tables: 1,2 mil / 3.4M / 12万. */
export function fmtCompact(n: number, lang = i18next.language): string {
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
