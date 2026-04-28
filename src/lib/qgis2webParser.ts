import type { Feature, FeatureCollection } from "geojson";
import { defaultBranding, defaultLayerStyle, defaultTheme } from "./defaults";
import { opacityFromRgba, rgbaToHex } from "./colors";
import type { LayerManifest, PopupField, Qgis2webProject, VirtualFile } from "../types/project";
import { isFeatureCollection } from "../types/project";

type ParsedDataFile = {
  path: string;
  variable: string;
  geojson: FeatureCollection;
};

export function parseQgis2webProject(files: VirtualFile[]): Qgis2webProject {
  const indexFile = files.find((file) => file.path.endsWith("index.html") && file.text);
  if (!indexFile?.text) {
    throw new Error("Folder tidak memiliki index.html qgis2web.");
  }

  const fileMap = Object.fromEntries(files.map((file) => [file.path, file]));
  const dataFiles = parseDataFiles(files);
  if (dataFiles.length === 0) {
    throw new Error("Tidak ada file data/*.js GeoJSON qgis2web yang dapat dibaca.");
  }

  const indexHtml = indexFile.text;
  const detectedEngine = indexHtml.includes("L.map(") || indexHtml.includes("leaflet") ? "leaflet" : "unknown";
  const overlays = parseOverlays(indexHtml);
  const layerVars = parseLayerVariables(indexHtml);
  const layerByDataVar = new Map(layerVars.map((entry) => [entry.dataVariable, entry]));

  const layers: LayerManifest[] = dataFiles.map((dataFile, index) => {
    const feature = dataFile.geojson.features.find(Boolean) as Feature | undefined;
    const geometryType = feature?.geometry?.type || "Unknown";
    const layerInfo = layerByDataVar.get(dataFile.variable);
    const layerVariable = layerInfo?.layerVariable || variableToLayerVariable(dataFile.variable);
    const collectionName = collectionNameOf(dataFile.geojson);
    const displayName =
      overlays.get(layerVariable) ||
      prettifyLayerName(collectionName || dataFile.variable.replace(/^json_/, ""));
    const popupFields = buildPopupFields(dataFile.geojson);
    const style = {
      ...defaultLayerStyle(geometryType, index),
      ...parseStyleForLayer(indexHtml, layerVariable, geometryType)
    };

    return {
      id: dataFile.variable.replace(/^json_/, ""),
      displayName,
      sourcePath: dataFile.path,
      dataVariable: dataFile.variable,
      layerVariable,
      geometryType,
      visible: indexHtml.includes(`map.addLayer(${layerVariable})`),
      showInLayerControl: overlays.has(layerVariable),
      popupEnabled: indexHtml.includes(`onEachFeature: pop_${layerVariable.replace(/^layer_/, "")}`),
      legendEnabled: true,
      popupFields,
      style,
      geojson: normalizeFeatureIds(dataFile.geojson)
    };
  });

  const title = parseTitle(indexHtml) || "Peta WebGIS Interaktif";

  return {
    name: rootFolderName(files) || "qgis2web-project",
    engine: detectedEngine,
    importedAt: new Date().toISOString(),
    files: fileMap,
    indexHtmlPath: indexFile.path,
    layers,
    branding: {
      ...defaultBranding,
      title,
      subtitle: "Diedit dengan qgis2web Studio"
    },
    theme: defaultTheme,
    manualLegendItems: [],
    textAnnotations: [],
    diagnostics: detectedEngine === "leaflet" ? [] : ["Parser menemukan export non-Leaflet. MVP hanya mendukung Leaflet."]
  };
}

function parseDataFiles(files: VirtualFile[]): ParsedDataFile[] {
  return files
    .filter((file) => file.path.includes("/data/") && file.path.endsWith(".js") && file.text)
    .map((file) => {
      const text = file.text || "";
      const match = text.match(/^\s*var\s+([A-Za-z0-9_]+)\s*=\s*/);
      if (!match) {
        return null;
      }
      const jsonText = text.slice(match[0].length).replace(/;\s*$/, "");
      try {
        const geojson = JSON.parse(jsonText);
        if (!isFeatureCollection(geojson)) {
          return null;
        }
        return {
          path: file.path,
          variable: match[1],
          geojson
        };
      } catch {
        return null;
      }
    })
    .filter((file): file is ParsedDataFile => Boolean(file));
}

