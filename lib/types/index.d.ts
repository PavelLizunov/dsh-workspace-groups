import type { GroupsContext } from './context-types.js';
/** Plugin identity for cordis.yml rows. */
export declare const name = "dsh-workspace-groups";
/** Routes mount only while native request authentication and the webserver are available. */
export declare const inject: string[];
/** Plugin body: mount the config snapshot route and persistence routes. */
export declare function apply(ctx: GroupsContext): void;
