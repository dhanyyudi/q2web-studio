import type { Qgis2webProject } from "../types/project";

const PROJECT_FILE = "last-project.json";

export async function saveProjectToOpfs(project: Qgis2webProject): Promise<void> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return;
  }
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(PROJECT_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(project));
  await writable.close();
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
