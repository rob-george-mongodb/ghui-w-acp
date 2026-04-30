#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core"
import { RegistryProvider } from "@effect/atom-react"
import { createRoot } from "@opentui/react"
import { App } from "./App.js"

process.env.OTUI_USE_ALTERNATE_SCREEN = "true"

const renderer = await createCliRenderer({
	exitOnCtrlC: false,
	screenMode: "alternate-screen",
	externalOutputMode: "passthrough",
	onDestroy: () => process.exit(0),
})

createRoot(renderer).render(
	<RegistryProvider>
		<App />
	</RegistryProvider>,
)
