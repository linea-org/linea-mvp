import { DrizzleDB } from "../client";
import { NewProviderConnection, ProviderConnection } from "../schema";
import { AIProviderType, IntegrationType } from "@linea/shared";
interface ConnectionRepositoryInter {
    findById(id: string): Promise<ProviderConnection | null>;
    findByProvider(workspaceId: string, provider: AIProviderType): Promise<ProviderConnection | null>;
    create(payload: NewProviderConnection): Promise<ProviderConnection | null>;
    delete(connectId: string): Promise<void>;
    findAll(workspaceId: string): Promise<ProviderConnection[]>;
}
export declare class ConnectionRepository implements ConnectionRepositoryInter {
    private readonly db;
    constructor(db: DrizzleDB);
    findById(id: string): Promise<ProviderConnection | null>;
    findByProvider(workspaceId: string, provider: AIProviderType | IntegrationType): Promise<ProviderConnection | null>;
    create(payload: NewProviderConnection): Promise<ProviderConnection | null>;
    delete(connectId: string): Promise<void>;
    findAll(workspaceId: string): Promise<ProviderConnection[]>;
}
export {};
