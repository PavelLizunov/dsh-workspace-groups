// Adapt the existing mobile gesture-guarded observer, not a second click handler.
export function patchGroupedNavigation(source) {
  const edits = [
    ["[class*=\"sessionRow\"] button", ".wgSessionRow button, [class*=\"sessionRow\"] button"],
    ["[class*=\"newSession\"], [class*=\"sessionRow\"],", "[class*=\"newSession\"], .wgSessionRow, [class*=\"sessionRow\"],"],
    ["const title = selected?.querySelector('[class*=\"_title\"]');", "const sessionId = selected?.getAttribute('data-session-id');\n            if (sessionId) return sessionId;\n            const title = selected?.querySelector('.wgSessionTitle, [class*=\"_title\"]');"],
  ]
  let result = source
  for (const [before, after] of edits) {
    if (!result.includes(before)) throw new Error(`Mobile navigation contract changed: ${before}`)
    result = result.replaceAll(before, after)
  }
  return result
}
