import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { SessionTitleSnapshot, SessionTitleUserMessage } from '@deepseek-ai/dsh-session-title';
export declare function isSubstantive(text: string): boolean;
export declare function humanMessages(events: readonly SessionEvent[]): SessionTitleUserMessage[];
/** Match the native helper's framing, retaining exact messages and source seqs. */
export declare function titleInputBytes(messages: readonly SessionTitleUserMessage[]): number;
/** Recent whole messages first; include the original topic if there is room. */
export declare function selectTitleMessages(messages: readonly SessionTitleUserMessage[], maxBytes: number): SessionTitleUserMessage[];
export declare function titleDue(messages: readonly SessionTitleUserMessage[], title: SessionTitleSnapshot | undefined, every: number): boolean;
