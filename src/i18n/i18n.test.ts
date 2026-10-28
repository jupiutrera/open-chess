import { describe, expect, it } from 'vitest'
import es from './es.json'
import en from './en.json'
import fr from './fr.json'
import itJson from './it.json'
import zh from './zh.json'
import ja from './ja.json'
import contentFr from './content/fr.json'
import contentIt from './content/it.json'
import contentZh from './content/zh.json'
import contentJa from './content/ja.json'
import { LESSONS } from '../features/lessons/lessonData'
import { BOTS } from '../features/play/bots'
import { POOLS } from '../features/play/botChat'

/** Every leaf path with its value; arrays count as one leaf with their length. */
function leaves(o: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  if (Array.isArray(o) || typeof o !== 'object' || o === null) return out.set(prefix, Array.isArray(o) ? o.length : o)
  for (const [k, v] of Object.entries(o)) for (const [p, x] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(p, x)
  return out
}

const vars = (s: unknown) => (typeof s === 'string' ? [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort() : [])

describe('UI translations', () => {
  const base = leaves(en)
  for (const [lang, json] of Object.entries({ es, fr, it: itJson, zh, ja })) {
    it(`${lang} has the same keys and placeholders as en`, () => {
      const l = leaves(json)
      expect([...l.keys()].sort()).toEqual([...base.keys()].sort())
      for (const [k, v] of base) expect(vars(l.get(k)), k).toEqual(vars(v))
    })
  }
})

describe('content translations', () => {
  const expected = new Map<string, unknown>()
  for (const l of LESSONS) {
    expected.set(`lessons.${l.id}.title`, 'string')
    expected.set(`lessons.${l.id}.intro`, 'string')
    expected.set(`lessons.${l.id}.steps`, l.steps.length)
  }
  for (const b of BOTS) {
    expected.set(`bots.${b.id}.bio`, 'string')
    if (b.title) expected.set(`bots.${b.id}.name`, 'string')
    for (const [ev, lines] of Object.entries(b.says ?? {})) expected.set(`bots.${b.id}.says.${ev}`, lines!.en.length)
  }
  for (const [style, pool] of Object.entries(POOLS)) for (const [ev, lines] of Object.entries(pool)) expected.set(`chat.${style}.${ev}`, lines.en.length)

  for (const [lang, json] of Object.entries({ fr: contentFr, it: contentIt, zh: contentZh, ja: contentJa })) {
    it(`${lang} covers every lesson and bot line`, () => {
      const l = leaves(json)
      expect([...l.keys()].sort()).toEqual([...expected.keys()].sort())
      for (const [k, v] of expected) expect(v === 'string' ? typeof l.get(k) : l.get(k), k).toBe(v)
    })
  }
})
