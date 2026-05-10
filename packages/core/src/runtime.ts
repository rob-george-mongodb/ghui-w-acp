import { Layer } from "effect"
import type { AppConfig } from "./config.js"
import { AppConfigService } from "./config.js"
import { Observability } from "./observability.js"
import { BrowserOpener } from "./services/BrowserOpener.js"
import { CacheService } from "./services/CacheService.js"
import { Clipboard } from "./services/Clipboard.js"
import { CommandRunner } from "./services/CommandRunner.js"
import { GitHubService } from "./services/GitHubService.js"
import { MockGitHubService, type MockOptions } from "./services/MockGitHubService.js"

export interface CoreLayerOptions {
	readonly appConfig: AppConfig
	readonly mock?: MockOptions | undefined
}

export const makeCoreLayer = (options: CoreLayerOptions) => {
	const configLayer = Layer.succeed(AppConfigService, AppConfigService.of(options.appConfig))
	const commandLayer = CommandRunner.layer

	const githubLayer = options.mock ? MockGitHubService.layer(options.mock) : GitHubService.layerNoDeps.pipe(Layer.provide(commandLayer), Layer.provide(configLayer))

	const cacheLayer = options.mock ? CacheService.disabledLayer : CacheService.layerFromPath(options.appConfig.cachePath)
	const clipboardLayer = Clipboard.layerNoDeps.pipe(Layer.provide(commandLayer))
	const browserLayer = BrowserOpener.layerNoDeps.pipe(Layer.provide(commandLayer))
	const observabilityLayer = Observability.layer

	return Layer.mergeAll(githubLayer, cacheLayer, clipboardLayer, browserLayer, commandLayer, configLayer, observabilityLayer)
}
