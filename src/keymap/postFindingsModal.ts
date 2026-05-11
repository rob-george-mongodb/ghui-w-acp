import { context } from "@ghui/keymap"

export interface PostFindingsModalCtx {
	readonly closeModal: () => void
	readonly confirmPost: () => void
	readonly stepUp: () => void
	readonly stepDown: () => void
}

const PostFindings = context<PostFindingsModalCtx>()

export const postFindingsModalKeymap = PostFindings(
	{ id: "post-findings-modal.cancel", title: "Cancel", keys: ["escape"], run: (s) => s.closeModal() },
	{ id: "post-findings-modal.confirm", title: "Post findings", keys: ["return"], run: (s) => s.confirmPost() },
	{ id: "post-findings-modal.up", title: "Up", keys: ["up", "k"], run: (s) => s.stepUp() },
	{ id: "post-findings-modal.down", title: "Down", keys: ["down", "j"], run: (s) => s.stepDown() },
)
