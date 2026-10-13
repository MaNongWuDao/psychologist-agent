<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  McBubble,
  McHeader,
  McInput,
  McIntroduction,
  McLayout,
  McLayoutContent,
  McLayoutSender,
  McMarkdownCard,
  McPrompt,
} from '@matechat/core';
import CrisisBanner from './CrisisBanner.vue';
import SessionSidebar from './SessionSidebar.vue';
import { counselorApi, streamChat, type ActiveStream } from '../services/counselor';
import {
  PHASE_LABEL,
  RISK_LABEL,
  type ChatMessage,
  type RiskLevel,
  type RuntimeInfo,
  type SessionSummary,
} from '../types';

const STARTERS: Array<{ value: string; label: string; desc: string }> = [
  {
    value: 'starter-sleep',
    label: '最近总是失眠，白天也没精神',
    desc: '睡眠与情绪',
  },
  {
    value: 'starter-work',
    label: '工作压力大到喘不过气',
    desc: '职场压力',
  },
  {
    value: 'starter-relation',
    label: '和家人相处总是吵架，很累',
    desc: '亲密关系',
  },
  {
    value: 'starter-self',
    label: '我不知道自己想要什么',
    desc: '自我探索',
  },
];

const sessions = ref<SessionSummary[]>([]);
const activeSessionId = ref<string | null>(null);
const runtime = ref<RuntimeInfo | null>(null);
const messages = ref<ChatMessage[]>([]);
const inputValue = ref('');
const streaming = ref(false);
const loadingHistory = ref(false);
const notice = ref('');
const crisisDismissed = ref(false);
const railOpen = ref(false);

let activeStream: ActiveStream | null = null;

const activeSession = computed(
  () => sessions.value.find((item) => item.id === activeSessionId.value) ?? null,
);

const latestRisk = computed<RiskLevel>(() => {
  const last = messages.value.at(-1);
  return last?.riskLevel ?? activeSession.value?.riskLevel ?? 'none';
});

const showCrisisBanner = computed(
  () => latestRisk.value === 'high' && messages.value.length > 0 && !crisisDismissed.value,
);

async function refreshSessions(): Promise<void> {
  sessions.value = await counselorApi.listSessions();
}

async function bootstrap(): Promise<void> {
  try {
    runtime.value = await counselorApi.getRuntime();
    await refreshSessions();
    if (sessions.value.length) {
      await openSession(sessions.value[0].id);
    }
  } catch (error) {
    notice.value = `初始化失败：${(error as Error).message}`;
  }
}

async function openSession(id: string): Promise<void> {
  if (streaming.value) {
    return;
  }
  loadingHistory.value = true;
  notice.value = '';
  try {
    const detail = await counselorApi.getSession(id);
    activeSessionId.value = detail.id;
    crisisDismissed.value = false;
    messages.value = detail.messages.map((message) => ({
      id: String(message.id),
      from: message.role,
      content: message.content,
      riskLevel: message.riskLevel,
      phase: message.phase,
      streaming: false,
    }));
  } catch (error) {
    notice.value = `加载会话失败：${(error as Error).message}`;
  } finally {
    loadingHistory.value = false;
  }
}

async function createSession(): Promise<string | null> {
  notice.value = '';
  try {
    const session = await counselorApi.createSession();
    sessions.value = [session, ...sessions.value];
    activeSessionId.value = session.id;
    messages.value = [];
    crisisDismissed.value = false;
    return session.id;
  } catch (error) {
    notice.value = `新建会话失败：${(error as Error).message}`;
    return null;
  }
}

async function removeSession(id: string): Promise<void> {
  try {
    await counselorApi.deleteSession(id);
    sessions.value = sessions.value.filter((item) => item.id !== id);
    if (activeSessionId.value === id) {
      activeSessionId.value = null;
      messages.value = [];
    }
  } catch (error) {
    notice.value = `删除会话失败：${(error as Error).message}`;
  }
}

