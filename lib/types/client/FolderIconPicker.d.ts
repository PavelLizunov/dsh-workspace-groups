import { type FolderIconId } from '../core/icons.js';
import { type T } from './row-utils.js';
export declare function FolderIconPicker({ open, label, icon, color, busy, error, onSelect, onClose, t }: {
    open: boolean;
    label: string;
    icon?: FolderIconId | undefined;
    color?: string | null | undefined;
    busy: boolean;
    error: string | null;
    onSelect: (icon: FolderIconId | null, color: string | null) => void;
    onClose: () => void;
    t: T;
}): import("react").JSX.Element;
