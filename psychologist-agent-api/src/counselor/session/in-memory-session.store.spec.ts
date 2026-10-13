import { InMemorySessionStore } from './in-memory-session.store';
import { DEFAULT_SESSION_TITLE } from './session.store';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  it('用第一条用户消息生成标题并累计轮次', async () => {
    const session = await store.createSession();
    expect(session.title).toBe(DEFAULT_SESSION_TITLE);

    await store.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: '  最近总是失眠，晚上很难受，白天也没有精神  ',
      riskLevel: 'low',
      phase: 'intake',
    });
    await store.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '我在听。',
      riskLevel: 'low',
      phase: 'intake',
    });

    const detail = await store.getSession(session.id);
    expect(detail?.title).toBe('最近总是失眠，晚上很难受，白天也没有精神');
    expect(detail?.messageCount).toBe(2);
    expect(detail?.messages).toHaveLength(2);
  });

  it('风险等级只升不降', async () => {
    const session = await store.createSession();

    await store.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: '有点累',
      riskLevel: 'low',
      phase: 'intake',
    });
    await store.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: '我不想活了',
      riskLevel: 'high',
      phase: 'crisis',
    });
    await store.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '我很在意你的安全',
      riskLevel: 'low',
      phase: 'crisis',
    });

    const summary = (await store.listSessions())[0];
    expect(summary.riskLevel).toBe('high');
    expect(summary.phase).toBe('crisis');
  });

  it('ensureSession 幂等且能删除会话', async () => {
    const first = await store.ensureSession('session-1', '测试会话');
    const second = await store.ensureSession('session-1', '另一个名字');

    expect(second.id).toBe(first.id);
    expect(second.title).toBe('测试会话');
    expect(await store.deleteSession('session-1')).toBe(true);
    expect(await store.deleteSession('session-1')).toBe(false);
    expect(await store.getSession('session-1')).toBeNull();
  });

  it('显式命名的会话不会被首条消息覆盖标题', async () => {
    const session = await store.createSession('危机演练');

    await store.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: '我不想活了，想从楼上跳下去。',
      riskLevel: 'high',
      phase: 'crisis',
    });

    const detail = await store.getSession(session.id);
    expect(detail?.title).toBe('危机演练');
    expect(detail?.riskLevel).toBe('high');
    expect(detail?.phase).toBe('crisis');
  });
});
