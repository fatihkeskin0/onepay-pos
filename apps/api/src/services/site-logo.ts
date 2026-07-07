import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

const MAX_LOGO_BYTES = 512 * 1024;
const ALLOWED_EXT = new Set(["svg", "png", "webp"]);

const MIME_TO_EXT: Record<string, "svg" | "png" | "webp"> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/webp": "webp",
};

function extFromFilename(name: string): "svg" | "png" | "webp" | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "svg" || ext === "png" || ext === "webp") return ext;
  return null;
}

function detectExt(filename: string, bytes: Buffer): "svg" | "png" | "webp" {
  const fromName = extFromFilename(filename);
  if (fromName) return fromName;

  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes.length >= 12 && bytes.slice(0, 4).toString("ascii") === "RIFF") return "webp";
  if (bytes.length >= 5 && bytes.toString("utf8", 0, 5).toLowerCase().includes("<svg")) return "svg";

  throw new Error("Desteklenmeyen logo formatı (SVG, PNG, WebP)");
}

function sitesDir(): string {
  return join(config.upload.dir, "sites");
}

async function removeExistingSiteLogos(siteId: number): Promise<void> {
  const dir = sitesDir();
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  const prefix = `${siteId}.`;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => unlink(join(dir, name)).catch(() => undefined)),
  );
}

export async function saveSiteLogo(
  siteId: number,
  filename: string,
  contentBase64: string,
): Promise<string> {
  const raw = contentBase64.trim();
  if (!raw) throw new Error("Logo dosyası boş");

  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new Error("Geçersiz logo dosyası");
  if (buffer.length > MAX_LOGO_BYTES) throw new Error("Logo en fazla 512 KB olabilir");

  const ext = detectExt(filename, buffer);
  if (!ALLOWED_EXT.has(ext)) throw new Error("Desteklenmeyen logo formatı (SVG, PNG, WebP)");

  if (ext === "svg") {
    const text = buffer.toString("utf8");
    if (/<script/i.test(text)) throw new Error("SVG dosyası güvenlik nedeniyle reddedildi");
  }

  const dir = sitesDir();
  await mkdir(dir, { recursive: true });
  await removeExistingSiteLogos(siteId);

  const storedName = `${siteId}.${ext}`;
  await writeFile(join(dir, storedName), buffer);

  return `/uploads/sites/${storedName}`;
}

export function resolvePublicLogoPath(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  if (
    storedUrl.startsWith("http://") ||
    storedUrl.startsWith("https://") ||
    storedUrl.startsWith("data:")
  ) {
    return storedUrl;
  }
  if (storedUrl.startsWith("/uploads/")) return storedUrl;
  if (storedUrl.startsWith("/backend/uploads/")) return storedUrl.replace(/^\/backend/, "");
  return storedUrl;
}

export { MIME_TO_EXT };
