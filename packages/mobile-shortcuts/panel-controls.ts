export function openPanel(doc: Document): boolean {
  const control = doc.querySelector<HTMLButtonElement>('[data-sidebar-right-expand]')
    ?? doc.querySelector<HTMLButtonElement>('[data-dsh-toggle-cluster] button')
    ?? doc.querySelector<HTMLButtonElement>('[data-sidebar-right-toggle]')
  if (!control) return false
  control.click()
  return true
}

export function activeRightPanel(doc: Document): HTMLElement | null {
  return [...doc.querySelectorAll<HTMLElement>('[data-sidebar-right-open]')].find(panel =>
    !panel.closest('[hidden], [aria-hidden="true"]') && panel.getBoundingClientRect().width > 0,
  ) ?? null
}

export function closePanel(doc: Document): boolean {
  const control = activeRightPanel(doc)?.querySelector<HTMLButtonElement>('[data-sidebar-right-toggle]')
  if (!control) return false
  control.click()
  return true
}

export function blurComposer(doc: Document): void {
  const active = doc.activeElement
  if (active instanceof HTMLElement && active.closest('[data-composer-card]')) active.blur()
}
