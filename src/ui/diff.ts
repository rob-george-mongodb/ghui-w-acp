import { parseColor, SyntaxStyle } from "@opentui/core"
import { Data, Schema } from "effect"
import type { DiffCommentSide, PullRequestItem, PullRequestReviewComment } from "../domain.js"
import { colors } from "./colors.js"

export const DiffView = Schema.Literals(["unified", "split"])
export type DiffView = Schema.Schema.Type<typeof DiffView>

export const DiffWrapMode = Schema.Literals(["none", "word"])
export type DiffWrapMode = Schema.Schema.Type<typeof DiffWrapMode>

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

export const createDiffSyntaxStyle = () => SyntaxStyle.fromStyles({
	keyword: { fg: parseColor(colors.accent), bold: true },
	"keyword.import": { fg: parseColor(colors.accent), bold: true },
	string: { fg: parseColor(colors.inlineCode) },
	comment: { fg: parseColor(colors.muted), italic: true },
	number: { fg: parseColor(colors.status.review) },
	boolean: { fg: parseColor(colors.status.review) },
	constant: { fg: parseColor(colors.status.review) },
	function: { fg: parseColor(colors.status.passing) },
	"function.call": { fg: parseColor(colors.status.passing) },
	constructor: { fg: parseColor(colors.status.draft) },
	type: { fg: parseColor(colors.status.draft) },
	operator: { fg: parseColor(colors.status.failing) },
	variable: { fg: parseColor(colors.text) },
	property: { fg: parseColor(colors.status.review) },
	bracket: { fg: parseColor(colors.text) },
	punctuation: { fg: parseColor(colors.text) },
	default: { fg: parseColor(colors.text) },
})

const extensionFiletypes: Record<string, string> = {
	c: "c",
	cc: "cpp",
	cpp: "cpp",
	cs: "csharp",
	css: "css",
	go: "go",
	h: "c",
	hpp: "cpp",
	html: "html",
	java: "java",
	js: "javascript",
	jsx: "javascript",
	json: "json",
	kt: "kotlin",
	md: "markdown",
	mjs: "javascript",
	py: "python",
	rs: "rust",
	rb: "ruby",
	sh: "bash",
	svelte: "svelte",
	toml: "toml",
	ts: "typescript",
	tsx: "typescript",
	txt: "text",
	vue: "vue",
	yaml: "yaml",
	yml: "yaml",
	zig: "zig",
}

const filetypeForPath = (path: string) => {
	const basename = path.split("/").at(-1) ?? path
	if (basename === "Dockerfile") return "dockerfile"
	const extension = basename.includes(".") ? basename.split(".").at(-1)?.toLowerCase() : undefined
	return extension ? extensionFiletypes[extension] : undefined
}

