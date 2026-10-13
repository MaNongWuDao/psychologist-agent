# psychologist-agent-web

心理咨询师智能体的前端：Vue 3 + TypeScript + Vite + MateChat + DevUI。

## 页面结构

- 左侧会话栏：会话列表、风险标记、新建 / 删除会话、运行时状态（模型与存储）。
- 主对话区：MateChat 布局（`McLayout` / `McHeader` / `McLayoutContent` / `McLayoutSender`），
  消息用 `McBubble` + `McMarkdownCard` 渲染，右上方显示当前风险等级与咨询阶段。
- 危机提示：命中高风险时在输入框上方展示心理援助热线。
- 移动端：会话栏收起为抽屉，由顶部的侧栏按钮唤起。

## 快速开始

```bash
pnpm install
pnpm dev
```

开发服务器默认把 `/api` 代理到 `http://127.0.0.1:3000`（后端地址）。
需要指向其他地址时：

```bash
API_PROXY_TARGET=http://127.0.0.1:4000 pnpm dev
```

## 目录结构

```
src/
  components/
    CounselorChat.vue   页面主组件：状态、流式接收、会话切换
    SessionSidebar.vue  会话列表
    CrisisBanner.vue    危机资源提示
  services/counselor.ts REST + SSE 客户端
  types/index.ts        与后端共享的数据结构
  utils/format.ts       相对时间格式化
```

## 构建

```bash
pnpm build     # vue-tsc 类型检查 + vite 打包
pnpm preview
```

## 说明

- DevUI 只按需注册了 `button` 与 `popover`（MateChat 的输入框内部会用到 `d-popover`）；
  如果引入整套 `vue-devui`，会把编辑器、图表等组件一起打进首屏包。
- `vite.config.ts` 里开启了 `css.lightningcss.errorRecovery`，用于跳过 DevUI 样式表中
  的历史 hack（如 `*zoom`），否则 LightningCSS 压缩阶段会直接报错。
