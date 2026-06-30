import { DrizzleDB } from "@linea/db";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConnectionsService } from "../connections/connections.service";
import { DB_TOKEN } from "../database/database.module";



@Injectable()
export class AIService {
    constructor(
        @Inject(DB_TOKEN) private readonly db: DrizzleDB,
        private readonly config: ConfigService,
        private readonly connectionsService: ConnectionsService,
    ) { }
}