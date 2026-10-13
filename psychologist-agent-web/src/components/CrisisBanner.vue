<script setup lang="ts">
import { CRISIS_HOTLINES } from '../types';

defineEmits<{ dismiss: [] }>();
</script>

<template>
  <section class="crisis-banner" role="alert">
    <div class="crisis-head">
      <i class="icon-warning" />
      <strong>检测到高风险信号，请优先保障人身安全</strong>
      <d-button
        class="crisis-dismiss"
        variant="text"
        size="sm"
        icon="close"
        title="收起"
        @click="$emit('dismiss')"
      />
    </div>
    <p class="crisis-desc">
      如果你此刻有伤害自己的念头或计划，请立即联系专业人员或身边的人，这不是一个人扛的事。
    </p>
    <ul class="crisis-list">
      <li v-for="line in CRISIS_HOTLINES" :key="line.phone">
        <span>{{ line.name }}</span>
        <strong>{{ line.phone }}</strong>
      </li>
    </ul>
  </section>
</template>
