import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
	CommandRunner,
	type CommandResult,
	AppConfigService,
	GitHubService,
	RateLimitError,
	isRateLimitError,
	parseRetryAfterSeconds,
	parsePullRequestSummary,
	parsePullRequest,
	getCheckInfoFromContexts,
	pullRequestPage,
	STATUS_CHECKS_LIMIT,
} from "@ghui/core"

const testAppConfig = (overrides: Partial<{ prFetchLimit: number; prPageSize: number }> = {}) =>
	Layer.succeed(
		AppConfigService,
		AppConfigService.of({ prFetchLimit: overrides.prFetchLimit ?? 200, prPageSize: overrides.prPageSize ?? 50, cachePath: null }),
	)

interface RecordedCall {
	readonly command: string
	readonly args: readonly string[]
}

const fakeCommandRunner = (responses: string | string[], recorder: RecordedCall[]) => {
	let callIndex = 0
	const responseList = Array.isArray(responses) ? responses : [responses]
	return Layer.succeed(
		CommandRunner,
		CommandRunner.of({
			run: (command, args) => {
				recorder.push({ command, args: [...args] })
				const response = responseList[Math.min(callIndex++, responseList.length - 1)]!
				const result: CommandResult = { stdout: response, stderr: "", exitCode: 0 }
				return Effect.succeed(result)
			},
			runSchema: <S extends Schema.Top>(schema: S, command: string, args: readonly string[]) => {
				recorder.push({ command, args: [...args] })
				const response = responseList[Math.min(callIndex++, responseList.length - 1)]!
				return Effect.try({
					try: () => JSON.parse(response) as unknown,
					catch: (cause) => cause,
				}).pipe(Effect.flatMap((value) => Schema.decodeUnknownEffect(schema)(value))) as Effect.Effect<S["Type"], never, S["DecodingServices"]>
			},
		}),
	)
}

const failingCommandRunner = (stderr: string, exitCode: number) =>
	Layer.succeed(
		CommandRunner,
		CommandRunner.of({
			run: (command, args) => {
				const result: CommandResult = { stdout: "", stderr, exitCode }
				return Effect.succeed(result)
			},
			runSchema: <S extends Schema.Top>(schema: S, command: string, args: readonly string[]) => {
				const result: CommandResult = { stdout: "", stderr, exitCode }
				return Effect.succeed(result) as unknown as Effect.Effect<S["Type"], never, S["DecodingServices"]>
			},
		}),
	)

const runWith = <A>(effect: Effect.Effect<A, unknown, GitHubService>, layer: Layer.Layer<GitHubService>) =>
	Effect.runPromise(effect.pipe(Effect.provide(layer)) as Effect.Effect<A>)

const makeSummaryNode = (overrides: Partial<Record<string, unknown>> = {}) => ({
	number: 1,
	title: "Test PR",
	isDraft: false,
	reviewDecision: "APPROVED",
	autoMergeRequest: null,
	state: "OPEN",
	merged: false,
	createdAt: "2026-01-01T00:00:00Z",
	closedAt: null,
	url: "https://github.com/owner/repo/pull/1",
	author: { login: "testuser" },
	headRefOid: "abc123",
	headRefName: "feature-branch",
	repository: { nameWithOwner: "owner/repo" },
	...overrides,
})

const makeDetailNode = (overrides: Partial<Record<string, unknown>> = {}) => ({
	...makeSummaryNode(overrides),
	body: "PR description",
	labels: { nodes: [{ name: "bug", color: "ff0000" }] },
	additions: 10,
	deletions: 5,
	changedFiles: 3,
})

const makeSearchResponse = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) =>
	JSON.stringify({
		data: {
			search: {
				nodes,
				pageInfo: { hasNextPage, endCursor },
			},
		},
	})

const makeRepoResponse = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) =>
	JSON.stringify({
		data: {
			repository: {
				pullRequests: {
					nodes,
					pageInfo: { hasNextPage, endCursor },
				},
			},
		},
	})

