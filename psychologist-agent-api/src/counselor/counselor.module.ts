import { Module } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { APP_ENV, type AppEnv } from '../config/app-env';
import { AppConfigModule } from '../config/app-config.module';
import {
  PG_POOL,
  PostgresConnection,
  PostgresModule,
} from '../database/postgres.module';
import { CounselorController } from './counselor.controller';
import { CounselorService } from './counselor.service';
import {
  COUNSELOR_MODEL,
  createCounselorModel,
} from './llm/chat-model.factory';
import {
  CHECKPOINTER,
  CounselorCheckpointer,
} from './persistence/checkpointer.service';
import { InMemorySessionStore } from './session/in-memory-session.store';
import { PostgresSessionStore } from './session/postgres-session.store';
import { SESSION_STORE, type SessionStore } from './session/session.store';

async function createCheckpointer(
  env: AppEnv,
  connection: PostgresConnection,
): Promise<CounselorCheckpointer> {
  if (connection.pool && env.databaseUrl && env.persistence !== 'memory') {
    const saver = PostgresSaver.fromConnString(env.databaseUrl);
    await saver.setup();
    return new CounselorCheckpointer('postgres', saver, saver);
  }
  return new CounselorCheckpointer('memory', new MemorySaver());
}

@Module({
  imports: [AppConfigModule, PostgresModule],
  controllers: [CounselorController],
  providers: [
    {
      provide: COUNSELOR_MODEL,
      inject: [APP_ENV],
      useFactory: (env: AppEnv): BaseChatModel => createCounselorModel(env),
    },
    {
      provide: CHECKPOINTER,
      inject: [APP_ENV, PG_POOL],
      useFactory: createCheckpointer,
    },
    {
      provide: SESSION_STORE,
      inject: [PG_POOL],
      useFactory: (connection: PostgresConnection): SessionStore =>
        connection.pool
          ? new PostgresSessionStore(connection)
          : new InMemorySessionStore(),
    },
    CounselorService,
  ],
})
export class CounselorModule {}
