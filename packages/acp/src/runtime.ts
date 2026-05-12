import { Layer } from "effect"
import { ACPService, ACPConfigService, type ACPConfig } from "./services/ACPService.js"
import { ACPStore } from "./services/ACPStore.js"
import { ReviewWatcher } from "./services/ReviewWatcher.js"

export interface ACPLayerOptions {
	readonly storePath: string | null
	readonly agentConfig?: ACPConfig
}

const defaultACPConfig: ACPConfig = {
	agents: [{ name: "opencode", command: ["opencode", "acp"] }],
	storePath: null,
}

export const makeACPLayer = (options: ACPLayerOptions): Layer.Layer<ACPService | ACPStore> => {
	const resolvedConfig: ACPConfig = {
		...(options.agentConfig ?? defaultACPConfig),
		storePath: options.storePath,
	}
	const configLayer = Layer.succeed(ACPConfigService, resolvedConfig)
	const storeLayer = ACPStore.layerFromPath(options.storePath)
	const watcherLayer = ReviewWatcher.layer.pipe(Layer.provide(storeLayer))
	const acpLayer = ACPService.layer.pipe(Layer.provide(configLayer), Layer.provide(storeLayer), Layer.provide(watcherLayer))
	return Layer.mergeAll(acpLayer, storeLayer)
}
