/** Polish has few and many categories in addition to one and other. The Polish
 * other strings use wording suitable for every non-singular integer, so share
 * them with those categories without changing the source catalogue's keys. */
export function polishPlurals(resource: object): object {
  return Object.fromEntries(Object.entries(resource).flatMap(([key, value]) => {
    const translated = value && typeof value === 'object' && !Array.isArray(value) ? polishPlurals(value) : value
    if (!key.endsWith('_other')) return [[key, translated]]
    const base = key.slice(0, -6)
    return [[key, translated], [`${base}_few`, translated], [`${base}_many`, translated]]
  }))
}
