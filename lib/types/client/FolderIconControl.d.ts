import type { ReactNode } from 'react';
/** Direct icon choice uses the same dialog as the row menu, without toggling its tree branch. */
export declare function FolderIconControl({ kind, color, label, onChoose, children }: {
    kind: 'group' | 'project';
    color?: string | null | undefined;
    label: string;
    onChoose?: (() => void) | undefined;
    children: ReactNode;
}): import("react").JSX.Element;
