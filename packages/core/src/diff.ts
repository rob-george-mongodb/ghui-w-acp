import { Data, Schema } from "effect"

export type DiffCommentSide = "LEFT" | "RIGHT"

export const DiffView = Schema.Literals(["unified", "split"])
export type DiffView = Schema.Schema.Type<typeof DiffView>

export const DiffWrapMode = Schema.Literals(["none", "word"])
export type DiffWrapMode = Schema.Schema.Type<typeof DiffWrapMode>

export const DiffWhitespaceMode = Schema.Literals(["ignore", "show"])
export type DiffWhitespaceMode = Schema.Schema.Type<typeof DiffWhitespaceMode>

export const DiffCommentKind = Schema.Literals(["addition", "deletion", "context"])
export type DiffCommentKind = Schema.Schema.Type<typeof DiffCommentKind>

export interface DiffFilePatch {
	readonly name: string
	readonly filetype: string | undefined
	readonly patch: string
}

export interface DiffFileStats {
	readonly additions: number
	readonly deletions: number
}

export interface StackedDiffFilePatch {
	readonly file: DiffFilePatch
	readonly index: number
	readonly headerLine: number
	readonly diffStartLine: number
	readonly diffHeight: number
}

export interface DiffCommentAnchor {
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly kind: DiffCommentKind
	readonly renderLine: number
	readonly colorLine: number
	readonly text: string
}

export type StackedDiffCommentAnchor = DiffCommentAnchor & {
	readonly fileIndex: number
	readonly localRenderLine: number
}

export type PullRequestDiffState = Data.TaggedEnum<{
	Loading: {}
	Ready: { readonly patch: string; readonly files: readonly DiffFilePatch[] }
	Error: { readonly error: string }
}>

export const PullRequestDiffState = Data.taggedEnum<PullRequestDiffState>()

const unquoteDiffPath = (path: string) => path.replace(/^"|"$/g, "").replace(/^a\//, "").replace(/^b\//, "")

const readDiffPath = (value: string, start: number) => {
	if (value[start] === '"') {
		for (let index = start + 1; index < value.length; index++) {
			if (value[index] === '"' && value[index - 1] !== "\\") {
				const raw = value.slice(start, index + 1)
				try {
					return { path: JSON.parse(raw) as string, end: index + 1 }
				} catch {
					return { path: raw, end: index + 1 }
				}
			}
		}
	}

	const end = value.slice(start).search(/\s/)
	const pathEnd = end >= 0 ? start + end : value.length
	return { path: value.slice(start, pathEnd), end: pathEnd }
}

const parseDiffGitPaths = (line: string) => {
	const prefix = "diff --git "
	if (!line.startsWith(prefix)) return null
	const left = readDiffPath(line, prefix.length)
	const rightStart = line.slice(left.end).search(/\S/)
	if (rightStart < 0) return null
	const right = readDiffPath(line, left.end + rightStart)
	return [left.path, right.path] as const
}

const patchFileName = (patch: string) => {
	const diffLine = patch.split("\n").find((line) => line.startsWith("diff --git "))
	if (diffLine) {
		const paths = parseDiffGitPaths(diffLine)
		if (paths) {
			const next = unquoteDiffPath(paths[1])
			if (next !== "/dev/null") return next
			return unquoteDiffPath(paths[0])
		}
	}

	const nextLine = patch.split("\n").find((line) => line.startsWith("+++ "))
	return nextLine ? unquoteDiffPath(nextLine.slice(4).trim()) : "diff"
}

export const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

const formatHunkRange = (start: string, count: number) => `${start},${count}`

export const normalizeHunkLineCounts = (patch: string) => {
	const lines = patch.split("\n")
	const normalized = [...lines]

	for (let index = 0; index < lines.length; index++) {
		const match = lines[index]!.match(hunkHeaderPattern)
		if (!match) continue

		let oldCount = 0
		let newCount = 0
		for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex]!
			if (line.startsWith("@@ ") || line.startsWith("diff --git ")) break

			const prefix = line[0]
			if (prefix === " ") {
				oldCount += 1
				newCount += 1
			} else if (prefix === "-") {
				oldCount += 1
			} else if (prefix === "+") {
				newCount += 1
			}
		}

		normalized[index] = `@@ -${formatHunkRange(match[1]!, oldCount)} +${formatHunkRange(match[3]!, newCount)} @@${match[5]!}`
	}

	return normalized.join("\n")
}

