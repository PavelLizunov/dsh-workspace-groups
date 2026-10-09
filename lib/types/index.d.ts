import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import type { GroupsContext } from './context-types.js';
import { type SidebarFilterPreferences } from './core/types.js';
/** Plugin identity for cordis.yml rows. */
export declare const name = "dsh-workspace-groups";
/** Routes mount only while native request authentication and the webserver are available. */
export declare const inject: string[];
/** Profile-backed live filter configuration, using the DSH 0.2 settings contract. */
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    filter: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
        status: Schema<string, string, "defined">;
        recency: Schema<string, string, "defined">;
        color: Schema<"red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        status: Schema<string, string, "defined">;
        recency: Schema<string, string, "defined">;
        color: Schema<"red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "defined">;
    }>>>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    filter: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
        status: Schema<string, string, "defined">;
        recency: Schema<string, string, "defined">;
        color: Schema<"red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        status: Schema<string, string, "defined">;
        recency: Schema<string, string, "defined">;
        color: Schema<"red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | null, "defined">;
    }>>>, "volatile-defined">;
}>>, "plain">;
export interface Config {
    filter: Volatile<SidebarFilterPreferences>;
}
/** Plugin body: mount the config snapshot route and persistence routes. */
export declare function apply(ctx: GroupsContext, config: Config): void;
