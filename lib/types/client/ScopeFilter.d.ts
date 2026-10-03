export interface ScopeOption {
    id: string;
    label: string;
    icon?: string | undefined;
    color?: string | null | undefined;
}
/** Reuse the host's portal menu for SVG-labelled, keyboard-accessible single selection. */
export declare function ScopeFilter({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly ScopeOption[];
    onChange: (id: string) => void;
}): import("react").JSX.Element;
