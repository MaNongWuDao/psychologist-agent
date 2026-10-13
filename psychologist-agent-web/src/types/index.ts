export type RiskLevel = "none" | "low" | "medium" | "high";

export type CounselingPhase =
  | "intake"
  | "exploration"
  | "intervention"
  | "closure"
  | "crisis";

export type MessageRole = "user" | "assistant";

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

export interface RuntimeInfo {
  persistence: "postgres" | "memory";
  llmProvider: "openai" | "dashscope" | "demo";
  model: string;
}

export type StreamEvent =
  | {
      type: "meta";
      sessionId: string;
      riskLevel: RiskLevel;
      phase: CounselingPhase;
    }
  | { type: "token"; content: string }
  | {
      type: "done";
      sessionId: string;
      riskLevel: RiskLevel;
      phase: CounselingPhase;
      crisis: boolean;
    }
  | { type: "error"; message: string };

/** 用于渲染的会话内消息。 */
export interface ChatMessage {
  id: string;
  from: MessageRole;
  content: string;
  riskLevel: RiskLevel;
  phase: CounselingPhase;
  streaming: boolean;
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  none: "常规",
  low: "轻度关注",
  medium: "中度关注",
  high: "高风险",
};

export const PHASE_LABEL: Record<CounselingPhase, string> = {
  intake: "接洽",
  exploration: "探索",
  intervention: "工作",
  closure: "收束",
  crisis: "危机干预",
};

export const CRISIS_HOTLINES = [
  { name: "全国心理援助热线", phone: "12356" },
  { name: "深圳心理危机研究与干预中心", phone: "0755-25629459" },
  { name: "紧急救助", phone: "120 / 110" },
];
