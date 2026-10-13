import { CounselingPhase } from './types';

/**
 * 咨询阶段由对话轮次推导，不额外消耗模型调用，
 * 也让“阶段”成为可预测、可测试的行为。
 */
export function resolvePhase(turn: number): CounselingPhase {
  if (turn <= 1) {
    return 'intake';
  }
  if (turn <= 3) {
    return 'exploration';
  }
  if (turn <= 8) {
    return 'intervention';
  }
  return 'closure';
}
