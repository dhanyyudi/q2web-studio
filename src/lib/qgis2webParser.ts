import type { Feature, FeatureCollection } from "geojson";
import {
  defaultBasemaps,
  defaultBranding,
  defaultLayerStyle,
  defaultLegendSettings,
  defaultMapSettings,
  defaultPopupSettings,
  defaultRuntimeSettings,
  defaultSidebarSettings,
  defaultTheme
} from "./defaults";
import { opacityFromRgba, rgbaToHex } from "./colors";
import type { BasemapConfig, LayerLabelConfig, LayerManifest, LegendSymbolType, PopupField, PopupTemplate, Qgis2webProject, RuntimeWidget, RuntimeWidgetId, VirtualFile } from "../types/project";
import { isFeatureCollection } from "../types/project";

type ParsedDataFile = {
  path: string;
  variable: string;
  geojson: FeatureCollection;
};

type ParsedOverlay = {
  layerVariable: string;
  label: string;
  legendRows: ParsedLegendRow[];
  treeGroup?: string;
};

type ParsedLegendRow = {
  label: string;
  imagePath: string;
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
  const layerControlVariables = parseLayerControlVariables(indexHtml);
  const basemaps = parseBasemaps(indexHtml);
  const widgets = parseWidgets(indexHtml, files);
  const labels = parseLayerLabels(indexHtml, files);
  const popupTemplates = parsePopupTemplates(indexHtml);
  const layerVars = parseLayerVariables(indexHtml);
  const layerByDataVar = new Map(layerVars.map((entry) => [entry.dataVariable, entry]));

  const layers: LayerManifest[] = dataFiles.map((dataFile, index) => {
    const feature = dataFile.geojson.features.find(Boolean) as Feature | undefined;
    const geometryType = feature?.geometry?.type || "Unknown";
    const layerInfo = layerByDataVar.get(dataFile.variable);
    const layerVariable = layerInfo?.layerVariable || variableToLayerVariable(dataFile.variable);
    const collectionName = collectionNameOf(dataFile.geojson);
    const overlay = overlays.get(layerVariable);
    const displayName =
      overlay?.label ||
      prettifyLayerName(collectionName || dataFile.variable.replace(/^json_/, ""));
    const importedPopupTemplate = popupTemplates.get(layerVariable);
    const popupFields = importedPopupTemplate?.fields.length ? importedPopupTemplate.fields : buildPopupFields(dataFile.geojson);
    const style = {
      ...defaultLayerStyle(geometryType, index),
      ...parseStyleForLayer(indexHtml, layerVariable, geometryType, overlay?.legendRows || [])
    };

      return {
        id: dataFile.variable.replace(/^json_/, ""),
        displayName,
        sourcePath: dataFile.path,
        dataVariable: dataFile.variable,
        layerVariable,
        geometryType,
        visible: indexHtml.includes(`map.addLayer(${layerVariable})`),
        showInLayerControl: overlays.size === 0 && layerControlVariables.size === 0 ? true : overlays.has(layerVariable) || layerControlVariables.has(layerVariable),
        layerTreeGroup: overlay?.treeGroup,
        popupEnabled: indexHtml.includes(`onEachFeature: pop_${layerVariable.replace(/^layer_/, "")}`),
        legendEnabled: Boolean(overlay?.legendRows.length || style.categories?.length || overlay),

      popupFields,
      popupTemplate: importedPopupTemplate,
      label: labels.get(layerVariable),
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
    mapSettings: {
      ...defaultMapSettings,
      basemap: basemaps.find((basemap) => basemap.default)?.id || defaultMapSettings.basemap,
      initialBounds: parseInitialBounds(indexHtml)
    },
    basemaps: basemaps.length ? basemaps : defaultBasemaps,
    runtime: {
      ...defaultRuntimeSettings,
      widgets
    },
    legendSettings: defaultLegendSettings,
    popupSettings: defaultPopupSettings,
    sidebar: defaultSidebarSettings,
    manualLegendItems: [],
    textAnnotations: [],
    diagnostics: detectedEngine === "leaflet" ? [] : ["Parser menemukan export non-Leaflet. MVP hanya mendukung Leaflet."]
  };
}

function parseWidgets(indexHtml: string, files: VirtualFile[]): RuntimeWidget[] {
  const widgetDefinitions: { id: RuntimeWidgetId; label: string; patterns: RegExp[]; assetPatterns?: RegExp[] }[] = [
    { id: "measure", label: "Measure tool", patterns: [/leaflet-measure/i, /L\.Control\.Measure/i], assetPatterns: [/leaflet-measure/i] },
    { id: "photon", label: "Address search", patterns: [/leaflet\.photon/i, /control\.photon/i, /L\.Control\.Photon/i], assetPatterns: [/leaflet\.photon/i, /photon/i] },
    { id: "fullscreen", label: "Fullscreen", patterns: [/Control\.Fullscreen/i, /leaflet-fullscreen/i], assetPatterns: [/fullscreen/i] },
    { id: "scale", label: "Scale bar", patterns: [/L\.control\.scale/i] },
    { id: "hash", label: "URL hash", patterns: [/leaflet-hash/i, /new\s+L\.Hash/i], assetPatterns: [/leaflet-hash/i] },
    { id: "rotatedMarker", label: "Rotated marker", patterns: [/leaflet\.rotatedMarker/i], assetPatterns: [/rotatedMarker/i] },
    { id: "pattern", label: "Pattern fill", patterns: [/leaflet\.pattern/i], assetPatterns: [/leaflet\.pattern/i] },
    { id: "labels", label: "Permanent labels", patterns: [/labelgun/i, /labels\.js/i, /bindTooltip/i], assetPatterns: [/labelgun/i, /labels\.js/i, /rbush/i] },
    { id: "layersTree", label: "Layer tree control", patterns: [/L\.Control\.Layers\.Tree/i, /Layers\.Tree/i], assetPatterns: [/L\.Control\.Layers\.Tree/i] },
    { id: "highlight", label: "Highlight on hover", patterns: [/highlightFeature/i, /resetHighlight/i] }
  ];
  const referencedAssetPaths = referencedAssets(indexHtml, files);
  const searchableText = `${indexHtml}\n${files.map((file) => `${file.path}\n${file.text || ""}`).join("\n")}`;
  return widgetDefinitions
    .map((definition) => {
      const detected = definition.patterns.some((pattern) => pattern.test(searchableText));
      const assetPatterns = definition.assetPatterns || definition.patterns;
      return {
        id: definition.id,
        label: definition.label,
        enabled: detected,
        detected,
        assetPaths: detected
          ? referencedAssetPaths.filter((path) => assetPatterns.some((pattern) => pattern.test(path)))
          : []
      } satisfies RuntimeWidget;
    })
    .filter((widget) => widget.detected);
}

function referencedAssets(indexHtml: string, files: VirtualFile[]): string[] {
  const indexPath = files.find((file) => file.path.endsWith("index.html"))?.path || "index.html";
  const root = indexPath.includes("/") ? indexPath.slice(0, indexPath.lastIndexOf("/") + 1) : "";
  const availablePaths = new Set(files.map((file) => file.path));
  const paths: string[] = [];
  const matches = indexHtml.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/gi);
  for (const match of matches) {
    const raw = match[1];
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("#")) continue;
    const normalized = normalizeAssetPath(`${root}${stripUrlSuffix(raw)}`);
    if (availablePaths.has(normalized) && !paths.includes(normalized)) paths.push(normalized);
  }
  return paths;
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

function parseBasemaps(indexHtml: string): BasemapConfig[] {
  const labelByVariable = new Map<string, string>();
  const orderByVariable = new Map<string, number>();
  const baseMapsBody = indexHtml.match(/var\s+baseMaps\s*=\s*\{([\s\S]*?)\};/)?.[1] || "";
  for (const [index, match] of Array.from(baseMapsBody.matchAll(/["']([^"']+)["']\s*:\s*([A-Za-z0-9_]+)/g)).entries()) {
    labelByVariable.set(match[2], htmlToText(match[1]));
    orderByVariable.set(match[2], index);
  }
  for (const [index, match] of Array.from(indexHtml.matchAll(/\{label:\s*(["'])(.*?)\1,\s*layer:\s*([A-Za-z0-9_]+),\s*radioGroup:\s*['"]bm['"]/gs)).entries()) {
    if (!orderByVariable.has(match[3])) orderByVariable.set(match[3], index);
  }

  const basemapEntries: Array<BasemapConfig & { _variable: string }> = [];
  const tileLayerMatches = indexHtml.matchAll(/var\s+([A-Za-z0-9_]+)\s*=\s*L\.tileLayer\(\s*(['"])(.*?)\2\s*,\s*\{([\s\S]*?)\}\s*\);/g);
  for (const match of tileLayerMatches) {
    const variable = match[1];
    const url = unescapeJsString(match[3]);
    const options = match[4];
    if (!url.includes("/{z}/") && !url.includes("{z}")) continue;
    const normalizedVariable = variable.replace(/^layer_/, "").replace(/^basemap_/, "");
    const id = knownBasemapId(url) || normalizedVariable || `basemap-${basemapEntries.length + 1}`;
    basemapEntries.push({
      _variable: variable,
      id,
      label: labelByVariable.get(variable) || prettifyLayerName(normalizedVariable || variable),
      url,
      attribution: readOptionString(options, "attribution") || "",
      maxZoom: Number.parseInt(readOptionRaw(options, "maxZoom"), 10) || 20,
      default: false,
      enabled: true,
      source: "imported"
    });
  }
  basemapEntries.sort((a, b) => (orderByVariable.get(a._variable) ?? Number.MAX_SAFE_INTEGER) - (orderByVariable.get(b._variable) ?? Number.MAX_SAFE_INTEGER));
  const addedLayerMatch = indexHtml.match(/map\.addLayer\(([^)]+)\)/);
  const defaultVariable = addedLayerMatch?.[1]?.trim() || "";
  basemapEntries.forEach((entry) => {
    entry.default = entry._variable === defaultVariable || entry.id === defaultVariable.replace(/^layer_/, "").replace(/^basemap_/, "");
  });
  const basemaps = basemapEntries.map(({ _variable, ...basemap }) => basemap);

  if (basemaps.length > 0 && !basemaps.some((basemap) => basemap.default)) {
    basemaps[0].default = true;
  }
  return basemaps;
}

function knownBasemapId(url: string): string | null {
  if (url.includes("basemaps.cartocdn.com/rastertiles/voyager")) return "carto-voyager";
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/World_Imagery")) return "esri-imagery";
  if (url.includes("tile.openstreetmap.org")) return "osm";
  return null;
}

function parseLayerLabels(indexHtml: string, files: VirtualFile[]): Map<string, LayerLabelConfig> {
  const labels = new Map<string, LayerLabelConfig>();
  const labelCss = readLabelCss(files);
  const matches = indexHtml.matchAll(/(layer_[A-Za-z0-9_]+)\.bindTooltip\(([\s\S]*?)\{([\s\S]*?)\}\s*\)/g);
  for (const match of matches) {
    const expression = match[2];
    const field = expression.match(/properties\[['"]([^'"]+)['"]\]/)?.[1];
    if (!field) continue;
    const options = match[3];
    const className = readOptionString(options, "className");
    labels.set(match[1], buildLabelConfig(field, options, className, expression, labelCss));
  }
  const eachLayerMatches = indexHtml.matchAll(/(layer_[A-Za-z0-9_]+)\.eachLayer\(function\(layer\)\s*\{([\s\S]*?)\n\s*\}\);/g);
  for (const match of eachLayerMatches) {
    if (labels.has(match[1]) || !match[2].includes("bindTooltip")) continue;
    const body = match[2];
    const field = body.match(/properties\[['"]([^'"]+)['"]\]/)?.[1];
    if (!field) continue;
    const tooltipMatch = body.match(/bindTooltip\(([\s\S]*?),\s*\{([\s\S]*?)\}\s*\)/);
    const expression = tooltipMatch?.[1] || "";
    const options = tooltipMatch?.[2] || "";
    const className = readOptionString(options, "className");
    labels.set(match[1], buildLabelConfig(field, options, className, expression, labelCss));
  }
  return labels;
}

function buildLabelConfig(field: string, options: string, className: string, expression: string, labelCss: Map<string, string>): LayerLabelConfig {
  const htmlTemplate = labelTemplateFromExpression(expression, field);
  return {
    enabled: true,
    field,
    permanent: /permanent\s*:\s*true/.test(options),
    offset: parseOffset(options),
    className,
    htmlTemplate,
    cssText: className ? labelCss.get(className) : undefined,
    fontSize: 12,
    textColor: "#172026",
    haloColor: "#ffffff"
  };
}

function parsePopupTemplates(indexHtml: string): Map<string, PopupTemplate> {
  const templates = new Map<string, PopupTemplate>();
  const popupNames = Array.from(indexHtml.matchAll(/function\s+pop_([A-Za-z0-9_]+)\s*\(/g)).map((match) => match[1]);
  for (const suffix of popupNames) {
    const body = readFunctionBody(indexHtml, `pop_${suffix}`);
    const layerVariable = `layer_${suffix}`;
    const fields = parsePopupFieldsFromBody(body);
    const originalHtml = parsePopupHtmlFromBody(body);
    if (fields.length === 0 && !originalHtml) continue;
    templates.set(layerVariable, {
      mode: "original",
      source: "imported",
      html: fields.length > 0 ? popupHtmlFromFields(fields) : originalHtml,
      fields
    });
  }
  return templates;
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

function parseOverlays(indexHtml: string): Map<string, ParsedOverlay> {
  const overlays = new Map<string, ParsedOverlay>();
  const treeEntries = parseOverlayTreeEntries(indexHtml);
  if (treeEntries.length > 0) {
    for (const entry of treeEntries) {
      overlays.set(entry.layerVariable, entry);
    }
    return overlays;
  }
  const matches = indexHtml.matchAll(/\{label:\s*(['"])(.*?)\1,\s*layer:\s*(layer_[A-Za-z0-9_]+)/gs);
  for (const match of matches) {
    const rawLabel = unescapeJsString(match[2]);
    const label = cleanHtmlLabel(rawLabel);
    overlays.set(match[3], {
      layerVariable: match[3],
      label,
      legendRows: parseLegendRows(rawLabel)
    });
  }
  return overlays;
}

function parseOverlayTreeEntries(indexHtml: string): ParsedOverlay[] {
  const treeMatch = indexHtml.match(/var\s+overlaysTree\s*=\s*(\[[\s\S]*?\])\s*\n\s*var\s+lay\s*=/);
  if (!treeMatch?.[1]) return [];
  return parseOverlayTreeNodeList(treeMatch[1], "Layers");
}

function parseOverlayTreeNodeList(source: string, parentGroup: string): ParsedOverlay[] {
  const entries: ParsedOverlay[] = [];
  let index = source.indexOf("[");
  if (index === -1) return entries;
  index += 1;
  while (index < source.length) {
    const nextObject = source.indexOf("{", index);
    const nextClose = source.indexOf("]", index);
    if (nextObject === -1 || (nextClose !== -1 && nextClose < nextObject)) break;
    const objectEnd = findMatchingDelimiter(source, nextObject, "{", "}");
    if (objectEnd === -1) break;
    const nodeSource = source.slice(nextObject, objectEnd + 1);
    const rawLabel = readTreeNodeLabel(nodeSource);
    const label = cleanHtmlLabel(rawLabel);
    const layerVariable = nodeSource.match(/layer:\s*(layer_[A-Za-z0-9_]+)/)?.[1];
    const childrenStart = nodeSource.indexOf("children:");
    if (childrenStart !== -1) {
      const childArrayStart = nodeSource.indexOf("[", childrenStart);
      if (childArrayStart !== -1) {
        const childArrayEnd = findMatchingDelimiter(nodeSource, childArrayStart, "[", "]");
        if (childArrayEnd !== -1) {
          const groupLabel = label || parentGroup;
          entries.push(...parseOverlayTreeNodeList(nodeSource.slice(childArrayStart, childArrayEnd + 1), groupLabel));
        }
      }
    } else if (layerVariable) {
      entries.push({
        layerVariable,
        label,
        legendRows: parseLegendRows(rawLabel),
        treeGroup: parentGroup
      });
    }
    index = objectEnd + 1;
  }
  return entries;
}

function readTreeNodeLabel(source: string): string {
  const labelMatch = source.match(/label:\s*(['"])([\s\S]*?)\1/);
  return labelMatch ? unescapeJsString(labelMatch[2]) : "";
}

function findMatchingDelimiter(source: string, start: number, openChar: string, closeChar: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }
    if ((char === '"' || char === "'") && previous !== "\\") {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseLayerControlVariables(indexHtml: string): Set<string> {
  const variables = new Set<string>();
  const controlMatches = indexHtml.matchAll(/L\.control\.layers\([\s\S]*?\)\.addTo\(map\)/g);
  for (const match of controlMatches) {
    const layerMatches = match[0].matchAll(/['"][^'"]+['"]\s*:\s*(layer_[A-Za-z0-9_]+)/g);
    for (const layerMatch of layerMatches) {
      variables.add(layerMatch[1]);
    }
  }
  return variables;
}

function parseLayerVariables(indexHtml: string): { layerVariable: string; dataVariable: string }[] {
  const matches = indexHtml.matchAll(/var\s+(layer_[A-Za-z0-9_]+)\s*=\s*new\s+L\.geoJson\((json_[A-Za-z0-9_]+)/g);
  return Array.from(matches).map((match) => ({
    layerVariable: match[1],
    dataVariable: match[2]
  }));
}

function parseStyleForLayer(
  indexHtml: string,
  layerVariable: string,
  geometryType: string,
  legendRows: ParsedLegendRow[]
): Partial<LayerManifest["style"]> {
  const suffix = layerVariable.replace(/^layer_/, "");
  const body = readFunctionBody(indexHtml, `style_${suffix}_0`) || "";
  const symbolType = symbolTypeForStyle(geometryType, body);
  const fillColor = rgbaToHex(readStyleValue(body, "fillColor"), undefined);
  const strokeColor = rgbaToHex(readStyleValue(body, "color"), undefined);
  const fillOpacity = Number.parseFloat(readStyleValue(body, "fillOpacity"));
  const strokeOpacity = opacityFromRgba(readStyleValue(body, "color"), Number.NaN);
  const strokeWidth = Number.parseFloat(readStyleValue(body, "weight"));
  const dashArray = readStyleValue(body, "dashArray");
  const categoryField = readSwitchField(body);
  const categories = parseCategories(body, legendRows, symbolType);

  return {
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(Number.isFinite(fillOpacity) ? { fillOpacity } : {}),
    ...(Number.isFinite(strokeOpacity) ? { strokeOpacity } : {}),
    ...(Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
    ...(dashArray ? { dashArray } : geometryType.includes("Line") ? {} : {}),
    symbolType,
    sourceImagePath: legendRows[0]?.imagePath || "",
    ...(categoryField ? { categoryField } : {}),
    ...(categories.length > 0 ? { categories } : {})
  };
}

function readFunctionBody(source: string, functionName: string): string {
  const signature = source.match(new RegExp(`function\\s+${escapeRegExp(functionName)}\\s*\\([^)]*\\)\\s*\\{`, "m"));
  if (!signature || signature.index === undefined) return "";
  const start = signature.index + signature[0].length;
  let depth = 1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index);
    }
  }
  return "";
}

function readStyleValue(body: string, key: string): string {
  const match = body.match(new RegExp(`${key}:\\s*(?:'([^']*)'|"([^"]*)"|([^,\\n}]+))`, "i"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function readSwitchField(body: string): string {
  const match = body.match(/switch\(String\(feature\.properties\[['"]([^'"]+)['"]\]\)\)/);
  return match?.[1] || "";
}

function parseCategories(
  body: string,
  legendRows: ParsedLegendRow[],
  symbolType: LegendSymbolType
): LayerManifest["style"]["categories"] {
  const caseMatches = Array.from(body.matchAll(/case\s+['"]([^'"]+)['"]:\s*return\s*\{([^]*?)\}\s*break;/g));
  return caseMatches.map((match) => ({
    value: match[1],
    label: legendRows[caseMatches.findIndex((item) => item[1] === match[1])]?.label || match[1],
    fillColor: rgbaToHex(readStyleValue(match[2], "fillColor"), "#3388ff"),
    strokeColor: rgbaToHex(readStyleValue(match[2], "color"), "#1f2937"),
    strokeWidth: Number.parseFloat(readStyleValue(match[2], "weight")) || 2,
    dashArray: readStyleValue(match[2], "dashArray"),
    symbolType,
    sourceImagePath: legendRows[caseMatches.findIndex((item) => item[1] === match[1])]?.imagePath || "",
    visible: true
  }));
}

function parseLegendRows(rawLabel: string): ParsedLegendRow[] {
  const rows = Array.from(rawLabel.matchAll(/<tr[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi));
  if (rows.length > 0) {
    return rows.map((row) => ({
      imagePath: row[1],
      label: htmlToText(row[2])
    }));
  }
  const singleImage = rawLabel.match(/<img[^>]+src=["']([^"']+)["'][^>]*>\s*([^<]*)/i);
  if (singleImage) {
    return [{ imagePath: singleImage[1], label: htmlToText(singleImage[2]) }];
  }
  return [];
}

function parsePopupHtmlFromBody(body: string): string {
  const assigned = body.match(/var\s+popupContent\s*=\s*([\s\S]*?);\s*(?:return|layer\.bindPopup|bindPopup)/)?.[1]?.trim();
  if (!assigned) return "";
  const normalized = assigned.replace(/\\\r?\n\s*/g, "");
  const segments = Array.from(normalized.matchAll(/(['"])(.*?)(?<!\\)\1|feature\.properties\[['"]([^'"]+)['"]\]/g));
  if (segments.length === 0) return "";
  return segments
    .map((segment) => {
      if (segment[3]) return `{{${segment[3]}}}`;
      return unescapeJsString(segment[2] || "");
    })
    .join("");
}

function parsePopupFieldsFromBody(body: string): PopupField[] {
  const fields: PopupField[] = [];
  const rowMatches = body.matchAll(/<tr[\s\S]*?<\/(?:tr)>/g);
  for (const row of rowMatches) {
    const rowText = row[0];
    const fieldMatch = rowText.match(/feature\.properties\[['"]([^'"]+)['"]\]/);
    if (!fieldMatch) continue;
    const strongLabel = rowText.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1];
    const thLabel = rowText.match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1];
    const label = htmlToText(strongLabel || thLabel || prettifyFieldName(fieldMatch[1]));
    fields.push({
      key: fieldMatch[1],
      label,
      visible: true,
      header: Boolean(strongLabel || /colspan=["']2["']/i.test(rowText))
    });
  }
  return dedupePopupFields(fields);
}

function isUsablePopupTemplate(html: string): boolean {
  const normalized = html.trim();
  return Boolean(normalized && /<\w+/.test(normalized) && (/\{\{\s*[A-Za-z0-9_:-]+\s*\}\}/.test(normalized) || /<table|<div|<span|<p/i.test(normalized)));
}

function popupHtmlFromFields(fields: PopupField[]): string {
  const rows = fields
    .map((field) =>
      field.header
        ? `<tr><td colspan="2"><strong>${escapeHtmlText(field.label)}</strong><br>{{${field.key}}}</td></tr>`
        : `<tr><th scope="row">${escapeHtmlText(field.label)}</th><td class="visible-with-data" id="${escapeHtmlText(field.key)}">{{${field.key}}}</td></tr>`
    )
    .join("");
  return `<table>${rows}</table>`;
}

function dedupePopupFields(fields: PopupField[]): PopupField[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
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
  return htmlToText(withoutImages);
}

function readOptionString(options: string, key: string): string {
  return unescapeJsString(readOptionRaw(options, key).replace(/^['"]|['"]$/g, ""));
}

function readOptionRaw(options: string, key: string): string {
  const match = options.match(new RegExp(`${key}\\s*:\\s*('(?:\\\\'|[^'])*'|\"(?:\\\\\"|[^\"])*\"|[^,\\n}]+)`, "i"));
  return (match?.[1] || "").trim();
}

function parseOffset(options: string): [number, number] {
  const match = options.match(/offset\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/);
  return [Number.parseFloat(match?.[1] || "0") || 0, Number.parseFloat(match?.[2] || "0") || 0];
}

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function labelTemplateFromExpression(expression: string, field: string): string | undefined {
  const normalized = expression.trim();
  if (!normalized) return undefined;
  const stringMatch = normalized.match(/String\((['"])([\s\S]*?)\1\s*\+\s*layer\.feature\.properties\[['"][^'"]+['"]\]\s*\+\s*(['"])([\s\S]*?)\3\)/);
  if (stringMatch) {
    return `${unescapeJsString(stringMatch[2])}{{${field}}}${unescapeJsString(stringMatch[4])}`;
  }
  const qgisStringMatch = normalized.match(/String\((['"])([\s\S]*?)\1\s*\+\s*layer\.feature\.properties\[['"][^'"]+['"]\]\)\s*\+\s*(['"])([\s\S]*?)\3/);
  if (qgisStringMatch) {
    return `${unescapeJsString(qgisStringMatch[2])}{{${field}}}${unescapeJsString(qgisStringMatch[4])}`;
  }
  const simpleConcatMatch = normalized.match(/(['"])([\s\S]*?)\1\s*\+\s*layer\.feature\.properties\[['"][^'"]+['"]\]\s*\+\s*(['"])([\s\S]*?)\3/);
  if (simpleConcatMatch) {
    return `${unescapeJsString(simpleConcatMatch[2])}{{${field}}}${unescapeJsString(simpleConcatMatch[4])}`;
  }
  return undefined;
}

function readLabelCss(files: VirtualFile[]): Map<string, string> {
  const css = files
    .filter((file) => file.kind === "text" && file.text && file.path.endsWith(".css"))
    .map((file) => file.text || "")
    .join("\n");
  const rules = new Map<string, string>();
  for (const match of css.matchAll(/\.([A-Za-z0-9_-]+)\s*\{([\s\S]*?)\}/g)) {
    rules.set(match[1], match[2].trim());
  }
  return rules;
}

function htmlToText(value: string): string {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.innerHTML = value;
    return (div.textContent || div.innerText || "").trim();
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unescapeJsString(value: string): string {
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function symbolTypeForStyle(geometryType: string, body: string): LegendSymbolType {
  if (geometryType.includes("Line")) return "line";
  if (geometryType.includes("Point")) return "point";
  const fillOpacity = Number.parseFloat(readStyleValue(body, "fillOpacity"));
  const fillEnabled = readStyleValue(body, "fill");
  if (Number.isFinite(fillOpacity) && fillOpacity <= 0) return "line";
  if (fillEnabled === "false") return "line";
  return "polygon";
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

function parseInitialBounds(indexHtml: string): [[number, number], [number, number]] | undefined {
  const match = indexHtml.match(/\.fitBounds\(\s*\[\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*,\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*\]\s*\)/);
  if (!match) return undefined;
  const values = match.slice(1).map((value) => Number.parseFloat(value));
  if (values.some((value) => !Number.isFinite(value))) return undefined;
  return [
    [values[0], values[1]],
    [values[2], values[3]]
  ];
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
