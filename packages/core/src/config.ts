import { readFileSync } from "node:fs"
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

const defaultAcpStorePath = () => join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ghui", "acp.sqlite")

const resolveAcpStorePath = () => {
	const value = process.env.GHUI_ACP_STORE_PATH?.trim()
	if (value === "off" || value === "0" || value === "false") return null
	return value && value.length > 0 ? value : defaultAcpStorePath()
}

interface AcpAgentConfig {
	readonly name: string
	readonly command: readonly string[]
	readonly defaultModel?: string
}

interface AcpConfig {
	readonly agents: readonly AcpAgentConfig[]
	readonly defaultAgent?: string
}

export interface GhuiJsonConfig {
	readonly repoMappings?: Record<string, string>
	readonly acp?: AcpConfig
	readonly worktreeRoot?: string
}

const defaultConfigFilePath = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "ghui", "ghui.json")

const loadJsonConfig = (): GhuiJsonConfig => {
	const configPath = defaultConfigFilePath()
	try {
		const content = readFileSync(configPath, "utf8")
		return JSON.parse(content) as GhuiJsonConfig
	} catch {
		return {}
	}
}

export const ghuiJsonConfig: GhuiJsonConfig = loadJsonConfig()

export interface AppConfig {
	readonly prFetchLimit: number
	readonly prPageSize: number
	readonly cachePath: string | null
	readonly acpStorePath: string | null
	readonly prUpdatedSinceWindow: PullRequestUpdatedSinceWindow
	readonly jsonConfig: GhuiJsonConfig
}

export class AppConfigService extends Context.Service<AppConfigService, AppConfig>()("ghui/AppConfig") {}

const appConfig = Config.all({
	prFetchLimit: Config.int("GHUI_PR_FETCH_LIMIT").pipe(Config.withDefault(200), Config.map(positiveIntOr(200))),
	prPageSize: Config.int("GHUI_PR_PAGE_SIZE").pipe(Config.withDefault(50), Config.map(pageSizeOr(50))),
	cachePath: Config.succeed(resolveCachePath()),
	acpStorePath: Config.succeed(resolveAcpStorePath()),
	prUpdatedSinceWindow: Config.string("GHUI_PR_UPDATED_SINCE").pipe(
		Config.withDefault("1m"),
		Config.map((v): PullRequestUpdatedSinceWindow => {
			const valid = ["1m", "3m", "1y", "any"] as const
			return (valid as readonly string[]).includes(v) ? (v as PullRequestUpdatedSinceWindow) : "1m"
		}),
	),
	jsonConfig: Config.succeed(ghuiJsonConfig),
})

export const resolveAppConfig = Effect.gen(function* () {
	return yield* appConfig
})

export const AppConfigLive = Layer.effect(AppConfigService, resolveAppConfig)
