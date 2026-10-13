import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, type BaseMessageChunk } from '@langchain/core/messages';
import { APP_ENV, type AppEnv } from '../config/app-env';
import { PG_POOL, PostgresConnection } from '../database/postgres.module';
import { buildCounselorGraph } from './agent/graph';
import type { CounselorGraph } from './agent/graph';
import type { CounselorStateType } from './agent/state';
import { COUNSELOR_MODEL } from './llm/chat-model.factory';
import {
  CHECKPOINTER,
  CounselorCheckpointer,
} from './persistence/checkpointer.service';
import { assessRisk } from './risk/risk-detector';
import { SESSION_STORE, type SessionStore } from './session/session.store';
import type { ChatRequest } from './dto/counselor.dto';
import {
  CounselingPhase,
  RiskLevel,
  SessionDetail,
  SessionSummary,
  StreamEvent,
} from './domain/types';

function chunkText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

@Injectable()
export class CounselorService {
  private readonly logger = new Logger(CounselorService.name);

  private readonly graph: CounselorGraph;

  constructor(
    @Inject(COUNSELOR_MODEL) model: BaseChatModel,
    @Inject(CHECKPOINTER) checkpointer: CounselorCheckpointer,
    @Inject(SESSION_STORE) private readonly store: SessionStore,
    @Inject(PG_POOL) private readonly connection: PostgresConnection,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {
    this.graph = buildCounselorGraph({
      model,
      checkpointer: checkpointer.saver,
    });
  }

  describeRuntime() {
    return {
      persistence: this.connection.pool ? 'postgres' : 'memory',
      llmProvider: this.env.llm.provider,
      model: this.env.llm.model,
    };
  }

  listSessions(): Promise<SessionSummary[]> {
    return this.store.listSessions();
  }

  createSession(title?: string): Promise<SessionSummary> {
    return this.store.createSession(title);
  }

  getSession(id: string): Promise<SessionDetail | null> {
    return this.store.getSession(id);
  }

  deleteSession(id: string): Promise<boolean> {
    return this.store.deleteSession(id);
  }

  /**
   * 把一次对话转成 SSE 事件流：meta -> token* -> done。
   * 输入先落库，再由 LangGraph 负责状态与记忆。
   */
  async *streamChat(
    input: ChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    await this.store.ensureSession(input.sessionId, input.title);

    const screening = assessRisk(input.message);
    let riskLevel: RiskLevel = screening.level;
    let phase: CounselingPhase =
      screening.level === 'high' ? 'crisis' : 'intake';

    await this.store.appendMessage({
      sessionId: input.sessionId,
      role: 'user',
      content: input.message,
      riskLevel,
      phase,
    });

    const config = {
      configurable: { thread_id: input.sessionId },
      streamMode: ['messages', 'updates'] as ('messages' | 'updates')[],
      signal,
    };

    let streamed = '';
    let metaSent = false;

    const stream = await this.graph.stream(
      {
        messages: [new HumanMessage(input.message)],
        sessionId: input.sessionId,
      },
      config,
    );

    for await (const chunk of stream) {
      const [mode, payload] = chunk as [string, unknown];

      if (mode === 'updates') {
        const update = payload as Partial<
          Record<string, Partial<CounselorStateType>>
        >;
        if (update.safetyScreen) {
          riskLevel = update.safetyScreen.riskLevel ?? riskLevel;
          phase = update.safetyScreen.phase ?? phase;
        }
        if (update.crisisResponse) {
          phase = 'crisis';
        }
        continue;
      }

      if (mode !== 'messages') {
        continue;
      }

      const [messageChunk, metadata] = payload as [
        BaseMessageChunk,
        { langgraph_node?: string } | undefined,
      ];
      const node = metadata?.langgraph_node;
      if (node !== 'counselor' && node !== 'crisisResponse') {
        continue;
      }

      const text = chunkText(messageChunk?.content);
      if (!text) {
        continue;
      }

      if (!metaSent) {
        metaSent = true;
        yield { type: 'meta', sessionId: input.sessionId, riskLevel, phase };
      }

      streamed += text;
      yield { type: 'token', content: text };
    }

    // 兜底：万一节点没有以流式分片产出（例如危机脚本为整段文本），
    // 直接从最终状态里取出这条回复。
    if (!streamed) {
      const answer = await this.readLastReply(input.sessionId);
      if (answer) {
        streamed = answer;
        if (!metaSent) {
          yield { type: 'meta', sessionId: input.sessionId, riskLevel, phase };
        }
        yield { type: 'token', content: answer };
      }
    }

    if (streamed) {
      await this.store.appendMessage({
        sessionId: input.sessionId,
        role: 'assistant',
        content: streamed,
        riskLevel,
        phase,
      });
    }

    yield {
      type: 'done',
      sessionId: input.sessionId,
      riskLevel,
      phase,
      crisis: riskLevel === 'high',
    };
  }

  private async readLastReply(sessionId: string): Promise<string> {
    try {
      const snapshot = await this.graph.getState({
        configurable: { thread_id: sessionId },
      });
      const messages =
        (snapshot.values as CounselorStateType | undefined)?.messages ?? [];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.getType() === 'ai') {
          return chunkText(message.content);
        }
      }
    } catch (error) {
      this.logger.warn(`读取最终状态失败：${(error as Error).message}`);
    }
    return '';
  }
}
