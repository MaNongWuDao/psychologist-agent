import {
  CounselingPhase,
  MessageRole,
  RiskLevel,
  SessionDetail,
  SessionSummary,
  StoredMessage,
} from '../domain/types';

export const SESSION_STORE = Symbol('SESSION_STORE');

export const DEFAULT_SESSION_TITLE = '新的对话';

export interface AppendMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
  riskLevel: RiskLevel;
  phase: CounselingPhase;
}

export interface SessionStore {
  listSessions(): Promise<SessionSummary[]>;
  createSession(title?: string): Promise<SessionSummary>;
  getSession(id: string): Promise<SessionDetail | null>;
  deleteSession(id: string): Promise<boolean>;
  ensureSession(id: string, title?: string): Promise<SessionSummary>;
  appendMessage(input: AppendMessageInput): Promise<StoredMessage>;
}

/** 用第一条用户消息生成会话标题，方便侧边栏识别。 */
export function deriveTitle(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return DEFAULT_SESSION_TITLE;
  }
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}
