"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDb = exports.Database = void 0;
const client_1 = require("./client");
const ConnectionRepository_1 = require("./repositories/ConnectionRepository");
class Database {
    connection;
    constructor(config) {
        const db = (0, client_1.createDb)(config.connectionURL);
        this.connection = new ConnectionRepository_1.ConnectionRepository(db);
    }
}
exports.Database = Database;
var client_2 = require("./client");
Object.defineProperty(exports, "createDb", { enumerable: true, get: function () { return client_2.createDb; } });
__exportStar(require("./schema/index"), exports);
__exportStar(require("./repositories/index"), exports);
//# sourceMappingURL=index.js.map