function parseOverlays(indexHtml: string): Map<string, string> {
  const overlays = new Map<string, string>();
  const matches = indexHtml.matchAll(/\{label:\s*(['"])(.*?)\1,\s*layer:\s*(layer_[A-Za-z0-9_]+)/gs);
  for (const match of matches) {
    overlays.set(match[3], cleanHtmlLabel(match[2]));
  }
  return overlays;
}

function parseLayerVariables(indexHtml: string): { layerVariable: string; dataVariable: string }[] {
  const matches = indexHtml.matchAll(/var\s+(layer_[A-Za-z0-9_]+)\s*=\s*new\s+L\.geoJson\((json_[A-Za-z0-9_]+)/g);
  return Array.from(matches).map((match) => ({
    layerVariable: match[1],
    dataVariable: match[2]
  }));
}

function parseStyleForLayer(indexHtml: string, layerVariable: string, geometryType: string): Partial<LayerManifest["style"]> {
  const suffix = layerVariable.replace(/^layer_/, "");
  const styleMatch = indexHtml.match(new RegExp(`function\\s+style_${escapeRegExp(suffix)}[^]*?\\n\\s*}\\n\\s*map\\.createPane`));
  const body = styleMatch?.[0] || "";
  const fillColor = rgbaToHex(readStyleValue(body, "fillColor"), undefined);
  const strokeColor = rgbaToHex(readStyleValue(body, "color"), undefined);
  const fillOpacity = Number.parseFloat(readStyleValue(body, "fillOpacity"));
  const strokeOpacity = opacityFromRgba(readStyleValue(body, "color"), Number.NaN);
  const strokeWidth = Number.parseFloat(readStyleValue(body, "weight"));
  const dashArray = readStyleValue(body, "dashArray");
  const categoryField = readSwitchField(body);
  const categories = parseCategories(body);

  return {
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(Number.isFinite(fillOpacity) ? { fillOpacity } : {}),
    ...(Number.isFinite(strokeOpacity) ? { strokeOpacity } : {}),
    ...(Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
    ...(dashArray ? { dashArray } : geometryType.includes("Line") ? {} : {}),
    ...(categoryField ? { categoryField } : {}),
    ...(categories.length > 0 ? { categories } : {})
  };
}

function readStyleValue(body: string, key: string): string {
  const match = body.match(new RegExp(`${key}:\\s*(['"]?)([^'",\\n}]+(?:,[^'"}]+)?|[^'"}]+)\\1`, "i"));
  return match?.[2]?.trim() || "";
}

function readSwitchField(body: string): string {
  const match = body.match(/switch\(String\(feature\.properties\[['"]([^'"]+)['"]\]\)\)/);
  return match?.[1] || "";
}

function parseCategories(body: string): LayerManifest["style"]["categories"] {
  const caseMatches = Array.from(body.matchAll(/case\s+['"]([^'"]+)['"]:\s*return\s*\{([^]*?)}\s*break;/g));
  return caseMatches.map((match) => ({
    value: match[1],
    label: match[1],
    fillColor: rgbaToHex(readStyleValue(match[2], "fillColor"), "#3388ff"),
    strokeColor: rgbaToHex(readStyleValue(match[2], "color"), "#1f2937"),
    visible: true
  }));
}

function buildPopupFields(geojson: FeatureCollection): PopupField[] {
  const keys = new Set<string>();
  for (const feature of geojson.features.slice(0, 25)) {
    Object.keys(feature.properties || {}).forEach((key) => keys.add(key));
  }
  return Array.from(keys).map((key, index) => ({
    key,
    label: prettifyFieldName(key),
    visible: !key.startsWith("q2wHide_"),
    header: index === 0
  }));
}

function normalizeFeatureIds(geojson: FeatureCollection): FeatureCollection {
  const collectionName = collectionNameOf(geojson);
  return {
    ...geojson,
    features: geojson.features.map((feature, index) => ({
      ...feature,
      id: feature.id ?? `${collectionName || "layer"}-${index}`,
      properties: {
        ...(feature.properties || {}),
        __q2ws_id: feature.id ?? `${collectionName || "layer"}-${index}`
      }
    }))
  };
}

function cleanHtmlLabel(label: string): string {
  const layerOnly = label.split(/<br\s*\/?>/i)[0] || label;
  const withoutImages = layerOnly.replace(/<img[^>]*>/gi, "");
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.innerHTML = withoutImages;
    return (div.textContent || div.innerText || "").trim();
  }
  return withoutImages.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function prettifyLayerName(name: string): string {
  return name
    .replace(/^json_/, "")
    .replace(/_\d+$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
}

function prettifyFieldName(name: string): string {
  return name
    .replace(/^q2wHide_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function variableToLayerVariable(variable: string): string {
  return `layer_${variable.replace(/^json_/, "")}`;
}

function parseTitle(indexHtml: string): string {
  return indexHtml.match(/<title>(.*?)<\/title>/i)?.[1]?.trim() || "";
}

function rootFolderName(files: VirtualFile[]): string {
  const first = files[0]?.path || "";
  return first.includes("/") ? first.split("/")[0] : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectionNameOf(geojson: FeatureCollection): string {
  return ((geojson as FeatureCollection & { name?: string }).name || "").trim();
}
