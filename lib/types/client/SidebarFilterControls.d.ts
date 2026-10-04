import { type T } from './row-utils.js';
import type { SidebarFilter } from './tree-filter.js';
/** Native Menu owns focus, dismissal and placement; only the choice layout is custom. */
export declare function SidebarFilterControls({ filter, onChange, t }: {
    filter: SidebarFilter;
    onChange: (filter: SidebarFilter) => void;
    t: T;
}): import("react").JSX.Element;
