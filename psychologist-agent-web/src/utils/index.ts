interface BaseMessage {
  content: string;
  role: "system" | "user" | "assistant";
}

export function mateChatToLangChainMsgs(
  rawList: Array<{ from: string; content: string }>,
): BaseMessage[] {
  return (
    rawList
      // 过滤掉 content 为空的脏数据
      .filter((item) => item?.content != null && item.content.trim() !== "")
      .map((item) => {
        if (item.from === "user") {
          return { role: "user", content: item.content };
        } else if (item.from === "model") {
          return { role: "assistant", content: item.content };
        }
        throw new Error(`不支持的消息from类型：${item.from}`);
      })
  );
}
