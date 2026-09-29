import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { type SessionTitleLlmConfig } from '@deepseek-ai/dsh-session-title-llm';
export declare const name = "dsh-periodic-session-titles";
export declare const inject: string[];
export interface Config extends SessionTitleLlmConfig {
    everyMessages: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    everyMessages: Schema<number, number, "defined">;
    targetWords: Schema<number, number, "defined">;
    targetCjkCharacters: Schema<number, number, "defined">;
    maxInputBytes: Schema<number, number, "defined">;
    maxOutputTokens: Schema<number, number, "defined">;
    timeoutMs: Schema<number, number, "defined">;
    provider: Schema<string, string, "plain">;
    model: Schema<string, string, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    everyMessages: Schema<number, number, "defined">;
    targetWords: Schema<number, number, "defined">;
    targetCjkCharacters: Schema<number, number, "defined">;
    maxInputBytes: Schema<number, number, "defined">;
    maxOutputTokens: Schema<number, number, "defined">;
    timeoutMs: Schema<number, number, "defined">;
    provider: Schema<string, string, "plain">;
    model: Schema<string, string, "plain">;
}>>, "plain">;
/** Separate provider so loading the sidebar never replaces the configured title strategy. */
export declare function apply(ctx: Context, config: Config): void;
