import { useState, useEffect, useCallback } from "react"
import type { PullRequestView } from "@ghui/core"
import type { AppCommand } from "@ghui/core"
import { PRList } from "./components/PRList.js"
import { PRDetail } from "./components/PRDetail.js"
import { CommentsPane } from "./components/CommentsPane.js"
import { CommandPalette } from "./components/CommandPalette.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"

export const App = () => {
	const [selectedPR, setSelectedPR] = useState<{ repo: string; number: number } | null>(null)
	const [activeView, setActiveView] = useState<PullRequestView>({ _tag: "Queue", mode: "review", repository: null })
	const [commentsPaneVisible, setCommentsPaneVisible] = useState(false)
	const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "k") {
			e.preventDefault()
			setCommandPaletteOpen((v) => !v)
		}
	}, [])

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	const paletteCommands: AppCommand[] = [
		{
			id: "comments.toggle",
			title: commentsPaneVisible ? "Hide comments" : "Show comments",
			scope: "Pull request",
			shortcut: "c",
			disabledReason: selectedPR ? null : "Select a pull request first.",
			run: () => setCommentsPaneVisible((v) => !v),
		},
	]

	return (
		<ErrorBoundary>
			<div className={`app-layout ${commentsPaneVisible ? "comments-visible" : ""}`}>
				<PRList
					activeView={activeView}
					selectedPR={selectedPR}
					onSelectPR={setSelectedPR}
					onViewChange={setActiveView}
				/>
				<div className="pr-detail-pane">
					{selectedPR ? (
						<PRDetail repo={selectedPR.repo} number={selectedPR.number} />
					) : (
						<div className="pr-detail-empty">Select a pull request</div>
					)}
				</div>
				{commentsPaneVisible && selectedPR && (
					<CommentsPane
						repo={selectedPR.repo}
						number={selectedPR.number}
						onClose={() => setCommentsPaneVisible(false)}
					/>
				)}
			</div>
			{commandPaletteOpen && (
				<CommandPalette
					commands={paletteCommands}
					onExecute={(cmd) => cmd.run()}
					onClose={() => setCommandPaletteOpen(false)}
				/>
			)}
		</ErrorBoundary>
	)
}
