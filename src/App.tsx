import { useEffect, useMemo, useRef, useState } from "react";
import { useDefaultLayout, usePanelRef, type GroupImperativeHandle } from "react-resizable-panels";
import { Toaster, toast } from "sonner";
import { PreviewOverlay } from "./components/PreviewOverlay";
import { AppWorkspace } from "./components/AppWorkspace";
import { Topbar, type AppThemeMode } from "./components/Topbar";
import { logoFileToDataUrl } from "./lib/logo";
import { loadProjectFromOpfs, opfsErrorMessage } from "./lib/opfs";
import { useImportExport } from "./hooks/useImportExport";
import { geometryKindOf, isDrawModeAllowed, layerHasMultiGeometry, shortcutRows } from "./lib/appHelpers";
import { hydrateProject } from "./lib/projectHydration";
import { useProjectState } from "./hooks/useProjectState";
import type { Qgis2webProject } from "./types/project";
import { APP_THEME_STORAGE_KEY, BASEMAP_PRESET_GROUPS, LEFT_PANEL_COLLAPSED_STORAGE_KEY, TABLE_LAYOUT_STORAGE_KEY, WORKSPACE_LAYOUT_STORAGE_KEY, applyAppTheme, projectSelectionIdentityKey, readStoredBoolean, readStoredTheme, shortcutDrawMode } from "./lib/appShell";
import type { TableMode } from "./components/AttributeTable";

// Phase 2a split note: buffer guard moved to useProjectState and still checks selectedFeatureData.feature.geometry before Turf.

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
    status, setStatus, busy, setBusy, history, setHistory, selectedProjectLayer, selectedLayer, selectedFeatureData,
    newFeaturePropertyKey, setNewFeaturePropertyKey, newFeaturePropertyValue, setNewFeaturePropertyValue,
    updateProject, undoProject, redoProject, warnAboutLargeDatasets, handleTileError, handleSelectedFeatureChange,
    patchSelectedLayer, updateRasterLayer, selectedFeatureTitle, updateSelectedFeatureField, addSelectedFeatureProperty,
    removeSelectedFeatureProperty, renameSelectedPopupField, ensureLayerLabel, ensurePopupTemplate, setMapSetting, resetToExportView,
    setLayerControlSetting, setPopupSetting, setLegendSetting, toggleRuntimeWidget, setDefaultBasemap, addPresetBasemap, addCustomBasemap,
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
      <AppWorkspace
        project={project}
        busy={busy}
        status={status}
        workspaceGroupRef={workspaceGroupRef}
        sidePanelRef={sidePanelRef}
        inspectorPanelRef={inspectorPanelRef}
        mapPanelRef={mapPanelRef}
        tablePanelRef={tablePanelRef}
        defaultWorkspaceLayout={defaultWorkspaceLayout}
        onWorkspaceLayoutChanged={onWorkspaceLayoutChanged}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        leftPanelCollapsed={leftPanelCollapsed}
        setWorkspaceLeftPanelCollapsed={setWorkspaceLeftPanelCollapsed}
        importVirtualFiles={importVirtualFiles}
        importZipFile={importZipFile}
        importFiles={importFiles}
        startImport={startImport}
        startZipImport={startZipImport}
        setStatus={setStatus}
        inspectorMode={inspectorMode}
        setInspectorMode={setInspectorMode}
        selectedLayer={selectedLayer}
        selectedProjectLayer={selectedProjectLayer}
        setSelectedLayerId={setSelectedLayerId}
        setSelectedFeature={setSelectedFeature}
        updateProject={updateProject}
        setDefaultBasemap={setDefaultBasemap}
        setMapSetting={setMapSetting}
        resetToExportView={resetToExportView}
        selectedGeometryKind={selectedGeometryKind}
        selectedLayerHasMultiGeometry={selectedLayerHasMultiGeometry}
        canEditGeometry={canEditGeometry}
        canDrawPoint={canDrawPoint}
        canDrawLine={canDrawLine}
        canDrawPolygon={canDrawPolygon}
        drawMode={drawMode}
        setDrawModeWithGuard={setDrawModeWithGuard}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        addTextAnnotation={addTextAnnotation}
        setShowShortcutDialog={setShowShortcutDialog}
        tableMode={tableMode}
        setTableMode={setTableMode}
        attributeFilter={attributeFilter}
        setAttributeFilter={setAttributeFilter}
        showFieldsDialog={showFieldsDialog}
        setShowFieldsDialog={setShowFieldsDialog}
        newField={newField}
        setNewField={setNewField}
        renameFrom={renameFrom}
        setRenameFrom={setRenameFrom}
        renameTo={renameTo}
        setRenameTo={setRenameTo}
        selectedFeature={selectedFeature}
        selectedFeatureIds={selectedFeatureIds}
        handleSelectedFeatureChange={handleSelectedFeatureChange}
        handleLassoComplete={handleLassoComplete}
        handleTileError={handleTileError}
        logoInputRef={logoInputRef}
        presetBasemapProvider={presetBasemapProvider}
        setPresetBasemapProvider={setPresetBasemapProvider}
        baseMapPresetGroups={BASEMAP_PRESET_GROUPS}
        importLogo={importLogo}
        updateBasemapField={updateBasemapField}
        moveBasemap={moveBasemap}
        removeBasemap={removeBasemap}
        addPresetBasemap={addPresetBasemap}
        addCustomBasemap={addCustomBasemap}
        inspectorActions={{
          setLayerControlSetting, toggleRuntimeWidget, setLegendSetting, addManualLegend, setPopupSetting,
          selectedFeatureData, patchSelectedLayer, selectedFeatureTitle, bufferSelectedFeature, mergeSelectedLayer,
          updateSelectedFeatureField, removeSelectedFeatureProperty, newFeaturePropertyKey, setNewFeaturePropertyKey,
          newFeaturePropertyValue, setNewFeaturePropertyValue, addSelectedFeatureProperty, polygonToLineSelectedFeature,
          convexHullSelectedFeature, splitLineSelectedFeature, divideLineSelectedFeature, simplifySelectedFeature,
          selectAllFeatures, translateSelectedFeatures, rotateSelectedFeatures, scaleSelectedFeatures, clearSelection,
          ensureLayerLabel, ensurePopupTemplate, renameSelectedPopupField, updateRasterLayer
        }}
        showShortcutDialog={showShortcutDialog}
        shortcutRows={shortcutRows}
      />
      {previewOpen && project && selectedProjectLayer && (
        <PreviewOverlay project={project} selectedLayerId={selectedProjectLayer.id} onClose={() => setPreviewOpen(false)} onExport={exportZip} onProjectChange={updateProject} onTileError={handleTileError} />
      )}
    </main>
  );
}