describe("parsePullRequestSummary", () => {
	test("parses a minimal summary node", () => {
		const node = makeSummaryNode()
		const result = parsePullRequestSummary(node as any)
		expect(result.number).toBe(1)
		expect(result.title).toBe("Test PR")
		expect(result.author).toBe("testuser")
		expect(result.repository).toBe("owner/repo")
		expect(result.state).toBe("open")
		expect(result.reviewStatus).toBe("approved")
		expect(result.detailLoaded).toBe(false)
		expect(result.body).toBe("")
	})

	test("handles draft PR", () => {
		const result = parsePullRequestSummary(makeSummaryNode({ isDraft: true }) as any)
		expect(result.reviewStatus).toBe("draft")
	})

	test("handles merged state", () => {
		const result = parsePullRequestSummary(makeSummaryNode({ merged: true, state: "MERGED" }) as any)
		expect(result.state).toBe("merged")
	})

	test("handles closed state", () => {
		const result = parsePullRequestSummary(makeSummaryNode({ merged: false, state: "CLOSED" }) as any)
		expect(result.state).toBe("closed")
	})

	test("handles null reviewDecision", () => {
		const result = parsePullRequestSummary(makeSummaryNode({ reviewDecision: null }) as any)
		expect(result.reviewStatus).toBe("none")
	})

	test("handles autoMergeRequest present", () => {
		const result = parsePullRequestSummary(makeSummaryNode({ autoMergeRequest: { enabledAt: "2026-01-01" } }) as any)
		expect(result.autoMergeEnabled).toBe(true)
	})

	test("handles missing statusCheckRollup", () => {
		const result = parsePullRequestSummary(makeSummaryNode() as any)
		expect(result.checkStatus).toBe("none")
		expect(result.checks).toEqual([])
	})

	test("handles statusCheckRollup with checks", () => {
		const node = makeSummaryNode({
			statusCheckRollup: {
				contexts: {
					nodes: [
						{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
						{ __typename: "StatusContext", context: "deploy", state: "SUCCESS" },
					],
				},
			},
		})
		const result = parsePullRequestSummary(node as any)
		expect(result.checkStatus).toBe("passing")
		expect(result.checks).toHaveLength(2)
	})
})

describe("parsePullRequest", () => {
	test("parses a detail node with all fields", () => {
		const result = parsePullRequest(makeDetailNode() as any)
		expect(result.body).toBe("PR description")
		expect(result.labels).toEqual([{ name: "bug", color: "#ff0000" }])
		expect(result.additions).toBe(10)
		expect(result.deletions).toBe(5)
		expect(result.changedFiles).toBe(3)
		expect(result.detailLoaded).toBe(true)
	})

	test("handles label with null color", () => {
		const node = makeDetailNode()
		;(node as any).labels = { nodes: [{ name: "wip", color: null }] }
		const result = parsePullRequest(node as any)
		expect(result.labels).toEqual([{ name: "wip", color: null }])
	})
})

describe("getCheckInfoFromContexts", () => {
	test("returns none for empty contexts", () => {
		const result = getCheckInfoFromContexts([])
		expect(result.checkStatus).toBe("none")
		expect(result.checkSummary).toBeNull()
		expect(result.checksLimitHit).toBe(false)
	})

	test("all passing", () => {
		const contexts: any[] = [
			{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
			{ __typename: "CheckRun", name: "lint", status: "COMPLETED", conclusion: "SUCCESS" },
		]
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checkStatus).toBe("passing")
		expect(result.checkSummary).toBe("checks 2/2")
		expect(result.checksLimitHit).toBe(false)
	})

	test("one failing", () => {
		const contexts: any[] = [
			{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
			{ __typename: "CheckRun", name: "lint", status: "COMPLETED", conclusion: "FAILURE" },
		]
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checkStatus).toBe("failing")
		expect(result.checkSummary).toBe("checks 1/2")
	})

	test("one pending", () => {
		const contexts: any[] = [
			{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
			{ __typename: "CheckRun", name: "deploy", status: "IN_PROGRESS", conclusion: null },
		]
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checkStatus).toBe("pending")
		expect(result.checkSummary).toBe("checks 1/2")
	})

	test("flags checksLimitHit when exactly at limit", () => {
		const contexts: any[] = Array.from({ length: STATUS_CHECKS_LIMIT }, (_, i) => ({
			__typename: "CheckRun",
			name: `check-${i}`,
			status: "COMPLETED",
			conclusion: "SUCCESS",
		}))
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checksLimitHit).toBe(true)
		expect(result.checkSummary).toContain("+")
	})

	test("StatusContext types are handled", () => {
		const contexts: any[] = [{ __typename: "StatusContext", context: "ci/circleci", state: "SUCCESS" }]
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checkStatus).toBe("passing")
		expect(result.checks[0]!.name).toBe("ci/circleci")
	})

	test("StatusContext PENDING maps to in_progress", () => {
		const contexts: any[] = [{ __typename: "StatusContext", context: "deploy", state: "PENDING" }]
		const result = getCheckInfoFromContexts(contexts)
		expect(result.checkStatus).toBe("pending")
	})
})

