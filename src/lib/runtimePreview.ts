import JSZip from "jszip";
import { exportProjectZip } from "./exportProject";
import { publishPreviewEntries } from "./previewBridge";
import type { Qgis2webProject } from "../types/project";

export type RuntimePreviewBundle = {
  token: string;
  url: string;
};

export async function buildRuntimePreview(project: Qgis2webProject): Promise<RuntimePreviewBundle> {
  const zipBlob = await exportProjectZip(project);
  const zip = await JSZip.loadAsync(zipBlob);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const root = project.name;
  const previewEntries: Array<{ path: string; body: ArrayBuffer; contentType: string }> = [];

  for (const entry of entries) {
    const relativePath = stripRoot(entry.name, root);
    if (!relativePath) continue;
    const body = await entry.async("arraybuffer");
    previewEntries.push({
      path: relativePath,
      body,
      contentType: contentTypeFromPath(relativePath)
    });
  }

  return publishPreviewEntries(previewEntries);
}

function stripRoot(path: string, root: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function contentTypeFromPath(path: string): string {
  if (/\.html?$/i.test(path)) return "text/html";
  if (/\.css$/i.test(path)) return "text/css";
  if (/\.js$/i.test(path)) return "application/javascript";
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.ico$/i.test(path)) return "image/x-icon";
  return "application/octet-stream";
}
