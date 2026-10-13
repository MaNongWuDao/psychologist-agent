import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { CounselingPhase, RiskLevel } from '../domain/types';

const replace = <T>(_previous: T, next: T): T => next;

export const CounselorState = Annotation.Root({
  ...MessagesAnnotation.spec,
  sessionId: Annotation<string>({
    reducer: replace,
    default: () => '',
  }),
  riskLevel: Annotation<RiskLevel>({
    reducer: replace,
    default: () => 'none',
  }),
  riskEvidence: Annotation<string[]>({
    reducer: replace,
    default: () => [],
  }),
  phase: Annotation<CounselingPhase>({
    reducer: replace,
    default: () => 'intake',
  }),
});

export type CounselorStateType = typeof CounselorState.State;

export type CounselorStateUpdate = typeof CounselorState.Update;
