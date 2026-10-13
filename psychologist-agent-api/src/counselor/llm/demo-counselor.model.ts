import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs';

interface TopicTemplate {
  match: RegExp;
  reflection: string;
  question: string;
}

const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    match: /(焦虑|紧张|心慌|喘不上气|惊恐)/,
    reflection:
      '听你描述这种紧绷、心跳很快的感觉，身体像是随时准备应对什么危险，而脑子又停不下来。长时间处在这种状态里，人会非常疲惫。',
    question:
      '这种紧绷通常出现在什么样的时刻？那时候你脑子里冒出来的念头是什么？',
  },
  {
    match: /(失眠|睡不着|半夜醒|早醒)/,
    reflection:
      '睡不着的时候，夜晚会变得格外漫长，好像全世界都安静下来，只剩自己在和念头较劲。',
    question: '躺下之后最难熬的是哪一段？是入睡困难，还是会突然醒过来？',
  },
  {
    match: /(工作|加班|老板|同事|失业|绩效|考试|学业)/,
    reflection:
      '工作的压力不只是事情多，更难受的常常是那种“不能出错、不能被否定”的紧绷感。',
    question:
      '如果把这份压力拆开看，最让你喘不过气的是任务本身，还是别人对你的评价？',
  },
  {
    match: /(分手|失恋|离婚|男朋友|女朋友|老公|老婆|父母|家里|家人)/,
    reflection:
      '关系里的伤往往最深，因为它牵扯的是“我在对方眼里到底重不重要”这件事。',
    question: '在这段关系里，你最希望被对方看见、却一直没被看见的是什么？',
  },
  {
    match: /(绝望|没有意义|撑不下去|看不到希望|活着.*累)/,
    reflection:
      '你说那种“撑不下去”的感觉，我认真听到了。当一个人长期耗尽了力气，连希望都会变得很奢侈。',
    question:
      '这段时间里，有没有哪怕一小会儿，你觉得没那么沉重？那时候你在做什么？',
  },
];

const FALLBACK_TEMPLATES: Array<{ reflection: string; question: string }> = [
  {
    reflection: '我在听。你愿意把这些说出来，本身就需要一点力气。',
    question: '如果让你用一个词形容此刻的自己，会是什么词？',
  },
  {
    reflection: '嗯，我大概能感觉到这件事情压在你心上已经有一段时间了。',
    question: '这件事最早是从什么时候开始让你觉得不对劲的？',
  },
];

function lastUserText(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() === 'human') {
      return typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content);
    }
  }
  return '';
}

function pickTemplate(text: string) {
  const hit = TOPIC_TEMPLATES.find((template) => template.match.test(text));
  if (hit) {
    return hit;
  }
  const index =
    [...text].reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    FALLBACK_TEMPLATES.length;
  return FALLBACK_TEMPLATES[index];
}

export function composeDemoReply(messages: BaseMessage[]): string {
  const text = lastUserText(messages).trim();
  const template = pickTemplate(text);
  const excerpt = text.length > 18 ? `${text.slice(0, 18)}……` : text;
  const prefix = excerpt
    ? `你提到「${excerpt}」，我先确认一下我有没有理解偏。\n\n`
    : '';
  return `${prefix}${template.reflection}\n\n${template.question}`;
}

export interface DemoCounselorModelFields {
  /** 每帧之间的间隔，让前端能看到逐字输出的效果 */
  chunkDelayMs?: number;
}

/**
 * 离线演示模型：在没有 OPENAI_API_KEY 时让整套链路（LangGraph + SSE + 前端）
 * 依然可以完整跑通。它不做任何真实的语言理解，仅用于本地联调。
 */
export class DemoCounselorModel extends BaseChatModel<BaseChatModelCallOptions> {
  private readonly chunkDelayMs: number;

  constructor(fields: DemoCounselorModelFields = {}) {
    super({});
    this.chunkDelayMs = fields.chunkDelayMs ?? 8;
  }

  _llmType(): string {
    return 'demo-counselor';
  }

  // BaseChatModel 的契约要求返回 Promise，这里没有真正的异步步骤。
  // eslint-disable-next-line @typescript-eslint/require-await
  async _generate(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const text = composeDemoReply(messages);
    return {
      generations: [{ text, message: new AIMessage(text) }],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const text = composeDemoReply(messages);
    const tokens = text.match(/[\s\S]{1,4}/g) ?? [text];

    for (const token of tokens) {
      if (this.chunkDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.chunkDelayMs));
      }
      const chunk = new ChatGenerationChunk({
        text: token,
        message: new AIMessageChunk(token),
      });
      yield chunk;
      await runManager?.handleLLMNewToken(token);
    }
  }
}

export function isHumanMessage(message: BaseMessage): boolean {
  return message instanceof HumanMessage;
}
