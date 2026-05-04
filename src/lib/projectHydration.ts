import bbox from "@turf/bbox";
import type { Qgis2webProject } from "../types/project";
import { isVectorLayer, normalizeProjectLayerKind } from "./rasterParsing";
import {
  defaultBasemaps,
  defaultLayerControlSettings,
  defaultLegendSettings,
  defaultMapSettings,
  defaultPopupSettings,
  defaultRuntimeSettings,
  defaultSidebarSettings
} from "./defaults";
import { migrateProject } from "./projectUpdates";
import { normalizeGraduatedStyle, normalizeLayerStyleMode } from "./styleMode";

function migrateLayerControlMode(value: unknown): "collapsed" | "expanded" | "tree" {
  if (value === "collapsed" || value === "expanded" || value === "tree") return value;
  if (value === "compact") return "collapsed";
  return defaultLayerControlSettings.mode;
}

function normalizePopupStyle(value: unknown): "card" | "compact" | "minimal" | "original" {
  if (value === "card" || value === "compact" || value === "minimal" || value === "original") return value;
  return defaultPopupSettings.style;
}

export function hydrateProject(project: Qgis2webProject): Qgis2webProject {
  const migrated = migrateProject(project);
  const branding = migrated.branding || {
    title: "Peta WebGIS Interaktif",
    subtitle: "",
    footer: "",
    showHeader: true,
    showFooter: true,
    showWelcome: false,
    headerPlacement: "top-full" as const,
    footerPlacement: "bottom-full" as const,
    welcome: undefined,
    logoPath: "",
    logoPlacement: "left" as const
  };
  const theme = migrated.theme || {
    accent: "#156f7a",
    surface: "#ffffff",
    text: "#172026",
    muted: "#66737f",
    radius: 8,
    shadow: 18,
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    headerHeight: 48
  };
  const layerControlSettings = {
    ...defaultLayerControlSettings,
    ...(migrated.layerControlSettings || {}),
    mode: migrateLayerControlMode(migrated.layerControlSettings?.mode || migrated.mapSettings?.layerControlMode)
  };
  return {
    ...migrated,
    layerControlSettings,
    mapSettings: {
      ...defaultMapSettings,
      ...(migrated.mapSettings || {}),
      layerControlMode: layerControlSettings.mode
    },
    basemaps: normalizeBasemaps(migrated.basemaps),
    runtime: { ...defaultRuntimeSettings, ...(migrated.runtime || {}) },
    legendSettings: { ...defaultLegendSettings, ...(migrated.legendSettings || {}) },
    popupSettings: {
      ...defaultPopupSettings,
      ...(migrated.popupSettings || {}),
      style: normalizePopupStyle(migrated.popupSettings?.style)
    },
    sidebar: { ...defaultSidebarSettings, ...(migrated.sidebar || {}) },
    diagnostics: migrated.diagnostics || [],
    theme: { ...theme, headerHeight: theme.headerHeight ?? 48 },
    branding: {
      ...branding,
      headerPlacement: branding.headerPlacement || "top-full",
      footerPlacement: branding.footerPlacement || "bottom-full",
      welcome: {
        enabled: branding.welcome?.enabled ?? branding.showWelcome ?? false,
        title: branding.welcome?.title || branding.title || "Selamat datang",
        subtitle: branding.welcome?.subtitle || branding.subtitle || "",
        ctaLabel: branding.welcome?.ctaLabel || "Mulai jelajah",
        autoDismiss: branding.welcome?.autoDismiss || "never",
        showOnce: branding.welcome?.showOnce ?? false,
        placement: branding.welcome?.placement || "center"
      },
      logoPath: branding.logoPath || "",
      logoPlacement: branding.logoPlacement || "left"
    },
    layers: (migrated.layers || []).map((inputLayer) => {
      const layer = normalizeProjectLayerKind(inputLayer);
      if (!isVectorLayer(layer)) return layer;
      const featureIds = new Set<string>();
      return {
        ...layer,
        geojson: {
          ...layer.geojson,
          features: layer.geojson.features.map((feature, index) => {
            const properties = feature.properties || {};
            const existingStableId = typeof properties.__q2ws_id === "string" && properties.__q2ws_id.trim() ? properties.__q2ws_id : "";
            const sourceId = String(feature.id ?? `${layer.id}-${index}`);
            const baseId = existingStableId || `${layer.id}::${sourceId}`;
            const stableId = uniqueFeatureId(featureIds, baseId, `${layer.id}-${index}`);
            return { ...feature, id: feature.id ?? stableId, properties: { ...properties, __q2ws_id: stableId } };
          })
        },
        layerTreeGroup: layer.layerTreeGroup || "Layers",
        popupTemplate: layer.popupTemplate ? { ...layer.popupTemplate, fields: layer.popupTemplate.fields || layer.popupFields || [] } : undefined,
        popupSettings: layer.popupSettings
          ? {
              ...defaultPopupSettings,
              ...layer.popupSettings,
              style: normalizePopupStyle(layer.popupSettings.style)
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
    }),
    manualLegendItems: (migrated.manualLegendItems || []).map((item) => ({
      ...item,
      strokeWidth: item.strokeWidth ?? 2,
      dashArray: item.dashArray || "",
      symbolType: item.symbolType || "polygon",
      sourceImagePath: item.sourceImagePath || ""
    }))
  };
}

export function normalizeBasemaps(basemaps: Qgis2webProject["basemaps"] | undefined): Qgis2webProject["basemaps"] {
  if (basemaps?.length) return basemaps;
  return defaultBasemaps;
}

function uniqueFeatureId(existingIds: Set<string>, candidate: string, fallback: string): string {
  const baseId = candidate || fallback;
  let nextId = baseId;
  let suffix = 1;
  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  existingIds.add(nextId);
  return nextId;
}

export function projectCenter(project: Qgis2webProject): [number, number] {
  const box = bbox({ type: "FeatureCollection", features: project.layers.filter(isVectorLayer).flatMap((layer) => layer.geojson.features) });
  if (box.some((value) => !Number.isFinite(value))) return [0, 0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}
