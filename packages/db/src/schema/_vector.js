"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vector = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.vector = (0, pg_core_1.customType)({
    dataType(config) {
        return `vector(${config?.dimensions ?? 1536})`;
    },
    toDriver(value) {
        return `[${value.join(",")}]`;
    },
    fromDriver(value) {
        return value.slice(1, -1).split(",").map(Number);
    },
});
//# sourceMappingURL=_vector.js.map