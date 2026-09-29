import { type FolderIconId } from '../core/icons.js';
import type { T } from './row-utils.js';
export declare function FolderIconPicker({ open, label, icon, busy, error, onSelect, onClose, t }: {
    open: boolean;
    label: string;
    icon?: FolderIconId | undefined;
    busy: boolean;
    error: string | null;
    onSelect: (icon: FolderIconId | null) => void;
    onClose: () => void;
    t: T;
}): import("react").JSX.Element;
