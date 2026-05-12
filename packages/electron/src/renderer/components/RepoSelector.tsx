import { useState, type FormEvent } from "react"
import type { PullRequestView } from "@ghui/core"
import { parseRepositoryInput } from "@ghui/core"

interface RepoSelectorProps {
	onViewChange: (view: PullRequestView) => void
}

export const RepoSelector = ({ onViewChange }: RepoSelectorProps) => {
	const [input, setInput] = useState("")
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		const parsed = parseRepositoryInput(input)
		if (!parsed) {
			setError("Enter a valid owner/repo or GitHub URL")
			return
		}
		setError(null)
		setInput("")
		onViewChange({ _tag: "Repository", repository: parsed })
	}

	return (
		<form className="repo-selector" onSubmit={handleSubmit}>
			<input
				className="repo-selector-input"
				type="text"
				placeholder="owner/repo or GitHub URL"
				value={input}
				onChange={(e) => {
					setInput(e.target.value)
					setError(null)
				}}
			/>
			<button className="btn btn-primary btn-sm" type="submit" disabled={!input.trim()}>
				Go
			</button>
			{error && <div className="repo-selector-error">{error}</div>}
		</form>
	)
}
