// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { findComposerInput, openCamera } from '../packages/mobile-shortcuts/camera-intake.ts'

describe('mobile camera uses the existing composer intake', () => {
  it('requests the rear camera synchronously and restores all picker attributes', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,image/png'
    input.multiple = true
    const click = vi.spyOn(input,'click').mockImplementation(() => {
      expect(input.accept).toBe('image/*')
      expect(input.getAttribute('capture')).toBe('environment')
      expect(input.multiple).toBe(false)
    })
    expect(openCamera(input)).toBe(true)
    expect(click).toHaveBeenCalledTimes(1)
    expect(input.accept).toBe('.pdf,image/png')
    expect(input.hasAttribute('capture')).toBe(false)
    expect(input.multiple).toBe(true)
    expect(openCamera(input)).toBe(true)
    expect(click).toHaveBeenCalledTimes(2)
  })
  it('restores attributes even when the native picker throws', () => {
    const input = document.createElement('input'); input.type = 'file'; input.setAttribute('capture','user')
    vi.spyOn(input,'click').mockImplementation(() => {throw new Error('cancelled')})
    expect(() => openCamera(input)).toThrow('cancelled')
    expect(input.getAttribute('capture')).toBe('user')
    expect(input.hasAttribute('accept')).toBe(false)
    expect(input.multiple).toBe(false)
  })
  it('does nothing for missing or disabled intake', () => {
    expect(openCamera(null)).toBe(false)
    const input = document.createElement('input'); input.disabled = true
    const click = vi.spyOn(input,'click')
    expect(openCamera(input)).toBe(false)
    expect(click).not.toHaveBeenCalled()
  })
  it('only picks a resident composer file input', () => {
    document.body.innerHTML = '<input type="file"><div data-composer-card><input type="file" id="resident"></div>'
    expect(findComposerInput(document)?.id).toBe('resident')
    document.body.innerHTML = ''
  })
})
