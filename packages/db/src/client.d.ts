import postgres from "postgres";
import * as schema from "./schema/index";
export type DrizzleDB = ReturnType<typeof createDb>;
export declare function createDb(connectionString: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
