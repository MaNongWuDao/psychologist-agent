import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV, type AppEnv } from './config/app-env';
import { PG_POOL, PostgresConnection } from './database/postgres.module';

export interface ServiceInfo {
  name: string;
  status: 'ok';
  llmProvider: string;
  model: string;
  persistence: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(PG_POOL) private readonly connection: PostgresConnection,
  ) {}

  getServiceInfo(): ServiceInfo {
    return {
      name: 'psychologist-agent-api',
      status: 'ok',
      llmProvider: this.env.llm.provider,
      model: this.env.llm.model,
      persistence: this.connection.pool ? 'postgres' : 'memory',
      timestamp: new Date().toISOString(),
    };
  }
}
