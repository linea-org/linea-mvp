import { createDb, type DrizzleDB } from '@linea/db';
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DB_TOKEN = Symbol('DRIZZLE_DB');

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDB => {
        return createDb(config.getOrThrow<string>('DATABASE_URL'));
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DatabaseModule {}
