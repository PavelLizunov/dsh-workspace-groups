import type { DirectoryEntry, DirectoryListing } from '@deepseek-ai/dsh-client-runtime/client';
export interface DirectoryBrowserStrings {
    title: string;
    home: string;
    newFolder: string;
    folderName: string;
    create: string;
    cancel: string;
    open: string;
    loading: string;
    retry: string;
    showHidden?: string;
    truncated?: string;
    pathPlaceholder?: string;
    go?: string;
    refresh?: string;
}
export interface DirectoryBrowserProps {
    open: boolean;
    busy: boolean;
    listDirectory: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>;
    createDirectory: (path: string, name: string) => Promise<string>;
    onPick: (path: string) => void;
    onClose: () => void;
    strings: DirectoryBrowserStrings;
}
export interface FormattedCrumb {
    path: string;
    name: string;
    isHome: boolean;
}
export declare function filterDirectoryEntries(entries: DirectoryEntry[], showHidden: boolean): DirectoryEntry[];
export declare function formatCrumbs(crumbs?: DirectoryEntry[], homePath?: string, homeLabel?: string): FormattedCrumb[];
export declare function resolveNewFolderTarget(selectedPath?: string, listingPath?: string): string | undefined;
export declare function isImeComposing(event: React.KeyboardEvent): boolean;
export declare function DirectoryBrowser({ open, busy, listDirectory, createDirectory, onPick, onClose, strings }: DirectoryBrowserProps): import("react").JSX.Element;
