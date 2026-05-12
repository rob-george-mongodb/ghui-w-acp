import { useState, useEffect, useRef, useCallback } from "react"
import { filterCommands, clampCommandIndex, type AppCommand } from "@ghui/core"

interface CommandPaletteProps {
	commands: readonly AppCommand[]
	onExecute: (command: AppCommand) => void
	onClose: () => void
}

const DIFF_SCOPE_IDS = new Set(["diff", "file", "thread"])
const shouldExclude = (cmd: AppCommand) => cmd.id.split(".").some((segment) => DIFF_SCOPE_IDS.has(segment))

export const CommandPalette = ({ commands, onExecute, onClose }: CommandPaletteProps) => {
	const [query, setQuery] = useState("")
	const [selectedIndex, setSelectedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const eligible = commands.filter((cmd) => !shouldExclude(cmd))
	const filtered = filterCommands(eligible, query)

	useEffect(() => {
		setSelectedIndex(0)
	}, [query])

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	useEffect(() => {
		const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
		el?.scrollIntoView({ block: "nearest" })
	}, [selectedIndex])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault()
				onClose()
			} else if (e.key === "ArrowDown") {
				e.preventDefault()
				setSelectedIndex((i) => clampCommandIndex(i + 1, filtered))
			} else if (e.key === "ArrowUp") {
				e.preventDefault()
				setSelectedIndex((i) => clampCommandIndex(i - 1, filtered))
			} else if (e.key === "Enter") {
				e.preventDefault()
				const cmd = filtered[selectedIndex]
				if (cmd && !cmd.disabledReason) {
					onExecute(cmd)
					onClose()
				}
			}
		},
		[filtered, selectedIndex, onClose, onExecute],
	)

	return (
		<div className="command-palette-overlay" onClick={onClose}>
			<div className="command-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
				<input ref={inputRef} className="command-palette-input" type="text" placeholder="Type a command…" value={query} onChange={(e) => setQuery(e.target.value)} />
				<div className="command-palette-list" ref={listRef}>
					{filtered.length === 0 && <div className="command-palette-empty">No matching commands</div>}
					{filtered.map((cmd, i) => (
						<div
							key={cmd.id}
							className={`command-palette-item ${i === selectedIndex ? "selected" : ""} ${cmd.disabledReason ? "disabled" : ""}`}
							onMouseEnter={() => setSelectedIndex(i)}
							onClick={() => {
								if (!cmd.disabledReason) {
									onExecute(cmd)
									onClose()
								}
							}}
						>
							<div className="command-palette-item-main">
								<span className="command-palette-item-title">{cmd.title}</span>
								{cmd.shortcut && <span className="command-palette-item-shortcut">{cmd.shortcut}</span>}
							</div>
							{cmd.subtitle && <div className="command-palette-item-subtitle">{cmd.subtitle}</div>}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
