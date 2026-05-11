import { app, BrowserWindow } from "electron"
import { join } from "node:path"
import { setupIpcHandlers } from "./ipc.js"
import type { AppConfig } from "@ghui/core/node"

const appConfig: AppConfig = {
	prFetchLimit: 200,
	prPageSize: 50,
	cachePath: null,
	prUpdatedSinceWindow: "1m",
}

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	})

	if (process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
	}
}

app.whenReady().then(() => {
	setupIpcHandlers(appConfig)
	createWindow()

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit()
})
