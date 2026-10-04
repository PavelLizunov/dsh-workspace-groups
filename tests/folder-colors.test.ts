import { describe, expect, it } from 'vitest'
import { setItemColor } from '../src/client/overlay-core.ts'

describe('independent folder color metadata', () => {
  it('changes a workspace without touching its group or sibling', () => {
    const before = { categories: ['Dev'], assignments: { w1: 'Dev', w2: 'Dev' }, colors: { Dev: 'green', w1: 'pink', w2: 'blue' } }
    expect(setItemColor(before, 'w1', 'red').colors).toEqual({ Dev: 'green', w1: 'red', w2: 'blue' })
    expect(before.colors.w1).toBe('pink')
  })
  it('clearing a workspace color does not copy its parent color', () => {
    const result = setItemColor({ categories: ['Dev'], assignments: { w1: 'Dev' }, colors: { Dev: 'green', w1: 'pink' } }, 'w1', null)
    expect(result.colors).toEqual({ Dev: 'green' })
    expect(result.colors).not.toHaveProperty('w1')
  })
  it('changing the group does not rewrite workspace colors', () => {
    expect(setItemColor({ categories: ['Dev'], assignments: { w1: 'Dev' }, colors: { Dev: 'green', w1: 'pink' } }, 'Dev', 'blue').colors).toEqual({ Dev: 'blue', w1: 'pink' })
  })
})
