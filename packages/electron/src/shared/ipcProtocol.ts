import type {
	AppConfig,
	CreatePullRequestCommentInput,
	PullRequestComment,
	PullRequestItem,
	PullRequestLabel,
	PullRequestMergeAction,
	PullRequestMergeInfo,
	PullRequestReviewComment,
	SubmitPullRequestReviewInput,
} from "@ghui/core/node"
import type { PullRequestLoad } from "@ghui/core/node"
import type { PullRequestView } from "@ghui/core/node"

export type IpcChannels = {
	"pr:list": { args: [view: PullRequestView]; result: PullRequestItem[] }
	"pr:details": { args: [repo: string, number: number]; result: PullRequestItem }
	"pr:comments": { args: [repo: string, number: number]; result: readonly PullRequestComment[] }
	"pr:mergeInfo": { args: [repo: string, number: number]; result: PullRequestMergeInfo }
	"pr:merge": { args: [repo: string, number: number, action: PullRequestMergeAction]; result: void }
	"pr:close": { args: [repo: string, number: number]; result: void }
	"pr:review": { args: [input: SubmitPullRequestReviewInput]; result: void }
	"pr:toggleDraft": { args: [repo: string, number: number, isDraft: boolean]; result: void }
	"pr:labels:list": { args: [repo: string]; result: readonly { readonly name: string; readonly color: string | null }[] }
	"pr:labels:add": { args: [repo: string, number: number, label: string]; result: void }
	"pr:labels:remove": { args: [repo: string, number: number, label: string]; result: void }
	"pr:comment:create": { args: [input: CreatePullRequestCommentInput]; result: PullRequestReviewComment }
	"pr:comment:edit": { args: [repo: string, commentId: string, body: string]; result: void }
	"pr:comment:delete": { args: [repo: string, commentId: string]; result: void }
	"clipboard:copy": { args: [text: string]; result: void }
	"browser:open": { args: [url: string]; result: void }
	"cache:readQueue": { args: [viewer: string, view: PullRequestView]; result: PullRequestLoad | null }
	"config:get": { args: []; result: AppConfig }
	"auth:user": { args: []; result: string }
	"auth:check": { args: []; result: { ok: boolean; error?: string } }
}

export type IpcChannel = keyof IpcChannels

export type IpcError = { _tag: string; message: string; retryAfterSeconds?: number | undefined }
