import { Database } from '@linea/db';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Database,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Database({
          connectionURL: config.getOrThrow('DATABASE_URL'),
        });
      },
    },
  ],
  exports: [Database],
})
export class DatabaseModule {}
