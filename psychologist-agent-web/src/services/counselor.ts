import type { RuntimeInfo, SessionDetail, SessionSummary, StreamEvent } from '../types';

const API_BASE = '/api/counselor';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`请求失败（${response.status}）`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const counselorApi = {
  getRuntime(): Promise<RuntimeInfo> {
    return request<RuntimeInfo>('/runtime');
  },

  listSessions(): Promise<SessionSummary[]> {
    return request<SessionSummary[]>('/sessions');
  },

  createSession(title?: string): Promise<SessionSummary> {
    return request<SessionSummary>('/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    });
  },

  getSession(id: string): Promise<SessionDetail> {
    return request<SessionDetail>(`/sessions/${encodeURIComponent(id)}`);
  },

  deleteSession(id: string): Promise<{ id: string; deleted: boolean }> {
    return request<{ id: string; deleted: boolean }>(
      `/sessions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
};

export interface StreamHandlers {
  onMeta?: (event: Extract<StreamEvent, { type: 'meta' }>) => void;
  onToken?: (text: string) => void;
  onDone?: (event: Extract<StreamEvent, { type: 'done' }>) => void;
  onError?: (message: string) => void;
}

export interface ActiveStream {
  abort: () => void;
  /** 无论成功、失败还是中断都会 resolve，便于收尾。 */
  completion: Promise<void>;
}

function dispatch(event: StreamEvent, handlers: StreamHandlers): void {
  if (event.type === 'meta') {
    handlers.onMeta?.(event);
  } else if (event.type === 'token') {
    handlers.onToken?.(event.content);
  } else if (event.type === 'done') {
    handlers.onDone?.(event);
  } else {
    handlers.onError?.(event.message);
  }
}

/**
 * 与后端 SSE 接口对接：解析 `data: {json}` 事件流。
 */
export function streamChat(
  sessionId: string,
  message: string,
  handlers: StreamHandlers,
): ActiveStream {
  const controller = new AbortController();

  const completion = (async () => {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        handlers.onError?.(`对话请求失败（${response.status}）`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const payload = block
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('');
          if (!payload) {
            continue;
          }
          try {
            dispatch(JSON.parse(payload) as StreamEvent, handlers);
          } catch {
            // 忽略不完整分片
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        handlers.onError?.((error as Error).message);
      }
    }
  })();

  return {
    abort: () => controller.abort(),
    completion,
  };
}