const whitespaceComparableText = (text: string) => text.replace(/\s+/g, "")
const MAX_WHITESPACE_LCS_CELLS = 40_000

const linearWhitespaceEquivalentMatches = (deletions: readonly string[], additions: readonly string[]) => {
	const additionsByKey = new Map<string, number[]>()
	const cursors = new Map<string, number>()
	for (let index = 0; index < additions.length; index++) {
		const key = whitespaceComparableText(additions[index]!.slice(1))
		let bucket = additionsByKey.get(key)
		if (!bucket) {
			bucket = []
			additionsByKey.set(key, bucket)
		}
		bucket.push(index)
	}

	const matches: Array<{ readonly oldIndex: number; readonly newIndex: number }> = []
	let minimumNewIndex = 0
	for (let oldIndex = 0; oldIndex < deletions.length; oldIndex++) {
		const key = whitespaceComparableText(deletions[oldIndex]!.slice(1))
		const candidates = additionsByKey.get(key)
		if (!candidates) continue
		let cursor = cursors.get(key) ?? 0
		while (cursor < candidates.length && candidates[cursor]! < minimumNewIndex) cursor++
		const newIndex = candidates[cursor]
		if (newIndex === undefined) continue
		matches.push({ oldIndex, newIndex })
		cursors.set(key, cursor + 1)
		minimumNewIndex = newIndex + 1
	}
	return matches
}

const whitespaceEquivalentMatches = (deletions: readonly string[], additions: readonly string[]) => {
	if ((deletions.length + 1) * (additions.length + 1) > MAX_WHITESPACE_LCS_CELLS) {
		return linearWhitespaceEquivalentMatches(deletions, additions)
	}

	const oldKeys = deletions.map((line) => whitespaceComparableText(line.slice(1)))
	const newKeys = additions.map((line) => whitespaceComparableText(line.slice(1)))
	const lengths = Array.from({ length: oldKeys.length + 1 }, () => Array<number>(newKeys.length + 1).fill(0))

	for (let oldIndex = oldKeys.length - 1; oldIndex >= 0; oldIndex--) {
		for (let newIndex = newKeys.length - 1; newIndex >= 0; newIndex--) {
			lengths[oldIndex]![newIndex] =
				oldKeys[oldIndex] === newKeys[newIndex] ? lengths[oldIndex + 1]![newIndex + 1]! + 1 : Math.max(lengths[oldIndex + 1]![newIndex]!, lengths[oldIndex]![newIndex + 1]!)
		}
	}

	const matches: Array<{ readonly oldIndex: number; readonly newIndex: number }> = []
	let oldIndex = 0
	let newIndex = 0
	while (oldIndex < oldKeys.length && newIndex < newKeys.length) {
		if (oldKeys[oldIndex] === newKeys[newIndex]) {
			matches.push({ oldIndex, newIndex })
			oldIndex++
			newIndex++
		} else if (lengths[oldIndex + 1]![newIndex]! >= lengths[oldIndex]![newIndex + 1]!) {
			oldIndex++
		} else {
			newIndex++
		}
	}

	return matches
}

const mergeWhitespaceEquivalentChanges = (deletions: readonly string[], additions: readonly string[]) => {
	const matches = whitespaceEquivalentMatches(deletions, additions)
	const merged: string[] = []
	let oldCursor = 0
	let newCursor = 0

	for (const match of matches) {
		while (oldCursor < match.oldIndex) merged.push(deletions[oldCursor++]!)
		while (newCursor < match.newIndex) merged.push(additions[newCursor++]!)
		merged.push(` ${additions[match.newIndex]!.slice(1)}`)
		oldCursor = match.oldIndex + 1
		newCursor = match.newIndex + 1
	}

	while (oldCursor < deletions.length) merged.push(deletions[oldCursor++]!)
	while (newCursor < additions.length) merged.push(additions[newCursor++]!)
	return merged
}

