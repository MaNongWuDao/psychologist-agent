/* eslint-disable @typescript-eslint/require-await -- 内存实现没有真正的异步步骤，
   但需要与 SessionStore 的异步接口保持一致，方便与 Postgres 实现互换。 */
import { randomUUID } from 'node:crypto';
import {
  RiskLevel,
  SessionDetail,
  SessionSummary,
  StoredMessage,
} from '../domain/types';
import {
  AppendMessageInput,
  DEFAULT_SESSION_TITLE,
  deriveTitle,
  SessionStore,
} from './session.store';

interface MemorySession {
  summary: SessionSummary;
  messages: StoredMessage[];
}

const RISK_RANK: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, MemorySession>();

  private sequence = 0;

  async listSessions(): Promise<SessionSummary[]> {
    return [...this.sessions.values()]
      .map((session) => ({ ...session.summary }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createSession(title?: string): Promise<SessionSummary> {
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id: randomUUID(),
      title: title?.trim() || DEFAULT_SESSION_TITLE,
      riskLevel: 'none',
      phase: 'intake',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(summary.id, { summary, messages: [] });
    return { ...summary };
  }

  async ensureSession(id: string, title?: string): Promise<SessionSummary> {
    const existing = this.sessions.get(id);
    if (existing) {
      return { ...existing.summary };
    }
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id,
      title: title?.trim() || DEFAULT_SESSION_TITLE,
      riskLevel: 'none',
      phase: 'intake',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, { summary, messages: [] });
    return { ...summary };
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }
    return {
      ...session.summary,
      messages: session.messages.map((message) => ({ ...message })),
    };
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async appendMessage(input: AppendMessageInput): Promise<StoredMessage> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`会话不存在：${input.sessionId}`);
    }

    this.sequence += 1;
    const message: StoredMessage = {
      id: this.sequence,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      riskLevel: input.riskLevel,
      phase: input.phase,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(message);

    // 与 Postgres 实现保持一致：只有仍在使用默认标题时才用首条消息命名。
    const isFirstUserTurn =
      input.role === 'user' &&
      session.summary.messageCount === 0 &&
      session.summary.title === DEFAULT_SESSION_TITLE;
    session.summary = {
      ...session.summary,
      title: isFirstUserTurn
        ? deriveTitle(input.content)
        : session.summary.title,
      riskLevel:
        RISK_RANK[input.riskLevel] > RISK_RANK[session.summary.riskLevel]
          ? input.riskLevel
          : session.summary.riskLevel,
      phase: input.phase,
      messageCount: session.summary.messageCount + 1,
      updatedAt: message.createdAt,
    };

    return { ...message };
  }
}
