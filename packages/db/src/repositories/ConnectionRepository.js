"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class ConnectionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const [record] = await this.db
            .select()
            .from(schema_1.providerConnections)
            .where((0, drizzle_orm_1.eq)(schema_1.providerConnections.id, id))
            .limit(1);
        if (!record)
            return null;
        return record;
    }
    async findByProvider(workspaceId, provider) {
        const [record] = await this.db
            .select()
            .from(schema_1.providerConnections)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.providerConnections.workspaceId, workspaceId), (0, drizzle_orm_1.eq)(schema_1.providerConnections.provider, provider)))
            .limit(1);
        if (!record)
            return null;
        return record;
    }
    async create(payload) {
        const [record] = await this.db
            .insert(schema_1.providerConnections)
            .values(payload)
            .returning();
        if (!record)
            return null;
        return record;
    }
    async delete(connectId) {
        const [row] = await this.db
            .select({ id: schema_1.providerConnections.id })
            .from(schema_1.providerConnections)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.providerConnections.id, connectId)))
            .limit(1);
        if (!row)
            throw new Error(`Provider Connect ${connectId} not found`);
        await this.db
            .delete(schema_1.providerConnections)
            .where((0, drizzle_orm_1.eq)(schema_1.providerConnections.id, connectId));
    }
    async findAll(workspaceId) {
        return this.db
            .select()
            .from(schema_1.providerConnections)
            .where((0, drizzle_orm_1.eq)(schema_1.providerConnections.workspaceId, workspaceId));
    }
}
exports.ConnectionRepository = ConnectionRepository;
//# sourceMappingURL=ConnectionRepository.js.map