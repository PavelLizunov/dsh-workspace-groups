import { describe, expect, it } from 'vitest'
import { effectiveFolderColor } from '../src/client/folder-colors.ts'
import { setItemColor } from '../src/client/overlay-core.ts'

describe('workspace folder color inheritance', () => {
  it('inherits current parent without materializing an override', () => {
    const colors = Object.freeze({ Dev: 'green', Other: 'blue' })
    expect(effectiveFolderColor(colors, 'w1', 'Dev')).toBe('green')
    expect(effectiveFolderColor(colors, 'w1', 'Other')).toBe('blue')
    expect(colors).toEqual({ Dev: 'green', Other: 'blue' })
  })
  it('keeps own color above parent and supports custom CSS values', () => {
    expect(effectiveFolderColor({ Dev: 'green', w1: 'pink' }, 'w1', 'Dev')).toBe('pink')
    expect(effectiveFolderColor({ Dev: '#123456' }, 'w1', 'Dev')).toBe('#123456')
  })
  it('clearing own color resumes inheritance', () => {
    const manual = setItemColor({ categories: ['Dev'], assignments: { w1: 'Dev' }, colors: { Dev: 'green', w1: 'pink' } }, 'w1', null)
    expect(effectiveFolderColor(manual.colors, 'w1', 'Dev')).toBe('green')
    expect(manual.colors).not.toHaveProperty('w1')
  })
  it('treats null as no override and leaves top-level neutral without own color', () => {
    expect(effectiveFolderColor({ Dev: 'green', w1: null }, 'w1', 'Dev')).toBe('green')
    expect(effectiveFolderColor({ Dev: 'green' }, 'w1')).toBeUndefined()
    expect(effectiveFolderColor({ w1: 'blue' }, 'w1')).toBe('blue')
    expect(effectiveFolderColor(undefined, 'w1', 'Dev')).toBeUndefined()
  })
})
