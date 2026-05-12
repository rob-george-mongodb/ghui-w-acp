import { Layer } from "effect"
import { type AppConfig, AppConfigService, BrowserOpener, CacheService, Clipboard, GitHubService, Observability } from "@ghui/core/node"
import { NodeCommandRunner } from "./nodeCommandRunner.js"

export const makeElectronCoreLayer = (options: { appConfig: AppConfig }) => {
	const configLayer = Layer.succeed(AppConfigService, AppConfigService.of(options.appConfig))
	const commandLayer = NodeCommandRunner.layer
	const githubLayer = GitHubService.layerNoDeps.pipe(Layer.provide(commandLayer), Layer.provide(configLayer))
	const cacheLayer = CacheService.disabledLayer
	const clipboardLayer = Clipboard.layerNoDeps.pipe(Layer.provide(commandLayer))
	const browserLayer = BrowserOpener.layerNoDeps.pipe(Layer.provide(commandLayer))
	const observabilityLayer = Observability.layer

	return Layer.mergeAll(githubLayer, cacheLayer, clipboardLayer, browserLayer, commandLayer, configLayer, observabilityLayer)
}
