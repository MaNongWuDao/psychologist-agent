import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = configureApp(app);

  await app.listen(env.port);
  Logger.log(`接口地址 http://localhost:${env.port}/api`, 'Bootstrap');
}
void bootstrap();
