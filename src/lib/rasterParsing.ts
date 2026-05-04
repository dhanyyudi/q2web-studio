import type { LayerManifest, ProjectLayer, RasterImageLayer, RasterPmtilesLayer, RasterWmsLayer, VirtualFile } from "../types/project";

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

export function parseImageOverlayLayers(indexHtml: string, files: VirtualFile[]): RasterImageLayer[] {
  const indexFile = files.find((file) => file.path.endsWith("index.html"));
  const indexRoot = indexFile?.path.includes("/") ? indexFile.path.slice(0, indexFile.path.lastIndexOf("/") + 1) : "";
  const availablePaths = new Set(files.map((file) => normalizeAssetPath(file.path)));
  const overlayMatches = Array.from(indexHtml.matchAll(/(?:var\s+([A-Za-z0-9_]+)\s*=\s*)?L\.imageOverlay\(\s*(["'])(.*?)\2\s*,\s*\[\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*,\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*\](?:\s*,\s*\{([\s\S]*?)\})?\s*\)/g));
  return overlayMatches.map((match, index) => {
    const rawVariable = match[1] || `layer_raster_image_${index + 1}`;
    const variable = rawVariable.startsWith("layer_") ? rawVariable : `layer_${rawVariable}`;
    const rawPath = unescapeJsString(match[3]);
    const imagePath = resolveAssetPath(indexRoot, rawPath, availablePaths);
    const opacity = Number.parseFloat(readOptionRaw(match[8] || "", "opacity"));
    return {
      id: variable.replace(/^layer_/, ""),
      kind: "raster-image",
      displayName: prettifyRasterName(variable.replace(/^layer_/, "")),
      visible: indexHtml.includes(`map.addLayer(${rawVariable})`) || indexHtml.includes(`map.addLayer(${variable})`) || new RegExp(`${escapeRegExp(rawVariable)}\\.addTo\\(map\\)`).test(indexHtml),
      showInLayerControl: true,
      legendEnabled: false,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      layerVariable: variable,
      imagePath,
      bounds: [
        [Number.parseFloat(match[4]), Number.parseFloat(match[5])],
        [Number.parseFloat(match[6]), Number.parseFloat(match[7])]
      ]
    } satisfies RasterImageLayer;
  });
}

export function parseWmsLayers(indexHtml: string, files: VirtualFile[]): RasterWmsLayer[] {
  const overlayLabels = parseRasterOverlayLabels(indexHtml);
  const matches = Array.from(indexHtml.matchAll(/(?:var\s+([A-Za-z0-9_]+)\s*=\s*)?L\.tileLayer\.wms\(\s*(["'])(.*?)\2\s*,\s*\{([\s\S]*?)\}\s*\)/g));
  return matches.map((match, index) => {
    const rawVariable = match[1] || `layer_raster_wms_${index + 1}`;
    const variable = rawVariable.startsWith("layer_") ? rawVariable : `layer_${rawVariable}`;
    const options = match[4] || "";
    const opacity = Number.parseFloat(readOptionRaw(options, "opacity"));
    return {
      id: variable.replace(/^layer_/, ""),
      kind: "raster-wms",
      displayName: overlayLabels.get(rawVariable) || overlayLabels.get(variable) || prettifyRasterName(variable.replace(/^layer_/, "")),
      visible: indexHtml.includes(`map.addLayer(${rawVariable})`) || indexHtml.includes(`map.addLayer(${variable})`) || new RegExp(`${escapeRegExp(rawVariable)}\\.addTo\\(map\\)`).test(indexHtml),
      showInLayerControl: true,
      legendEnabled: false,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      layerVariable: variable,
      url: unescapeJsString(match[3]),
      layersParam: readOptionRaw(options, "layers") || "",
      format: readOptionRaw(options, "format") || "image/png",
      transparent: readOptionRaw(options, "transparent") !== "false",
      version: readOptionRaw(options, "version") || undefined,
      attribution: readOptionRaw(options, "attribution") || undefined
    } satisfies RasterWmsLayer;
  });
}

export function parsePmtilesLayers(indexHtml: string, files: VirtualFile[]): RasterPmtilesLayer[] {
  const indexFile = files.find((file) => file.path.endsWith("index.html"));
  const indexRoot = indexFile?.path.includes("/") ? indexFile.path.slice(0, indexFile.path.lastIndexOf("/") + 1) : "";
  const availablePaths = new Set(files.map((file) => normalizeAssetPath(file.path)));
  const overlayLabels = parseRasterOverlayLabels(indexHtml);
  const matches = Array.from(indexHtml.matchAll(/(?:var\s+([A-Za-z0-9_]+)\s*=\s*)?(?:pmtiles\.)?leafletRasterLayer\(\s*new\s+(?:pmtiles\.)?PMTiles\(\s*(["'])(.*?)\2\s*\)\s*,\s*\{([\s\S]*?)\}\s*\)/g));
  return matches.map((match, index) => {
    const rawVariable = match[1] || `layer_raster_pmtiles_${index + 1}`;
    const variable = rawVariable.startsWith("layer_") ? rawVariable : `layer_${rawVariable}`;
    const options = match[4] || "";
    const opacity = Number.parseFloat(readOptionRaw(options, "opacity"));
    return {
      id: variable.replace(/^layer_/, ""),
      kind: "raster-pmtiles",
      displayName: overlayLabels.get(rawVariable) || overlayLabels.get(variable) || prettifyRasterName(variable.replace(/^layer_/, "")),
      visible: indexHtml.includes(`map.addLayer(${rawVariable})`) || indexHtml.includes(`map.addLayer(${variable})`) || new RegExp(`${escapeRegExp(rawVariable)}\\.addTo\\(map\\)`).test(indexHtml),
      showInLayerControl: true,
      legendEnabled: false,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      layerVariable: variable,
      url: resolveAssetPath(indexRoot, unescapeJsString(match[3]), availablePaths),
      attribution: readOptionRaw(options, "attribution") || undefined,
      minZoom: numericOption(options, "minZoom"),
      maxZoom: numericOption(options, "maxZoom"),
      sourcePath: resolveAssetPath(indexRoot, unescapeJsString(match[3]), availablePaths)
    } satisfies RasterPmtilesLayer;
  });
}

function parseRasterOverlayLabels(indexHtml: string): Map<string, string> {
  const labels = new Map<string, string>();
  const matches = indexHtml.matchAll(/\{\s*label\s*:\s*(["'])(.*?)\1\s*,\s*layer\s*:\s*([A-Za-z0-9_]+)/g);
  for (const match of matches) labels.set(match[3], match[2]);
  return labels;
}

function numericOption(options: string, key: string): number | undefined {
  const value = Number.parseFloat(readOptionRaw(options, key));
  return Number.isFinite(value) ? value : undefined;
}

function resolveAssetPath(indexRoot: string, rawPath: string, availablePaths: Set<string>): string {
  if (/^(?:https?:)?\/\//i.test(rawPath) || rawPath.startsWith("data:")) return rawPath;
  const normalized = normalizeAssetPath(`${indexRoot}${stripUrlSuffix(rawPath)}`);
  if (availablePaths.has(normalized)) return normalized;
  const withoutRoot = normalizeAssetPath(stripUrlSuffix(rawPath));
  return availablePaths.has(withoutRoot) ? withoutRoot : normalized;
}

function normalizeAssetPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function stripUrlSuffix(path: string): string {
  return path.split("#", 1)[0].split("?", 1)[0];
}

function readOptionRaw(options: string, key: string): string {
  const match = options.match(new RegExp(`${key}\\s*:\\s*('(?:\\\\'|[^'])*'|\"(?:\\\\\"|[^\"])*\"|[^,\\n}]+)`, "i"));
  return (match?.[1] || "").trim().replace(/^["']|["']$/g, "");
}

function unescapeJsString(value: string): string {
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function prettifyRasterName(name: string): string {
  return name.replace(/^raster_?image_?/i, "Raster Image ").replace(/_\d+$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").trim() || "Raster Image";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
