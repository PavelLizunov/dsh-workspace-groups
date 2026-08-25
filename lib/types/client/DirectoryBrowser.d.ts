import type { DirectoryListing } from '@deepseek-ai/dsh-client-runtime/client';
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
export declare function DirectoryBrowser({ open, busy, listDirectory, createDirectory, onPick, onClose, strings }: DirectoryBrowserProps): import("react").JSX.Element;
