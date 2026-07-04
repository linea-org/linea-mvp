import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Database } from '@linea/db';

@Global()
@Module({
  providers: [
    {
      provide: Database,
      useFactory: (config: ConfigService) =>
        new Database({
          connectionURL: config.getOrThrow('DATABASE_URL'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [Database],
})
export class DatabaseModule {}
