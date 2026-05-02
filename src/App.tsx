import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef, type GroupImperativeHandle } from "react-resizable-panels";
import { Toaster, toast } from "sonner";
import {
  Circle,
  Lasso,
  MousePointer2,
  PenLine,
  Square,
  Trash2,
  Type,
  XCircle
} from "lucide-react";
import type { Point } from "geojson";
import { AttributeTable, type TableMode } from "./components/AttributeTable";
import { EmptyState } from "./components/EmptyState";
import { MapCanvas } from "./components/MapCanvas";
import { PreviewOverlay } from "./components/PreviewOverlay";
import { InspectorShell } from "./components/Inspector/InspectorShell";
import { SidePanel } from "./components/SidePanel";
import { ToolbarButton } from "./components/ToolbarButton";
import { Topbar, type AppThemeMode } from "./components/Topbar";
import { Button } from "./components/ui/button";
import { filesFromDataTransferItems } from "./lib/fileImport";
import { updateLayer } from "./lib/projectUpdates";
import { logoFileToDataUrl } from "./lib/logo";
import { loadProjectFromOpfs, opfsErrorMessage } from "./lib/opfs";
import { useImportExport } from "./hooks/useImportExport";
import { geometryKindOf, isDrawModeAllowed, layerHasMultiGeometry, shortcutRows, type GeometryKind } from "./lib/appHelpers";
import { hydrateProject } from "./lib/projectHydration";
import { useProjectState } from "./hooks/useProjectState";
import type {
  BasemapConfig,
  DrawMode,
  LayerManifest,
  Qgis2webProject,
  SelectedFeatureRef,
  TextAnnotation
} from "./types/project";


