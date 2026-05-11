import { contextBridge, ipcRenderer } from "electron"
import type { IpcChannel, IpcChannels, IpcResult } from "../shared/ipcProtocol.js"

const ALLOWED_CHANNELS: ReadonlySet<IpcChannel> = new Set<IpcChannel>([
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
	"auth:check",
])

const electronAPI = {
	invoke: <C extends IpcChannel>(channel: C, ...args: IpcChannels[C]["args"]): Promise<IpcResult<IpcChannels[C]["result"]>> => {
		if (!ALLOWED_CHANNELS.has(channel)) {
			return Promise.reject(new Error(`Unknown IPC channel: ${channel}`))
		}
		return ipcRenderer.invoke(channel, ...args)
	},
}

export type ElectronAPI = typeof electronAPI

contextBridge.exposeInMainWorld("electronAPI", electronAPI)
