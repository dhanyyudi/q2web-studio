import type { FeatureCollection } from "geojson";
import type { LayerManifest } from "../types/project";

type SimplifyResponse = {
  requestId: number;
  simplified: { id: string; geojson: FeatureCollection }[];
};

let worker: Worker | null = null;
let requestId = 0;

export function shouldSimplifyLayer(layer: LayerManifest, zoom: number): boolean {
  const isLineOrPolygon = layer.geometryType.includes("Line") || layer.geometryType.includes("Polygon");
  return isLineOrPolygon && layer.geojson.features.length > 5000 && zoom < 14;
}

export function simplifyTolerance(zoom: number): number {
  if (zoom >= 13) return 0.00004;
  if (zoom >= 11) return 0.00012;
  if (zoom >= 9) return 0.00028;
  return 0.0006;
}

export function simplifyLayersForPreview(layers: LayerManifest[], zoom: number): Promise<Record<string, FeatureCollection>> {
  if (layers.length === 0 || typeof Worker === "undefined") {
    return Promise.resolve({});
  }
  const currentWorker = getWorker();
  const currentRequestId = ++requestId;
  const tolerance = simplifyTolerance(zoom);
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<SimplifyResponse>) => {
      if (event.data.requestId !== currentRequestId) return;
      cleanup();
      resolve(Object.fromEntries(event.data.simplified.map((item) => [item.id, item.geojson])));
    };
    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error || new Error(event.message));
    };
    const cleanup = () => {
      currentWorker.removeEventListener("message", handleMessage);
      currentWorker.removeEventListener("error", handleError);
    };
    currentWorker.addEventListener("message", handleMessage);
    currentWorker.addEventListener("error", handleError);
    currentWorker.postMessage({
      type: "simplify",
      requestId: currentRequestId,
      tolerance,
      layers: layers.map((layer) => ({ id: layer.id, geojson: layer.geojson }))
    });
  });
}

function getWorker(): Worker {
  worker ??= new Worker(new URL("../workers/simplifyWorker.ts", import.meta.url), { type: "module" });
  return worker;
}
