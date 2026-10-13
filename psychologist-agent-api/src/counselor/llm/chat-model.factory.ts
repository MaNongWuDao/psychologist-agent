import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AppEnv } from '../../config/app-env';
import { DemoCounselorModel } from './demo-counselor.model';

export const COUNSELOR_MODEL = Symbol('COUNSELOR_MODEL');

/**
 * 统一的模型装配入口。
 * LangChain v1 使用 `model` 字段（旧的 `modelName` 已废弃）。
 * OpenAI 与 DashScope（百炼兼容模式）都走 ChatOpenAI，差别只在 Key 与 baseURL。
 */
export function createCounselorModel(env: AppEnv): BaseChatModel {
  const logger = new Logger('CounselorModel');
  const { provider, apiKey, baseUrl, model, temperature } = env.llm;

  if (provider === 'demo') {
    logger.log('使用本地演示模型（未配置模型 API Key）');
    return new DemoCounselorModel();
  }

  logger.log(
    `使用模型 ${provider}/${model}，网关 ${baseUrl ?? 'OpenAI 官方端点'}`,
  );

  return new ChatOpenAI({
    model,
    temperature,
    apiKey,
    configuration: baseUrl ? { baseURL: baseUrl } : undefined,
  });
}