describe("pullRequestPage", () => {
	test("filters null nodes", () => {
		const connection = {
			nodes: [makeSummaryNode(), null, makeSummaryNode({ number: 2 })],
			pageInfo: { hasNextPage: true, endCursor: "cursor1" },
		}
		const page = pullRequestPage(connection as any, parsePullRequestSummary as any)
		expect(page.items).toHaveLength(2)
		expect(page.hasNextPage).toBe(true)
		expect(page.endCursor).toBe("cursor1")
	})

	test("hasNextPage is false when endCursor is null", () => {
		const connection = {
			nodes: [makeSummaryNode()],
			pageInfo: { hasNextPage: true, endCursor: null },
		}
		const page = pullRequestPage(connection as any, parsePullRequestSummary as any)
		expect(page.hasNextPage).toBe(false)
	})
})

describe("isRateLimitError", () => {
	test("detects rate limit message", () => {
		expect(isRateLimitError("API rate limit exceeded for user")).toBe(true)
		expect(isRateLimitError("secondary rate limit")).toBe(true)
		expect(isRateLimitError("abuse detection mechanism")).toBe(true)
		expect(isRateLimitError("retry after 60 seconds")).toBe(true)
	})

	test("does not trigger on normal errors", () => {
		expect(isRateLimitError("Not Found")).toBe(false)
		expect(isRateLimitError("permission denied")).toBe(false)
	})
})

describe("parseRetryAfterSeconds", () => {
	test("extracts seconds from message", () => {
		expect(parseRetryAfterSeconds("Please retry after 60 seconds")).toBe(60)
	})

	test("returns null when no match", () => {
		expect(parseRetryAfterSeconds("rate limit exceeded")).toBeNull()
	})
})

describe("GitHubService.listOpenPullRequestPage", () => {
	test("fetches a page of search results", async () => {
		const recorder: RecordedCall[] = []
		const response = makeSearchResponse([makeSummaryNode()], false, null)
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(response, recorder), testAppConfig())))

		const page = await runWith(
			GitHubService.use((gh) => gh.listOpenPullRequestPage({ mode: "authored", repository: null, cursor: null, pageSize: 50 })),
			layer,
		)

		expect(page.items).toHaveLength(1)
		expect(page.items[0]!.number).toBe(1)
		expect(page.hasNextPage).toBe(false)
	})

	test("passes cursor for pagination", async () => {
		const recorder: RecordedCall[] = []
		const response = makeSearchResponse([makeSummaryNode()], false, null)
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(response, recorder), testAppConfig())))

		await runWith(
			GitHubService.use((gh) => gh.listOpenPullRequestPage({ mode: "authored", repository: null, cursor: "abc123", pageSize: 50 })),
			layer,
		)

		const args = recorder[0]!.args
		expect(args).toContain("after=abc123")
	})

	test("uses repository query for repository mode", async () => {
		const recorder: RecordedCall[] = []
		const response = makeRepoResponse([makeSummaryNode()])
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(response, recorder), testAppConfig())))

		await runWith(
			GitHubService.use((gh) => gh.listOpenPullRequestPage({ mode: "repository", repository: "owner/repo", cursor: null, pageSize: 50 })),
			layer,
		)

		const args = recorder[0]!.args
		expect(args).toContain("owner=owner")
		expect(args).toContain("name=repo")
	})

	test("clamps page size to 1-100", async () => {
		const recorder: RecordedCall[] = []
		const response = makeSearchResponse([makeSummaryNode()])
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(response, recorder), testAppConfig())))

		await runWith(
			GitHubService.use((gh) => gh.listOpenPullRequestPage({ mode: "authored", repository: null, cursor: null, pageSize: 200 })),
			layer,
		)

		const firstArg = recorder[0]!.args.find((a) => a.startsWith("first="))
		expect(firstArg).toBe("first=100")
	})
})

