import { Component, type ReactNode } from "react"

interface ErrorBoundaryProps {
	children: ReactNode
}

interface ErrorBoundaryState {
	error: Error | null
}

const diagnose = (error: Error): { title: string; detail: string; action?: string } => {
	const msg = error.message ?? ""

	if (/gh[:.]?\s*(not found|ENOENT|command not found)/i.test(msg)) {
		return {
			title: "GitHub CLI not found",
			detail: "ghui requires the `gh` CLI to be installed and on your PATH.",
			action: "Install it from https://cli.github.com then restart.",
		}
	}

	if (/auth|401|403|login|token/i.test(msg)) {
		return {
			title: "Authentication failed",
			detail: "Your GitHub CLI session may have expired.",
			action: "Run `gh auth login` in your terminal, then retry.",
		}
	}

	if (/rate.?limit|429/i.test(msg)) {
		return {
			title: "Rate limited",
			detail: "GitHub API rate limit exceeded. Wait a minute and retry.",
		}
	}

	if (/network|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)) {
		return {
			title: "Network error",
			detail: "Could not reach GitHub. Check your internet connection.",
		}
	}

	return {
		title: "Something went wrong",
		detail: msg || "An unexpected error occurred.",
	}
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null }

	static getDerivedStateFromError(error: Error) {
		return { error }
	}

	override render() {
		if (!this.state.error) return this.props.children

		const info = diagnose(this.state.error)

		return (
			<div className="error-boundary">
				<div className="error-boundary-card">
					<h2 className="error-boundary-title">{info.title}</h2>
					<p className="error-boundary-detail">{info.detail}</p>
					{info.action && <p className="error-boundary-action">{info.action}</p>}
					<button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
						Retry
					</button>
				</div>
			</div>
		)
	}
}
