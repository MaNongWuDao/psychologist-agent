# 心理咨询师智能体

Vue 3 + MateChat + LangChain.js 1.x + LangGraph.js 1.x + NestJS + PostgreSQL 实现的心理咨询师智能体示例。

```
psychologist-agent/
├── psychologist-agent-api   NestJS 服务端：LangGraph 对话图、危机筛查、PostgreSQL 持久化
└── psychologist-agent-web   Vue 3 前端：MateChat 对话界面、SSE 流式渲染
```

## 跑起来

```bash
# 1. 服务端
cd psychologist-agent-api
pnpm install
docker compose up -d          # 可选：没有数据库时会自动降级为内存存储
pnpm run start:dev            # http://localhost:3000/api

# 2. 前端
cd ../psychologist-agent-web
pnpm install
pnpm dev
```

模型支持 `dashscope`（阿里云百炼）/ `openai` / `demo` 三种模式：
把 `.env.example` 复制为 `.env`，填写 `DASHSCOPE_API_KEY`（或 `OPENAI_API_KEY`）即可切换到真实模型；
一个 Key 都没有时会使用内置的离线演示模型，方便先跑通链路。

## 设计要点

- **安全优先**：危机筛查是确定性的规则实现，命中高风险时由固定脚本接管回复，
  模型无法跳过或改写这一步。
- **LangChain / LangGraph 1.x 写法**：`ChatOpenAI({ model })`、`StateGraph` +
  `MessagesAnnotation`、`streamMode: ['messages', 'updates']`、`PostgresSaver`，
  没有使用 1.0 之前的 `MessageGraph`、`modelName`、`createReactAgent` 等过时 API。
- **可降级**：数据库或模型任一缺失时都能启动，便于本地调试与演示。
