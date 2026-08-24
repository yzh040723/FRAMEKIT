import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { deleteWebsite, getSettings, listWebsites, saveSettings, saveWebsite } from "./storage";
import { exportPhoto, importPhoto, openPhoto } from "./photos";
import type { ExifFields, Website } from "./types";

let mainWindow: BrowserWindow | null = null;
let maximized = false;
const webDir = path.join(__dirname, "..", "web");

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1280, height: 820, minWidth: 760, minHeight: 520, frame: false, show: false, backgroundColor: "#101318", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  mainWindow.loadFile(path.join(webDir, "index.html")); mainWindow.once("ready-to-show", () => mainWindow?.show()); mainWindow.on("closed", () => { mainWindow = null; });
}
function registerIpc() {
  ipcMain.handle("choose-photo", async () => { const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openFile"], filters: [{ name: "JPEG 图片", extensions: ["jpg", "jpeg"] }] }); return result.canceled ? { ok: false, canceled: true } : openPhoto(result.filePaths[0]); });
  ipcMain.handle("open-photo", (_e, filePath: string) => openPhoto(filePath)); ipcMain.handle("import-photo", (_e, dataUrl: string, filename: string) => importPhoto(dataUrl, filename));
  ipcMain.handle("export-photo", async (_e, payload: { src: string; fields: ExifFields; defaultName: string }) => { const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: payload.defaultName, filters: [{ name: "JPEG 图片", extensions: ["jpg"] }] }); return result.canceled || !result.filePath ? { ok: false, canceled: true } : exportPhoto(payload.src, result.filePath, payload.fields); });
  ipcMain.handle("get-settings", getSettings); ipcMain.handle("save-settings", (_e, settings) => saveSettings(settings)); ipcMain.handle("list-websites", listWebsites); ipcMain.handle("save-website", (_e, item: Website) => saveWebsite(item)); ipcMain.handle("delete-website", (_e, id: string) => deleteWebsite(id));
  function coordinate(lat: number, lng: number, inverse: boolean) { if (!(73.66 < lng && lng < 135.05 && 3.86 < lat && lat < 53.55)) return { lat, lng }; const pi = Math.PI, x = lng - 105, y = lat - 35, a = 6378245, ee = 0.006693421622965943; let dLat = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x)); let dLng = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x)); dLat += (20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3 + (20*Math.sin(y*pi)+40*Math.sin(y/3*pi))*2/3 + (160*Math.sin(y/12*pi)+320*Math.sin(y*pi/30))*2/3; dLng += (20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3 + (20*Math.sin(x*pi)+40*Math.sin(x/3*pi))*2/3 + (150*Math.sin(x/12*pi)+300*Math.sin(x/30*pi))*2/3; const rad = lat/180*pi, magic = 1-ee*Math.sin(rad)**2, sqrt = Math.sqrt(magic); dLat = dLat*180/((a*(1-ee))/(magic*sqrt)*pi); dLng = dLng*180/(a/sqrt*Math.cos(rad)*pi); const sign = inverse ? -1 : 1; return { lat: lat + sign*dLat, lng: lng + sign*dLng }; }
  ipcMain.handle("wgs84-to-gcj02", (_e, lat: number, lng: number) => coordinate(lat, lng, false)); ipcMain.handle("gcj02-to-wgs84", (_e, lat: number, lng: number) => coordinate(lat, lng, true));
  ipcMain.handle("minimize-window", () => mainWindow?.minimize()); ipcMain.handle("close-window", () => mainWindow?.close()); ipcMain.handle("toggle-maximize", () => { if (!mainWindow) return; maximized = !mainWindow.isMaximized(); maximized ? mainWindow.maximize() : mainWindow.unmaximize(); return { ok: true, maximized }; }); ipcMain.handle("resize-window", (_e, width: number, height: number) => mainWindow?.setSize(Math.max(760, Math.round(width)), Math.max(520, Math.round(height))));
  ipcMain.handle("open-external", (_e, url: string) => /^https?:\/\//i.test(url) ? shell.openExternal(url) : false); ipcMain.handle("get-app-info", () => ({ title: "FRAMEKIT 摄影工具箱", version: app.getVersion() }));
}
app.whenReady().then(() => { registerIpc(); createWindow(); app.on("activate", () => { if (!mainWindow) createWindow(); }); }); app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
