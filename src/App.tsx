import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Circle,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Layers3,
  Monitor,
  Moon,
  MousePointer2,
  Paintbrush,
  PenLine,
  Plus,
  Redo2,
  Save,
  Settings2,
  Square,
  Sun,
  Heart,
  Trash2,
  Type,
  Undo2,
  Wand2,
  XCircle
} from "lucide-react";
import bbox from "@turf/bbox";
import { buffer as turfBuffer } from "@turf/buffer";
import simplify from "@turf/simplify";
import union from "@turf/union";
import { featureCollection } from "@turf/helpers";
import type { Feature, Point, Polygon, MultiPolygon } from "geojson";
import { AttributeTable, type TableMode } from "./components/AttributeTable";
import { ColorField } from "./components/ColorField";
import { MapCanvas } from "./components/MapCanvas";
import { PreviewOverlay } from "./components/PreviewOverlay";
import { ProjectInspector } from "./components/ProjectInspector";
import { ToolbarButton } from "./components/ToolbarButton";
import { Button } from "./components/ui/button";
import { filesFromDataTransferItems, filesFromFileList, filesFromZipFile } from "./lib/fileImport";
import { downloadBlob, exportProjectZip } from "./lib/exportProject";
import { logoFileToDataUrl } from "./lib/logo";
import { addFeatureProperty, deleteFeatureProperty, migrateProject, renameField, updateFeatureProperty, updateLayer, updateLayerGeojson } from "./lib/projectUpdates";
import { clearProjectFromOpfs, loadProjectFromOpfs, opfsErrorMessage, saveProjectToOpfs } from "./lib/opfs";
import { parseProjectInWorker } from "./lib/workerClient";
import { fieldNames } from "./lib/style";
import { defaultBasemaps, defaultLegendSettings, defaultMapSettings, defaultPopupSettings, defaultRuntimeSettings, defaultSidebarSettings } from "./lib/defaults";
import type {
  BasemapConfig,
  DrawMode,
  InitialZoomMode,
  LayerControlMode,
  LayerManifest,
  LegendPosition,
  MapViewMode,
  PopupTemplateMode,
  Qgis2webProject,
  SelectedFeatureRef,
  TextAnnotation
} from "./types/project";

type InspectorMode = "project" | "layer";
type GeometryKind = "point" | "line" | "polygon" | "unknown";
type AppThemeMode = "light" | "dark" | "system";
type HistoryEntry = { project: Qgis2webProject; label: string; group?: string; updatedAt: number };
type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };

