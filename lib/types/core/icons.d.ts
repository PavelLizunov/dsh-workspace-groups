/** Stable IDs for the bundled Tabler Outline subset; never interpret user input as SVG. */
export declare const FOLDER_ICON_IDS: readonly ["code", "terminal", "server", "database", "cloud", "world", "shield", "tools", "book", "file-text", "notes", "flask", "palette", "photo", "music", "video", "home", "briefcase", "users", "rocket", "bulb", "star", "heart", "archive", "deepseek", "cat", "dog", "fish", "butterfly", "horse", "paw"];
export type FolderIconId = typeof FOLDER_ICON_IDS[number];
export type FolderIconScope = 'group' | 'workspace';
export declare function isFolderIconId(value: unknown): value is FolderIconId;
