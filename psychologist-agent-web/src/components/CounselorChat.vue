<template>
  <McLayout class="container">
    <McHeader
      :title="'MateChat'"
      :logoImg="'https://matechat.gitcode.com/logo.svg'"
    >
      <template #operationArea>
        <div class="operations">
          <i class="icon-helping"></i>
        </div>
      </template>
    </McHeader>
    <McLayoutContent
      v-if="startPage"
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      "
    >
      <McIntroduction
        :logoImg="'https://matechat.gitcode.com/logo2x.svg'"
        :title="'MateChat'"
        :subTitle="'Hi，欢迎使用 MateChat'"
        :description="description"
      ></McIntroduction>
      <McPrompt
        :list="introPrompt.list"
        :direction="introPrompt.direction"
        class="intro-prompt"
        @itemClick="onSubmit($event.label)"
      ></McPrompt>
    </McLayoutContent>
    <McLayoutContent class="content-container" v-else>
      <template v-for="(msg, idx) in messages" :key="idx">
        <McBubble
          v-if="msg.from === 'user'"
          :content="msg.content"
          :align="'right'"
          :avatarConfig="{
            imgSrc: 'https://matechat.gitcode.com/png/demo/userAvatar.svg',
          }"
        >
        </McBubble>
        <McBubble
          v-else
          :content="msg.content"
          :avatarConfig="{ imgSrc: 'https://matechat.gitcode.com/logo.svg' }"
          :loading="msg.loading"
        >
        </McBubble>
      </template>
    </McLayoutContent>
    <div class="shortcut" style="display: flex; align-items: center; gap: 8px">
      <McPrompt
        v-if="!startPage"
        :list="simplePrompt"
        :direction="'horizontal'"
        style="flex: 1"
        @itemClick="onSubmit($event.label)"
      ></McPrompt>
      <Button
        style="margin-left: auto"
        icon="add"
        shape="circle"
        title="新建对话"
        size="md"
        @click="newConversation"
      />
    </div>
    <McLayoutSender>
      <McInput
        :value="inputValue"
        :maxLength="2000"
        @change="(e) => (inputValue = e)"
        @submit="onSubmit"
      >
        <template #extra>
          <div class="input-foot-wrapper">
            <div class="input-foot-left">
              <span v-for="(item, index) in inputFootIcons" :key="index">
                <i :class="item.icon"></i>
                {{ item.text }}
              </span>
              <span class="input-foot-dividing-line"></span>
              <span class="input-foot-maxlength"
                >{{ inputValue.length }}/2000</span
              >
            </div>
            <div class="input-foot-right">
              <Button
                icon="op-clearup"
                shape="round"
                :disabled="!inputValue"
                @click="inputValue = ''"
                ><span class="demo-button-content">清空输入</span></Button
              >
            </div>
          </div>
        </template>
      </McInput>
    </McLayoutSender>
  </McLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "vue-devui/button";
import "vue-devui/button/style.css";
import { mateChatToLangChainMsgs } from "@/utils/index";

const description = [
  "MateChat 可以辅助研发人员编码、查询知识和相关作业信息、编写文档等。",
  "作为AI模型，MateChat 提供的答案可能不总是确定或准确的，但您的反馈可以帮助 MateChat 做的更好。",
];
const introPrompt = {
  direction: "horizontal",
  list: [
    {
      value: "quickSort",
      label: "帮我写一个快速排序",
      iconConfig: { name: "icon-info-o", color: "#5e7ce0" },
      desc: "使用 js 实现一个快速排序",
    },
    {
      value: "helpMd",
      label: "你可以帮我做些什么？",
      iconConfig: { name: "icon-star", color: "rgb(255, 215, 0)" },
      desc: "了解当前大模型可以帮你做的事",
    },
    {
      value: "bindProjectSpace",
      label: "怎么绑定项目空间",
      iconConfig: { name: "icon-priority", color: "#3ac295" },
      desc: "如何绑定云空间中的项目",
    },
  ],
};
const simplePrompt = [
  {
    value: "quickSort",
    iconConfig: { name: "icon-info-o", color: "#5e7ce0" },
    label: "帮我写一个快速排序",
  },
  {
    value: "helpMd",
    iconConfig: { name: "icon-star", color: "rgb(255, 215, 0)" },
    label: "你可以帮我做些什么？",
  },
];
const startPage = ref(true);
const inputValue = ref("");
const inputFootIcons = [
  { icon: "icon-at", text: "智能体" },
  { icon: "icon-standard", text: "词库" },
  { icon: "icon-add", text: "附件" },
];

const messages = ref<any[]>([]);

const newConversation = () => {
  startPage.value = true;
  messages.value = [];
};

const onSubmit = async (evt) => {
  inputValue.value = "";
  startPage.value = false;

  console.log(messages.value);

  const res = await fetch("http://localhost:3000/api/counselor/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: evt,
      history: mateChatToLangChainMsgs(messages.value),
    }),
  });
  messages.value.push({
    from: "user",
    content: evt,
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = ""; // 关键：增加缓冲区，解决跨chunk断行问题
  const aiMsg = {
    id: Date.now().toString(),
    from: "model",
    content: "",
    loading: true,
  };
  messages.value.push(aiMsg);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // 追加到缓冲区
    buffer += decoder.decode(value, { stream: true });
    // 按换行分割
    const lines = buffer.split("\n");
    // 最后一行留在 buffer，防止被截断
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimLine = line.trim();
      if (!trimLine || !trimLine.startsWith("data: ")) continue;
      const dataStr = trimLine.replace("data: ", "");
      if (dataStr === "[DONE]") continue;
      try {
        const json = JSON.parse(dataStr);
        aiMsg.content += json.token;
        aiMsg.loading = false;
        messages.value = [...messages.value];
        console.log(aiMsg.content);
      } catch (e) {
        // 单独捕获JSON解析异常，避免单条坏数据中断整个流
        console.warn("parse sse line error", e, dataStr);
      }
    }
  }

  //   messages.value.push({
  //       from: "model",
  //     });
  // // 用户发送消息
  // messages.value.push({
  //   from: "user",
  //   content: evt,
  // });
  // setTimeout(() => {
  //   // 模型返回消息
  //   messages.value.push({
  //     from: "model",
  //     content: evt,
  //   });
  // }, 200);
};
</script>

<style>
.container {
  width: 1000px;
  margin: 20px auto;
  height: calc(100vh - 82px);
  padding: 20px;
  gap: 8px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 16px;
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.input-foot-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100%;
  margin-right: 8px;

  .input-foot-left {
    display: flex;
    align-items: center;
    gap: 8px;

    span {
      font-size: 14px;
      line-height: 18px;
      color: #252b3a;
      cursor: pointer;
    }

    .input-foot-dividing-line {
      width: 1px;
      height: 14px;
      background-color: #d7d8da;
    }

    .input-foot-maxlength {
      font-size: 14px;
      color: #71757f;
    }
  }

  .input-foot-right {
    .demo-button-content {
      font-size: 14px;
    }

    & > *:not(:first-child) {
      margin-left: 8px;
    }
  }
}
</style>
