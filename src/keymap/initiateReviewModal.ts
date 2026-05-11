import { context } from "@ghui/keymap"

export interface InitiateReviewModalCtx {
	readonly closeModal: () => void
	readonly confirmInitiate: () => void
}

const InitiateReview = context<InitiateReviewModalCtx>()

export const initiateReviewModalKeymap = InitiateReview(
	{ id: "initiate-review-modal.cancel", title: "Cancel", keys: ["escape"], run: (s) => s.closeModal() },
	{ id: "initiate-review-modal.confirm", title: "Initiate review", keys: ["return"], run: (s) => s.confirmInitiate() },
)
