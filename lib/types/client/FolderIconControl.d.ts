import type { ReactNode } from 'react';
/** Decorative row icon: tapping it expands the row; editing belongs to the row menu. */
export declare function FolderIconControl({ kind, color, children }: {
    kind: 'group' | 'project';
    color?: string | null | undefined;
    children: ReactNode;
}): import("react").JSX.Element;
