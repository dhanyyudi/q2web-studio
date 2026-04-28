import { parseQgis2webProject } from "../lib/qgis2webParser";
import type { StudioWorkerMessage, StudioWorkerResponse } from "../types/project";

self.onmessage = (event: MessageEvent<StudioWorkerMessage>) => {
  try {
    if (event.data.type === "parse") {
      const project = parseQgis2webProject(event.data.files);
      const response: StudioWorkerResponse = { type: "parsed", project };
      self.postMessage(response);
    }
  } catch (error) {
    const response: StudioWorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Gagal memproses folder qgis2web."
    };
    self.postMessage(response);
  }
};
