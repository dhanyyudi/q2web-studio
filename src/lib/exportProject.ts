import JSZip from "jszip";
import { allLegendItems, legendGroupsForLayers } from "./style";
import { q2wsCss, q2wsRuntime } from "../runtime/runtime";
import type { LayerManifest, Qgis2webProject, VirtualFile } from "../types/project";

const CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' blob:; img-src \'self\' data: blob: https:; style-src \'self\' blob: \'unsafe-inline\'; script-src \'self\' blob: \'unsafe-inline\' \'unsafe-eval\'; connect-src \'self\' blob: https:;">';

export async function exportProjectZip(project: Qgis2webProject): Promise<Blob> {
  const zip = new JSZip();
  const files = rewriteProjectFiles(project);

  Object.values(files).forEach((file) => {
    if (file.kind === "text") {
      zip.file(file.path, file.text || "");
    } else if (file.buffer) {
      zip.file(file.path, file.buffer);
    }
  });

  zip.file(`${project.name}/q2ws-config.json`, JSON.stringify(buildRuntimeConfig(project), null, 2));
  zip.file(`${project.name}/q2ws-runtime.js`, q2wsRuntime);
  zip.file(`${project.name}/q2ws-custom.css`, q2wsCss);

  return zip.generateAsync({ type: "blob" });
}

export function buildRuntimeConfig(project: Qgis2webProject) {
  return {
    version: 1,
    branding: project.branding,
    theme: project.theme,
    mapSettings: project.mapSettings,
    basemaps: project.basemaps,
    runtime: project.runtime,
    legendSettings: project.legendSettings,
    popupSettings: project.popupSettings,
    sidebar: project.sidebar,
    layers: project.layers.map((layer) => ({
      id: layer.id,
      displayName: layer.displayName,
      layerVariable: layer.layerVariable,
      visible: layer.visible,
      showInLayerControl: layer.showInLayerControl,
      layerTreeGroup: layer.layerTreeGroup,
      popupEnabled: layer.popupEnabled,
      legendEnabled: layer.legendEnabled,
      popupFields: layer.popupFields,
      popupTemplate: layer.popupTemplate,
      popupSettings: layer.popupSettings,
      label: layer.label,
      style: layer.style
    })),
    legend: allLegendItems(project.layers, project.manualLegendItems),
    legendGroups: legendGroupsForLayers(project.layers, project.manualLegendItems),
    textAnnotations: project.textAnnotations
  };
}

function rewriteProjectFiles(project: Qgis2webProject): Record<string, VirtualFile> {
  const files = { ...project.files };
  for (const layer of project.layers) {
    files[layer.sourcePath] = {
      path: layer.sourcePath,
      name: layer.sourcePath.split("/").pop() || layer.sourcePath,
      kind: "text",
      mime: "application/javascript",
      text: serializeDataLayer(layer)
    };
  }

  const disabledAssetPaths = new Set(
    (project.runtime?.widgets || [])
      .filter((widget) => !widget.enabled)
      .flatMap((widget) => widget.assetPaths)
  );
  for (const path of disabledAssetPaths) {
    delete files[path];
  }

  const indexFile = files[project.indexHtmlPath];
  if (indexFile?.text) {
    files[project.indexHtmlPath] = {
      ...indexFile,
      text: patchIndexHtml(indexFile.text, project)
    };
  }

  return files;
}

function serializeDataLayer(layer: LayerManifest): string {
  const clean = {
    ...layer.geojson,
    features: layer.geojson.features.map((feature) => {
      const properties = { ...(feature.properties || {}) };
      delete properties.__q2ws_id;
      return {
        ...feature,
        properties
      };
    })
  };
  return `var ${layer.dataVariable} = ${JSON.stringify(clean)};`;
}

function patchIndexHtml(indexHtml: string, project: Qgis2webProject): string {
  let html = indexHtml;
  if (html.includes("Content-Security-Policy")) {
    html = html.replace(/<meta[^>]+Content-Security-Policy[^>]*>\s*/i, `        ${CSP_META}\n`);
  } else {
    html = html.replace("</head>", `        ${CSP_META}\n    </head>`);
  }
  if (!html.includes("q2ws-custom.css")) {
    html = html.replace("</head>", '        <link rel="stylesheet" href="q2ws-custom.css">\n    </head>');
  }
  if (!html.includes("q2ws-runtime.js")) {
    html = html.replace("</body>", '        <script src="q2ws-runtime.js"></script>\n    </body>');
  }
  const disabledAssetPaths = new Set(
    (project.runtime?.widgets || [])
      .filter((widget) => !widget.enabled)
      .flatMap((widget) => widget.assetPaths)
  );
  if (disabledAssetPaths.size) {
    html = removeDisabledAssetTags(html, project.indexHtmlPath, disabledAssetPaths);
  }
  return html;
}

function removeDisabledAssetTags(indexHtml: string, indexHtmlPath: string, disabledAssetPaths: Set<string>): string {
  const indexRoot = indexHtmlPath.includes("/") ? indexHtmlPath.slice(0, indexHtmlPath.lastIndexOf("/") + 1) : "";
  return indexHtml.replace(/\s*<(script|link)\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*(?:><\/script>|>)\s*/gi, (tag, _tagName, rawPath) => {
    if (/^(?:https?:)?\/\//i.test(rawPath) || rawPath.startsWith("data:") || rawPath.startsWith("#")) return tag;
    const normalized = normalizeAssetPath(`${indexRoot}${stripUrlSuffix(rawPath)}`);
    return disabledAssetPaths.has(normalized) ? "\n" : tag;
  });
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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
