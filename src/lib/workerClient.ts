import type { Qgis2webProject, StudioWorkerResponse, VirtualFile } from "../types/project";

export function parseProjectInWorker(files: VirtualFile[]): Promise<Qgis2webProject> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../worker/studioWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<StudioWorkerResponse>) => {
      worker.terminate();
      if (event.data.type === "parsed") {
        resolve(event.data.project);
      } else {
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Worker import gagal."));
    };
    worker.postMessage({ type: "parse", files });
  });
}
