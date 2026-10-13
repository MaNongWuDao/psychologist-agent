import { Global, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_ENV, type AppEnv } from '../config/app-env';
import { AppConfigModule } from '../config/app-config.module';

export const PG_POOL = Symbol('PG_POOL');

const SCHEMA_SQL = `
create table if not exists counselor_session (
  id text primary key,
  title text not null,
  risk_level text not null default 'none',
  phase text not null default 'intake',
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists counselor_message (
  id bigserial primary key,
  session_id text not null references counselor_session(id) on delete cascade,
  role text not null,
  content text not null,
  risk_level text not null default 'none',
  phase text not null default 'intake',
  created_at timestamptz not null default now()
);

create index if not exists counselor_message_session_idx
  on counselor_message (session_id, id);
`;

/**
 * 持有连接池并负责在应用关闭时释放。
 * `pool` 为 null 表示当前运行在内存降级模式。
 */
export class PostgresConnection implements OnModuleDestroy {
  constructor(readonly pool: Pool | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}

/**
 * 提供可选的 PostgreSQL 连接池。
 * `PERSISTENCE=auto`（默认）下连接失败会降级为内存存储，保证本地无数据库也能启动。
 */
@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_ENV],
      useFactory: async (env: AppEnv): Promise<PostgresConnection> => {
        const logger = new Logger('Postgres');

        if (!env.databaseUrl) {
          if (env.persistence === 'postgres') {
            throw new Error('PERSISTENCE=postgres 需要配置 DATABASE_URL');
          }
          logger.warn(
            '未配置 DATABASE_URL，会话数据将保存在内存中（重启后丢失）。',
          );
          return new PostgresConnection(null);
        }

        const pool = new Pool({ connectionString: env.databaseUrl, max: 10 });
        try {
          await pool.query('select 1');
          await pool.query(SCHEMA_SQL);
          logger.log('PostgreSQL 已连接，会话表已就绪。');
          return new PostgresConnection(pool);
        } catch (error) {
          await pool.end().catch(() => undefined);
          if (env.persistence === 'postgres') {
            throw error;
          }
          logger.warn(
            `PostgreSQL 连接失败，已降级为内存存储：${(error as Error).message}`,
          );
          return new PostgresConnection(null);
        }
      },
    },
  ],
  exports: [PG_POOL],
})
export class PostgresModule {}
