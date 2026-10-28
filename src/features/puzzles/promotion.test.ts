import { describe, expect, it } from 'vitest'
import { pickPromotion } from './promotion'

describe('pickPromotion', () => {
  it('takes the expected piece when the board sent none', () => {
    expect(pickPromotion('a7', 'a8', undefined, 'a7a8n', false)).toBe('n')
  })
  it('replaces an auto-queen with the expected underpromotion', () => {
    expect(pickPromotion('a7', 'a8', 'q', 'a7a8n', true)).toBe('n')
  })
  it('keeps a queen picked by hand', () => {
    expect(pickPromotion('a7', 'a8', 'q', 'a7a8n', false)).toBe('q')
  })
  it('only applies to the expected squares', () => {
    expect(pickPromotion('b7', 'b8', 'q', 'a7a8n', true)).toBe('q')
    expect(pickPromotion('e2', 'e4', undefined, 'e2e4', true)).toBe('')
  })
})
