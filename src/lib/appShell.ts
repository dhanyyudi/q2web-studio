import type { BasemapConfig, DrawMode, Qgis2webProject } from "../types/project";
import type { AppThemeMode } from "../components/Topbar";
import { isDrawModeAllowed, type GeometryKind } from "./appHelpers";

export const TABLE_LAYOUT_STORAGE_KEY = "q2ws-table-layout";
export const APP_THEME_STORAGE_KEY = "q2ws-app-theme";
export const WORKSPACE_LAYOUT_STORAGE_KEY = "q2ws-workspace-layout";
export const LEFT_PANEL_COLLAPSED_STORAGE_KEY = "q2ws-left-panel-collapsed";

export const BASEMAP_PRESET_GROUPS: { name: string; items: BasemapConfig[] }[] = [
  {
    name: "OpenStreetMap",
    items: [
      { id: "osm", label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors", maxZoom: 19, default: false, enabled: true, source: "studio" },
      { id: "osm-hot", label: "OSM Humanitarian", url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors, HOT", maxZoom: 20, default: false, enabled: true, source: "studio" }
    ]
  },
  {
    name: "Esri",
    items: [
      { id: "esri-imagery", label: "World Imagery", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "esri-topo", label: "World Topo Map", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "esri-streets", label: "World Street Map", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "esri-light-gray", label: "Light Gray Base", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri", maxZoom: 16, default: false, enabled: true, source: "studio" },
      { id: "esri-dark-gray", label: "Dark Gray Base", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri", maxZoom: 16, default: false, enabled: true, source: "studio" }
    ]
  },
  {
    name: "Carto",
    items: [
      { id: "carto-voyager", label: "Carto Voyager", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "carto-positron", label: "Carto Positron", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "carto-dark-matter", label: "Carto Dark Matter", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "carto-positron-nolabels", label: "Carto Positron No Labels", url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20, default: false, enabled: true, source: "studio" },
      { id: "carto-dark-matter-nolabels", label: "Carto Dark Matter No Labels", url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20, default: false, enabled: true, source: "studio" }
    ]
  }
];

export function readStoredTheme(): AppThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

export function applyAppTheme(theme: AppThemeMode): void {
  const resolved = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme === "system" ? "light" : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
}

export function shortcutDrawMode(key: string, geometryKind: GeometryKind, canEditGeometry: boolean): DrawMode | null {
  const modeByKey: Record<string, DrawMode> = {
    "1": "select",
    "2": "point",
    "3": "linestring",
    "4": "polygon",
    "5": "rectangle",
    "6": "circle",
    "7": "lasso"
  };
  const mode = modeByKey[key];
  if (!mode) return null;
  if (!canEditGeometry && mode !== "lasso") return null;
  return isDrawModeAllowed(mode, geometryKind) ? mode : null;
}

export function projectSelectionIdentityKey(project: Qgis2webProject): string {
  return `${project.importedAt}::${project.name}::${project.layers.map((layer) => layer.id).join("|")}`;
}