const minimizeWhitespaceHunk = (header: string, body: readonly string[]) => {
	const minimized: string[] = []
	let deletions: string[] = []
	let additions: string[] = []

	const flushChangeBlock = () => {
		if (deletions.length === 0 && additions.length === 0) return
		minimized.push(...mergeWhitespaceEquivalentChanges(deletions, additions))
		deletions = []
		additions = []
	}

	for (const line of body) {
		const firstChar = line[0]
		if (firstChar === "-") {
			deletions.push(line)
			continue
		}

		if (firstChar === "+") {
			additions.push(line)
			continue
		}

		flushChangeBlock()
		minimized.push(line)
	}

	flushChangeBlock()
	return minimized.some((line) => line[0] === "-" || line[0] === "+") ? [header, ...minimized] : []
}

export const minimizeWhitespacePatch = (patch: string) => {
	const lines = patch.split("\n")
	const minimized: string[] = []

	for (let index = 0; index < lines.length; ) {
		const line = lines[index]!
		if (!line.match(hunkHeaderPattern)) {
			minimized.push(line)
			index++
			continue
		}

		let end = index + 1
		while (end < lines.length && !lines[end]!.match(hunkHeaderPattern) && !lines[end]!.startsWith("diff --git ")) end++
		minimized.push(...minimizeWhitespaceHunk(line, lines.slice(index + 1, end)))
		index = end
	}

	return normalizeHunkLineCounts(minimized.join("\n")).trimEnd()
}

export const minimizeWhitespaceDiffFiles = (files: readonly DiffFilePatch[]): readonly DiffFilePatch[] =>
	files.flatMap((file) => {
		const patch = minimizeWhitespacePatch(file.patch)
		if (file.patch.split("\n").some((line) => line.match(hunkHeaderPattern)) && !patch.split("\n").some((line) => line.match(hunkHeaderPattern))) return []
		return [{ ...file, patch }]
	})

export interface SplitPatchFilesOptions {
	readonly resolveFiletype?: (name: string) => string | undefined
}

export const splitPatchFiles = (patch: string, options?: SplitPatchFilesOptions): readonly DiffFilePatch[] => {
	const trimmed = patch.trimEnd()
	if (trimmed.length === 0) return []

	const matches = [...trimmed.matchAll(/^diff --git .+$/gm)]
	if (matches.length === 0) {
		return [{ name: "diff", filetype: undefined, patch: trimmed }]
	}

	const resolveFiletype = options?.resolveFiletype
	return matches.map((match, index) => {
		const start = match.index ?? 0
		const end = index + 1 < matches.length ? (matches[index + 1]!.index ?? trimmed.length) : trimmed.length
		const filePatch = normalizeHunkLineCounts(trimmed.slice(start, end).trimEnd())
		const name = patchFileName(filePatch)
		return { name, filetype: resolveFiletype?.(name), patch: filePatch }
	})
}

export const pullRequestDiffKey = (pr: { repository: string; number: number; headRefOid: string }) => `${pr.repository}#${pr.number}:${pr.headRefOid}`

export const safeDiffFileIndex = (files: readonly DiffFilePatch[], index: number) => (files.length > 0 ? Math.max(0, Math.min(index, files.length - 1)) : 0)

