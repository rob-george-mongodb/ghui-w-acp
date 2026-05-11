import type { ElectronAPI } from "../../preload/index.js"
import type { IpcChannels } from "../../shared/ipcProtocol.js"

declare global {
	interface Window {
		electronAPI: ElectronAPI
	}
}

const invoke = <C extends keyof IpcChannels>(channel: C, ...args: IpcChannels[C]["args"]): Promise<IpcChannels[C]["result"]> =>
	window.electronAPI.invoke(channel, ...args)

export const coreBridge = {
	listPullRequests: (...args: IpcChannels["pr:list"]["args"]) => invoke("pr:list", ...args),
	getPullRequestDetails: (...args: IpcChannels["pr:details"]["args"]) => invoke("pr:details", ...args),
	listPullRequestComments: (...args: IpcChannels["pr:comments"]["args"]) => invoke("pr:comments", ...args),
	getPullRequestMergeInfo: (...args: IpcChannels["pr:mergeInfo"]["args"]) => invoke("pr:mergeInfo", ...args),
	mergePullRequest: (...args: IpcChannels["pr:merge"]["args"]) => invoke("pr:merge", ...args),
	closePullRequest: (...args: IpcChannels["pr:close"]["args"]) => invoke("pr:close", ...args),
	submitReview: (...args: IpcChannels["pr:review"]["args"]) => invoke("pr:review", ...args),
	toggleDraft: (...args: IpcChannels["pr:toggleDraft"]["args"]) => invoke("pr:toggleDraft", ...args),
	listLabels: (...args: IpcChannels["pr:labels:list"]["args"]) => invoke("pr:labels:list", ...args),
	addLabel: (...args: IpcChannels["pr:labels:add"]["args"]) => invoke("pr:labels:add", ...args),
	removeLabel: (...args: IpcChannels["pr:labels:remove"]["args"]) => invoke("pr:labels:remove", ...args),
	createComment: (...args: IpcChannels["pr:comment:create"]["args"]) => invoke("pr:comment:create", ...args),
	editComment: (...args: IpcChannels["pr:comment:edit"]["args"]) => invoke("pr:comment:edit", ...args),
	deleteComment: (...args: IpcChannels["pr:comment:delete"]["args"]) => invoke("pr:comment:delete", ...args),
	copyToClipboard: (...args: IpcChannels["clipboard:copy"]["args"]) => invoke("clipboard:copy", ...args),
	openInBrowser: (...args: IpcChannels["browser:open"]["args"]) => invoke("browser:open", ...args),
	readCachedQueue: (...args: IpcChannels["cache:readQueue"]["args"]) => invoke("cache:readQueue", ...args),
	getConfig: (...args: IpcChannels["config:get"]["args"]) => invoke("config:get", ...args),
	getAuthenticatedUser: (...args: IpcChannels["auth:user"]["args"]) => invoke("auth:user", ...args),
	checkAuth: (...args: IpcChannels["auth:check"]["args"]) => invoke("auth:check", ...args),
}
