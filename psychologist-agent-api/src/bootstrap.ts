import type { INestApplication } from '@nestjs/common';
import { APP_ENV, type AppEnv } from './config/app-env';

/**
 * 统一的 HTTP 层配置，main.ts 与 e2e 测试共用，避免两边行为漂移。
 */
export function configureApp(app: INestApplication): AppEnv {
  const env = app.get<AppEnv>(APP_ENV);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin:
      env.corsOrigin === '*'
        ? true
        : env.corsOrigin.split(',').map((item) => item.trim()),
  });
  app.enableShutdownHooks();

  return env;
}
