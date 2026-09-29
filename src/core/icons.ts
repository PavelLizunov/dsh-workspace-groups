/** Stable IDs for the bundled Tabler Outline subset; never interpret user input as SVG. */
export const FOLDER_ICON_IDS = [
  'code', 'terminal', 'server', 'database', 'cloud', 'world', 'shield', 'tools',
  'book', 'file-text', 'notes', 'flask', 'palette', 'photo', 'music', 'video',
  'home', 'briefcase', 'users', 'rocket', 'bulb', 'star', 'heart', 'archive',
] as const
export type FolderIconId = typeof FOLDER_ICON_IDS[number]
export type FolderIconScope = 'group' | 'workspace'
export function isFolderIconId(value: unknown): value is FolderIconId {
  return typeof value === 'string' && (FOLDER_ICON_IDS as readonly string[]).includes(value)
}
