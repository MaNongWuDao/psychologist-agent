import { HumanMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { DemoCounselorModel } from '../llm/demo-counselor.model';
import { buildCounselorGraph } from './graph';

function createGraph() {
  return buildCounselorGraph({
    model: new DemoCounselorModel({ chunkDelayMs: 0 }),
    checkpointer: new MemorySaver(),
  });
}

function lastAiMessage(state: { messages: unknown[] }): string {
  const messages = state.messages as Array<{
    getType(): string;
    content: unknown;
  }>;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].getType() === 'ai') {
      return String(messages[index].content);
    }
  }
  return '';
}

describe('counselor graph', () => {
  it('常规对话走 counselor 节点，并带上阶段与风险信息', async () => {
    const graph = createGraph();

    const result = await graph.invoke(
      { messages: [new HumanMessage('最近工作压力很大，总是睡不好。')] },
      { configurable: { thread_id: 'normal-1' } },
    );

    expect(result.riskLevel).toBe('low');
    expect(result.phase).toBe('intake');
    expect(lastAiMessage(result)).toContain('？');
  });

  it('高风险对话切换到固定危机脚本并跳过模型生成', async () => {
    const graph = createGraph();

    const result = await graph.invoke(
      { messages: [new HumanMessage('我不想活了，想从楼上跳下去。')] },
      { configurable: { thread_id: 'crisis-1' } },
    );

    expect(result.riskLevel).toBe('high');
    expect(result.phase).toBe('crisis');
    const reply = lastAiMessage(result);
    expect(reply).toContain('12356');
    expect(reply).toContain('安全');
  });

  it('同一 thread_id 会累积多轮记忆并推进咨询阶段', async () => {
    const graph = createGraph();
    const config = { configurable: { thread_id: 'memory-1' } };

    const first = await graph.invoke(
      { messages: [new HumanMessage('我和女朋友分手了。')] },
      config,
    );
    expect(first.phase).toBe('intake');

    const second = await graph.invoke(
      { messages: [new HumanMessage('其实这个问题从三个月前就开始了。')] },
      config,
    );

    expect((second.messages as unknown[]).length).toBeGreaterThan(
      (first.messages as unknown[]).length,
    );
    expect(second.phase).toBe('exploration');
  });
});
