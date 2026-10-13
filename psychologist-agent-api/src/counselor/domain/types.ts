export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type RiskCategory =
  'suicide' | 'selfHarm' | 'harmToOthers' | 'hopelessness' | 'distress';

/** 咨询阶段：接洽 -> 探索 -> 干预 -> 收束。由对话轮次确定，避免额外模型调用。 */
export type CounselingPhase =
  'intake' | 'exploration' | 'intervention' | 'closure' | 'crisis';

export type MessageRole = 'user' | 'assistant';

export interface SessionSummary {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  phase: CounselingPhase;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: number;
  sessionId: string;
  role: MessageRole;
  content: string;
  riskLevel: RiskLevel;
  phase: CounselingPhase;
  createdAt: string;
}

export interface SessionDetail extends SessionSummary {
  messages: StoredMessage[];
}

export type StreamEvent =
  | {
      type: 'meta';
      sessionId: string;
      riskLevel: RiskLevel;
      phase: CounselingPhase;
    }
  | { type: 'token'; content: string }
  | {
      type: 'done';
      sessionId: string;
      riskLevel: RiskLevel;
      phase: CounselingPhase;
      crisis: boolean;
    }
  | { type: 'error'; message: string };

export const RISK_LEVEL_ORDER: RiskLevel[] = ['none', 'low', 'medium', 'high'];

export function highestRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_LEVEL_ORDER.indexOf(a) >= RISK_LEVEL_ORDER.indexOf(b) ? a : b;
}
