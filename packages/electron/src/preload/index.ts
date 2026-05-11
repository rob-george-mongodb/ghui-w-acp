import { contextBridge, ipcRenderer } from "electron"
import type { IpcChannel, IpcChannels } from "../shared/ipcProtocol.js"

const electronAPI = {
	invoke: <C extends IpcChannel>(channel: C, ...args: IpcChannels[C]["args"]): Promise<IpcChannels[C]["result"]> =>
		ipcRenderer.invoke(channel, ...args),
}

export type ElectronAPI = typeof electronAPI

contextBridge.exposeInMainWorld("electronAPI", electronAPI)
