import { describe, expect, it } from 'vitest'
import { serialRunner } from './runner'

describe('serialRunner', () => {
  it('joins a running job instead of starting another', async () => {
    let calls = 0
    const r = serialRunner(async () => {
      calls++
      await Promise.resolve()
    })
    await Promise.all([r.run(), r.run()])
    expect(calls).toBe(1)
  })

  it('a run invalidated midway sees itself stale and is started again', async () => {
    const seen: boolean[] = []
    let release!: () => void
    let first = true
    const r = serialRunner(async (stale) => {
      if (first) {
        first = false
        await new Promise<void>((res) => (release = res))
      }
      seen.push(stale())
    })
    const p = r.run()
    await Promise.resolve()
    r.invalidate()
    release()
    await p
    // the stale run must not commit its cursors; the fresh one may
    expect(seen).toEqual([true, false])
  })

  it('does not run again when it is no longer allowed', async () => {
    let calls = 0
    let release!: () => void
    const r = serialRunner(
      async () => {
        calls++
        if (calls === 1) await new Promise<void>((res) => (release = res))
      },
      () => false,
    )
    const p = r.run()
    await Promise.resolve()
    r.invalidate()
    release()
    await p
    expect(calls).toBe(1)
  })
})
