import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Logger } from '@nestjs/common';

export type LlmProvider = 'openai' | 'dashscope' | 'demo';

export type PersistenceDriver = 'auto' | 'postgres' | 'memory';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  temperature: number;
  apiKey?: string;
  /** OpenAI 兼容网关地址；OpenAI 官方端点留空即可 */
  baseUrl?: string;
}

export interface AppEnv {
  port: number;
  corsOrigin: string;
  llm: LlmConfig;
  databaseUrl?: string;
  persistence: PersistenceDriver;
}

export const APP_ENV = Symbol('APP_ENV');

const DEFAULT_DASHSCOPE_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

const DEFAULT_MODEL: Record<Exclude<LlmProvider, 'demo'>, string> = {
  openai: 'gpt-4o-mini',
  dashscope: 'qwen-plus',
};

const KEY_ENV: Record<Exclude<LlmProvider, 'demo'>, string> = {
  openai: 'OPENAI_API_KEY',
  dashscope: 'DASHSCOPE_API_KEY',
};

/** 未显式指定供应商时的探测顺序。 */
const AUTO_DETECT_ORDER: Array<Exclude<LlmProvider, 'demo'>> = [
  'dashscope',
  'openai',
];

const DEFAULT_TEMPERATURE = 0.6;

interface ProviderCredential {
  provider: Exclude<LlmProvider, 'demo'>;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature: number;
}

let envFileLoaded = false;

/**
 * 使用 Node 内置的 .env 解析，避免引入 ESM-only 的配置包。
 *
 * 语义与 dotenv 一致：**已存在的系统环境变量优先**，.env 只补齐缺失项。
 * 这样测试或 CI 里显式设置的环境变量不会被仓库里的 .env 覆盖。
 */
function loadEnvFileOnce(): void {
  if (envFileLoaded) {
    return;
  }
  envFileLoaded = true;

  for (const file of ['.env.local', '.env']) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      // 未提供该文件时忽略
      continue;
    }

    for (const [key, value] of Object.entries(parseEnv(content))) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function readString(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

function readNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readPersistence(raw: string | undefined): PersistenceDriver {
  const value = readString(raw)?.toLowerCase();
  if (value === 'postgres' || value === 'memory' || value === 'auto') {
    return value;
  }
  return 'auto';
}

function readCredential(
  provider: Exclude<LlmProvider, 'demo'>,
): ProviderCredential {
  if (provider === 'openai') {
    return {
      provider,
      apiKey: readString(process.env.OPENAI_API_KEY),
      baseUrl: readString(process.env.OPENAI_BASE_URL),
      model: readString(process.env.OPENAI_MODEL) ?? DEFAULT_MODEL.openai,
      temperature: readNumber(
        process.env.OPENAI_TEMPERATURE,
        DEFAULT_TEMPERATURE,
      ),
    };
  }

  return {
    provider,
    apiKey: readString(process.env.DASHSCOPE_API_KEY),
    baseUrl:
      readString(process.env.DASHSCOPE_BASE_URL) ?? DEFAULT_DASHSCOPE_BASE_URL,
    model: readString(process.env.DASHSCOPE_MODEL) ?? DEFAULT_MODEL.dashscope,
    temperature: readNumber(
      process.env.DASHSCOPE_TEMPERATURE,
      DEFAULT_TEMPERATURE,
    ),
  };
}

function toLlmConfig(credential: ProviderCredential): LlmConfig {
  return {
    provider: credential.provider,
    model: credential.model,
    temperature: credential.temperature,
    apiKey: credential.apiKey,
    baseUrl: credential.baseUrl,
  };
}

const DEMO_LLM: LlmConfig = {
  provider: 'demo',
  model: 'demo-counselor',
  temperature: DEFAULT_TEMPERATURE,
};

/**
 * 解析模型配置。
 *
 * - `LLM_PROVIDER=demo` 直接用本地演示模型；
 * - `LLM_PROVIDER=dashscope|openai` 时，若对应 Key 缺失会自动改用另一个已配置
 *   的供应商（并打印警告），避免「设了 provider 却读不到 Key」的静默失败；
 * - 未指定 provider 时按 DashScope → OpenAI 的顺序探测，都没有则降级为演示模型。
 */
function resolveLlm(logger: Logger): LlmConfig {
  const requested = readString(process.env.LLM_PROVIDER)?.toLowerCase();
  const credentials = AUTO_DETECT_ORDER.map(readCredential);
  const withKey = credentials.filter((item) => item.apiKey);

  if (requested === 'demo') {
    return DEMO_LLM;
  }

  const explicit =
    requested === 'openai' || requested === 'dashscope' ? requested : null;

  const chosen = explicit
    ? (withKey.find((item) => item.provider === explicit) ?? withKey[0])
    : withKey[0];

  if (!chosen) {
    logger.warn(
      `未配置 ${KEY_ENV.openai} 或 ${KEY_ENV.dashscope}，使用本地演示模型（离线可用，回复为规则生成）。`,
    );
    return DEMO_LLM;
  }

  if (explicit && chosen.provider !== explicit) {
    logger.warn(
      `LLM_PROVIDER=${explicit} 但没有配置 ${KEY_ENV[explicit]}，已自动改用 ${chosen.provider}。`,
    );
  }

  return toLlmConfig(chosen);
}

/**
 * 环境变量的唯一读取入口，便于集中校验与在测试中直接构造。
 */
export function loadAppEnv(): AppEnv {
  loadEnvFileOnce();

  return {
    port: readNumber(process.env.PORT, 3000),
    corsOrigin: readString(process.env.CORS_ORIGIN) ?? '*',
    llm: resolveLlm(new Logger('AppEnv')),
    databaseUrl: readString(process.env.DATABASE_URL),
    persistence: readPersistence(process.env.PERSISTENCE),
  };
}
