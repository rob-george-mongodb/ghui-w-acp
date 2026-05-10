import { parseColor, pathToFiletype, SyntaxStyle } from "@opentui/core"
import type { PullRequestItem } from "@ghui/core"
import { colors } from "./colors.js"

export {
	type DiffCommentSide,
	DiffView,
	DiffWrapMode,
	DiffWhitespaceMode,
	DiffCommentKind,
	type DiffFilePatch,
	type DiffFileStats,
	type StackedDiffFilePatch,
	type DiffCommentAnchor,
	type StackedDiffCommentAnchor,
	PullRequestDiffState,
	hunkHeaderPattern,
	normalizeHunkLineCounts,
	minimizeWhitespacePatch,
	minimizeWhitespaceDiffFiles,
	safeDiffFileIndex,
	stackedDiffFileIndexAtLine,
	stackedDiffFileAtLine,
	diffFileStats,
	diffFileStatsText,
	diffCommentLocationKey,
	diffCommentSideLabel,
	diffCommentLineLabel,
	diffCommentAnchorLabel,
	verticalDiffAnchor,
	diffAnchorOnSide,
	nearestDiffAnchorForLocation,
	nearestDiffCommentAnchorIndex,
	scrollTopForVisibleLine,
	pullRequestDiffKey,
} from "@ghui/core"

import {
	hunkHeaderPattern,
	diffFileStatsText as diffFileStatsTextLocal,
	type DiffCommentAnchor,
	type DiffFilePatch,
	type DiffView,
	type DiffWrapMode,
	type StackedDiffFilePatch,
	splitPatchFiles as coreSplitPatchFiles,
} from "@ghui/core"

export const splitPatchFiles = (patch: string): readonly DiffFilePatch[] => coreSplitPatchFiles(patch, { resolveFiletype: pathToFiletype })

export const createDiffSyntaxStyle = () =>
	SyntaxStyle.fromStyles({
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

export const diffStatText = (pullRequest: PullRequestItem) => {
	if (!pullRequest.detailLoaded) return "loading details"
	const files = pullRequest.changedFiles === 1 ? "1 file" : `${pullRequest.changedFiles} files`
	const stats = diffFileStatsTextLocal(pullRequest)
	return stats ? `${stats} ${files}` : files
}

type PendingDiffCommentAnchor = Omit<DiffCommentAnchor, "renderLine" | "colorLine">

const diffContentWidth = (lines: readonly string[], view: DiffView, width: number) => {
	const lineNumberGutterWidth = patchLineNumberGutterWidth(lines)
	return view === "split" ? Math.max(1, Math.floor(width / 2) - lineNumberGutterWidth) : Math.max(1, width - lineNumberGutterWidth)
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

export const buildStackedDiffFiles = (files: readonly DiffFilePatch[], view: DiffView, wrapMode: DiffWrapMode, width: number): readonly StackedDiffFilePatch[] => {
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

export const getDiffCommentAnchors = (file: DiffFilePatch, view: DiffView = "unified", wrapMode: DiffWrapMode = "none", width = 120): readonly DiffCommentAnchor[] => {
	const anchors: DiffCommentAnchor[] = []
	const lines = file.patch.split("\n")
	const contentWidth = diffContentWidth(lines, view, width)
	let oldLine = 0
	let newLine = 0
	let renderLine = 0
	let colorLine = 0
	let leftColorLine = 0
	let rightColorLine = 0
	let leftVisualLine = 0
	let rightVisualLine = 0
	let inHunk = false
	let deletions: Array<PendingDiffCommentAnchor & { readonly height: number }> = []
	let additions: Array<PendingDiffCommentAnchor & { readonly height: number }> = []

	const alignSplitSides = () => {
		if (leftVisualLine < rightVisualLine) {
			const pad = rightVisualLine - leftVisualLine
			leftColorLine += pad
			leftVisualLine += pad
		} else if (rightVisualLine < leftVisualLine) {
			const pad = leftVisualLine - rightVisualLine
			rightColorLine += pad
			rightVisualLine += pad
		}
		renderLine = Math.max(leftVisualLine, rightVisualLine)
	}

	const pushSplitRow = (
		deletion: (PendingDiffCommentAnchor & { readonly height: number }) | undefined,
		addition: (PendingDiffCommentAnchor & { readonly height: number }) | undefined,
	) => {
		alignSplitSides()
		if (deletion) anchors.push({ path: deletion.path, line: deletion.line, side: deletion.side, kind: deletion.kind, text: deletion.text, renderLine, colorLine: leftColorLine })
		if (addition) anchors.push({ path: addition.path, line: addition.line, side: addition.side, kind: addition.kind, text: addition.text, renderLine, colorLine: rightColorLine })
		leftColorLine++
		rightColorLine++
		leftVisualLine += deletion?.height ?? 1
		rightVisualLine += addition?.height ?? 1
		renderLine = Math.max(leftVisualLine, rightVisualLine)
	}

	const pushSplitContext = (anchor: PendingDiffCommentAnchor & { readonly height: number }) => {
		alignSplitSides()
		anchors.push({ path: anchor.path, line: anchor.line, side: anchor.side, kind: anchor.kind, text: anchor.text, renderLine, colorLine: rightColorLine })
		leftColorLine++
		rightColorLine++
		leftVisualLine += anchor.height
		rightVisualLine += anchor.height
		renderLine = Math.max(leftVisualLine, rightVisualLine)
	}

	const flushChangeBlock = () => {
		if (deletions.length === 0 && additions.length === 0) return
		if (view === "split") {
			const rowCount = Math.max(deletions.length, additions.length)
			for (let index = 0; index < rowCount; index++) {
				pushSplitRow(deletions[index], additions[index])
			}
		} else {
			for (const deletion of deletions) {
				anchors.push({ path: deletion.path, line: deletion.line, side: deletion.side, kind: deletion.kind, text: deletion.text, renderLine, colorLine })
				renderLine += deletion.height
				colorLine++
			}
			for (const addition of additions) {
				anchors.push({ path: addition.path, line: addition.line, side: addition.side, kind: addition.kind, text: addition.text, renderLine, colorLine })
				renderLine += addition.height
				colorLine++
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
			const anchor = { path: file.name, line: newLine, side: "RIGHT", kind: "context", text, height: estimatedWrappedLineCount(text, contentWidth, wrapMode) } as const
			if (view === "split") {
				pushSplitContext(anchor)
			} else {
				anchors.push({ path: anchor.path, line: anchor.line, side: anchor.side, kind: anchor.kind, renderLine, colorLine, text: anchor.text })
				renderLine += anchor.height
				colorLine++
			}
			oldLine++
			newLine++
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
): readonly (DiffCommentAnchor & { readonly fileIndex: number; readonly localRenderLine: number })[] =>
	stackedFiles.flatMap((stackedFile) =>
		getDiffCommentAnchors(stackedFile.file, view, wrapMode, width).map((anchor) => ({
			...anchor,
			fileIndex: stackedFile.index,
			localRenderLine: anchor.renderLine,
			renderLine: stackedFile.diffStartLine + anchor.renderLine,
		})),
	)
