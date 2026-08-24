import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("framekit", {
  choosePhoto: () => ipcRenderer.invoke("choose-photo"),
  openPhoto: (filePath: string) => ipcRenderer.invoke("open-photo", filePath),
  importPhoto: (dataUrl: string, filename: string) => ipcRenderer.invoke("import-photo", dataUrl, filename),
  exportPhoto: (payload: unknown) => ipcRenderer.invoke("export-photo", payload),
  getSettings: () => ipcRenderer.invoke("get-settings"), saveSettings: (settings: unknown) => ipcRenderer.invoke("save-settings", settings),
  listWebsites: () => ipcRenderer.invoke("list-websites"), saveWebsite: (item: unknown) => ipcRenderer.invoke("save-website", item), deleteWebsite: (id: string) => ipcRenderer.invoke("delete-website", id),
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"), closeWindow: () => ipcRenderer.invoke("close-window"), toggleMaximize: () => ipcRenderer.invoke("toggle-maximize"), resizeWindow: (width: number, height: number) => ipcRenderer.invoke("resize-window", width, height),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url), getAppInfo: () => ipcRenderer.invoke("get-app-info"), wgs84ToGcj02: (lat: number, lng: number) => ipcRenderer.invoke("wgs84-to-gcj02", lat, lng), gcj02ToWgs84: (lat: number, lng: number) => ipcRenderer.invoke("gcj02-to-wgs84", lat, lng)
});
