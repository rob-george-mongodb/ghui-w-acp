import type { CheckItem } from "@ghui/core"

const statusIcon = (check: CheckItem): string => {
	if (check.status !== "completed") return "◯"
	switch (check.conclusion) {
		case "success":
			return "✓"
		case "failure":
			return "✗"
		case "neutral":
		case "skipped":
			return "–"
		case "cancelled":
			return "⊘"
		case "timed_out":
			return "⏱"
		default:
			return "?"
	}
}

const statusClass = (check: CheckItem): string => {
	if (check.status !== "completed") return "check-pending"
	switch (check.conclusion) {
		case "success":
			return "check-passing"
		case "failure":
			return "check-failing"
		default:
			return "check-none"
	}
}

export const StatusChecks = ({ checks }: { checks: readonly CheckItem[] }) => {
	if (checks.length === 0) return null

	return (
		<div className="status-checks-list">
			{checks.map((check) => (
				<div key={check.name} className="status-check-item">
					<span className={statusClass(check)}>{statusIcon(check)}</span>
					<span className="status-check-name">{check.name}</span>
				</div>
			))}
		</div>
	)
}
