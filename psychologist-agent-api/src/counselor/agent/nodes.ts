import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { resolvePhase } from '../domain/phase';
import { assessRisk } from '../risk/risk-detector';
import { buildCounselorSystemPrompt, CRISIS_RESPONSE } from './prompts';
import type { CounselorStateType, CounselorStateUpdate } from './state';

export function countUserTurns(messages: BaseMessage[]): number {
  return messages.filter((message) => message.getType() === 'human').length;
}

export function lastUserText(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() === 'human') {
      const { content } = message;
      return typeof content === 'string' ? content : JSON.stringify(content);
    }
  }
  return '';
}

/** 第一步永远是确定性筛查，模型无权跳过。 */
export function safetyScreenNode(
  state: CounselorStateType,
): CounselorStateUpdate {
  const assessment = assessRisk(lastUserText(state.messages));
  const turn = countUserTurns(state.messages);

  return {
    sessionId: state.sessionId,
    riskLevel: assessment.level,
    riskEvidence: assessment.evidence,
    phase: assessment.level === 'high' ? 'crisis' : resolvePhase(turn),
  };
}

/** 危机回复使用固定脚本，避免模型在关键时刻自由发挥。 */
export function crisisResponseNode(): CounselorStateUpdate {
  return {
    messages: [new AIMessage(CRISIS_RESPONSE)],
  };
}

export function createCounselorNode(model: BaseChatModel) {
  return async (state: CounselorStateType): Promise<CounselorStateUpdate> => {
    const systemPrompt = buildCounselorSystemPrompt({
      phase: state.phase,
      riskLevel: state.riskLevel,
      riskEvidence: state.riskEvidence,
      turn: countUserTurns(state.messages),
    });

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);

    return {
      messages: [response],
    };
  };
}
