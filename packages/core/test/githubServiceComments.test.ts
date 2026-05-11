import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { CommandRunner, type CommandResult, AppConfigService } from "@ghui/core"
import { GitHubService } from "@ghui/core"

const testAppConfig = Layer.succeed(
	AppConfigService,
	AppConfigService.of({ prFetchLimit: 200, prPageSize: 50, cachePath: null, prUpdatedSinceWindow: "1m", jsonConfig: {} }),
)

interface RecordedCall {
	readonly command: string
	readonly args: readonly string[]
}

const fakeCommandRunner = (response: string, recorder: RecordedCall[]) =>
	Layer.succeed(
		CommandRunner,
		CommandRunner.of({
			run: (command, args) => {
				recorder.push({ command, args: [...args] })
				const result: CommandResult = { stdout: response, stderr: "", exitCode: 0 }
				return Effect.succeed(result)
			},
			runSchema: <S extends Schema.Top>(schema: S, command: string, args: readonly string[]) => {
				recorder.push({ command, args: [...args] })
				return Effect.try({
					try: () => JSON.parse(response) as unknown,
					catch: (cause) => cause,
				}).pipe(Effect.flatMap((value) => Schema.decodeUnknownEffect(schema)(value))) as Effect.Effect<S["Type"], never, S["DecodingServices"]>
			},
		}),
	)

const baseIssueResponse = JSON.stringify({
	id: 9001,
	user: { login: "kit" },
	body: "Updated body",
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-02T00:00:00Z",
	html_url: "https://github.com/owner/repo/issues/1#issuecomment-9001",
	url: "https://api.github.com/repos/owner/repo/issues/comments/9001",
})

const baseReviewResponse = JSON.stringify({
	id: 7777,
	node_id: "PRRC_abc",
	user: { login: "kit" },
	body: "Updated review body",
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-02T00:00:00Z",
	path: "src/foo.ts",
	line: 42,
	original_line: 42,
	side: "RIGHT",
	in_reply_to_id: null,
	html_url: "https://github.com/owner/repo/pull/1#discussion_r7777",
	url: "https://api.github.com/repos/owner/repo/pulls/comments/7777",
})

const runWith = <A>(effect: Effect.Effect<A, unknown, GitHubService>, layer: Layer.Layer<GitHubService>) =>
	Effect.runPromise(effect.pipe(Effect.provide(layer)) as Effect.Effect<A>)

describe("GitHubService comment edit/delete", () => {
	test("editPullRequestIssueComment PATCHes the issue comments endpoint", async () => {
		const recorder: RecordedCall[] = []
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(baseIssueResponse, recorder), testAppConfig)))
		const updated = await runWith(
			GitHubService.use((github) => github.editPullRequestIssueComment("owner/repo", "9001", "Updated body")),
			layer,
		)

		expect(updated._tag).toBe("comment")
		expect(updated.body).toBe("Updated body")
		expect(updated.id).toBe("9001")
		expect(recorder).toHaveLength(1)
		expect(recorder[0]!.command).toBe("gh")
		expect(recorder[0]!.args).toEqual(["api", "--method", "PATCH", "repos/owner/repo/issues/comments/9001", "-f", "body=Updated body"])
	})

	test("editReviewComment PATCHes the pulls comments endpoint", async () => {
		const recorder: RecordedCall[] = []
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(baseReviewResponse, recorder), testAppConfig)))
		const updated = await runWith(
			GitHubService.use((github) => github.editReviewComment("owner/repo", "7777", "Updated review body")),
			layer,
		)

		expect(updated._tag).toBe("review-comment")
		expect(updated.body).toBe("Updated review body")
		expect(recorder[0]!.args).toEqual(["api", "--method", "PATCH", "repos/owner/repo/pulls/comments/7777", "-f", "body=Updated review body"])
	})

	test("deletePullRequestIssueComment DELETEs the issue comments endpoint", async () => {
		const recorder: RecordedCall[] = []
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner("", recorder), testAppConfig)))
		await runWith(
			GitHubService.use((github) => github.deletePullRequestIssueComment("owner/repo", "9001")),
			layer,
		)

		expect(recorder).toHaveLength(1)
		expect(recorder[0]!.args).toEqual(["api", "--method", "DELETE", "repos/owner/repo/issues/comments/9001"])
	})

	test("deleteReviewComment DELETEs the pulls comments endpoint", async () => {
		const recorder: RecordedCall[] = []
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner("", recorder), testAppConfig)))
		await runWith(
			GitHubService.use((github) => github.deleteReviewComment("owner/repo", "7777")),
			layer,
		)

		expect(recorder[0]!.args).toEqual(["api", "--method", "DELETE", "repos/owner/repo/pulls/comments/7777"])
	})
})
