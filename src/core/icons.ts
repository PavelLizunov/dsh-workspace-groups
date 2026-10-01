/** Stable IDs for the bundled Tabler Outline subset; never interpret user input as SVG. */
export const FOLDER_ICON_IDS = [
  'code', 'terminal', 'server', 'database', 'cloud', 'world', 'shield', 'tools',
  'book', 'file-text', 'notes', 'flask', 'palette', 'photo', 'music', 'video',
  'home', 'briefcase', 'users', 'rocket', 'bulb', 'star', 'heart', 'archive',
  'deepseek', 'cat', 'dog', 'fish', 'butterfly', 'horse', 'paw',
  'microphone', 'wave-sine', 'brain', 'cpu', 'network', 'puzzle', 'chart-line', 'git-branch',
] as const
export type FolderIconId = typeof FOLDER_ICON_IDS[number]
export type FolderIconScope = 'group' | 'workspace'
export const FOLDER_ICON_GROUPS = [
  { id: 'technology', icons: ['deepseek', 'brain', 'cpu', 'server', 'database', 'network', 'cloud', 'shield', 'world'] },
  { id: 'voice', icons: ['microphone', 'wave-sine', 'music', 'video'] },
  { id: 'development', icons: ['code', 'terminal', 'puzzle', 'git-branch', 'tools', 'chart-line', 'flask'] },
  { id: 'documents', icons: ['book', 'file-text', 'notes', 'archive', 'users'] },
  { id: 'animals', icons: ['cat', 'dog', 'fish', 'butterfly', 'horse', 'paw'] },
  { id: 'additional', icons: ['palette', 'photo', 'home', 'briefcase', 'rocket', 'bulb', 'star', 'heart'] },
] as const satisfies readonly { id: string; icons: readonly FolderIconId[] }[]
export type FolderIconGroupId = typeof FOLDER_ICON_GROUPS[number]['id']
export function isFolderIconId(value: unknown): value is FolderIconId {
  return typeof value === 'string' && (FOLDER_ICON_IDS as readonly string[]).includes(value)
}
