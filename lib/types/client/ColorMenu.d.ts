import { type T } from './row-utils.js';
export interface ColorMenuProps {
    t: T;
    color?: string | null | undefined;
    onSelect: (color: string | null) => void;
}
/** Flat portal menu: unlike nested submenus, Menu clamps this list to the viewport. */
export declare function ColorMenu({ t, color, onSelect }: ColorMenuProps): import("react").JSX.Element;
