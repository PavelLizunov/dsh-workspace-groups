/** Stable IDs for the bundled Tabler Outline subset; never interpret user input as SVG. */
export declare const FOLDER_ICON_IDS: readonly ["code", "terminal", "server", "database", "cloud", "world", "shield", "tools", "book", "file-text", "notes", "flask", "palette", "photo", "music", "video", "home", "briefcase", "users", "rocket", "bulb", "star", "heart", "archive", "deepseek", "cat", "dog", "fish", "butterfly", "horse", "paw", "microphone", "wave-sine", "brain", "cpu", "network", "puzzle", "chart-line", "git-branch"];
export type FolderIconId = typeof FOLDER_ICON_IDS[number];
export type FolderIconScope = 'group' | 'workspace';
export declare const FOLDER_ICON_GROUPS: readonly [{
    readonly id: "technology";
    readonly icons: readonly ["deepseek", "brain", "cpu", "server", "database", "network", "cloud", "shield", "world"];
}, {
    readonly id: "voice";
    readonly icons: readonly ["microphone", "wave-sine", "music", "video"];
}, {
    readonly id: "development";
    readonly icons: readonly ["code", "terminal", "puzzle", "git-branch", "tools", "chart-line", "flask"];
}, {
    readonly id: "documents";
    readonly icons: readonly ["book", "file-text", "notes", "archive", "users"];
}, {
    readonly id: "animals";
    readonly icons: readonly ["cat", "dog", "fish", "butterfly", "horse", "paw"];
}, {
    readonly id: "additional";
    readonly icons: readonly ["palette", "photo", "home", "briefcase", "rocket", "bulb", "star", "heart"];
}];
export type FolderIconGroupId = typeof FOLDER_ICON_GROUPS[number]['id'];
export declare function isFolderIconId(value: unknown): value is FolderIconId;
