import { useState, useEffect, useRef } from "react"

interface SearchBarProps {
	value: string
	onChange: (value: string) => void
}

export const SearchBar = ({ value, onChange }: SearchBarProps) => {
	const [local, setLocal] = useState(value)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		setLocal(value)
	}, [value])

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current)
		}
	}, [])

	const handleChange = (next: string) => {
		setLocal(next)
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => onChange(next), 300)
	}

	return (
		<div className="search-bar">
			<span className="search-bar-icon">⌕</span>
			<input
				className="search-bar-input"
				type="text"
				placeholder="Filter pull requests…"
				value={local}
				onChange={(e) => handleChange(e.target.value)}
			/>
			{local && (
				<button className="search-bar-clear btn-sm btn-ghost" onClick={() => { setLocal(""); onChange("") }}>✕</button>
			)}
		</div>
	)
}
