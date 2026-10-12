import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Fill listing omissions once per sidebar lifetime; native summaries remain untouched. */
export declare function useActivityList(list: SessionListState, archivedIds: readonly SessionId[]): {
    list: SessionListState;
    loading: boolean;
    unavailable: boolean;
};
