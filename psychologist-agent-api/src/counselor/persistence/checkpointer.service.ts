import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export const CHECKPOINTER = Symbol('CHECKPOINTER');

export type CheckpointerKind = 'postgres' | 'memory';

/**
 * 包装 LangGraph 的 checkpointer，让 Nest 能在应用关闭时释放数据库连接。
 */
export class CounselorCheckpointer implements OnModuleDestroy {
  private readonly logger = new Logger('Checkpointer');

  constructor(
    readonly kind: CheckpointerKind,
    readonly saver: BaseCheckpointSaver,
    private readonly postgresSaver?: PostgresSaver,
  ) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.postgresSaver?.end();
    } catch (error) {
      this.logger.warn(
        `关闭 checkpointer 连接失败：${(error as Error).message}`,
      );
    }
  }
}
