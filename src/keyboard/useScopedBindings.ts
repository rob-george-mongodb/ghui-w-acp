import { useBindings } from "@opentui/keymap/react"
import { useRef } from "react"

export type ScopedBindingAction = (() => void) | string

export interface ScopedBindingsOptions {
	/** When false, bindings exist on the keymap but don't dispatch. */
	readonly when: boolean
	/** Map of key string (e.g. "j", "ctrl+p", "meta+left") to action. */
	readonly bindings: Readonly<Record<string, ScopedBindingAction>>
}

/**
 * Wraps `@opentui/keymap/react`'s `useBindings` so callers don't have to write
 * the ref dance themselves. The layer registers exactly once (deps=[]); the
 * `when` flag and the action callbacks read the latest values via refs.
 *
 * - `bindings` shape (which keys are bound) is captured at first render. Don't
 *   change which keys you bind across renders — only what they do.
 * - Action values are read fresh on every dispatch, so closures over component
 *   state are always current.
 * - String actions are passed through as named-command references.
 */
export const useScopedBindings = ({ when, bindings }: ScopedBindingsOptions): void => {
	const activeRef = useRef(false)
	activeRef.current = when

	const actionsRef = useRef(bindings)
	actionsRef.current = bindings

	useBindings(() => ({
		enabled: () => activeRef.current,
		bindings: Object.entries(bindings).map(([key, action]) => ({
			key,
			cmd: typeof action === "string" ? action : () => {
				const current = actionsRef.current[key]
				if (typeof current === "function") current()
			},
		})),
	}), [])
}
