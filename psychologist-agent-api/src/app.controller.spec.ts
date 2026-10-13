import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_ENV, type AppEnv } from './config/app-env';
import { PG_POOL, PostgresConnection } from './database/postgres.module';

const testEnv: AppEnv = {
  port: 3000,
  corsOrigin: '*',
  llm: {
    provider: 'demo',
    model: 'demo-counselor',
    temperature: 0.6,
  },
  databaseUrl: undefined,
  persistence: 'memory',
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: APP_ENV, useValue: testEnv },
        { provide: PG_POOL, useValue: new PostgresConnection(null) },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('返回服务元信息', () => {
      const info = appController.getServiceInfo();

      expect(info.name).toBe('psychologist-agent-api');
      expect(info.status).toBe('ok');
      expect(info.llmProvider).toBe('demo');
      expect(info.persistence).toBe('memory');
    });
  });
});
