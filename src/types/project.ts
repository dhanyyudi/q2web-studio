import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

export type Engine = "leaflet" | "unknown";

export type VirtualFile = {
  path: string;
  name: string;
  kind: "text" | "binary";
  text?: string;
  buffer?: ArrayBuffer;
  mime?: string;
};

export type LayerStyle = {
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  dashArray: string;
  pointRadius: number;
  textColor: string;
  textSize: number;
  symbolType: LegendSymbolType;
  sourceImagePath: string;
  categoryField: string;
  categories: LayerCategoryStyle[];
};

export type LayerCategoryStyle = {
  value: string;
  label: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  dashArray: string;
  symbolType: LegendSymbolType;
  sourceImagePath: string;
  visible: boolean;
};

export type LayerManifest = {
  id: string;
  displayName: string;
  sourcePath: string;
  dataVariable: string;
  layerVariable: string;
  geometryType: string;
  visible: boolean;
  showInLayerControl: boolean;
  popupEnabled: boolean;
  legendEnabled: boolean;
  popupFields: PopupField[];
  style: LayerStyle;
  geojson: FeatureCollection;
};

export type PopupField = {
  key: string;
  label: string;
  visible: boolean;
  header: boolean;
};

export type ThemeSettings = {
  accent: string;
  surface: string;
  text: string;
  muted: string;
  radius: number;
  shadow: number;
  fontFamily: string;
  headerHeight: number;
};

export type BrandingSettings = {
  title: string;
  subtitle: string;
  footer: string;
  showHeader: boolean;
  showFooter: boolean;
  showWelcome: boolean;
  showSidebar: boolean;
  logoPath: string;
  logoPlacement: "left" | "center" | "right" | "hidden";
};

export type LegendSymbolType = "polygon" | "line" | "point" | "image";

export type LegendItem = {
  id: string;
  label: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  dashArray: string;
  symbolType: LegendSymbolType;
  sourceImagePath: string;
  layerId?: string;
  visible: boolean;
};

export type BasemapId = "osm" | "carto-voyager" | "esri-imagery" | "none";

export type MapViewMode = "all" | "selected";

export type MapSettings = {
  basemap: BasemapId;
  viewMode: MapViewMode;
};

export type LegendPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type LegendSettings = {
  position: LegendPosition;
  collapsed: boolean;
  groupByLayer: boolean;
};

export type PopupSettings = {
  style: "compact" | "card" | "minimal";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  labelColor: string;
  radius: number;
  shadow: number;
};

export type TextAnnotation = Feature<
  Geometry,
  GeoJsonProperties & {
    text: string;
    fontSize: number;
    color: string;
    anchor: "center" | "left" | "right";
  }
>;

export type Qgis2webProject = {
  name: string;
  engine: Engine;
  importedAt: string;
  files: Record<string, VirtualFile>;
  indexHtmlPath: string;
  layers: LayerManifest[];
  branding: BrandingSettings;
  theme: ThemeSettings;
  mapSettings: MapSettings;
  legendSettings: LegendSettings;
  popupSettings: PopupSettings;
  manualLegendItems: LegendItem[];
  textAnnotations: TextAnnotation[];
  diagnostics: string[];
};

export type WorkerParseRequest = {
  type: "parse";
  files: VirtualFile[];
};

export type WorkerParseResponse = {
  type: "parsed";
  project: Qgis2webProject;
};

export type WorkerErrorResponse = {
  type: "error";
  message: string;
};

export type StudioWorkerMessage = WorkerParseRequest;
export type StudioWorkerResponse = WorkerParseResponse | WorkerErrorResponse;

export type DrawMode = "select" | "point" | "linestring" | "polygon" | "rectangle" | "circle" | "delete";

export function isFeatureCollection(value: unknown): value is FeatureCollection {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as FeatureCollection).type === "FeatureCollection" &&
      Array.isArray((value as FeatureCollection).features)
  );
}
