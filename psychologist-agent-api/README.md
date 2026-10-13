# psychologist-agent-api

心理咨询师智能体的服务端：NestJS 11 + LangChain.js 1.x + LangGraph.js 1.x + PostgreSQL。

## 能力

- **安全优先的对话图**：每次请求先做确定性危机筛查，再决定走常规咨询还是危机干预。
- **流式输出**：`POST /api/counselor/chat` 以 SSE 返回 `meta → token* → done` 事件。
- **多轮记忆**：LangGraph `PostgresSaver` 以 `thread_id = sessionId` 持久化对话状态；未配置数据库时自动降级为 `MemorySaver`。
- **会话读写**：`counselor_session` / `counselor_message` 作为侧边栏与历史记录的读模型。
- **离线可跑**：没有 API Key 时使用本地演示模型，整条链路（LangGraph + SSE + 前端）依然可以联调。

## 快速开始

```bash
pnpm install
cp .env.example .env      # 按需填写 OPENAI_API_KEY / DATABASE_URL
docker compose up -d      # 可选：启动 PostgreSQL
pnpm run start:dev
```

服务默认监听 `http://localhost:3000/api`。

### 模型配置

`LLM_PROVIDER` 支持 `dashscope` / `openai` / `demo` 三种取值，留空则自动探测：
先看 `DASHSCOPE_API_KEY`，再看 `OPENAI_API_KEY`，都没有就使用本地演示模型。

| 变量 | 说明 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 阿里云百炼 / DashScope 的 API Key |
| `DASHSCOPE_MODEL` | 默认 `qwen-plus` |
| `DASHSCOPE_BASE_URL` | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`，专属部署填自己的域名 |
| `DASHSCOPE_TEMPERATURE` | 默认 `0.6` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` / `OPENAI_TEMPERATURE` | 走 OpenAI 或其兼容网关时使用 |

DashScope 与 OpenAI 都是 OpenAI 兼容协议，服务端统一用 `ChatOpenAI` 调用，
区别只在 Key 与 `baseURL`。启动日志会打印最终选中的 `provider/model/网关`，
便于确认配置是否生效。若 `LLM_PROVIDER` 指定的供应商缺少 Key，会自动改用另一个
已配置的供应商并打印警告，而不是等到请求时才失败。

未配置 `DATABASE_URL` 时日志会提示降级为内存存储，重启后会话丢失；
配置了数据库后会自动建表，并额外创建 LangGraph 的 checkpoint 表。

`.env` 的加载语义与 dotenv 一致：**已存在的系统环境变量优先**，
因此 `LLM_PROVIDER=openai pnpm start` 这类临时覆盖不会被 `.env` 覆盖。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api` | 服务元信息（模型、存储驱动） |
| `GET` | `/api/counselor/runtime` | 运行时信息（模型提供方、持久化方式） |
| `GET` | `/api/counselor/sessions` | 会话列表 |
| `POST` | `/api/counselor/sessions` | 新建会话 |
| `GET` | `/api/counselor/sessions/:id` | 会话详情（含历史消息） |
| `DELETE` | `/api/counselor/sessions/:id` | 删除会话 |
| `POST` | `/api/counselor/chat` | SSE 流式对话 |

`/api/counselor/chat` 请求体：

```json
{ "sessionId": "uuid", "message": "最近总是失眠", "title": "可选，仅首次建会话时使用" }
```

事件格式（每行一个 JSON）：

```
data: {"type":"meta","sessionId":"...","riskLevel":"low","phase":"intake"}
data: {"type":"token","content":"我在听"}
data: {"type":"done","sessionId":"...","riskLevel":"low","phase":"intake","crisis":false}
```

## 对话图

```
START → safetyScreen ─┬─(riskLevel=high)→ crisisResponse → END
                      └─(其他)          → counselor      → END
```

- `safetyScreen`：调用 `assessRisk()` 做规则筛查。规则结果不会被模型覆盖，模型无权跳过这一步。
- `crisisResponse`：返回固定脚本（安抚 + 安全确认 + 心理援助热线），不让模型在关键时刻自由发挥。
- `counselor`：带阶段（接洽/探索/工作/收束）与风险等级的心理咨询师系统提示词，由模型生成。

图使用 LangGraph 1.x 的写法：`StateGraph` + `Annotation.Root({ ...MessagesAnnotation.spec })` +
`addConditionalEdges`，流式读取用 `streamMode: ['messages', 'updates']`。

## 目录结构

```
src/
  config/           环境变量读取（process.loadEnvFile）
  database/         pg 连接池与建表 SQL
  counselor/
    agent/          prompts / state / nodes / graph
    domain/         领域类型与阶段推导
    dto/            zod 请求校验
    llm/            模型装配 + 离线演示模型
    persistence/    checkpointer 包装（PostgresSaver / MemorySaver）
    risk/           危机筛查规则
    session/        会话读模型（Postgres / 内存两套实现）
```

## 测试

```bash
pnpm test        # 单元测试：风险规则、会话存储、对话图
pnpm run test:e2e # 端到端：SSE 流式、会话 CRUD、危机脚本
```

e2e 用例强制使用演示模型与内存存储，不依赖网络与数据库。

## 说明

- `.npmrc` 未使用时，`pnpm-workspace.yaml` 里的 `storeDir` 用于对齐本机已有的 pnpm store，
  避免 pnpm 因为 store 位置不一致而要求整包重装；换机器时可以删掉这一行。
- 危机筛查是规则实现，覆盖自杀意念、准备行为、自伤、伤人与无望感等表述，并对
  “我不会自杀” 这类否定句做了降级处理。规则表集中在
  `src/counselor/risk/risk-detector.ts`，可以按业务继续补充。
