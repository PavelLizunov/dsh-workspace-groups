import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Navigation is owned by uiWorkspace; mainView retention identifies its selection. */
export declare function mainSessionId(list: SessionListState): SessionId | undefined;