describe("GitHubService.listOpenPullRequests (paginatePages)", () => {
	test("fetches multiple pages until hasNextPage is false", async () => {
		const recorder: RecordedCall[] = []
		const page1 = makeSearchResponse([makeSummaryNode({ number: 1 })], true, "cursor1")
		const page2 = makeSearchResponse([makeSummaryNode({ number: 2 })], false, null)
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner([page1, page2], recorder), testAppConfig())))

		const items = await runWith(GitHubService.use((gh) => gh.listOpenPullRequests("authored", null)), layer)

		expect(items).toHaveLength(2)
		expect(recorder).toHaveLength(2)
	})

	test("stops at prFetchLimit", async () => {
		const recorder: RecordedCall[] = []
		const nodes = Array.from({ length: 3 }, (_, i) => makeSummaryNode({ number: i + 1 }))
		const page1 = makeSearchResponse(nodes, true, "cursor1")
		const page2 = makeSearchResponse(nodes, true, "cursor2")
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner([page1, page2], recorder), testAppConfig({ prFetchLimit: 5 }))))

		const items = await runWith(GitHubService.use((gh) => gh.listOpenPullRequests("authored", null)), layer)

		expect(items.length).toBeLessThanOrEqual(6)
		expect(recorder).toHaveLength(2)
	})

	test("stops when endCursor is null even if hasNextPage is true", async () => {
		const recorder: RecordedCall[] = []
		const response = makeSearchResponse([makeSummaryNode()], true, null)
		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(fakeCommandRunner(response, recorder), testAppConfig())))

		const items = await runWith(GitHubService.use((gh) => gh.listOpenPullRequests("authored", null)), layer)

		expect(items).toHaveLength(1)
		expect(recorder).toHaveLength(1)
	})
})

describe("rate limit error handling", () => {
	test("CommandRunner raises RateLimitError for rate-limited gh output", async () => {
		const runner = Layer.succeed(
			CommandRunner,
			CommandRunner.of({
				run: (command, args) => {
					return Effect.fail(
						new RateLimitError({ command, args: [...args], detail: "API rate limit exceeded", retryAfterSeconds: 60 }),
					) as any
				},
				runSchema: <S extends Schema.Top>(_schema: S, command: string, args: readonly string[]) => {
					return Effect.fail(
						new RateLimitError({ command, args: [...args], detail: "API rate limit exceeded", retryAfterSeconds: 60 }),
					) as any
				},
			}),
		)

		const layer = GitHubService.layerNoDeps.pipe(Layer.provide(Layer.merge(runner, testAppConfig())))

		let caughtTag: string | undefined
		await Effect.runPromise(
			GitHubService.use((gh) => gh.listOpenPullRequestPage({ mode: "authored", repository: null, cursor: null, pageSize: 50 })).pipe(
				Effect.provide(layer),
				Effect.catch((e: any) => {
					caughtTag = e._tag
					return Effect.void
				}),
			),
		)

		expect(caughtTag).toBe("RateLimitError")
	})
})
