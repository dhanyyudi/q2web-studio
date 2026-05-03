import type { LayerManifest, ProjectLayer, RasterImageLayer, RasterPmtilesLayer, RasterWmsLayer } from "../types/project";

export function isVectorLayer(layer: ProjectLayer): layer is LayerManifest {
  return layer.kind == null || layer.kind === "vector";
}

export function isRasterImageLayer(layer: ProjectLayer): layer is RasterImageLayer {
  return layer.kind === "raster-image";
}

export function isRasterWmsLayer(layer: ProjectLayer): layer is RasterWmsLayer {
  return layer.kind === "raster-wms";
}

export function isRasterPmtilesLayer(layer: ProjectLayer): layer is RasterPmtilesLayer {
  return layer.kind === "raster-pmtiles";
}

export function normalizeProjectLayerKind<T extends ProjectLayer>(layer: T): T {
  if (layer.kind == null) return { ...layer, kind: "vector" } as T;
  return layer;
}
