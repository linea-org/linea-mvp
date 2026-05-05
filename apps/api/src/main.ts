import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('v1', {
    exclude: ['/health', '/webhooks/clerk', '/docs'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Linea API')
      .setDescription('AI workflow orchestration platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'x-api-key' },
        'x-api-key',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  app.get(Logger).log(`API running on http://localhost:${port}`);
}

bootstrap();
