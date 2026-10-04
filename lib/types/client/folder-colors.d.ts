/** Own workspace color wins; clearing it resumes live parent-group inheritance. */
export declare function effectiveFolderColor(colors: Readonly<Record<string, string | null>> | undefined, workspaceId: string, groupKey?: string): string | undefined;
