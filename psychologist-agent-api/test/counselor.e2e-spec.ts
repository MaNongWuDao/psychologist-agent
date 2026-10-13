import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';
import { CRISIS_RESPONSE } from './../src/counselor/agent/prompts';

// 让 e2e 完全离线可跑：演示模型 + 内存存储。
process.env.LLM_PROVIDER = 'demo';
process.env.PERSISTENCE = 'memory';
process.env.DATABASE_URL = '';

interface SseEvent {
  type: 'meta' | 'token' | 'done' | 'error';
  content?: string;
  riskLevel?: string;
  phase?: string;
  crisis?: boolean;
}

interface ServiceInfoBody {
  name: string;
  persistence: string;
}

interface SessionBody {
  id: string;
  title: string;
  messages: Array<{ role: string }>;
}

function parseSse(body: string): SseEvent[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as SseEvent);
}

describe('Counselor (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api 返回服务信息', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);
    const body = response.body as ServiceInfoBody;

    expect(body.name).toBe('psychologist-agent-api');
    expect(body.persistence).toBe('memory');
  });

  it('会话 CRUD 全流程可用', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/counselor/sessions')
      .send({ title: '工作压力' })
      .expect(201);

    const session = created.body as SessionBody;
    const sessionId = session.id;
    expect(session.title).toBe('工作压力');

    const list = await request(app.getHttpServer())
      .get('/api/counselor/sessions')
      .expect(200);
    const listBody = list.body as SessionBody[];
    expect(listBody.map((item) => item.id)).toContain(sessionId);

    await request(app.getHttpServer())
      .get(`/api/counselor/sessions/${sessionId}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/counselor/sessions/${sessionId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/counselor/sessions/${sessionId}`)
      .expect(404);
  });

  it('普通对话以 SSE 流式返回并被持久化', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/counselor/sessions')
      .send({})
      .expect(201);
    const sessionId = (created.body as SessionBody).id;

    const chat = await request(app.getHttpServer())
      .post('/api/counselor/chat')
      .send({ sessionId, message: '最近总是失眠，白天压力很大。' })
      .expect(200);

    const events = parseSse(chat.text);
    const done = events.at(-1);
    expect(done?.type).toBe('done');
    expect(done?.crisis).toBe(false);
    expect(
      events.filter((event) => event.type === 'token').length,
    ).toBeGreaterThan(1);

    const detail = await request(app.getHttpServer())
      .get(`/api/counselor/sessions/${sessionId}`)
      .expect(200);
    const detailBody = detail.body as SessionBody;
    expect(detailBody.messages).toHaveLength(2);
    expect(detailBody.messages[0].role).toBe('user');
    expect(detailBody.messages[1].role).toBe('assistant');
    expect(detailBody.title).toContain('失眠');
  });

  it('高风险输入命中危机脚本，且不经过模型生成', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/counselor/sessions')
      .send({})
      .expect(201);
    const sessionId = (created.body as SessionBody).id;

    const chat = await request(app.getHttpServer())
      .post('/api/counselor/chat')
      .send({ sessionId, message: '我不想活了，想从楼上跳下去。' })
      .expect(200);

    const events = parseSse(chat.text);
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: 'done',
      riskLevel: 'high',
      phase: 'crisis',
      crisis: true,
    });

    const answer = events
      .filter((event) => event.type === 'token')
      .map((event) => event.content ?? '')
      .join('');
    expect(answer.trim()).toBe(CRISIS_RESPONSE);
    expect(answer).toContain('12356');
  });

  it('参数不合法时返回 400', async () => {
    await request(app.getHttpServer())
      .post('/api/counselor/chat')
      .send({ sessionId: '', message: '' })
      .expect(400);
  });
});
