<script setup lang="ts">
import { RISK_LABEL, type RiskLevel, type RuntimeInfo, type SessionSummary } from '../types';
import { formatRelativeTime } from '../utils/format';

const props = defineProps<{
  sessions: SessionSummary[];
  activeId: string | null;
  runtime: RuntimeInfo | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  create: [];
  select: [id: string];
  remove: [id: string];
}>();

const RISK_TONE: Record<RiskLevel, string> = {
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const PROVIDER_LABEL: Record<RuntimeInfo['llmProvider'], string> = {
  openai: 'OpenAI',
  dashscope: 'DashScope',
  demo: '本地演示',
};

function riskTone(level: RiskLevel): string {
  return RISK_TONE[level] ?? 'none';
}

function runtimeLabel(): string {
  if (!props.runtime) {
    return '连接中…';
  }
  const model =
    props.runtime.llmProvider === 'demo' ? '本地演示模型' : props.runtime.model;
  const store = props.runtime.persistence === 'postgres' ? 'PostgreSQL' : '内存';
  return `${model} · ${store}`;
}

function runtimeTitle(): string {
  if (!props.runtime) {
    return '正在读取运行时信息';
  }
  const provider = PROVIDER_LABEL[props.runtime.llmProvider];
  const store =
    props.runtime.persistence === 'postgres' ? 'PostgreSQL' : '内存存储';
  return `${provider} / ${props.runtime.model} · ${store}`;
}
</script>

<template>
  <aside class="session-rail">
    <div class="rail-brand">
      <span class="brand-mark" aria-hidden="true">心</span>
      <div class="brand-text">
        <strong>心理咨询师智能体</strong>
        <span class="brand-status" :title="runtimeTitle()">
          <i class="status-dot" :data-state="runtime ? 'online' : 'pending'" />
          {{ runtimeLabel() }}
        </span>
      </div>
    </div>

    <d-button
      class="rail-create"
      icon="add"
      variant="solid"
      :disabled="disabled"
      @click="emit('create')"
    >
      新建对话
    </d-button>

    <div class="rail-list">
      <p v-if="!sessions.length" class="rail-empty">还没有对话记录</p>
      <ul v-else class="session-list">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeId }"
          @click="emit('select', session.id)"
        >
          <span class="risk-dot" :data-risk="riskTone(session.riskLevel)" />
          <div class="session-meta">
            <span class="session-title">{{ session.title }}</span>
            <span class="session-sub">
              {{ formatRelativeTime(session.updatedAt) }} · {{ session.messageCount }} 条
              <template v-if="session.riskLevel !== 'none'">
                · {{ RISK_LABEL[session.riskLevel] }}
              </template>
            </span>
          </div>
          <d-button
            class="session-remove"
            variant="text"
            size="sm"
            icon="delete"
            title="删除会话"
            @click.stop="emit('remove', session.id)"
          />
        </li>
      </ul>
    </div>

    <div class="rail-footer">
      <i class="icon-warning-o" />
      <span>紧急情况请拨打 <strong>12356</strong> 心理援助热线</span>
    </div>
  </aside>
</template>
