import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { exiftool } from "exiftool-vendored";
import type { ExifFields, OpenPhotoResult } from "./types";

const JPG = /\.(jpe?g)$/i;

function ensurePhoto(filePath: string): void { if (!JPG.test(filePath)) throw new Error("仅支持 JPG / JPEG 格式图片"); }
function first(value: unknown): unknown { return Array.isArray(value) ? value[0] : value; }
function numberValue(value: unknown): number | null { const n = Number(first(value)); return Number.isFinite(n) ? n : null; }
function shutterText(value: unknown): string | null { const n = numberValue(value); if (n === null) return null; return n < 1 ? `1/${Math.round(1 / n)}` : String(n); }

async function readFields(filePath: string): Promise<ExifFields> {
  const tags: any = await (exiftool as any).read(filePath);
  const taken = first(tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate);
  const text = (v: unknown) => v == null ? null : String(v).replace(/:/g, "-").replace(/-/, ":").replace(/-/, ":").slice(0, 16);
  return {
    taken_at: text(taken), iso: numberValue(tags.ISO), ev: numberValue(tags.ExposureCompensation),
    shutter: shutterText(tags.ExposureTime), aperture: numberValue(tags.FNumber), focal35: numberValue(tags.FocalLengthIn35mmFormat),
    lat: numberValue(tags.GPSLatitude), lng: numberValue(tags.GPSLongitude), altitude: numberValue(tags.GPSAltitude), focal: numberValue(tags.FocalLength),
    make: tags.Make ? String(tags.Make).trim() : null, model: tags.Model ? String(tags.Model).trim() : null, serial: tags.SerialNumber ? String(tags.SerialNumber).trim() : null
  };
}

export async function openPhoto(filePath: string): Promise<OpenPhotoResult> {
  ensurePhoto(filePath); const image = sharp(filePath); const meta = await image.metadata(); const preview = await image.clone().resize({ width: 900, height: 900, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  return { ok: true, path: filePath, name: path.basename(filePath), size: (await fs.stat(filePath)).size, width: meta.width, height: meta.height, preview: `data:image/jpeg;base64,${preview.toString("base64")}`, exif: await readFields(filePath) };
}

export async function importPhoto(dataUrl: string, filename: string): Promise<OpenPhotoResult> {
  const encoded = dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : dataUrl; const bytes = Buffer.from(encoded, "base64"); if (bytes.subarray(0, 3).compare(Buffer.from([0xff, 0xd8, 0xff])) !== 0) throw new Error("仅支持 JPG / JPEG 图片");
  const dir = path.join(os.tmpdir(), "framekit_uploads"); await fs.mkdir(dir, { recursive: true }); const safe = path.basename(filename).match(JPG) ? path.basename(filename) : "upload.jpg"; const target = path.join(dir, `${Date.now()}_${safe}`); await fs.writeFile(target, bytes); return openPhoto(target);
}

function toTags(fields: ExifFields): Record<string, unknown> {
  const tags: Record<string, unknown> = {}; if (fields.taken_at) { const t = fields.taken_at.replace("T", " ").replace(/-/g, ":") + ":00"; tags.DateTimeOriginal = t; tags.CreateDate = t; tags.ModifyDate = t; }
  if (fields.iso != null) tags.ISO = fields.iso; if (fields.ev != null) tags.ExposureCompensation = fields.ev; if (fields.shutter) tags.ExposureTime = fields.shutter; if (fields.aperture != null) tags.FNumber = fields.aperture; if (fields.focal35 != null) tags.FocalLengthIn35mmFormat = fields.focal35; if (fields.lat != null) tags.GPSLatitude = fields.lat; if (fields.lng != null) tags.GPSLongitude = fields.lng; if (fields.altitude != null) tags.GPSAltitude = fields.altitude; if (fields.make) tags.Make = fields.make; if (fields.model) tags.Model = fields.model; if (fields.serial) tags.SerialNumber = fields.serial; return tags;
}

export async function exportPhoto(src: string, dst: string, fields: ExifFields) {
  ensurePhoto(src); ensurePhoto(dst); if (path.resolve(src) === path.resolve(dst)) throw new Error("导出文件不能覆盖原图"); await fs.copyFile(src, dst); await (exiftool as any).write(dst, toTags(fields), ["-overwrite_original"]); const stat = await fs.stat(src); await fs.utimes(dst, stat.atime, stat.mtime); return { ok: true, path: dst, name: path.basename(dst) };
}
