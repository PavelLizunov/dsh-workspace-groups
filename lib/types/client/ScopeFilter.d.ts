export interface ScopeOption {
    id: string;
    label: string;
    icon?: string | undefined;
    color?: string | null | undefined;
}
export declare function ScopeIcon({ option }: {
    option: ScopeOption;
}): import("react").JSX.Element;
/** Reuse the host's portal menu for SVG-labelled, keyboard-accessible single selection. */
export declare function ScopeFilter({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly ScopeOption[];
    onChange: (id: string) => void;
}): import("react").JSX.Element;
