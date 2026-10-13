import { createApp } from "vue";
import "@devui-design/icons/icomoon/devui-icon.css";
import "vue-devui/style.css";
// 只按需引入用到的 DevUI 组件，避免把编辑器、图表等整套组件打进首屏包里。
import DevUIButton from "vue-devui/button";
// d-button 内部会以 <d-icon> 解析图标组件，需要单独注册 icon 模块
import DevUIIcon from "vue-devui/icon";
import DevUIPopover from "vue-devui/popover";
import MateChat from "@matechat/core";
import App from "./App.vue";
import "./style.css";

createApp(App)
  .use(DevUIIcon)
  .use(DevUIPopover)
  .use(DevUIButton)
  .use(MateChat)
  .mount("#app");
