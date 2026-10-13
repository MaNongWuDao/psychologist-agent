import { randomUUID } from 'node:crypto';
import type { Pool, QueryResultRow } from 'pg';
import { PostgresConnection } from '../../database/postgres.module';
import {
  CounselingPhase,
  MessageRole,
  RiskLevel,
  SessionDetail,
  SessionSummary,
  StoredMessage,
} from '../domain/types';
import {
  AppendMessageInput,
  DEFAULT_SESSION_TITLE,
  SessionStore,
} from './session.store';

interface SessionRow extends QueryResultRow {
  id: string;
  title: string;
  risk_level: RiskLevel;
  phase: CounselingPhase;
  message_count: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MessageRow extends QueryResultRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  risk_level: RiskLevel;
  phase: CounselingPhase;
  created_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapSession(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    riskLevel: row.risk_level,
    phase: row.phase,
    messageCount: row.message_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapMessage(row: MessageRow): StoredMessage {
  return {
    id: Number(row.id),
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    riskLevel: row.risk_level,
    phase: row.phase,
    createdAt: toIso(row.created_at),
  };
}

const SESSION_COLUMNS =
  'id, title, risk_level, phase, message_count, created_at, updated_at';

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly connection: PostgresConnection) {}

  private get pool(): Pool {
    if (!this.connection.pool) {
      throw new Error('PostgreSQL 连接不可用');
    }
    return this.connection.pool;
  }

  async listSessions(): Promise<SessionSummary[]> {
    const { rows } = await this.pool.query<SessionRow>(
      `select ${SESSION_COLUMNS} from counselor_session order by updated_at desc limit 200`,
    );
    return rows.map(mapSession);
  }

  async createSession(title?: string): Promise<SessionSummary> {
    const { rows } = await this.pool.query<SessionRow>(
      `insert into counselor_session (id, title) values ($1, $2) returning ${SESSION_COLUMNS}`,
      [randomUUID(), title?.trim() || DEFAULT_SESSION_TITLE],
    );
    return mapSession(rows[0]);
  }

  async ensureSession(id: string, title?: string): Promise<SessionSummary> {
    const { rows } = await this.pool.query<SessionRow>(
      `insert into counselor_session (id, title) values ($1, $2)
       on conflict (id) do update set updated_at = counselor_session.updated_at
       returning ${SESSION_COLUMNS}`,
      [id, title?.trim() || DEFAULT_SESSION_TITLE],
    );
    return mapSession(rows[0]);
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const sessionResult = await this.pool.query<SessionRow>(
      `select ${SESSION_COLUMNS} from counselor_session where id = $1`,
      [id],
    );
    if (sessionResult.rowCount === 0) {
      return null;
    }

    const messageResult = await this.pool.query<MessageRow>(
      `select id, session_id, role, content, risk_level, phase, created_at
         from counselor_message where session_id = $1 order by id asc`,
      [id],
    );

    return {
      ...mapSession(sessionResult.rows[0]),
      messages: messageResult.rows.map(mapMessage),
    };
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'delete from counselor_session where id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async appendMessage(input: AppendMessageInput): Promise<StoredMessage> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const inserted = await client.query<MessageRow>(
        `insert into counselor_message (session_id, role, content, risk_level, phase)
         values ($1, $2, $3, $4, $5)
         returning id, session_id, role, content, risk_level, phase, created_at`,
        [
          input.sessionId,
          input.role,
          input.content,
          input.riskLevel,
          input.phase,
        ],
      );

      await client.query(
        `update counselor_session
            set message_count = message_count + 1,
                updated_at = now(),
                phase = $2,
                risk_level = case
                  when array_position(array['none','low','medium','high'], $3)
                       > array_position(array['none','low','medium','high'], risk_level)
                  then $3 else risk_level end,
                title = case
                  when message_count = 0 and $4 = 'user' and title = $5
                  then left($6, 24) else title end
          where id = $1`,
        [
          input.sessionId,
          input.phase,
          input.riskLevel,
          input.role,
          DEFAULT_SESSION_TITLE,
          input.content.replace(/\s+/g, ' ').trim(),
        ],
      );

      await client.query('commit');
      return mapMessage(inserted.rows[0]);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