const unquoteDiffPath = (path: string) => path.replace(/^"|"$/g, "").replace(/^a\//, "").replace(/^b\//, "")

const patchFileName = (patch: string) => {
	const diffLine = patch.split("\n").find((line) => line.startsWith("diff --git "))
	if (diffLine) {
		const match = diffLine.match(/^diff --git\s+(\S+)\s+(\S+)/)
		if (match) {
			const next = unquoteDiffPath(match[2]!)
			if (next !== "/dev/null") return next
			return unquoteDiffPath(match[1]!)
		}
	}

	const nextLine = patch.split("\n").find((line) => line.startsWith("+++ "))
	return nextLine ? unquoteDiffPath(nextLine.slice(4).trim()) : "diff"
}

const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

const formatHunkRange = (start: string, count: number) => `${start},${count}`

const normalizeHunkLineCounts = (patch: string) => {
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

export const splitPatchFiles = (patch: string): readonly DiffFilePatch[] => {
	const trimmed = patch.trimEnd()
	if (trimmed.length === 0) return []

	const matches = [...trimmed.matchAll(/^diff --git .+$/gm)]
	if (matches.length === 0) {
		return [{ name: "diff", filetype: undefined, patch: trimmed }]
	}

	return matches.map((match, index) => {
		const start = match.index ?? 0
		const end = index + 1 < matches.length ? matches[index + 1]!.index ?? trimmed.length : trimmed.length
		const filePatch = normalizeHunkLineCounts(trimmed.slice(start, end).trimEnd())
		const name = patchFileName(filePatch)
		return { name, filetype: filetypeForPath(name), patch: filePatch }
	})
}

export const pullRequestDiffKey = (pullRequest: PullRequestItem) => `${pullRequest.repository}#${pullRequest.number}`

export const safeDiffFileIndex = (files: readonly DiffFilePatch[], index: number) =>
	files.length > 0 ? Math.max(0, Math.min(index, files.length - 1)) : 0

export const buildStackedDiffFiles = (
	files: readonly DiffFilePatch[],
	view: DiffView,
	wrapMode: DiffWrapMode,
	width: number,
): readonly StackedDiffFilePatch[] => {
	let offset = 0
	return files.map((file, index) => {
		const diffHeight = patchRenderableLineCount(file.patch, view, wrapMode, width)
		const separatorBefore = index === 0 ? 0 : 1
		const headerLine = offset + separatorBefore
		const stackedFile = {
			file,
			index,
			headerLine,
			diffStartLine: headerLine + 2,
			diffHeight,
		} satisfies StackedDiffFilePatch
		offset += separatorBefore + 2 + diffHeight
		return stackedFile
	})
}

export const stackedDiffFileAtLine = (stackedFiles: readonly StackedDiffFilePatch[], line: number) =>
	stackedFiles.reduce<StackedDiffFilePatch | undefined>((current, file) => file.headerLine <= line ? file : current, undefined)

export const diffStatText = (pullRequest: PullRequestItem) => {
	if (!pullRequest.detailLoaded) return "loading details"
	const files = pullRequest.changedFiles === 1 ? "1 file" : `${pullRequest.changedFiles} files`
	return [
		pullRequest.additions > 0 ? `+${pullRequest.additions}` : null,
		pullRequest.deletions > 0 ? `-${pullRequest.deletions}` : null,
		files,
	].filter((part): part is string => part !== null).join(" ")
}

export const diffCommentLocationKey = (location: Pick<PullRequestReviewComment, "path" | "side" | "line">) => `${location.path}:${location.side}:${location.line}`

export const diffCommentAnchorKey = diffCommentLocationKey

type PendingDiffCommentAnchor = Omit<DiffCommentAnchor, "renderLine">

const diffContentWidth = (lines: readonly string[], view: DiffView, width: number) => {
	const lineNumberGutterWidth = patchLineNumberGutterWidth(lines)
	return view === "split"
		? Math.max(1, Math.floor(width / 2) - lineNumberGutterWidth)
		: Math.max(1, width - lineNumberGutterWidth)
}

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

export const diffFileStatText = (file: DiffFilePatch) => {
	return diffFileStatsText(diffFileStats(file))
}

export const diffFileStatsText = (stats: DiffFileStats) => {
	return [
		stats.additions > 0 ? `+${stats.additions}` : null,
		stats.deletions > 0 ? `-${stats.deletions}` : null,
	].filter((part): part is string => part !== null).join(" ")
}

export const getDiffCommentAnchors = (file: DiffFilePatch, view: DiffView = "unified", wrapMode: DiffWrapMode = "none", width = 120): readonly DiffCommentAnchor[] => {
	const anchors: DiffCommentAnchor[] = []
	const lines = file.patch.split("\n")
	const contentWidth = diffContentWidth(lines, view, width)
	let oldLine = 0
	let newLine = 0
	let renderLine = 0
	let inHunk = false
	let deletions: Array<PendingDiffCommentAnchor & { readonly height: number }> = []
	let additions: Array<PendingDiffCommentAnchor & { readonly height: number }> = []

	const flushChangeBlock = () => {
		if (deletions.length === 0 && additions.length === 0) return
		if (view === "split") {
			const rowCount = Math.max(deletions.length, additions.length)
			for (let index = 0; index < rowCount; index++) {
				const deletion = deletions[index]
				const addition = additions[index]
				if (deletion) anchors.push({ path: deletion.path, line: deletion.line, side: deletion.side, kind: deletion.kind, text: deletion.text, renderLine })
				if (addition) anchors.push({ path: addition.path, line: addition.line, side: addition.side, kind: addition.kind, text: addition.text, renderLine })
				renderLine += Math.max(deletion?.height ?? 1, addition?.height ?? 1)
			}
		} else {
			for (const deletion of deletions) {
				anchors.push({ path: deletion.path, line: deletion.line, side: deletion.side, kind: deletion.kind, text: deletion.text, renderLine })
				renderLine += deletion.height
			}
			for (const addition of additions) {
				anchors.push({ path: addition.path, line: addition.line, side: addition.side, kind: addition.kind, text: addition.text, renderLine })
				renderLine += addition.height
			}
		}
		deletions = []
		additions = []
	}

	for (const line of lines) {
		const hunk = line.match(hunkHeaderPattern)
		if (hunk) {
			flushChangeBlock()
			oldLine = Number(hunk[1])
			newLine = Number(hunk[3])
			inHunk = true
			continue
		}

		if (!inHunk) continue

		const firstChar = line[0]
		if (firstChar === "\\") continue

		if (firstChar === "+") {
			const text = line.slice(1)
			additions.push({ path: file.name, line: newLine, side: "RIGHT", kind: "addition", text, height: estimatedWrappedLineCount(text, contentWidth, wrapMode) })
			newLine++
			continue
		}

		if (firstChar === "-") {
			const text = line.slice(1)
			deletions.push({ path: file.name, line: oldLine, side: "LEFT", kind: "deletion", text, height: estimatedWrappedLineCount(text, contentWidth, wrapMode) })
			oldLine++
			continue
		}

		if (firstChar === " ") {
			flushChangeBlock()
			const text = line.slice(1)
			anchors.push({ path: file.name, line: newLine, side: "RIGHT", kind: "context", renderLine, text })
			oldLine++
			newLine++
			renderLine += estimatedWrappedLineCount(text, contentWidth, wrapMode)
		}
	}

	flushChangeBlock()
	return anchors
}

export const getStackedDiffCommentAnchors = (
	stackedFiles: readonly StackedDiffFilePatch[],
	view: DiffView = "unified",
	wrapMode: DiffWrapMode = "none",
	width = 120,
): readonly StackedDiffCommentAnchor[] =>
	stackedFiles.flatMap((stackedFile) => getDiffCommentAnchors(stackedFile.file, view, wrapMode, width).map((anchor) => ({
		...anchor,
		fileIndex: stackedFile.index,
		localRenderLine: anchor.renderLine,
		renderLine: stackedFile.diffStartLine + anchor.renderLine,
	})))

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

const estimatedWrappedLineCount = (text: string, width: number, wrapMode: DiffWrapMode) => {
	if (wrapMode === "none") return 1
	return Math.max(1, Math.ceil(Bun.stringWidth(text) / Math.max(1, width)))
}

const patchLineNumberGutterWidth = (lines: readonly string[]) => {
	let maxLineNumber = 1
	let hasSigns = false
	let oldLine = 0
	let newLine = 0

	for (const line of lines) {
		const hunk = line.match(hunkHeaderPattern)
		if (hunk) {
			oldLine = Number(hunk[1])
			newLine = Number(hunk[3])
			maxLineNumber = Math.max(maxLineNumber, oldLine, newLine)
			continue
		}

		const firstChar = line[0]
		if (firstChar === "-") {
			hasSigns = true
			maxLineNumber = Math.max(maxLineNumber, oldLine)
			oldLine++
		} else if (firstChar === "+") {
			hasSigns = true
			maxLineNumber = Math.max(maxLineNumber, newLine)
			newLine++
		} else if (firstChar === " ") {
			maxLineNumber = Math.max(maxLineNumber, oldLine, newLine)
			oldLine++
			newLine++
		}
	}

	const digits = Math.floor(Math.log10(maxLineNumber)) + 1
	return Math.max(3, digits + 2) + (hasSigns ? 2 : 0)
}

export const patchRenderableLineCount = (patch: string, view: DiffView, wrapMode: DiffWrapMode, width: number) => {
	const lines = patch.split("\n")
	const contentWidth = diffContentWidth(lines, view, width)
	let count = 0
	let inHunk = false
	let deletions: number[] = []
	let additions: number[] = []

	const flushChangeBlock = () => {
		if (deletions.length === 0 && additions.length === 0) return
		if (view === "split") {
			const rows = Math.max(deletions.length, additions.length)
			for (let index = 0; index < rows; index++) {
				const deletionCount = index < deletions.length ? deletions[index]! : 1
				const additionCount = index < additions.length ? additions[index]! : 1
				count += Math.max(deletionCount, additionCount)
			}
		} else {
			for (const deletion of deletions) count += deletion
			for (const addition of additions) count += addition
		}
		deletions = []
		additions = []
	}

	for (const line of lines) {
		if (line.startsWith("@@")) {
			flushChangeBlock()
			inHunk = true
			continue
		}

		if (!inHunk) continue

		const firstChar = line[0]
		if (firstChar === "\\") continue

		if (firstChar === "-") {
			deletions.push(estimatedWrappedLineCount(line.slice(1), contentWidth, wrapMode))
			continue
		}

		if (firstChar === "+") {
			additions.push(estimatedWrappedLineCount(line.slice(1), contentWidth, wrapMode))
			continue
		}

		if (firstChar === " ") {
			flushChangeBlock()
			count += estimatedWrappedLineCount(line.slice(1), contentWidth, wrapMode)
		}
	}

	flushChangeBlock()
	return Math.max(1, count)
}
