import { Layer } from "effect"
import type { AppConfig } from "./config.js"
import { AppConfigService } from "./config.js"
import { makeACPLayer } from "@ghui/acp"
import { Observability } from "./observability.js"
import { BrowserOpener } from "./services/BrowserOpener.js"
import { BunCacheService } from "./services/CacheServiceBun.js"
import { Clipboard } from "./services/Clipboard.js"
import { BunCommandRunner } from "./services/CommandRunnerBun.js"
import { GitHubService } from "./services/GitHubService.js"
import { MockGitHubService, type MockOptions } from "./services/MockGitHubService.js"
import { WorktreeService } from "./services/WorktreeService.js"

export interface CoreLayerOptions {
	readonly appConfig: AppConfig
	readonly mock?: MockOptions | undefined
}

export const makeCoreLayer = (options: CoreLayerOptions) => {
	const configLayer = Layer.succeed(AppConfigService, AppConfigService.of(options.appConfig))
	const commandLayer = BunCommandRunner.layer

	const githubLayer = options.mock ? MockGitHubService.layer(options.mock) : GitHubService.layerNoDeps.pipe(Layer.provide(commandLayer), Layer.provide(configLayer))

	const cacheLayer = BunCacheService.layerFromPath(options.mock ? null : options.appConfig.cachePath)
	const clipboardLayer = Clipboard.layerNoDeps.pipe(Layer.provide(commandLayer))
	const browserLayer = BrowserOpener.layerNoDeps.pipe(Layer.provide(commandLayer))
	const observabilityLayer = Observability.layer
	const worktreeLayer = WorktreeService.layer.pipe(Layer.provide(cacheLayer), Layer.provide(configLayer), Layer.provide(commandLayer))

	const acpStorePath = options.mock ? null : options.appConfig.acpStorePath
	const acpAgentConfig = options.appConfig.jsonConfig.acp
	const acpLayer = makeACPLayer({
		storePath: acpStorePath,
		...(acpAgentConfig
			? {
					agentConfig: {
						agents: acpAgentConfig.agents ?? [],
						...(acpAgentConfig.defaultAgent !== undefined ? { defaultAgent: acpAgentConfig.defaultAgent } : {}),
						storePath: acpStorePath,
					},
				}
			: {}),
	})

	return Layer.mergeAll(githubLayer, cacheLayer, clipboardLayer, browserLayer, commandLayer, configLayer, observabilityLayer, worktreeLayer, acpLayer)
}
