import { homedir } from "node:os"
import { join } from "node:path"
import { Config, Context, Effect, Layer } from "effect"
import type { PullRequestUpdatedSinceWindow } from "./inbox.js"

const positiveIntOr = (fallback: number) => (value: number) => (Number.isFinite(value) && value > 0 ? value : fallback)

const pageSizeOr = (fallback: number) => (value: number) => Math.min(100, positiveIntOr(fallback)(value))

const defaultCachePath = () => join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ghui", "cache.sqlite")

const resolveCachePath = () => {
	const value = process.env.GHUI_CACHE_PATH?.trim()
	if (value === "off" || value === "0" || value === "false") return null
	return value && value.length > 0 ? value : defaultCachePath()
}

export interface AppConfig {
	readonly prFetchLimit: number
	readonly prPageSize: number
	readonly cachePath: string | null
	readonly prUpdatedSinceWindow: PullRequestUpdatedSinceWindow
}

export class AppConfigService extends Context.Service<AppConfigService, AppConfig>()("ghui/AppConfig") {}

const appConfig = Config.all({
	prFetchLimit: Config.int("GHUI_PR_FETCH_LIMIT").pipe(Config.withDefault(200), Config.map(positiveIntOr(200))),
	prPageSize: Config.int("GHUI_PR_PAGE_SIZE").pipe(Config.withDefault(50), Config.map(pageSizeOr(50))),
	cachePath: Config.succeed(resolveCachePath()),
	prUpdatedSinceWindow: Config.string("GHUI_PR_UPDATED_SINCE").pipe(
		Config.withDefault("1m"),
		Config.map((v): PullRequestUpdatedSinceWindow => {
			const valid = ["1m", "3m", "1y", "any"] as const
			return (valid as readonly string[]).includes(v) ? (v as PullRequestUpdatedSinceWindow) : "1m"
		}),
	),
})

export const resolveAppConfig = Effect.gen(function* () {
	return yield* appConfig
})

export const AppConfigLive = Layer.effect(AppConfigService, resolveAppConfig)