async function send(raw: string): Promise<void> {
  const content = raw.trim();
  if (!content || streaming.value) {
    return;
  }

  const sessionId = activeSessionId.value ?? (await createSession());
  if (!sessionId) {
    return;
  }

  notice.value = '';
  crisisDismissed.value = false;
  inputValue.value = '';

  messages.value.push({
    id: `local-user-${Date.now()}`,
    from: 'user',
    content,
    riskLevel: 'none',
    phase: 'intake',
    streaming: false,
  });
  messages.value.push({
    id: `local-reply-${Date.now()}`,
    from: 'assistant',
    content: '',
    riskLevel: 'none',
    phase: 'intake',
    streaming: true,
  });

  // 必须从 ref 数组里取回元素，拿到的才是响应式代理，
  // 否则下面按 token 累加时不会触发重渲染。
  const reply = messages.value[messages.value.length - 1];
  streaming.value = true;

  activeStream = streamChat(sessionId, content, {
    onMeta: (event) => {
      reply.riskLevel = event.riskLevel;
      reply.phase = event.phase;
    },
    onToken: (token) => {
      reply.content += token;
    },
    onDone: (event) => {
      reply.riskLevel = event.riskLevel;
      reply.phase = event.phase;
    },
    onError: (message) => {
      notice.value = `对话中断：${message}`;
    },
  });

  await activeStream.completion;
  activeStream = null;
  reply.streaming = false;
  streaming.value = false;

  try {
    await refreshSessions();
  } catch {
    // 会话列表刷新失败不影响本轮对话
  }
}

function stop(): void {
  activeStream?.abort();
}

function useStarter(label: string): void {
  void send(label);
}

function selectSession(id: string): void {
  railOpen.value = false;
  void openSession(id);
}

onMounted(() => {
  void bootstrap();
});
</script>

<template>
  <div class="app-shell">
    <SessionSidebar
      :class="{ 'is-open': railOpen }"
      :sessions="sessions"
      :active-id="activeSessionId"
      :runtime="runtime"
      :disabled="streaming"
      @create="createSession"
      @select="selectSession"
      @remove="removeSession"
    />
    <div v-if="railOpen" class="rail-backdrop" @click="railOpen = false" />

    <McLayout class="chat-column">
      <McHeader class="chat-header" :title="activeSession?.title ?? '新的对话'">
        <template #operationArea>
          <div class="header-chips">
            <d-button
              class="rail-toggle"
              variant="text"
              size="sm"
              icon="nav-expand"
              title="会话列表"
              @click="railOpen = !railOpen"
            />
            <span class="chip" :data-tone="latestRisk">
              {{ RISK_LABEL[latestRisk] }}
            </span>
            <span v-if="activeSession" class="chip ghost">
              {{ PHASE_LABEL[activeSession.phase] }}
            </span>
          </div>
        </template>
      </McHeader>

      <McLayoutContent class="chat-content" :auto-scroll="true" :show-scroll-arrow="true">
        <div v-if="loadingHistory" class="chat-placeholder">正在加载对话…</div>

        <div v-else-if="!messages.length" class="chat-welcome">
          <McIntroduction
            :title="'你好，我在这里'"
            :subTitle="'你可以从任何想说的地方开始'"
            :description="[
              '我会先听，再和你一起把混乱的部分慢慢理清。',
              '这里不是诊断，也不替代面诊；你可以放心地慢慢说。',
            ]"
          />
          <McPrompt
            class="chat-starters"
            direction="horizontal"
            :list="STARTERS"
            @itemClick="useStarter($event.label)"
          />
        </div>

        <div v-else class="chat-thread">
          <div
            v-for="message in messages"
            :key="message.id"
            class="thread-row"
            :data-from="message.from"
          >
            <McBubble
              :align="message.from === 'user' ? 'right' : 'left'"
              :variant="message.from === 'user' ? 'filled' : 'bordered'"
              :loading="message.streaming && !message.content"
              :avatar-config="
                message.from === 'user'
                  ? { name: '我', isRound: true }
                  : { name: '咨询师', isRound: true }
              "
            >
              <template #default>
                <McMarkdownCard :content="message.content" />
                <span v-if="message.streaming && message.content" class="typing-caret" />
              </template>
              <template v-if="message.riskLevel !== 'none'" #bottom>
                <span class="bubble-tag" :data-tone="message.riskLevel">
                  {{ RISK_LABEL[message.riskLevel] }}
                </span>
              </template>
            </McBubble>
          </div>
        </div>
      </McLayoutContent>

      <CrisisBanner v-if="showCrisisBanner" @dismiss="crisisDismissed = true" />

      <p v-if="notice" class="chat-notice">{{ notice }}</p>

      <McLayoutSender class="chat-sender">
        <McInput
          :value="inputValue"
          :maxLength="2000"
          :loading="streaming"
          placeholder="说说此刻最想被听见的那件事……"
          @change="(value: string) => (inputValue = value)"
          @submit="send"
          @cancel="stop"
        />
      </McLayoutSender>
    </McLayout>
  </div>
</template>
