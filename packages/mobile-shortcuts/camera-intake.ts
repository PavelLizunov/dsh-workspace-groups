/** Keep validation, upload and draft ownership with the resident DSH composer. */
export function openCamera(input: HTMLInputElement | null): boolean {
  if (!input || input.disabled) return false
  const names = ['accept', 'capture', 'multiple'] as const
  const previous = names.map(name => input.getAttribute(name))
  input.setAttribute('accept', 'image/*')
  input.setAttribute('capture', 'environment')
  input.removeAttribute('multiple')
  try {
    // Must run synchronously inside the user's tap. Never submit the draft.
    input.click()
    return true
  } finally {
    names.forEach((name, index) => {
      const value = previous[index]
      if (value === null || value === undefined) input.removeAttribute(name)
      else input.setAttribute(name, value)
    })
  }
}

export function findComposerInput(doc: Document): HTMLInputElement | null {
  return doc.querySelector<HTMLInputElement>('[data-composer-card] input[type="file"]')
}
