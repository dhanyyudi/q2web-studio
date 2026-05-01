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

export type PopupTemplateMode = "original" | "field-grid" | "custom";

export type PopupTemplate = {
  mode: PopupTemplateMode;
  source: "imported" | "studio" | "custom";
  html: string;
  fields: PopupField[];
};

export type LayerLabelConfig = {
  enabled: boolean;
  field: string;
  permanent: boolean;
  offset: [number, number];
  className: string;
  htmlTemplate?: string;
  cssText?: string;
  fontSize: number;
  textColor: string;
  haloColor: string;
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
  layerTreeGroup?: string;
  popupEnabled: boolean;
  legendEnabled: boolean;
  popupFields: PopupField[];
  popupTemplate?: PopupTemplate;
  popupSettings?: PopupSettings;
  label?: LayerLabelConfig;
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

export type HeaderPlacement = "top-full" | "top-left-pill" | "top-right-pill" | "top-center-card" | "hidden";
export type FooterPlacement = "bottom-full" | "bottom-left-pill" | "bottom-right-pill" | "hidden";

export type WelcomeSettings = {
  enabled: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  autoDismiss: "never" | "3" | "5" | "10";
  showOnce: boolean;
  placement: "center" | "bottom";
};

export type BrandingSettings = {
  title: string;
  subtitle: string;
  footer: string;
  showHeader: boolean;
  showFooter: boolean;
  showWelcome: boolean;
  headerPlacement: HeaderPlacement;
  footerPlacement: FooterPlacement;
  welcome: WelcomeSettings;
  logoPath: string;
  logoPlacement: "left" | "center" | "right" | "hidden";
};

export type SidebarSettings = {
  enabled: boolean;
  side: "left" | "right";
  width: number;
  content: string;
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

export type RuntimeWidgetId = "measure" | "photon" | "fullscreen" | "scale" | "hash" | "rotatedMarker" | "pattern" | "labels" | "layersTree" | "highlight";

export type RuntimeWidget = {
  id: RuntimeWidgetId;
  label: string;
  enabled: boolean;
  detected: boolean;
  assetPaths: string[];
  options?: Record<string, unknown>;
};

export type BasemapConfig = {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  default: boolean;
  enabled: boolean;
  source: "imported" | "studio" | "user";
};

export type RuntimeSettings = {
  widgets: RuntimeWidget[];
};

export type BasemapId =
  | "osm"
  | "osm-hot"
  | "carto-voyager"
  | "esri-imagery"
  | "esri-topo"
  | "esri-streets"
  | "stadia-terrain"
  | "none";

export type MapViewMode = "all" | "selected";
export type InitialZoomMode = "fit" | "fixed";

export type LayerControlMode = "original" | "compact" | "expanded" | "tree" | "studio";
export type LegendPlacement = "inside-control" | "floating-bottom-right" | "floating-bottom-left" | "floating-top-right" | "floating-top-left" | "hidden";

export type MapSettings = {
  basemap: string;
  viewMode: MapViewMode;
  initialZoomMode: InitialZoomMode;
  initialZoom: number;
  initialBounds?: [[number, number], [number, number]];
  layerControlMode: LayerControlMode;
};

export type LegendPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type LegendSettings = {
  enabled: boolean;
  position: LegendPosition;
  placement: LegendPlacement;
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
  basemaps: BasemapConfig[];
  runtime: RuntimeSettings;
  legendSettings: LegendSettings;
  popupSettings: PopupSettings;
  sidebar: SidebarSettings;
  manualLegendItems: LegendItem[];
  textAnnotations: TextAnnotation[];
  diagnostics: string[];
};

export type SelectedFeatureRef = {
  layerId: string;
  featureId: string;
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