const TABLE_LAYOUT_STORAGE_KEY = "q2ws-table-layout";
const APP_THEME_STORAGE_KEY = "q2ws-app-theme";
const HISTORY_LIMIT = 30;
const BASEMAP_PRESET_GROUPS: { name: string; items: BasemapConfig[] }[] = [
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

export function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mapPanelRef = usePanelRef();
  const tablePanelRef = usePanelRef();
  const [project, setProject] = useState<Qgis2webProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeatureRef | null>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("project");
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tableMode, setTableMode] = useState<TableMode>("open");
  const [attributeFilter, setAttributeFilter] = useState("");
  const [presetBasemapProvider, setPresetBasemapProvider] = useState(BASEMAP_PRESET_GROUPS[0]?.name || "OpenStreetMap");
  const [status, setStatus] = useState("Import a qgis2web export to start editing.");
  const [busy, setBusy] = useState(false);
  const [appTheme, setAppTheme] = useState<AppThemeMode>(() => readStoredTheme());
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [newField, setNewField] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [newFeaturePropertyKey, setNewFeaturePropertyKey] = useState("");
  const [newFeaturePropertyValue, setNewFeaturePropertyValue] = useState("");
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({
    past: [],
    future: []
  });
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: TABLE_LAYOUT_STORAGE_KEY,
    panelIds: ["map", "attributes"]
  });

  const selectedLayer = useMemo(
    () => project?.layers.find((layer) => layer.id === selectedLayerId) || project?.layers[0],
    [project, selectedLayerId]
  );
  const selectedGeometryKind = geometryKindOf(selectedLayer?.geometryType || "");
  const selectedLayerHasMultiGeometry = Boolean(selectedLayer && layerHasMultiGeometry(selectedLayer));
  const selectedFeatureData = useMemo(() => {
    if (!project || !selectedFeature) return null;
    const layer = project.layers.find((item) => item.id === selectedFeature.layerId);
    if (!layer) return null;
    const feature = layer.geojson.features.find(
      (item) => String(item.properties?.__q2ws_id ?? item.id ?? "") === selectedFeature.featureId
    );
    if (!feature) return null;
    return { layer, feature };
  }, [project, selectedFeature]);
  const canEditGeometry = Boolean(selectedLayer && !selectedLayerHasMultiGeometry);
  const canDrawPoint = canEditGeometry && selectedGeometryKind === "point";
  const canDrawLine = canEditGeometry && selectedGeometryKind === "line";
  const canDrawPolygon = canEditGeometry && selectedGeometryKind === "polygon";

  useEffect(() => {
    applyAppTheme(appTheme);
    localStorage.setItem(APP_THEME_STORAGE_KEY, appTheme);
    if (appTheme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyAppTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [appTheme]);

  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
    inputRef.current?.setAttribute("directory", "");
    loadProjectFromOpfs()
      .then((cached) => {
        if (cached && !project) {
          const hydrated = hydrateProject(cached);
          setProject(hydrated);
          setSelectedLayerId(hydrated.layers[0]?.id || "");
          setHistory({ past: [], future: [] });
          setStatus("Last project restored from browser cache.");
        }
      })
      .catch((error) => {
        const message = opfsErrorMessage(error);
        setStatus(message);
        toast.warning(message);
      });
  }, []);

  useEffect(() => {
    if (project && !selectedLayerId) {
      setSelectedLayerId(project.layers[0]?.id || "");
    }
  }, [project, selectedLayerId]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as Window & { __q2ws_project?: Qgis2webProject | null }).__q2ws_project = project;
    return () => {
      delete (window as Window & { __q2ws_project?: Qgis2webProject | null }).__q2ws_project;
    };
  }, [project]);

  useEffect(() => {
    if (!selectedFeature) return;
    if (!selectedFeatureData) {
      setSelectedFeature(null);
      return;
    }
    if (selectedFeature.layerId !== selectedLayerId) {
      setSelectedLayerId(selectedFeature.layerId);
      setInspectorMode("layer");
    }
  }, [selectedFeature, selectedFeatureData, selectedLayerId]);

  useEffect(() => {
    if (!selectedLayer) return;
    if (!canEditGeometry) {
      if (drawMode !== "select") {
        setDrawMode("select");
        return;
      }
      if (snapEnabled) setSnapEnabled(false);
      return;
    }
    if (drawMode === "select" || drawMode === "delete") return;
    if (!isDrawModeAllowed(drawMode, selectedGeometryKind)) {
      setDrawMode("select");
    }
  }, [canEditGeometry, drawMode, selectedGeometryKind, selectedLayer, snapEnabled]);

  useEffect(() => {
    if (tableMode === "maximized") {
      mapPanelRef.current?.resize("34%");
      tablePanelRef.current?.resize("66%");
      return;
    }
    if (tableMode === "minimized") {
      mapPanelRef.current?.resize("94%");
      tablePanelRef.current?.resize("6%");
      return;
    }
    mapPanelRef.current?.resize("74%");
    tablePanelRef.current?.resize("26%");
  }, [mapPanelRef, tableMode, tablePanelRef]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName || "";
      const isTypingTarget = target?.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
      if (isTypingTarget) return;

      const metaOrCtrl = event.metaKey || event.ctrlKey;
      if (metaOrCtrl && event.key.toLowerCase() === "z") {
        if (!project) return;
        event.preventDefault();
        if (event.shiftKey) redoProject();
        else undoProject();
        return;
      }

      if (event.key === "Escape") {
        if (showShortcutDialog) {
          event.preventDefault();
          setShowShortcutDialog(false);
        }
        return;
      }

      if (showShortcutDialog) return;

      if (event.key === "?") {
        event.preventDefault();
        setShowShortcutDialog(true);
        return;
      }

      if (!project || !selectedLayer || previewOpen) return;
      const nextMode = shortcutDrawMode(event.key, selectedGeometryKind, canEditGeometry);
      if (!nextMode) return;
      event.preventDefault();
      setDrawMode(nextMode);
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [canEditGeometry, history.future, history.past, previewOpen, project, selectedGeometryKind, selectedLayer, showShortcutDialog]);

  async function importFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setStatus("Parsing qgis2web folder in a worker...");
    const toastId = toast.loading("Importing qgis2web folder");
    try {
      const files = await filesFromFileList(fileList);
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      setHistory({ past: [], future: [] });
      warnAboutLargeDatasets(parsed);
      await persistProject(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${parsed.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importZip(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await importZipFile(file);
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  async function importZipFile(file: File) {
    setBusy(true);
    setStatus("Reading qgis2web ZIP locally...");
    const toastId = toast.loading("Importing qgis2web ZIP");
    try {
      const files = await filesFromZipFile(file);
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      setHistory({ past: [], future: [] });
      warnAboutLargeDatasets(parsed);
      await persistProject(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${file.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ZIP import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function importVirtualFiles(files: Awaited<ReturnType<typeof filesFromDataTransferItems>>, source: string) {
    if (files.length === 0) return;
    setBusy(true);
    setStatus(`Parsing qgis2web folder from ${source}...`);
    const toastId = toast.loading("Importing qgis2web folder");
    try {
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      setHistory({ past: [], future: [] });
      warnAboutLargeDatasets(parsed);
      await persistProject(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${parsed.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function startImport() {
    inputRef.current?.click();
  }

  function startZipImport() {
    zipInputRef.current?.click();
  }

  async function closeProject() {
    setProject(null);
    setSelectedLayerId("");
    setSelectedFeature(null);
    setInspectorMode("project");
    setDrawMode("select");
    setPreviewOpen(false);
    setAttributeFilter("");
    setHistory({ past: [], future: [] });
    setStatus("Project closed. Import a qgis2web export to start editing.");
    try {
      await clearProjectFromOpfs();
      toast.success("Project closed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project cache could not be cleared.";
      toast.warning(message);
    }
  }

  async function exportZip() {
    if (!project) return;
    setBusy(true);
    setStatus("Building static qgis2web ZIP with Studio runtime...");
    const toastId = toast.loading("Exporting ZIP");
    try {
      const blob = await exportProjectZip(project);
      downloadBlob(blob, `${project.name}-studio.zip`);
      setStatus("Export complete.");
      toast.success("Export ZIP complete", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  function updateProject(next: Qgis2webProject, options: UpdateProjectOptions = {}) {
    const hydrated = hydrateProject(next);
    if (project) {
      setHistory((current) => ({
        past: pushHistoryEntry(current.past, {
          project,
          label: options.label || "Project change",
          group: options.group,
          updatedAt: Date.now()
        }, options.coalesceMs ?? 0),
        future: []
      }));
    }
    setProject(hydrated);
    void saveProjectToOpfs(hydrated).then(showOpfsWarning).catch(() => undefined);
  }

  function restoreProject(next: Qgis2webProject) {
    const hydrated = hydrateProject(next);
    setProject(hydrated);
    setSelectedLayerId((current) => (hydrated.layers.some((layer) => layer.id === current) ? current : hydrated.layers[0]?.id || ""));
    void saveProjectToOpfs(hydrated).then(showOpfsWarning).catch(() => undefined);
  }

  function undoProject() {
    if (!project) return;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    restoreProject(previous.project);
    setHistory({
      past: history.past.slice(0, -1),
      future: [{ project, label: previous.label, group: previous.group, updatedAt: Date.now() }, ...history.future].slice(0, HISTORY_LIMIT)
    });
    toast.info(`Undid ${previous.label}`);
  }

  function redoProject() {
    if (!project) return;
    const next = history.future[0];
    if (!next) return;
    restoreProject(next.project);
    setHistory({
      past: pushHistoryEntry(history.past, { project, label: next.label, group: next.group, updatedAt: Date.now() }, 0),
      future: history.future.slice(1)
    });
    toast.info(`Redid ${next.label}`);
  }

  async function persistProject(next: Qgis2webProject, successMessage?: string): Promise<boolean> {
    try {
      const result = await saveProjectToOpfs(next);
      showOpfsWarning(result);
      if (successMessage) {
        toast.success(successMessage);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project could not be saved to browser cache.";
      toast.error(message);
      return false;
    }
  }

  function showOpfsWarning(result: { warning?: string }) {
    if (result.warning) {
      toast.warning(result.warning, { duration: 9000 });
    }
  }

  function warnAboutLargeDatasets(next: Qgis2webProject) {
    const heavyLayers = next.layers.filter((layer) => layer.geojson.features.length > 10000);
    if (heavyLayers.length === 0) return;
    const biggest = heavyLayers
      .map((layer) => `${layer.displayName}: ${layer.geojson.features.length.toLocaleString()} features`)
      .join(", ");
    toast.warning(`Large dataset imported. Rendering may be slow. ${biggest}`, { duration: 9000 });
  }

  const handleTileError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  function patchSelectedLayer(patch: Partial<LayerManifest>) {
    if (!project || !selectedLayer) return;
    updateProject(updateLayer(project, selectedLayer.id, patch));
  }

  function simplifySelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer, feature } = selectedFeatureData;
    if (!layer.geometryType.includes("Line") && !layer.geometryType.includes("Polygon")) {
      toast.warning("Simplify is available for line and polygon features.");
      return;
    }
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry to simplify.");
      return;
    }
    const featureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "");
    const simplified = simplify(feature as Feature, { tolerance: 0.00008, highQuality: true, mutate: false }) as Feature;
    if (!simplified.geometry || JSON.stringify(simplified.geometry) === JSON.stringify(feature.geometry)) {
      toast.info("Selected feature is already simple enough.");
      return;
    }
    const features = layer.geojson.features.map((candidate) =>
      String(candidate.properties?.__q2ws_id ?? candidate.id ?? "") === featureId
        ? { ...candidate, geometry: simplified.geometry }
        : candidate
    );
    updateProject(updateLayerGeojson(project, layer.id, { ...layer.geojson, features }), {
      label: "Simplify selected feature",
      group: `simplify-feature:${layer.id}:${featureId}`
    });
    toast.success("Selected feature simplified");
  }

  function bufferSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const distanceText = window.prompt("Buffer distance in meters", "100");
    if (!distanceText) return;
    const distance = Number(distanceText);
    if (!Number.isFinite(distance) || distance <= 0) {
      toast.warning("Enter a positive buffer distance in meters.");
      return;
    }
    if (!selectedFeatureData.feature.geometry) {
      toast.warning("Selected feature has no geometry to buffer.");
      return;
    }
    const buffered = turfBuffer(selectedFeatureData.feature, distance, { units: "meters", steps: 16 });
    if (!buffered || buffered.type !== "Feature") {
      toast.error("Buffer could not be created for the selected feature.");
      return;
    }
    const sourceLayer = selectedFeatureData.layer;
    const sourceFeatureId = String(selectedFeatureData.feature.properties?.__q2ws_id ?? selectedFeatureData.feature.id ?? "feature");
    const bufferId = `${sourceLayer.id}-buffer-${Math.round(distance)}m-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...sourceLayer,
      id: bufferId,
      displayName: `${sourceLayer.displayName} buffer ${distance} m`,
      sourcePath: `${project.name}/data/${bufferId}.js`,
      dataVariable: `json_${bufferId}`,
      layerVariable: `layer_${bufferId}`,
      geometryType: buffered.geometry.type,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "source_feature", label: "source_feature", visible: true, header: false },
        { key: "buffer_m", label: "buffer_m", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: [{
          ...buffered,
          id: `${bufferId}::${sourceFeatureId}`,
          properties: {
            ...(buffered.properties || {}),
            __q2ws_id: `${bufferId}::${sourceFeatureId}`,
            source_layer: sourceLayer.displayName,
            source_feature: sourceFeatureId,
            buffer_m: distance
          }
        }]
      },
      style: {
        ...sourceLayer.style,
        fillColor: "#ff7a18",
        strokeColor: "#ff7a18",
        fillOpacity: 0.25,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "",
        symbolType: "polygon"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Buffer ${sourceLayer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Buffer layer created");
  }

  function mergeSelectedLayer() {
    if (!project || !selectedLayer) return;
    if (!selectedLayer.geometryType.includes("Polygon")) {
      toast.warning("Merge is available for polygon layers.");
      return;
    }
    const polygonFeatures = selectedLayer.geojson.features.filter(
      (feature): feature is Feature<Polygon | MultiPolygon> =>
        feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon"
    );
    if (polygonFeatures.length < 2) {
      toast.warning("Merge requires at least two polygon features in the layer.");
      return;
    }
    let merged: Feature<Polygon | MultiPolygon> | null = null;
    for (const feature of polygonFeatures) {
      if (!merged) {
        merged = feature;
        continue;
      }
      try {
        const candidate: Feature<Polygon | MultiPolygon> | null = union(featureCollection([merged, feature]));
        if (candidate) merged = candidate;
      } catch {
        // skip geometry that turf cannot process
      }
    }
    if (!merged || !merged.geometry) {
      toast.error("Merge produced no valid geometry.");
      return;
    }
    const sourceLayer = selectedLayer;
    const mergeId = `${sourceLayer.id}-merged-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...sourceLayer,
      id: mergeId,
      displayName: `${sourceLayer.displayName} merge`,
      sourcePath: `${project.name}/data/${mergeId}.js`,
      dataVariable: `json_${mergeId}`,
      layerVariable: `layer_${mergeId}`,
      geometryType: merged.geometry.type,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "feature_count", label: "feature_count", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: [{
          ...merged,
          id: `${mergeId}::merged`,
          properties: {
            ...(merged.properties || {}),
            __q2ws_id: `${mergeId}::merged`,
            source_layer: sourceLayer.displayName,
            feature_count: polygonFeatures.length
          }
        }]
      },
      style: {
        ...sourceLayer.style,
        fillColor: "#ff7a18",
        strokeColor: "#ff7a18",
        fillOpacity: 0.25,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "",
        symbolType: "polygon"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Merge ${sourceLayer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Merge layer created");
  }

  function selectedFeatureIdValue() {
    return String(selectedFeatureData?.feature.properties?.__q2ws_id ?? selectedFeatureData?.feature.id ?? "");
  }

  function updateSelectedFeatureField(field: string, value: string) {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      updateFeatureProperty(project, selectedLayer.id, featureId, field, value),
      { label: `Edit ${field}`, group: `feature-property:${selectedLayer.id}:${featureId}:${field}`, coalesceMs: 600 }
    );
  }

  function addSelectedFeatureProperty() {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    if (!newFeaturePropertyKey.trim()) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      addFeatureProperty(project, selectedLayer.id, featureId, newFeaturePropertyKey, newFeaturePropertyValue),
      { label: `Add ${newFeaturePropertyKey.trim()}`, group: `feature-property-add:${selectedLayer.id}:${featureId}:${newFeaturePropertyKey.trim()}` }
    );
    setNewFeaturePropertyKey("");
    setNewFeaturePropertyValue("");
    toast.success("Property added to selected feature");
  }

  function removeSelectedFeatureProperty(field: string) {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      deleteFeatureProperty(project, selectedLayer.id, featureId, field),
      { label: `Delete ${field}`, group: `feature-property-delete:${selectedLayer.id}:${featureId}:${field}` }
    );
    toast.success("Property removed from selected feature");
  }

  function renameSelectedPopupField(oldKey: string, newKey: string) {
    if (!project || !selectedLayer) return;
    updateProject(renameField(project, selectedLayer.id, oldKey, newKey));
  }

  function ensureLayerLabel(layer: LayerManifest) {
    const firstField = fieldNames(layer)[0] || "";
    return layer.label || {
      enabled: false,
      field: firstField,
      permanent: true,
      offset: [0, -16] as [number, number],
      className: "",
      htmlTemplate: firstField ? `{{${firstField}}}` : "",
      cssText: "",
      fontSize: 12,
      textColor: "#172026",
      haloColor: "#ffffff"
    };
  }

  function ensurePopupTemplate(layer: LayerManifest) {
    return layer.popupTemplate || {
      mode: "field-grid" as const,
      source: "studio" as const,
      html: popupHtmlFromLayer(layer),
      fields: layer.popupFields
    };
  }

  function setMapSetting<K extends keyof Qgis2webProject["mapSettings"]>(
    key: K,
    value: Qgis2webProject["mapSettings"][K]
  ) {
    if (!project) return;
    updateProject({ ...project, mapSettings: { ...project.mapSettings, [key]: value } });
  }

  function setPopupSetting<K extends keyof Qgis2webProject["popupSettings"]>(
    key: K,
    value: Qgis2webProject["popupSettings"][K]
  ) {
    if (!project) return;
    updateProject({ ...project, popupSettings: { ...project.popupSettings, [key]: value } });
  }

  function setLegendSetting<K extends keyof Qgis2webProject["legendSettings"]>(
    key: K,
    value: Qgis2webProject["legendSettings"][K]
  ) {
    if (!project) return;
    updateProject({ ...project, legendSettings: { ...project.legendSettings, [key]: value } });
  }

  function toggleRuntimeWidget(widgetId: string, enabled: boolean) {
    if (!project) return;
    updateProject({
      ...project,
      runtime: {
        ...project.runtime,
        widgets: project.runtime.widgets.map((widget) => (widget.id === widgetId ? { ...widget, enabled } : widget))
      }
    });
  }

  function setDefaultBasemap(basemapId: string) {
    if (!project) return;
    updateProject({
      ...project,
      mapSettings: { ...project.mapSettings, basemap: basemapId },
      basemaps: project.basemaps.map((basemap) => ({ ...basemap, default: basemap.id === basemapId }))
    });
  }

  function addPresetBasemap(template: BasemapConfig) {
    if (!project) return;
    if (project.basemaps.some((basemap) => basemap.id === template.id || basemap.url === template.url)) return;
    updateProject({
      ...project,
      basemaps: [...project.basemaps, { ...template, default: false, enabled: true, source: "user" }]
    });
  }

  function addCustomBasemap() {
    if (!project) return;
    const id = `custom-${Date.now()}`;
    updateProject({
      ...project,
      basemaps: [
        ...project.basemaps,
        {
          id,
          label: "New basemap",
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "OpenStreetMap",
          maxZoom: 19,
          default: false,
          enabled: true,
          source: "user"
        }
      ]
    });
  }

  function removeBasemap(basemapId: string) {
    if (!project || project.basemaps.length <= 1) return;
    const remaining = project.basemaps.filter((basemap) => basemap.id !== basemapId);
    const needsNewDefault = !remaining.some((basemap) => basemap.default);
    if (needsNewDefault && remaining.length > 0) remaining[0].default = true;
    updateProject({
      ...project,
      mapSettings: {
        ...project.mapSettings,
        basemap: project.mapSettings.basemap === basemapId ? (remaining[0]?.id || "none") : project.mapSettings.basemap
      },
      basemaps: remaining
    });
  }

  function updateBasemapField<K extends keyof Qgis2webProject["basemaps"][number]>(basemapId: string, field: K, value: Qgis2webProject["basemaps"][number][K]) {
    if (!project) return;
    updateProject({
      ...project,
      basemaps: project.basemaps.map((basemap) => basemap.id === basemapId ? { ...basemap, [field]: value } : basemap)
    });
  }

  function moveBasemap(basemapId: string, direction: -1 | 1) {
    if (!project) return;
    const index = project.basemaps.findIndex((basemap) => basemap.id === basemapId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= project.basemaps.length) return;
    const basemaps = [...project.basemaps];
    const [item] = basemaps.splice(index, 1);
    basemaps.splice(nextIndex, 0, item);
    updateProject({
      ...project,
      basemaps
    });
  }

  function addManualLegend() {
    if (!project) return;
    updateProject({
      ...project,
      manualLegendItems: [
        ...project.manualLegendItems,
        {
          id: crypto.randomUUID(),
          label: "Manual legend item",
          fillColor: project.theme.accent,
          strokeColor: "#172026",
          strokeWidth: 2,
          dashArray: "",
          symbolType: "polygon",
          sourceImagePath: "",
          visible: true
        }
      ]
    });
  }

  function addTextAnnotation() {
    if (!project) return;
    const center = projectCenter(project);
    const annotation: TextAnnotation = {
      type: "Feature",
      id: crypto.randomUUID(),
      properties: {
        text: "New label",
        fontSize: 14,
        color: project.theme.text,
        anchor: "center"
      },
      geometry: {
        type: "Point",
        coordinates: center
      } satisfies Point
    };
    updateProject({ ...project, textAnnotations: [...project.textAnnotations, annotation] });
  }

  function setDrawModeWithGuard(nextMode: DrawMode) {
    if (nextMode === "delete") {
      if (!canEditGeometry) return;
      setDrawMode("delete");
      return;
    }
    if (nextMode === "select") {
      if (!canEditGeometry) return;
      setDrawMode("select");
      return;
    }
    if (!selectedLayer || !canEditGeometry) return;
    if (!isDrawModeAllowed(nextMode, selectedGeometryKind)) return;
    setDrawMode(nextMode);
  }

  async function importLogo(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !project) return;
    try {
      const dataUrl = await logoFileToDataUrl(file);
      updateProject({ ...project, branding: { ...project.branding, logoPath: dataUrl, logoPlacement: "left" } });
      toast.success("Logo added to header preview");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logo import failed.";
      toast.error(message);
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  return (
    <main className="app">
      <Toaster richColors position="top-right" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">q2</div>
          <div>
            <h1>qgis2web Studio</h1>
            <p>Local-first low-code editor for qgis2web Leaflet exports.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            multiple
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => importFiles(event.target.files)}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
          <input
            ref={zipInputRef}
            className="hidden-input"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => importZip(event.target.files)}
          />
          <Button type="button" disabled={busy} onClick={startZipImport}>
            <FolderOpen size={16} /> Import ZIP
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={startImport}>
            <FolderOpen size={16} /> Import Folder
          </Button>
          <Button type="button" variant="outline" disabled={!project || busy || history.past.length === 0} onClick={undoProject}>
            <Undo2 size={16} /> Undo {history.past[history.past.length - 1] ? `(${history.past[history.past.length - 1]?.label})` : ""}
          </Button>
          <Button type="button" variant="outline" disabled={!project || busy || history.future.length === 0} onClick={redoProject}>
            <Redo2 size={16} /> Redo {history.future[0] ? `(${history.future[0]?.label})` : ""}
          </Button>
          <div className="theme-toggle" aria-label="App theme">
            <button type="button" className={appTheme === "light" ? "active" : ""} title="Light theme" onClick={() => setAppTheme("light")}>
              <Sun size={15} />
            </button>
            <button type="button" className={appTheme === "dark" ? "active" : ""} title="Dark theme" onClick={() => setAppTheme("dark")}>
              <Moon size={15} />
            </button>
            <button type="button" className={appTheme === "system" ? "active" : ""} title="Use system theme" onClick={() => setAppTheme("system")}>
              <Monitor size={15} />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!project || busy}
            onClick={() =>
              project &&
              persistProject(project, "Project saved locally").then((saved) => {
                if (saved) setStatus("Project saved to browser cache.");
              })
            }
          >
            <Save size={16} /> Save Local
          </Button>
          <Button type="button" variant="outline" disabled={!project || busy} onClick={closeProject}>
            <XCircle size={16} /> Close Project
          </Button>
          <Button asChild type="button" variant="outline">
            <a href="https://tiptap.gg/dhanypedia" target="_blank" rel="noreferrer">
              <Heart size={16} /> Support
            </a>
          </Button>
          <Button data-testid="open-preview" type="button" variant="outline" disabled={!project || busy} onClick={() => setPreviewOpen(true)}>
            <Eye size={16} /> Preview
          </Button>
          <Button type="button" variant="outline" disabled={!project || busy} onClick={exportZip}>
            <Download size={16} /> Export ZIP
          </Button>
        </div>
      </header>

      <section
        className="workspace"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          try {
            const droppedFolderFiles = await filesFromDataTransferItems(event.dataTransfer.items);
            if (droppedFolderFiles.length > 0) {
              await importVirtualFiles(droppedFolderFiles, "drag and drop");
              return;
            }
            const zipFile = Array.from(event.dataTransfer.files).find((file) => file.name.toLowerCase().endsWith(".zip"));
            if (zipFile) {
              await importZipFile(zipFile);
              return;
            }
            importFiles(event.dataTransfer.files);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Import failed.";
            setStatus(message);
            toast.error(message);
          }
        }}
      >
        <aside className="side-panel">
          <PanelTitle icon={<Wand2 size={16} />} title="Project" />
          <div className="status-box">{busy ? "Working..." : status}</div>

          {project && (
            <>
              <button
                type="button"
                className={inspectorMode === "project" ? "project-settings-button active" : "project-settings-button"}
                onClick={() => setInspectorMode("project")}
              >
                <Settings2 size={16} /> Project Settings
              </button>

              <PanelTitle icon={<Settings2 size={16} />} title="Map View" />
              {project.basemaps.length > 0 && (
                <div className="sidebar-basemap-grid">
                  {project.basemaps.map((basemap) => {
                    const active = project.mapSettings.basemap === basemap.id || basemap.default;
                    return (
                      <button key={basemap.id} type="button" className={`basemap-card compact ${active ? "active" : ""} ${basemap.enabled ? "" : "disabled"}`} onClick={() => setDefaultBasemap(basemap.id)}>
                        <span className="basemap-card-preview" style={{ backgroundImage: `url(${basemapPreviewUrl(basemap.url)})` }} />
                        <strong>{basemap.label}</strong>
                        <small>{basemap.source}{basemap.enabled ? "" : " · disabled"}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              <SegmentedControl
                label="Layer display"
                value={project.mapSettings.viewMode}
                options={[
                  { value: "all", label: "All layers" },
                  { value: "selected", label: "Selected layer" }
                ]}
                onChange={(value) => setMapSetting("viewMode", value as MapViewMode)}
              />

              <PanelTitle icon={<Layers3 size={16} />} title="Layers" />
              <div className="layer-list">
                {project.layers.map((layer) => (
                  <div key={layer.id} className={layer.id === selectedLayer?.id ? "layer-row selected" : "layer-row"}>
                    <button type="button" className="layer-main" onClick={() => {
                      setSelectedLayerId(layer.id);
                      setSelectedFeature(null);
                      setInspectorMode("layer");
                    }}>
                      <span>{layer.displayName}</span>
                      <small>{layer.geometryType}</small>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={layer.visible ? "Hide layer" : "Show layer"}
                      onClick={() => updateProject(updateLayer(project, layer.id, { visible: !layer.visible }))}
                    >
                      {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
              {project.diagnostics.length > 0 && (
                <>
                  <PanelTitle icon={<AlertTriangle size={16} />} title="Diagnostics" />
                  <div className="diagnostics-panel">
                    {project.diagnostics.map((item, index) => (
                      <div className="diagnostic-row" key={`${index}-${item}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </aside>

        <section className="main-stage">
          {project && selectedLayer ? (
            <>
              <div className="toolbar">
                <ToolbarButton title={canEditGeometry ? "Select and edit" : "Multi-geometry layers are preview-only"} shortcut="1" active={drawMode === "select"} disabled={!canEditGeometry} onClick={() => setDrawModeWithGuard("select")}>
                  <MousePointer2 size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw point" shortcut="2" active={drawMode === "point"} disabled={!canDrawPoint} onClick={() => setDrawModeWithGuard("point")}>
                  <Circle size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw line" shortcut="3" active={drawMode === "linestring"} disabled={!canDrawLine} onClick={() => setDrawModeWithGuard("linestring")}>
                  <PenLine size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw polygon" shortcut="4" active={drawMode === "polygon"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("polygon")}>
                  <Square size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw rectangle" shortcut="5" active={drawMode === "rectangle"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("rectangle")}>
                  <Square size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw circle" shortcut="6" active={drawMode === "circle"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("circle")}>
                  <Circle size={17} />
                </ToolbarButton>
                <ToolbarButton title={canEditGeometry ? "Delete selected" : "Multi-geometry layers are preview-only"} active={drawMode === "delete"} disabled={!canEditGeometry} onClick={() => setDrawModeWithGuard("delete")}>
                  <Trash2 size={17} />
                </ToolbarButton>
                <button type="button" className={snapEnabled ? "snap-toggle active" : "snap-toggle"} disabled={!canEditGeometry} aria-pressed={snapEnabled} onClick={() => setSnapEnabled((current) => !current)}>
                  Snap
                </button>
                <ToolbarButton title="Add text annotation" onClick={addTextAnnotation}>
                  <Type size={17} />
                </ToolbarButton>
                <ToolbarButton title="Keyboard shortcuts" shortcut="?" onClick={() => setShowShortcutDialog(true)}>
                  ?
                </ToolbarButton>
              </div>
              <Group
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
                className={tableMode === "maximized" ? "stage-panels table-maximized" : "stage-panels"}
                orientation="vertical"
              >
                <Panel id="map" defaultSize="74%" minSize="25%" panelRef={mapPanelRef}>
                  <MapCanvas
                    project={project}
                    selectedLayerId={selectedLayer.id}
                    drawMode={drawMode}
                    snapEnabled={snapEnabled}
                    geometryEditingDisabled={!canEditGeometry}
                    onProjectChange={updateProject}
                    onTileError={handleTileError}
                    selectedFeature={selectedFeature}
                    onSelectedFeatureChange={setSelectedFeature}
                  />
                </Panel>
                <Separator className="panel-resize-handle" />
                <Panel
                  id="attributes"
                  defaultSize="26%"
                  minSize={tableMode === "minimized" ? "6%" : "14%"}
                  panelRef={tablePanelRef}
                >
                  <AttributeTable
                    project={project}
                    layer={selectedLayer}
                    mode={tableMode}
                    setMode={setTableMode}
                    filter={attributeFilter}
                    setFilter={setAttributeFilter}
                    showFieldsDialog={showFieldsDialog}
                    setShowFieldsDialog={setShowFieldsDialog}
                    newField={newField}
                    setNewField={setNewField}
                    renameFrom={renameFrom}
                    setRenameFrom={setRenameFrom}
                    renameTo={renameTo}
                    setRenameTo={setRenameTo}
                    updateProject={updateProject}
                    selectedFeatureId={selectedFeature?.layerId === selectedLayer.id ? selectedFeature.featureId : ""}
                    onSelectedFeatureChange={setSelectedFeature}
                  />
                </Panel>
              </Group>
            </>
          ) : (
            <div className="empty-state">
              <div className="drop-card">
                <FolderOpen size={42} />
                <h2>Import qgis2web export</h2>
                <p>Drag and drop a qgis2web ZIP here. Folder drag and drop also works in browsers that support folder entries.</p>
                <small>Recommended: ZIP export for the cleanest browser import. Use Import Folder if drag and drop is blocked by the browser.</small>
              </div>
              <div className="empty-actions">
                <Button type="button" disabled={busy} onClick={startZipImport}>
                  <FolderOpen size={16} /> Import ZIP
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={startImport}>
                  <FolderOpen size={16} /> Import Folder
                </Button>
              </div>
            </div>
          )}
        </section>

        {project && (
          <aside className="inspector">
            <div className="inspector-scope">
              <span>Project</span>
              {inspectorMode === "layer" && selectedLayer && <><span>/</span><strong>{selectedLayer.displayName}</strong></>}
            </div>

            {inspectorMode === "project" ? (
              <ProjectInspector
                project={project}
                logoInputRef={logoInputRef}
                presetBasemapProvider={presetBasemapProvider}
                setPresetBasemapProvider={setPresetBasemapProvider}
                baseMapPresetGroups={BASEMAP_PRESET_GROUPS}
                updateProject={updateProject}
                importLogo={importLogo}
                updateBasemapField={updateBasemapField}
                moveBasemap={moveBasemap}
                removeBasemap={removeBasemap}
                setDefaultBasemap={setDefaultBasemap}
                addPresetBasemap={addPresetBasemap}
                addCustomBasemap={addCustomBasemap}
                setMapSetting={setMapSetting}
                toggleRuntimeWidget={toggleRuntimeWidget}
                setLegendSetting={setLegendSetting}
                setPopupSetting={setPopupSetting}
              />
            ) : selectedLayer ? (
              <Tabs.Root defaultValue="layer" className="tabs-root">
                <Tabs.List className="tabs-list four" aria-label="Layer editor">
                  <Tabs.Trigger value="layer">Layer</Tabs.Trigger>
                  <Tabs.Trigger value="style">Style</Tabs.Trigger>
                  <Tabs.Trigger value="popup">Popup</Tabs.Trigger>
                  <Tabs.Trigger value="legend">Legend</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="layer" className="tabs-content">
                  <PanelTitle title="Layer Editor" />
                  <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => patchSelectedLayer({ displayName })} />
                  <PanelTitle title="Selected Feature" />
                  {selectedFeatureData && selectedFeatureData.layer.id === selectedLayer.id ? (
                    <div className="selected-feature-panel">
                      <div className="selected-feature-meta">
                        <strong>{selectedFeatureData.feature.properties?.__q2ws_id || selectedFeatureData.feature.id}</strong>
                        <div className="dialog-actions">
                          <button type="button" className="btn compact" onClick={bufferSelectedFeature}>Buffer</button>
                          <button type="button" className="btn compact" onClick={mergeSelectedLayer} disabled={selectedGeometryKind !== "polygon"}>Merge layer</button>
                          <button type="button" className="btn compact" onClick={() => setSelectedFeature(null)}>Clear</button>
                        </div>
                      </div>
                      <div className="feature-property-list">
                        {Object.keys(selectedFeatureData.feature.properties || {}).filter((field) => field !== "__q2ws_id").map((field) => (
                          <div className="feature-property-row" key={field}>
                            <TextInput
                              label={field}
                              value={String(selectedFeatureData.feature.properties?.[field] ?? "")}
                              onChange={(value) => updateSelectedFeatureField(field, value)}
                            />
                            <button type="button" className="btn compact danger" onClick={() => removeSelectedFeatureProperty(field)}>Delete</button>
                          </div>
                        ))}
                      </div>
                      <div className="feature-property-add">
                        <TextInput label="New property key" value={newFeaturePropertyKey} onChange={setNewFeaturePropertyKey} />
                        <TextInput label="Value" value={newFeaturePropertyValue} onChange={setNewFeaturePropertyValue} />
                        <button type="button" className="btn compact" onClick={addSelectedFeatureProperty}>Add to feature</button>
                      </div>
                      <div className="selected-feature-actions">
                        <button type="button" className="btn compact" onClick={simplifySelectedFeature}>
                          Simplify selected feature
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="editor-note">Select a feature from the map or attribute table to edit its properties.</div>
                  )}
                  {selectedLayerHasMultiGeometry && (
                    <div className="editor-note">This layer contains multi-geometry features. Style, popup, legend, and attributes remain editable, but vertex editing is disabled to keep the data safe.</div>
                  )}
                  <div className="toggle-grid">
                    <label><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => patchSelectedLayer({ visible: event.target.checked })} />Visible</label>
                    <label><input type="checkbox" checked={selectedLayer.popupEnabled} onChange={(event) => patchSelectedLayer({ popupEnabled: event.target.checked })} />Popup</label>
                    <label><input type="checkbox" checked={selectedLayer.legendEnabled} onChange={(event) => patchSelectedLayer({ legendEnabled: event.target.checked })} />Legend</label>
                    <label><input type="checkbox" checked={selectedLayer.showInLayerControl} onChange={(event) => patchSelectedLayer({ showInLayerControl: event.target.checked })} />Layer toggle</label>
                  </div>
                  {(() => {
                    const layerLabel = ensureLayerLabel(selectedLayer);
                    return (
                      <>
                        <PanelTitle title="Labels" />
                        <div className="toggle-grid">
                          <label><input type="checkbox" checked={layerLabel.enabled} onChange={(event) => patchSelectedLayer({ label: { ...layerLabel, enabled: event.target.checked } })} />Show labels</label>
                          <label><input type="checkbox" checked={layerLabel.permanent} onChange={(event) => patchSelectedLayer({ label: { ...layerLabel, permanent: event.target.checked } })} />Permanent</label>
                        </div>
                        <SelectField
                          label="Label field"
                          value={layerLabel.field}
                          onChange={(field) => patchSelectedLayer({ label: { ...layerLabel, field, htmlTemplate: `{{${field}}}` } })}
                          options={fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))}
                        />
                        <RangeInput label="Label offset X" value={layerLabel.offset[0]} min={-40} max={40} step={1} onChange={(offsetX) => patchSelectedLayer({ label: { ...layerLabel, offset: [offsetX, layerLabel.offset[1]] } })} />
                        <RangeInput label="Label offset Y" value={layerLabel.offset[1]} min={-40} max={40} step={1} onChange={(offsetY) => patchSelectedLayer({ label: { ...layerLabel, offset: [layerLabel.offset[0], offsetY] } })} />
                      </>
                    );
                  })()}
                </Tabs.Content>

                <Tabs.Content value="style" className="tabs-content">
                  <PanelTitle title="Spatial Style" />
                  {(selectedGeometryKind === "point" || selectedGeometryKind === "polygon") && (
                    <>
                      <ColorInput label="Fill" value={selectedLayer.style.fillColor} onChange={(fillColor) => patchSelectedLayer({ style: { ...selectedLayer.style, fillColor } })} />
                      <RangeInput label="Fill opacity" value={selectedLayer.style.fillOpacity} min={0} max={1} step={0.05} onChange={(fillOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, fillOpacity } })} />
                    </>
                  )}
                  <ColorInput label="Stroke" value={selectedLayer.style.strokeColor} onChange={(strokeColor) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeColor } })} />
                  <RangeInput label="Stroke opacity" value={selectedLayer.style.strokeOpacity} min={0} max={1} step={0.05} onChange={(strokeOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeOpacity } })} />
                  <RangeInput label="Stroke width" value={selectedLayer.style.strokeWidth} min={0} max={12} step={0.5} onChange={(strokeWidth) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeWidth } })} />
                  {selectedGeometryKind === "point" && (
                    <RangeInput label="Point radius" value={selectedLayer.style.pointRadius} min={2} max={24} step={1} onChange={(pointRadius) => patchSelectedLayer({ style: { ...selectedLayer.style, pointRadius } })} />
                  )}
                  {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && (
                    <TextInput label="Dash array" value={selectedLayer.style.dashArray} onChange={(dashArray) => patchSelectedLayer({ style: { ...selectedLayer.style, dashArray } })} />
                  )}
                  <PanelTitle title="Categorized Style" />
                  <SelectField
                    label="Field"
                    value={selectedLayer.style.categoryField}
                    onChange={(categoryField) => patchSelectedLayer({ style: { ...selectedLayer.style, categoryField } })}
                    options={[{ value: "", label: "No category field" }, ...fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))]}
                  />
                  {selectedLayer.style.categories.map((category, index) => (
                    <div className="category-row" key={category.value}>
                      <input value={category.label} onChange={(event) => {
                        const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
                        patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
                      }} />
                      <input type="color" value={category.fillColor} onChange={(event) => {
                        const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, fillColor: event.target.value } : item);
                        patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
                      }} />
                    </div>
                  ))}
                </Tabs.Content>

                <Tabs.Content value="popup" className="tabs-content">
                  {(() => {
                    const popupTemplate = ensurePopupTemplate(selectedLayer);
                    return (
                      <>
                        <PanelTitle title="Popup Template" />
                        <SelectField
                          label="Template mode"
                          value={popupTemplate.mode}
                          onChange={(mode) => patchSelectedLayer({ popupTemplate: { ...popupTemplate, mode: mode as PopupTemplateMode, fields: selectedLayer.popupFields } })}
                          options={[
                            { value: "original", label: "Original HTML" },
                            { value: "field-grid", label: "Field grid" },
                            { value: "custom", label: "Custom HTML" }
                          ]}
                        />
                      </>
                    );
                  })()}
                  {ensurePopupTemplate(selectedLayer).mode === "custom" && (
                    <>
                      <PanelTitle title="Custom Popup HTML" />
                        <textarea
                          className="popup-custom-textarea"
                          rows={6}
                          value={ensurePopupTemplate(selectedLayer).html || ""}
                          placeholder="<table><tr><th>Field</th><td>{{FIELDNAME}}</td></tr></table>"
                          onChange={(event) => patchSelectedLayer({ popupTemplate: { ...ensurePopupTemplate(selectedLayer), html: event.target.value, fields: selectedLayer.popupFields } })}
                        />

                      <small className="popup-custom-hint">Use {"{{FIELDNAME}}"} for dynamic values. Allowed tags: table, tr, th, td, strong, br, span, div, p, b, i, em.</small>
                    </>
                  )}
                  <PanelTitle title="Popup Style" />
                  <div className="toggle-grid">
                    <label>
                      <input type="checkbox" checked={Boolean(selectedLayer.popupSettings)} onChange={(event) => patchSelectedLayer({ popupSettings: event.target.checked ? { ...project.popupSettings } : undefined })} />
                      Override project style
                    </label>
                  </div>
                  {selectedLayer.popupSettings && (
                    <>
                      <ColorInput label="Accent" value={selectedLayer.popupSettings.accentColor} onChange={(accentColor) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, accentColor } })} />
                      <ColorInput label="Background" value={selectedLayer.popupSettings.backgroundColor} onChange={(backgroundColor) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, backgroundColor } })} />
                      <ColorInput label="Text" value={selectedLayer.popupSettings.textColor} onChange={(textColor) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, textColor } })} />
                      <ColorInput label="Label" value={selectedLayer.popupSettings.labelColor} onChange={(labelColor) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, labelColor } })} />
                      <RangeInput label="Radius" value={selectedLayer.popupSettings.radius} min={0} max={22} step={1} onChange={(radius) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, radius } })} />
                      <RangeInput label="Shadow" value={selectedLayer.popupSettings.shadow} min={0} max={42} step={1} onChange={(shadow) => patchSelectedLayer({ popupSettings: { ...selectedLayer.popupSettings!, shadow } })} />
                    </>
                  )}
                  <PanelTitle title="Popup Fields" />
                  <div className="popup-fields">
                    {selectedLayer.popupFields.map((field) => (
                      <div className="popup-field-row" key={field.key}>
                        <label className="popup-field-toggle">
                          <input
                            type="checkbox"
                            checked={field.visible}
                            onChange={(event) => {
                              const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, visible: event.target.checked } : item);
                              patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
                            }}
                          />
                          Visible
                        </label>
                        <input
                          className="popup-field-key-input"
                          value={field.key}
                          onChange={(event) => renameSelectedPopupField(field.key, event.target.value)}
                        />
                        <input
                          className="popup-field-label-input"
                          value={field.label}
                          onChange={(event) => {
                            const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, label: event.target.value } : item);
                            patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
                          }}
                        />
                        <label className="popup-field-toggle">
                          <input
                            type="checkbox"
                            checked={field.header}
                            onChange={(event) => {
                              const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, header: event.target.checked } : item);
                              patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
                            }}
                          />
                          Header
                        </label>
                      </div>
                    ))}
                  </div>
                </Tabs.Content>

                <Tabs.Content value="legend" className="tabs-content">
                  <PanelTitle title="Manual Legend" />
                  <button type="button" className="btn full" onClick={addManualLegend}><Plus size={15} /> Add legend item</button>
                  {project.manualLegendItems.map((item) => (
                    <div className="category-row" key={item.id}>
                      <input value={item.label} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, label: event.target.value } : legend) })} />
                      <input type="color" value={item.fillColor} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, fillColor: event.target.value } : legend) })} />
                    </div>
                  ))}
                </Tabs.Content>
              </Tabs.Root>
            ) : null}
          </aside>
        )}
      </section>
      {previewOpen && project && selectedLayer && (
        <PreviewOverlay
          project={project}
          selectedLayerId={selectedLayer.id}
          onClose={() => setPreviewOpen(false)}
          onExport={exportZip}
          onProjectChange={updateProject}
          onTileError={handleTileError}
        />
      )}
      {showShortcutDialog && (
        <div className="dialog-overlay" role="presentation" onClick={() => setShowShortcutDialog(false)}>
          <div className="dialog-content shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn dialog-close" aria-label="Close shortcuts" onClick={() => setShowShortcutDialog(false)}>
              <XCircle size={16} />
            </button>
            <h2 id="shortcut-dialog-title">Editing Shortcuts</h2>
            <p>Use number keys to swap geometry tools quickly. Undo and redo work with the standard keyboard shortcuts while focus stays outside input fields.</p>
            <div className="shortcut-grid">
              {shortcutRows(selectedGeometryKind, canEditGeometry).map((item) => (
                <div className="shortcut-row" key={item.keycap}>
                  <kbd>{item.keycap}</kbd>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setShowShortcutDialog(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function TextAreaInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="popup-custom-textarea" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SegmentedControl(props: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <span>{props.label}</span>
      <div className="segmented">
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={props.value === option.value ? "active" : ""}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <ColorField label={label} value={value} onChange={onChange} />;
}

function RangeInput(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{props.label}: {props.value}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}

function readStoredTheme(): AppThemeMode {
  const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
}

function applyAppTheme(theme: AppThemeMode): void {
  const resolved = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme === "system" ? "light" : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
}

function normalizeBasemaps(basemaps: Qgis2webProject["basemaps"] | undefined): Qgis2webProject["basemaps"] {
  if (basemaps?.length) return basemaps;
  return defaultBasemaps;
}

function layerHasMultiGeometry(layer: LayerManifest): boolean {
  return layer.geometryType.includes("Multi") || layer.geojson.features.some((feature) => feature.geometry?.type.startsWith("Multi"));
}

function basemapPreviewUrl(url: string): string {
  return url
    .replaceAll("{s}", "a")
    .replaceAll("{z}", "6")
    .replaceAll("{x}", "52")
    .replaceAll("{y}", "32")
    .replaceAll("{r}", "");
}

function popupHtmlFromLayer(layer: LayerManifest): string {
  const rows = layer.popupFields
    .filter((field) => field.visible)
    .map((field) => field.header
      ? `<tr><td colspan="2"><strong>${field.label}</strong><br>{{${field.key}}}</td></tr>`
      : `<tr><th scope="row">${field.label}</th><td>{{${field.key}}}</td></tr>`)
    .join("");
  return `<table>${rows}</table>`;
}

function geometryKindOf(geometryType: string): GeometryKind {
  if (geometryType.includes("Point")) return "point";
  if (geometryType.includes("Line")) return "line";
  if (geometryType.includes("Polygon")) return "polygon";
  return "unknown";
}

function isDrawModeAllowed(drawMode: DrawMode, geometryKind: GeometryKind): boolean {
  if (drawMode === "point") return geometryKind === "point";
  if (drawMode === "linestring") return geometryKind === "line";
  if (drawMode === "polygon" || drawMode === "rectangle" || drawMode === "circle") {
    return geometryKind === "polygon";
  }
  return true;
}

function shortcutDrawMode(key: string, geometryKind: GeometryKind, canEditGeometry: boolean): DrawMode | null {
  if (!canEditGeometry) return null;
  const modeByKey: Record<string, DrawMode> = {
    "1": "select",
    "2": "point",
    "3": "linestring",
    "4": "polygon",
    "5": "rectangle",
    "6": "circle"
  };
  const mode = modeByKey[key];
  if (!mode) return null;
  return isDrawModeAllowed(mode, geometryKind) ? mode : null;
}

function pushHistoryEntry(entries: HistoryEntry[], entry: HistoryEntry, coalesceMs: number): HistoryEntry[] {
  const previous = entries[entries.length - 1];
  if (coalesceMs > 0 && entry.group && previous?.group === entry.group && entry.updatedAt - previous.updatedAt <= coalesceMs) {
    return [...entries.slice(0, -1), { ...previous, label: entry.label }];
  }
  return [...entries.slice(-(HISTORY_LIMIT - 1)), entry];
}

function shortcutRows(geometryKind: GeometryKind, canEditGeometry: boolean): { keycap: string; label: string }[] {
  const unavailable = canEditGeometry ? "Unavailable for selected layer" : "Multi-geometry layer is preview-only";
  return [
    { keycap: "1", label: canEditGeometry ? "Select and edit" : unavailable },
    { keycap: "2", label: canEditGeometry && geometryKind === "point" ? "Draw point" : unavailable },
    { keycap: "3", label: canEditGeometry && geometryKind === "line" ? "Draw line" : unavailable },
    { keycap: "4", label: canEditGeometry && geometryKind === "polygon" ? "Draw polygon" : unavailable },
    { keycap: "5", label: canEditGeometry && geometryKind === "polygon" ? "Draw rectangle" : unavailable },
    { keycap: "6", label: canEditGeometry && geometryKind === "polygon" ? "Draw circle" : unavailable },
    { keycap: "?", label: "Open this shortcuts dialog" },
    { keycap: "Esc", label: "Close shortcuts dialog" },
    { keycap: "Cmd/Ctrl+Z", label: "Undo project edit" },
    { keycap: "Cmd/Ctrl+Shift+Z", label: "Redo project edit" }
  ];
}

function hydrateProject(project: Qgis2webProject): Qgis2webProject {
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
  return {
    ...migrated,
    mapSettings: {
      ...defaultMapSettings,
      ...(migrated.mapSettings || {})
    },
    basemaps: normalizeBasemaps(migrated.basemaps),
    runtime: {
      ...defaultRuntimeSettings,
      ...(migrated.runtime || {})
    },
    legendSettings: {
      ...defaultLegendSettings,
      ...(migrated.legendSettings || {})
    },
    popupSettings: {
      ...defaultPopupSettings,
      ...(migrated.popupSettings || {})
    },
    sidebar: {
      ...defaultSidebarSettings,
      ...(migrated.sidebar || {})
    },
    diagnostics: migrated.diagnostics || [],
    theme: {
      ...theme,
      headerHeight: theme.headerHeight ?? 48
    },
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
    layers: (migrated.layers || []).map((layer) => {
      const featureIds = new Set<string>();
      return {
        ...layer,
        geojson: {
          ...layer.geojson,
          features: layer.geojson.features.map((feature, index) => {
            const sourceId = String(feature.properties?.__q2ws_id ?? feature.id ?? `${layer.id}-${index}`);
            const baseId = `${layer.id}::${sourceId}`;
            const stableId = uniqueFeatureId(featureIds, baseId, `${layer.id}-${index}`);
            return {
              ...feature,
              id: feature.id ?? stableId,
              properties: {
                ...(feature.properties || {}),
                __q2ws_id: stableId
              }
            };
          })
        },
        layerTreeGroup: layer.layerTreeGroup || "Layers",
      popupTemplate: layer.popupTemplate
        ? {
            ...layer.popupTemplate,
            fields: layer.popupTemplate.fields || layer.popupFields || []
          }
        : undefined,
      popupSettings: layer.popupSettings
        ? {
            ...defaultPopupSettings,
            ...layer.popupSettings
          }
        : undefined,
      style: {
        ...layer.style,
        symbolType: layer.style?.symbolType || (layer.geometryType.includes("Line") ? "line" : layer.geometryType.includes("Point") ? "point" : "polygon"),
        sourceImagePath: layer.style?.sourceImagePath || "",
        categories: (layer.style?.categories || []).map((category) => ({
          ...category,
          strokeWidth: category.strokeWidth ?? layer.style?.strokeWidth ?? 2,
          dashArray: category.dashArray || "",
          symbolType: category.symbolType || layer.style?.symbolType || "polygon",
          sourceImagePath: category.sourceImagePath || ""
        }))
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

function projectCenter(project: Qgis2webProject): [number, number] {
  const box = bbox({
    type: "FeatureCollection",
    features: project.layers.flatMap((layer) => layer.geojson.features)
  });
  if (box.some((value) => !Number.isFinite(value))) return [0, 0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}