const TABLE_LAYOUT_STORAGE_KEY = "q2ws-table-layout";
const APP_THEME_STORAGE_KEY = "q2ws-app-theme";
const WORKSPACE_LAYOUT_STORAGE_KEY = "q2ws-workspace-layout";
const LEFT_PANEL_COLLAPSED_STORAGE_KEY = "q2ws-left-panel-collapsed";
// Phase 2a split note: buffer guard moved to useProjectState and still checks selectedFeatureData.feature.geometry before Turf.
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
  const workspaceGroupRef = useRef<GroupImperativeHandle | null>(null);
  const sidePanelRef = usePanelRef();
  const inspectorPanelRef = usePanelRef();
  const mapPanelRef = usePanelRef();
  const tablePanelRef = usePanelRef();
  const projectSelectionIdentityRef = useRef("");
  const lastExpandedLeftPanelWidthRef = useRef(18);
  const [tableMode, setTableMode] = useState<TableMode>("open");
  const [presetBasemapProvider, setPresetBasemapProvider] = useState(BASEMAP_PRESET_GROUPS[0]?.name || "OpenStreetMap");
  const [appTheme, setAppTheme] = useState<AppThemeMode>(() => readStoredTheme());
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => readStoredBoolean(LEFT_PANEL_COLLAPSED_STORAGE_KEY, false));
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [newField, setNewField] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: TABLE_LAYOUT_STORAGE_KEY,
    panelIds: ["map", "attributes"]
  });
  const { defaultLayout: defaultWorkspaceLayout, onLayoutChanged: onWorkspaceLayoutChanged } = useDefaultLayout({
    id: WORKSPACE_LAYOUT_STORAGE_KEY,
    panelIds: ["left-panel", "main-stage", "right-panel"]
  });

  const projectState = useProjectState({ hydrateProject });
  const {
    project, setProject, selectedLayerId, setSelectedLayerId, selectedFeature, setSelectedFeature,
    selectedFeatureIds, setSelectedFeatureIds, inspectorMode, setInspectorMode, drawMode, setDrawMode,
    snapEnabled, setSnapEnabled, previewOpen, setPreviewOpen, attributeFilter, setAttributeFilter,
    status, setStatus, busy, setBusy, history, setHistory, selectedLayer, selectedFeatureData,
    newFeaturePropertyKey, setNewFeaturePropertyKey, newFeaturePropertyValue, setNewFeaturePropertyValue,
    updateProject, undoProject, redoProject, warnAboutLargeDatasets, handleTileError, handleSelectedFeatureChange,
    patchSelectedLayer, selectedFeatureTitle, updateSelectedFeatureField, addSelectedFeatureProperty,
    removeSelectedFeatureProperty, renameSelectedPopupField, ensureLayerLabel, ensurePopupTemplate, setMapSetting,
    setPopupSetting, setLegendSetting, toggleRuntimeWidget, setDefaultBasemap, addPresetBasemap, addCustomBasemap,
    removeBasemap, updateBasemapField, moveBasemap, addManualLegend, addTextAnnotation, setDrawModeWithGuard,
    simplifySelectedFeature, bufferSelectedFeature, mergeSelectedLayer, selectAllFeatures, clearSelection,
    translateSelectedFeatures, rotateSelectedFeatures, scaleSelectedFeatures, handleLassoComplete, splitLineSelectedFeature,
    divideLineSelectedFeature, polygonToLineSelectedFeature, convexHullSelectedFeature
  } = projectState;
  const selectedGeometryKind = geometryKindOf(selectedLayer?.geometryType || "");
  const selectedLayerHasMultiGeometry = Boolean(selectedLayer && layerHasMultiGeometry(selectedLayer));
  const canEditGeometry = Boolean(selectedLayer && !selectedLayerHasMultiGeometry);
  const canDrawPoint = canEditGeometry && selectedGeometryKind === "point";
  const canDrawLine = canEditGeometry && selectedGeometryKind === "line";
  const canDrawPolygon = canEditGeometry && selectedGeometryKind === "polygon";
  const projectSelectionIdentity = useMemo(() => project ? projectSelectionIdentityKey(project) : "", [project]);

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
    localStorage.setItem(LEFT_PANEL_COLLAPSED_STORAGE_KEY, String(leftPanelCollapsed));
  }, [leftPanelCollapsed]);

  useEffect(() => {
    if (project && !selectedLayerId) {
      setSelectedLayerId(project.layers[0]?.id || "");
    }
  }, [project, selectedLayerId]);

  useEffect(() => {
    if (projectSelectionIdentityRef.current === projectSelectionIdentity) return;
    projectSelectionIdentityRef.current = projectSelectionIdentity;
    setSelectedFeatureIds([]);
  }, [projectSelectionIdentity]);

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
    setSelectedFeatureIds([]);
  }, [selectedLayerId]);

  useEffect(() => {
    if (!selectedLayer) return;
    if (!canEditGeometry) {
      if (drawMode !== "select" && drawMode !== "lasso") {
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

  const {
    closeProject,
    exportZip,
    importFiles,
    importVirtualFiles,
    importZip,
    importZipFile,
    persistProject,
    startImport,
    startZipImport
  } = useImportExport({
    project,
    inputRef,
    zipInputRef,
    setProject,
    setSelectedLayerId,
    setSelectedFeature,
    setInspectorMode,
    setDrawMode,
    setPreviewOpen,
    setAttributeFilter,
    setHistory,
    setBusy,
    setStatus,
    hydrateProject,
    warnAboutLargeDatasets
  });

  function setWorkspaceLeftPanelCollapsed(collapsed: boolean) {
    setLeftPanelCollapsed(collapsed);
    if (!workspaceGroupRef.current) return;
    const currentLayout = workspaceGroupRef.current.getLayout();
    const currentLeft = currentLayout["left-panel"] ?? 18;
    const currentMain = currentLayout["main-stage"] ?? 56;
    const currentRight = currentLayout["right-panel"] ?? 26;
    if (currentLeft > 0) {
      lastExpandedLeftPanelWidthRef.current = Math.min(30, Math.max(12, currentLeft));
    }
    const available = Math.max(0, 100 - currentRight);
    const nextLeft = collapsed ? 0 : Math.min(30, Math.max(12, lastExpandedLeftPanelWidthRef.current));
    const nextMain = Math.max(35, available - nextLeft);
    workspaceGroupRef.current.setLayout({
      "left-panel": nextLeft,
      "main-stage": nextMain,
      "right-panel": Math.min(45, Math.max(20, currentRight))
    });
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
      <Topbar
        inputRef={inputRef}
        zipInputRef={zipInputRef}
        project={project}
        busy={busy}
        appTheme={appTheme}
        historyPastLabel={history.past[history.past.length - 1]?.label || ""}
        historyFutureLabel={history.future[0]?.label || ""}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onFolderInputChange={importFiles}
        onZipInputChange={importZip}
        onStartZipImport={startZipImport}
        onStartFolderImport={startImport}
        onUndo={undoProject}
        onRedo={redoProject}
        onThemeChange={setAppTheme}
        onSaveLocal={() => {
          if (!project) return;
          persistProject(project, "Project saved locally").then((saved) => {
            if (saved) setStatus("Project saved to browser cache.");
          });
        }}
        onCloseProject={closeProject}
        onOpenPreview={() => setPreviewOpen(true)}
        onExportZip={exportZip}
      />

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
        <Group
          id="workspace-panels"
          data-testid="workspace-panels"
          groupRef={workspaceGroupRef}
          defaultLayout={defaultWorkspaceLayout || { "left-panel": leftPanelCollapsed ? 0 : 18, "main-stage": leftPanelCollapsed ? 74 : 56, "right-panel": 26 }}
          onLayoutChanged={onWorkspaceLayoutChanged}
          className="workspace-panels"
          orientation="horizontal"
        >
          <Panel id="left-panel" data-testid="left-panel" defaultSize={leftPanelCollapsed ? "0%" : "18%"} minSize="12%" maxSize="30%" collapsible collapsedSize="0%" panelRef={sidePanelRef}>
            <SidePanel
              project={project}
              busy={busy}
              status={status}
              inspectorMode={inspectorMode}
              selectedLayer={selectedLayer}
              onCollapse={() => setWorkspaceLeftPanelCollapsed(true)}
              onProjectSettings={() => setInspectorMode("project")}
              onDefaultBasemap={setDefaultBasemap}
              onMapViewModeChange={(value) => setMapSetting("viewMode", value)}
              onSelectLayer={(layerId) => {
                setSelectedLayerId(layerId);
                setSelectedFeature(null);
                setInspectorMode("layer");
              }}
              onUpdateLayer={(layer) => project && updateProject(updateLayer(project, layer.id, { visible: layer.visible }))}
            />
          </Panel>
      <Separator className="workspace-resize-handle" />
      <Panel id="main-stage" defaultSize={leftPanelCollapsed ? "74%" : "56%"} minSize="35%">
        <section className="main-stage">
          {project && selectedLayer ? (
            <>
              <div className="toolbar">
                <ToolbarButton title={canEditGeometry ? "Select and edit" : "Multi-geometry layers are preview-only"} shortcut="1" active={drawMode === "select"} disabled={!canEditGeometry} onClick={() => setDrawModeWithGuard("select")}>
                  <MousePointer2 size={17} />
                </ToolbarButton>
                <ToolbarButton title="Lasso select multiple features" shortcut="7" active={drawMode === "lasso"} disabled={!selectedLayer} onClick={() => setDrawModeWithGuard("lasso")}>
                  <Lasso size={17} />
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
                    lassoSelectionEnabled={Boolean(selectedLayer)}
                    onProjectChange={updateProject}
                    onTileError={handleTileError}
                    selectedFeature={selectedFeature}
                    selectedFeatureIds={selectedFeatureIds}
                    onSelectedFeatureChange={handleSelectedFeatureChange}
                    onLassoComplete={handleLassoComplete}
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
                    onSelectedFeatureChange={handleSelectedFeatureChange}
                  />
                </Panel>
              </Group>
            </>
          ) : (
            <EmptyState busy={busy} onImportZip={startZipImport} onImportFolder={startImport} />
          )}
        </section>
      </Panel>
      <Separator className="workspace-resize-handle" />

        <Panel id="right-panel" defaultSize="26%" minSize="20%" maxSize="45%" collapsible collapsedSize="0%" panelRef={inspectorPanelRef}>
          {project ? (
          <InspectorShell
            project={project}
            selectedLayer={selectedLayer}
            inspectorMode={inspectorMode}
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
            updateManualLegendItems={(manualLegendItems) => updateProject({ ...project, manualLegendItems })}
            addManualLegendItem={addManualLegend}
            setPopupSetting={setPopupSetting}
            selectedFeatureData={selectedFeatureData}
            selectedGeometryKind={selectedGeometryKind}
            selectedFeatureIds={selectedFeatureIds}
            selectedLayerHasMultiGeometry={selectedLayerHasMultiGeometry}
            patchSelectedLayer={patchSelectedLayer}
            selectedFeatureTitle={selectedFeatureTitle}
            bufferSelectedFeature={bufferSelectedFeature}
            mergeSelectedLayer={mergeSelectedLayer}
            clearSelectedFeature={() => setSelectedFeature(null)}
            updateSelectedFeatureField={updateSelectedFeatureField}
            removeSelectedFeatureProperty={removeSelectedFeatureProperty}
            newFeaturePropertyKey={newFeaturePropertyKey}
            setNewFeaturePropertyKey={setNewFeaturePropertyKey}
            newFeaturePropertyValue={newFeaturePropertyValue}
            setNewFeaturePropertyValue={setNewFeaturePropertyValue}
            addSelectedFeatureProperty={addSelectedFeatureProperty}
            polygonToLineSelectedFeature={polygonToLineSelectedFeature}
            convexHullSelectedFeature={convexHullSelectedFeature}
            splitLineSelectedFeature={splitLineSelectedFeature}
            divideLineSelectedFeature={divideLineSelectedFeature}
            simplifySelectedFeature={simplifySelectedFeature}
            selectAllFeatures={selectAllFeatures}
            translateSelectedFeatures={translateSelectedFeatures}
            rotateSelectedFeatures={rotateSelectedFeatures}
            scaleSelectedFeatures={scaleSelectedFeatures}
            clearSelection={clearSelection}
            ensureLayerLabel={ensureLayerLabel}
            ensurePopupTemplate={ensurePopupTemplate}
            renameSelectedPopupField={renameSelectedPopupField}
          />
          ) : <div className="inspector inspector-empty" aria-hidden="true" />}
        </Panel>
      </Group>
      {leftPanelCollapsed && (
        <button data-testid="left-panel-expand" type="button" className="left-panel-expand" aria-label="Expand side panel" onClick={() => setWorkspaceLeftPanelCollapsed(false)}>
          <span>☰</span>
        </button>
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

function readStoredTheme(): AppThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

function applyAppTheme(theme: AppThemeMode): void {
  const resolved = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme === "system" ? "light" : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
}

function basemapPreviewUrl(url: string): string {
  return url
    .replaceAll("{s}", "a")
    .replaceAll("{z}", "6")
    .replaceAll("{x}", "52")
    .replaceAll("{y}", "32")
    .replaceAll("{r}", "");
}

function shortcutDrawMode(key: string, geometryKind: GeometryKind, canEditGeometry: boolean): DrawMode | null {
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

function projectSelectionIdentityKey(project: Qgis2webProject): string {
  return `${project.importedAt}::${project.name}::${project.layers.map((layer) => layer.id).join("|")}`;
}

