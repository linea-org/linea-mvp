import { ConnectionRepository } from "./repositories/ConnectionRepository";
interface DatabaseConfig {
    connectionURL: string;
}
export declare class Database {
    readonly connection: ConnectionRepository;
    constructor(config: DatabaseConfig);
}
export { createDb } from "./client";
export type { DrizzleDB } from "./client";
export * from "./schema/index";
export * from "./repositories/index";
