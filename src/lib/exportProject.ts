import JSZip from "jszip";
import { allLegendItems, legendGroupsForLayers } from "./style";
import { q2wsCss, q2wsRuntime } from "../runtime/runtime";
import type { LayerManifest, Qgis2webProject, VirtualFile } from "../types/project";

const CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; img-src \'self\' data: https:; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\'; connect-src \'self\' https:;">';

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
    legendSettings: project.legendSettings,
    popupSettings: project.popupSettings,
    layers: project.layers.map((layer) => ({
      id: layer.id,
      displayName: layer.displayName,
      layerVariable: layer.layerVariable,
      visible: layer.visible,
      showInLayerControl: layer.showInLayerControl,
      popupEnabled: layer.popupEnabled,
      legendEnabled: layer.legendEnabled,
      popupFields: layer.popupFields,
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

  const indexFile = files[project.indexHtmlPath];
  if (indexFile?.text) {
    files[project.indexHtmlPath] = {
      ...indexFile,
      text: patchIndexHtml(indexFile.text)
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

function patchIndexHtml(indexHtml: string): string {
  let html = indexHtml;
  if (!html.includes("Content-Security-Policy")) {
    html = html.replace("</head>", `        ${CSP_META}\n    </head>`);
  }
  if (!html.includes("q2ws-custom.css")) {
    html = html.replace("</head>", '        <link rel="stylesheet" href="q2ws-custom.css">\n    </head>');
  }
  if (!html.includes("q2ws-runtime.js")) {
    html = html.replace("</body>", '        <script src="q2ws-runtime.js"></script>\n    </body>');
  }
  return html;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
