import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configSchema } from './config.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => configSchema.parse(config),
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class ConfigModule {}
