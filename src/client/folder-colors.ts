/** Own workspace color wins; clearing it resumes live parent-group inheritance. */
export function effectiveFolderColor(colors: Readonly<Record<string, string | null>> | undefined, workspaceId: string, groupKey?: string): string | undefined {
  return colors?.[workspaceId] ?? (groupKey === undefined ? undefined : colors?.[groupKey] ?? undefined)
}
