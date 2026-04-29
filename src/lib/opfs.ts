import type { Qgis2webProject } from "../types/project";

const PROJECT_FILE = "last-project.json";
const QUOTA_WARNING_RATIO = 0.82;

export type OpfsSaveResult = {
  warning?: string;
};

export async function saveProjectToOpfs(project: Qgis2webProject): Promise<OpfsSaveResult> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return {};
  }
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(PROJECT_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(project));
  await writable.close();
  return { warning: await storageQuotaWarning() };
}

export async function loadProjectFromOpfs(): Promise<Qgis2webProject | null> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(PROJECT_FILE);
    const file = await handle.getFile();
    return JSON.parse(await file.text()) as Qgis2webProject;
  } catch {
    return null;
  }
}

async function storageQuotaWarning(): Promise<string | undefined> {
  if (!navigator.storage.estimate) {
    return undefined;
  }
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  if (!quota || usage / quota < QUOTA_WARNING_RATIO) {
    return undefined;
  }
  return `Browser storage is ${Math.round((usage / quota) * 100)}% full. Export a ZIP backup before importing more large data.`;
}
