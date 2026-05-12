import { contextBridge, ipcRenderer } from "electron";
const ALLOWED_CHANNELS = /* @__PURE__ */ new Set([
  "pr:list",
  "pr:details",
  "pr:comments",
  "pr:mergeInfo",
  "pr:merge",
  "pr:close",
  "pr:review",
  "pr:toggleDraft",
  "pr:labels:list",
  "pr:labels:add",
  "pr:labels:remove",
  "pr:mergeMethods",
  "pr:issueComment:create",
  "pr:comment:create",
  "pr:comment:edit",
  "pr:comment:delete",
  "clipboard:copy",
  "browser:open",
  "cache:readQueue",
  "config:get",
  "auth:user",
  "auth:check"
]);
const electronAPI = {
  invoke: (channel, ...args) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  }
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
