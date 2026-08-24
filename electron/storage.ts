import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { Website } from "./types";

function dataRoot(): string { return app.getPath("userData"); }
async function ensureDir(dir: string): Promise<void> { await fs.mkdir(dir, { recursive: true }); }

export async function getSettings(): Promise<{ ok: true; settings: Record<string, unknown> }> {
  const file = path.join(dataRoot(), "settings.json");
  try { return { ok: true, settings: JSON.parse(await fs.readFile(file, "utf8")) }; }
  catch { return { ok: true, settings: { theme: "dark" } }; }
}

export async function saveSettings(settings: Record<string, unknown>) {
  await ensureDir(dataRoot());
  await fs.writeFile(path.join(dataRoot(), "settings.json"), JSON.stringify(settings, null, 2), "utf8");
  return { ok: true, settings };
}

function websitesRoot(): string { return path.join(dataRoot(), "websites"); }
function safeId(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || `site_${Date.now()}`; }

export async function listWebsites(): Promise<{ ok: true; items: Website[] }> {
  const dir = websitesRoot(); await ensureDir(dir); const names = await fs.readdir(dir);
  const items: Website[] = [];
  for (const name of names.filter(x => x.endsWith(".json"))) {
    try { const item = JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as Website; if (item.url) items.push({ ...item, id: name.slice(0, -5) }); } catch { /* skip invalid files */ }
  }
  return { ok: true, items };
}

export async function saveWebsite(input: Website) {
  const id = safeId(input.id || `site_${Date.now()}`); const item = { name: input.name?.trim() || "未命名网站", description: input.description?.trim() || "", url: /^https?:\/\//i.test(input.url) ? input.url.trim() : `https://${input.url.trim()}` };
  await ensureDir(websitesRoot()); await fs.writeFile(path.join(websitesRoot(), `${id}.json`), JSON.stringify(item, null, 2), "utf8");
  return { ok: true, item: { ...item, id } };
}

export async function deleteWebsite(id: string) { try { await fs.unlink(path.join(websitesRoot(), `${safeId(id)}.json`)); } catch { /* already gone */ } return { ok: true }; }
