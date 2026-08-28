import { type ManualGroups } from './core/types.js';
/** Default overlay location: `$DSH_HOME/workspace-groups.manual.json`. */
export declare function defaultManualPath(): string;
/**
 * Parse + shape-validate a raw overlay document into a ManualGroups.
 * Validates types only — category references are checked against the rule set
 * at the write boundary (validateManualGroups), because reads must tolerate
 * files written while the rule set was different.
 * @param raw - parsed JSON value.
 * @returns the normalized overlay.
 * @throws when the shape is malformed (non-mapping, bad names, duplicates,
 * the reserved uncategorized label, bad assignment/order values).
 */
export declare function parseManualGroups(raw: unknown): ManualGroups;
/**
 * Cross-validate a parsed overlay against the current rule categories
 * (write boundary only). Every assignment value must be `null`, a rule
 * display name, a manual category name, or the uncategorized label; order
 * keys must reference existing categories; renames/hides must reference
 * actual rule categories.
 * @param manual - parsed overlay.
 * @param ruleCategoryNames - current YAML rule category original names.
 * @throws when the overlay references categories that do not exist.
 */
export declare function validateManualGroups(manual: ManualGroups, ruleCategoryNames: readonly string[]): void;
/** Read + parse the overlay file. A missing file yields an empty overlay. */
export declare function readManualGroups(path: string): Promise<ManualGroups>;
/**
 * Atomically replace the overlay file: write a same-directory temp file,
 * fsync it, then rename over the target. A crash never leaves a torn JSON at
 * the real path (readers see either the old or the new file).
 * @param path - target file path.
 * @param manual - overlay to persist.
 */
export declare function writeManualGroups(path: string, manual: ManualGroups): Promise<void>;
/**
 * Compute a stable SHA-256 hash revision over canonical JSON representation of a ManualGroups overlay.
 */
export declare function manualRevision(manual: ManualGroups): string;
export interface ManualEnvelope {
    manual: ManualGroups;
    revision: string;
}
/** Read overlay envelope containing parsed ManualGroups and its stable revision. Missing file uses empty overlay revision. */
export declare function readManualEnvelope(path: string): Promise<ManualEnvelope>;
export type WriteManualResult = {
    ok: true;
    conflict: false;
    revision: string;
} | {
    ok: false;
    conflict: true;
    currentRevision: string;
    manual: ManualGroups;
};
/**
 * Write overlay if expectedRevision matches current envelope revision immediately before write.
 * On conflict, returns { ok: false, conflict: true, currentRevision, manual } preserving file.
 * On success, writes atomically and returns { ok: true, conflict: false, revision: newRevision }.
 */
export declare function writeManualGroupsIfRevision(path: string, manual: ManualGroups, expectedRevision: string): Promise<WriteManualResult>;
