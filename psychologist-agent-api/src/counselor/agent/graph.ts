import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import { isCrisis } from '../risk/risk-detector';
import {
  createCounselorNode,
  crisisResponseNode,
  safetyScreenNode,
} from './nodes';
import { CounselorState, type CounselorStateType } from './state';

export interface CounselorGraphDeps {
  model: BaseChatModel;
  checkpointer?: BaseCheckpointSaver;
}

export type CounselorRoute = 'crisis' | 'counselor';

export function routeAfterScreening(state: CounselorStateType): CounselorRoute {
  return isCrisis(state.riskLevel) ? 'crisis' : 'counselor';
}

/**
 * 心理咨询师智能体主图。
 *
 * START -> safetyScreen -> (高风险) crisisResponse -> END
 *                       -> (常规)   counselor     -> END
 */
export function buildCounselorGraph({
  model,
  checkpointer,
}: CounselorGraphDeps) {
  const workflow = new StateGraph(CounselorState)
    .addNode('safetyScreen', safetyScreenNode)
    .addNode('crisisResponse', crisisResponseNode)
    .addNode('counselor', createCounselorNode(model))
    .addEdge(START, 'safetyScreen')
    .addConditionalEdges('safetyScreen', routeAfterScreening, {
      crisis: 'crisisResponse',
      counselor: 'counselor',
    })
    .addEdge('crisisResponse', END)
    .addEdge('counselor', END);

  return workflow.compile({ checkpointer });
}

export type CounselorGraph = ReturnType<typeof buildCounselorGraph>;