export const stackedDiffFileIndexAtLine = (stackedFiles: readonly StackedDiffFilePatch[], line: number) => {
	let low = 0
	let high = stackedFiles.length - 1
	let match = -1
	while (low <= high) {
		const mid = (low + high) >>> 1
		if (stackedFiles[mid]!.headerLine <= line) {
			match = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	return match
}

export const stackedDiffFileAtLine = (stackedFiles: readonly StackedDiffFilePatch[], line: number) => stackedFiles[stackedDiffFileIndexAtLine(stackedFiles, line)]

export const diffFileStats = (file: DiffFilePatch): DiffFileStats => {
	let additions = 0
	let deletions = 0
	let inHunk = false

	for (const line of file.patch.split("\n")) {
		const hunk = line.match(hunkHeaderPattern)
		if (hunk) {
			inHunk = true
			continue
		}

		if (!inHunk) continue
		const firstChar = line[0]
		if (firstChar === "+") additions++
		else if (firstChar === "-") deletions++
	}

	return { additions, deletions }
}

export const diffFileStatsText = (stats: DiffFileStats) => {
	return [stats.additions > 0 ? `+${stats.additions}` : null, stats.deletions > 0 ? `-${stats.deletions}` : null].filter((part): part is string => part !== null).join(" ")
}

export const diffCommentLocationKey = (location: { path: string; side: DiffCommentSide; line: number }) => `${location.path}:${location.side}:${location.line}`

export const diffCommentSideLabel = (anchor: { side: DiffCommentSide }) => (anchor.side === "RIGHT" ? "→" : "←")

export const diffCommentLineLabel = (anchor: { side: DiffCommentSide; line: number }) => `${anchor.side === "RIGHT" ? "+" : "-"}${anchor.line}`

export const diffCommentAnchorLabel = (anchor: { side: DiffCommentSide; line: number }) => `${diffCommentSideLabel(anchor)} ${diffCommentLineLabel(anchor)}`

export const verticalDiffAnchor = <Anchor extends Pick<DiffCommentAnchor, "renderLine" | "side">>(
	anchors: readonly Anchor[],
	currentAnchor: Anchor | null,
	delta: number,
	preferredSide: DiffCommentSide | null = null,
) => {
	if (anchors.length === 0) return null
	const rows = [...new Set(anchors.map((anchor) => anchor.renderLine))].sort((left, right) => left - right)
	const current = currentAnchor && anchors.includes(currentAnchor) ? currentAnchor : anchors[0]!
	const currentRowIndex = Math.max(0, rows.indexOf(current.renderLine))
	const nextRow = rows[Math.max(0, Math.min(rows.length - 1, currentRowIndex + delta))]
	if (nextRow === undefined) return null
	const targetSide = preferredSide ?? current.side
	return anchors.find((anchor) => anchor.renderLine === nextRow && anchor.side === targetSide) ?? anchors.find((anchor) => anchor.renderLine === nextRow) ?? null
}

export const diffAnchorOnSide = <Anchor extends Pick<DiffCommentAnchor, "renderLine" | "side">>(anchors: readonly Anchor[], currentAnchor: Anchor | null, side: DiffCommentSide) =>
	currentAnchor ? (anchors.find((anchor) => anchor.renderLine === currentAnchor.renderLine && anchor.side === side) ?? null) : null

export const nearestDiffAnchorForLocation = <Anchor extends Pick<DiffCommentAnchor, "path" | "line" | "side" | "renderLine">>(
	anchors: readonly Anchor[],
	target: Anchor,
): Anchor | null => {
	const exact = anchors.find((anchor) => anchor.path === target.path && anchor.side === target.side && anchor.line === target.line)
	if (exact) return exact

	const nearestByLine = (candidates: readonly Anchor[]) =>
		candidates.reduce<Anchor | null>((nearest, anchor) => {
			if (!nearest) return anchor
			const distance = Math.abs(anchor.line - target.line)
			const nearestDistance = Math.abs(nearest.line - target.line)
			if (distance < nearestDistance) return anchor
			if (distance === nearestDistance && anchor.renderLine < nearest.renderLine) return anchor
			return nearest
		}, null)

	return (
		nearestByLine(anchors.filter((anchor) => anchor.path === target.path && anchor.side === target.side)) ??
		nearestByLine(anchors.filter((anchor) => anchor.path === target.path)) ??
		null
	)
}

export const nearestDiffCommentAnchorIndex = (anchors: readonly DiffCommentAnchor[], renderLine: number) => {
	if (anchors.length === 0) return 0
	const nextIndex = anchors.findIndex((anchor) => anchor.renderLine >= renderLine)
	return nextIndex >= 0 ? nextIndex : anchors.length - 1
}

export const scrollTopForVisibleLine = (currentTop: number, viewportHeight: number, line: number, margin = 1) => {
	const safeViewportHeight = Math.max(1, viewportHeight)
	if (line < currentTop + margin) return Math.max(0, line - margin)
	if (line >= currentTop + safeViewportHeight - margin) return Math.max(0, line - safeViewportHeight + margin + 1)
	return currentTop
}
