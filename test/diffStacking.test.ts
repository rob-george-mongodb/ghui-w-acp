import { describe, expect, test } from "bun:test"
import {
	buildStackedDiffFiles,
	getStackedDiffCommentAnchors,
	nearestDiffCommentAnchorIndex,
	patchRenderableLineCount,
	scrollTopForVisibleLine,
	splitPatchFiles,
} from "../src/ui/diff.ts"

const patch = `diff --git a/one.ts b/one.ts
--- a/one.ts
+++ b/one.ts
@@ -1,2 +1,2 @@
 const a = 1
-const b = 2
+const b = 3
diff --git a/two.ts b/two.ts
--- a/two.ts
+++ b/two.ts
@@ -10,2 +10,3 @@
 const c = 4
+const d = 5
 const e = 6`

describe("stacked diff helpers", () => {
	test("computes file offsets with separated headers", () => {
		const files = splitPatchFiles(patch)
		const stacked = buildStackedDiffFiles(files, "unified", "none", 120)
		const firstHeight = patchRenderableLineCount(files[0]!.patch, "unified", "none", 120)

		expect(stacked).toHaveLength(2)
		expect(stacked[0]).toMatchObject({ index: 0, headerLine: 0, diffStartLine: 2, diffHeight: firstHeight })
		expect(stacked[1]).toMatchObject({ index: 1, headerLine: firstHeight + 3, diffStartLine: firstHeight + 5 })
	})

	test("maps local comment anchors into global stacked lines", () => {
		const stacked = buildStackedDiffFiles(splitPatchFiles(patch), "unified", "none", 120)
		const anchors = getStackedDiffCommentAnchors(stacked, "unified")
		const secondFileAnchor = anchors.find((anchor) => anchor.path === "two.ts" && anchor.line === 11)

		expect(secondFileAnchor?.fileIndex).toBe(1)
		expect(secondFileAnchor?.localRenderLine).toBe(1)
		expect(secondFileAnchor?.renderLine).toBe(stacked[1]!.diffStartLine + 1)
	})

	test("chooses the first anchor at or below the current scroll line", () => {
		const stacked = buildStackedDiffFiles(splitPatchFiles(patch), "unified", "none", 120)
		const anchors = getStackedDiffCommentAnchors(stacked, "unified")

		expect(nearestDiffCommentAnchorIndex(anchors, 0)).toBe(0)
		expect(anchors[nearestDiffCommentAnchorIndex(anchors, stacked[1]!.headerLine)]?.fileIndex).toBe(1)
		expect(nearestDiffCommentAnchorIndex(anchors, Number.MAX_SAFE_INTEGER)).toBe(anchors.length - 1)
	})

	test("keeps visible lines stable while scrolling only near viewport edges", () => {
		expect(scrollTopForVisibleLine(40, 20, 47)).toBe(40)
		expect(scrollTopForVisibleLine(40, 20, 41)).toBe(40)
		expect(scrollTopForVisibleLine(40, 20, 40)).toBe(39)
		expect(scrollTopForVisibleLine(40, 20, 59)).toBe(41)
	})

	test("detects shell diffs as bash", () => {
		const [file] = splitPatchFiles(`diff --git a/script.zsh b/script.zsh
--- a/script.zsh
+++ b/script.zsh
@@ -1,2 +1,2 @@
 echo before
-echo old
+echo new`)

		expect(file?.filetype).toBe("bash")
	})
})
