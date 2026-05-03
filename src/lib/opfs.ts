import {
  defaultBasemaps,
  defaultBranding,
  defaultLayerControlSettings,
  defaultLegendSettings,
  defaultMapSettings,
  defaultPopupSettings,
  defaultRuntimeSettings,
  defaultSidebarSettings,
  defaultTheme
} from "./defaults";
import type { LayerManifest, ProjectLayer, Qgis2webProject, VirtualFile } from "../types/project";
import { migrateProject } from "./projectUpdates";
import { normalizeGraduatedStyle, normalizeLayerStyleMode } from "./styleMode";

const PROJECT_FILE = "last-project.json";
const QUOTA_WARNING_RATIO = 0.82;

export type OpfsSaveResult = {
  warning?: string;
};

export async function saveProjectToOpfs(project: Qgis2webProject): Promise<OpfsSaveResult> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return {};
  }
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(PROJECT_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(serializeProject(project)));
  await writable.close();
  return { warning: await storageQuotaWarning() };
}

export async function clearProjectFromOpfs(): Promise<void> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return;
  }
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(PROJECT_FILE);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return;
    }
    throw error;
  }
}

export async function loadProjectFromOpfs(): Promise<Qgis2webProject | null> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(PROJECT_FILE);
    const file = await handle.getFile();
    return deserializeProject(JSON.parse(await file.text()));
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
}

export function opfsErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `Browser cache could not be restored: ${error.message}`;
  }
  return "Browser cache could not be restored.";
}

export function hydrateStoredProjectForTest(value: unknown): Qgis2webProject {
  return deserializeProject(value);
}

function serializeProject(project: Qgis2webProject): Qgis2webProject & { files: Record<string, VirtualFile & { bufferBase64?: string }> } {
  const migrated = migrateProject(project);
  return {
    ...migrated,
    files: Object.fromEntries(
      Object.entries(migrated.files || {}).map(([path, file]) => [
        path,
        file.kind === "binary" && file.buffer
          ? { ...file, buffer: undefined, bufferBase64: arrayBufferToBase64(file.buffer) }
          : file
      ])
    )
  };
}

function deserializeProject(value: unknown): Qgis2webProject {
  const project = migrateProject(value as Qgis2webProject & { files?: Record<string, VirtualFile & { bufferBase64?: string }> });
  const files = Object.fromEntries(
    Object.entries(project.files || {}).map(([path, file]) => {
      const hydratedFile = file as VirtualFile & { bufferBase64?: string };
      return [
        path,
        hydratedFile.kind === "binary" && hydratedFile.bufferBase64
          ? { ...hydratedFile, buffer: base64ToArrayBuffer(hydratedFile.bufferBase64), bufferBase64: undefined }
          : hydratedFile
      ];
    })
  );
  return {
    ...project,
    files,
    branding: {
      ...defaultBranding,
      ...(project.branding || {}),
      welcome: {
        ...defaultBranding.welcome,
        ...(project.branding?.welcome || {})
      }
    },
    theme: {
      ...defaultTheme,
      ...(project.theme || {})
    },
    mapSettings: {
      ...defaultMapSettings,
      ...(project.mapSettings || {}),
      layerControlMode: hydrateLayerControlMode(project.layerControlSettings?.mode || project.mapSettings?.layerControlMode)
    },
    basemaps: normalizeBasemaps(project.basemaps),
    runtime: {
      ...defaultRuntimeSettings,
      ...(project.runtime || {})
    },
    layerControlSettings: {
      ...defaultLayerControlSettings,
      ...(project.layerControlSettings || {}),
      mode: hydrateLayerControlMode(project.layerControlSettings?.mode || project.mapSettings?.layerControlMode)
    },
    legendSettings: {
      ...defaultLegendSettings,
      ...(project.legendSettings || {})
    },
    popupSettings: {
      ...defaultPopupSettings,
      ...(project.popupSettings || {})
    },
    sidebar: {
      ...defaultSidebarSettings,
      ...(project.sidebar || {})
    },
    layers: (project.layers || []).map((layer) => hydrateLayer(layer)),
    manualLegendItems: project.manualLegendItems || [],
    textAnnotations: project.textAnnotations || [],
    diagnostics: project.diagnostics || []
  } as Qgis2webProject;
}

function normalizeBasemaps(basemaps: Qgis2webProject["basemaps"] | undefined): Qgis2webProject["basemaps"] {
  if (basemaps?.length) return basemaps;
  return defaultBasemaps;
}

function hydrateLayerControlMode(value: unknown): Qgis2webProject["layerControlSettings"]["mode"] {
  if (value === "compact") return "collapsed";
  if (value === "collapsed" || value === "expanded" || value === "tree") return value;
  return defaultLayerControlSettings.mode;
}

function hydrateLayer(inputLayer: ProjectLayer): ProjectLayer {
  if (inputLayer.kind && inputLayer.kind !== "vector") return inputLayer;
  const layer = inputLayer as LayerManifest;
  return {
    ...layer,
    popupTemplate: layer.popupTemplate
      ? {
          ...layer.popupTemplate,
          fields: layer.popupTemplate.fields || layer.popupFields || []
        }
      : undefined,
    layerTreeGroup: layer.layerTreeGroup || "Layers",
    popupSettings: layer.popupSettings
      ? {
          ...defaultPopupSettings,
          ...layer.popupSettings
        }
      : undefined,
    label: layer.label
      ? {
          ...layer.label,
          offset: layer.label.offset || [0, 0],
          className: layer.label.className || "",
          htmlTemplate: layer.label.htmlTemplate,
          cssText: layer.label.cssText
        }
      : undefined,
    style: {
      ...layer.style,
      mode: normalizeLayerStyleMode(layer.style),
      symbolType: layer.style?.symbolType || (layer.geometryType.includes("Line") ? "line" : layer.geometryType.includes("Point") ? "point" : "polygon"),
      sourceImagePath: layer.style?.sourceImagePath || "",
      categories: (layer.style?.categories || []).map((category) => ({
        ...category,
        strokeWidth: category.strokeWidth ?? layer.style?.strokeWidth ?? 2,
        dashArray: category.dashArray || "",
        symbolType: category.symbolType || layer.style?.symbolType || "polygon",
        sourceImagePath: category.sourceImagePath || ""
      })),
      graduated: normalizeGraduatedStyle(layer.style?.graduated)
    }
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function storageQuotaWarning(): Promise<string | undefined> {
  if (!navigator.storage.estimate) {
    return undefined;
  }
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  if (!quota || usage / quota < QUOTA_WARNING_RATIO) {
    return undefined;
  }
  return `Browser storage is ${Math.round((usage / quota) * 100)}% full. Export a ZIP backup before importing more large data.`;
}
