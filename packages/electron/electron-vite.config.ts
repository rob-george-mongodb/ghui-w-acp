import { defineConfig } from "electron-vite"
import { resolve } from "node:path"

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: resolve(__dirname, "src/main/index.ts"),
			},
		},
		resolve: {
			alias: {
				"@ghui/core": resolve(__dirname, "../core/src"),
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: resolve(__dirname, "src/preload/index.ts"),
				output: {
					format: "cjs",
					entryFileNames: "[name].js",
				},
			},
		},
	},
	renderer: {
		root: resolve(__dirname, "src/renderer"),
		build: {
			rollupOptions: {
				input: resolve(__dirname, "src/renderer/index.html"),
			},
		},
		resolve: {
			alias: {
				"@ghui/core": resolve(__dirname, "../core/src"),
			},
		},
	},
})
