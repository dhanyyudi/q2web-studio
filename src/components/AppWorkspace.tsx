import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Polygon } from "geojson";
import { Group, Panel, Separator, usePanelRef, type GroupImperativeHandle } from "react-resizable-panels";
import { Circle, Lasso, MousePointer2, PenLine, Square, Trash2, Type, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AttributeTable, type TableMode } from "./AttributeTable";
import { EmptyState } from "./EmptyState";
import { InspectorShell, type InspectorShellProps } from "./Inspector/InspectorShell";
import { MapCanvas } from "./MapCanvas";
import { SidePanel } from "./SidePanel";
import { ToolbarButton } from "./ToolbarButton";
import { Button } from "./ui/button";
import { filesFromDataTransferItems } from "../lib/fileImport";
import { updateLayer } from "../lib/projectUpdates";
import type { BasemapConfig, DrawMode, LayerManifest, MapSettings, Qgis2webProject, SelectedFeatureRef, VirtualFile } from "../types/project";
import type { GeometryKind } from "../lib/appHelpers";

type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };
type PanelRef = ReturnType<typeof usePanelRef>;
type PanelLayout = Record<string, number>;
type InspectorBaseProps = "project" | "selectedLayer" | "inspectorMode" | "logoInputRef" | "presetBasemapProvider" | "setPresetBasemapProvider" | "baseMapPresetGroups" | "updateProject" | "importLogo" | "updateBasemapField" | "moveBasemap" | "removeBasemap" | "setDefaultBasemap" | "addPresetBasemap" | "addCustomBasemap" | "setMapSetting" | "resetToExportView" | "updateManualLegendItems" | "clearSelectedFeature" | "selectedGeometryKind" | "selectedFeatureIds" | "selectedLayerHasMultiGeometry" | "selectedFeatureData" | "addManualLegendItem";
type InspectorActions = Omit<InspectorShellProps, InspectorBaseProps> & {
  selectedFeatureData: InspectorShellProps["selectedFeatureData"];
  addManualLegend: () => void;
};

export type AppWorkspaceProps = {
  project: Qgis2webProject | null;
  busy: boolean;
  status: string;
  workspaceGroupRef: RefObject<GroupImperativeHandle | null>;
  sidePanelRef: PanelRef;
  inspectorPanelRef: PanelRef;
  mapPanelRef: PanelRef;
  tablePanelRef: PanelRef;
  defaultWorkspaceLayout: PanelLayout | undefined;
  onWorkspaceLayoutChanged: (layout: PanelLayout) => void;
  defaultLayout: PanelLayout | undefined;
  onLayoutChanged: (layout: PanelLayout) => void;
  leftPanelCollapsed: boolean;
  setWorkspaceLeftPanelCollapsed: (collapsed: boolean) => void;
  importVirtualFiles: (files: VirtualFile[], sourceLabel: string) => Promise<void>;
  importZipFile: (file: File) => Promise<void>;
  importFiles: (files: FileList | null) => void;
  startImport: () => void;
  startZipImport: () => void;
  setStatus: (status: string) => void;
  inspectorMode: "project" | "layer";
  setInspectorMode: (mode: "project" | "layer") => void;
  selectedLayer: LayerManifest | undefined;
  setSelectedLayerId: (layerId: string) => void;
  setSelectedFeature: (feature: SelectedFeatureRef | null) => void;
  updateProject: (project: Qgis2webProject, options?: UpdateProjectOptions) => void;
  setDefaultBasemap: (basemapId: string) => void;
  setMapSetting: <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => void;
  resetToExportView: () => void;
  selectedGeometryKind: GeometryKind;
  selectedLayerHasMultiGeometry: boolean;
  canEditGeometry: boolean;
  canDrawPoint: boolean;
  canDrawLine: boolean;
  canDrawPolygon: boolean;
  drawMode: DrawMode;
  setDrawModeWithGuard: (mode: DrawMode) => void;
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  addTextAnnotation: () => void;
  setShowShortcutDialog: (show: boolean) => void;
  tableMode: TableMode;
  setTableMode: (mode: TableMode) => void;
  attributeFilter: string;
  setAttributeFilter: (filter: string) => void;
  showFieldsDialog: boolean;
  setShowFieldsDialog: (show: boolean) => void;
  newField: string;
  setNewField: (field: string) => void;
  renameFrom: string;
  setRenameFrom: (field: string) => void;
  renameTo: string;
  setRenameTo: (field: string) => void;
  selectedFeature: SelectedFeatureRef | null;
  selectedFeatureIds: string[];
  handleSelectedFeatureChange: (feature: SelectedFeatureRef | null) => void;
  handleLassoComplete: (polygon: Polygon) => void;
  handleTileError: (message: string) => void;
  logoInputRef: React.RefObject<HTMLInputElement>;
  presetBasemapProvider: string;
  setPresetBasemapProvider: (value: string) => void;
  baseMapPresetGroups: { name: string; items: BasemapConfig[] }[];
  importLogo: (files: FileList | null) => void;
  updateBasemapField: InspectorShellProps["updateBasemapField"];
  moveBasemap: InspectorShellProps["moveBasemap"];
  removeBasemap: InspectorShellProps["removeBasemap"];
  addPresetBasemap: InspectorShellProps["addPresetBasemap"];
  addCustomBasemap: InspectorShellProps["addCustomBasemap"];
  inspectorActions: InspectorActions;
  showShortcutDialog: boolean;
  shortcutRows: (geometryKind: GeometryKind, canEditGeometry: boolean) => Array<{ keycap: string; label: string }>;
};

export function AppWorkspace(props: AppWorkspaceProps) {
  const {
    project, busy, status, workspaceGroupRef, sidePanelRef, inspectorPanelRef, mapPanelRef, tablePanelRef,
    defaultWorkspaceLayout, onWorkspaceLayoutChanged, defaultLayout, onLayoutChanged, leftPanelCollapsed,
    setWorkspaceLeftPanelCollapsed, importVirtualFiles, importZipFile, importFiles, startImport, startZipImport,
    setStatus, inspectorMode, setInspectorMode, selectedLayer, setSelectedLayerId, setSelectedFeature,
    updateProject, setDefaultBasemap, setMapSetting, resetToExportView, selectedGeometryKind, selectedLayerHasMultiGeometry,
    canEditGeometry, canDrawPoint, canDrawLine, canDrawPolygon, drawMode, setDrawModeWithGuard, snapEnabled,
    setSnapEnabled, addTextAnnotation, setShowShortcutDialog, tableMode, setTableMode, attributeFilter,
    setAttributeFilter, showFieldsDialog, setShowFieldsDialog, newField, setNewField, renameFrom,
    setRenameFrom, renameTo, setRenameTo, selectedFeature, selectedFeatureIds, handleSelectedFeatureChange,
    handleLassoComplete, handleTileError, logoInputRef, presetBasemapProvider, setPresetBasemapProvider,
    baseMapPresetGroups, importLogo, updateBasemapField, moveBasemap, removeBasemap, addPresetBasemap,
    addCustomBasemap, inspectorActions, showShortcutDialog, shortcutRows
  } = props;

  return (
    <>
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
        <Group id="workspace-panels" data-testid="workspace-panels" groupRef={workspaceGroupRef} defaultLayout={defaultWorkspaceLayout || { "left-panel": leftPanelCollapsed ? 0 : 18, "main-stage": leftPanelCollapsed ? 74 : 56, "right-panel": 26 }} onLayoutChanged={onWorkspaceLayoutChanged} className="workspace-panels" orientation="horizontal">
          <Panel id="left-panel" data-testid="left-panel" defaultSize={leftPanelCollapsed ? "0%" : "18%"} minSize="12%" maxSize="30%" collapsible collapsedSize="0%" panelRef={sidePanelRef}>
            <SidePanel project={project} busy={busy} status={status} inspectorMode={inspectorMode} selectedLayer={selectedLayer} onCollapse={() => setWorkspaceLeftPanelCollapsed(true)} onProjectSettings={() => setInspectorMode("project")} onDefaultBasemap={setDefaultBasemap} onMapViewModeChange={(value) => setMapSetting("viewMode", value)} onSelectLayer={(layerId) => { setSelectedLayerId(layerId); setSelectedFeature(null); setInspectorMode("layer"); }} onUpdateLayer={(layer) => project && updateProject(updateLayer(project, layer.id, { visible: layer.visible }))} />
          </Panel>
          <Separator className="workspace-resize-handle" />
          <Panel id="main-stage" defaultSize={leftPanelCollapsed ? "74%" : "56%"} minSize="35%">
            <section className="main-stage">
              {project && selectedLayer ? (
                <>
                  <div className="toolbar">
                    <ToolbarButton title={canEditGeometry ? "Select and edit" : "Multi-geometry layers are preview-only"} shortcut="1" active={drawMode === "select"} disabled={!canEditGeometry} onClick={() => setDrawModeWithGuard("select")}><MousePointer2 size={17} /></ToolbarButton>
                    <ToolbarButton title="Lasso select multiple features" shortcut="7" active={drawMode === "lasso"} disabled={!selectedLayer} onClick={() => setDrawModeWithGuard("lasso")}><Lasso size={17} /></ToolbarButton>
                    <ToolbarButton title="Draw point" shortcut="2" active={drawMode === "point"} disabled={!canDrawPoint} onClick={() => setDrawModeWithGuard("point")}><Circle size={17} /></ToolbarButton>
                    <ToolbarButton title="Draw line" shortcut="3" active={drawMode === "linestring"} disabled={!canDrawLine} onClick={() => setDrawModeWithGuard("linestring")}><PenLine size={17} /></ToolbarButton>
                    <ToolbarButton title="Draw polygon" shortcut="4" active={drawMode === "polygon"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("polygon")}><Square size={17} /></ToolbarButton>
                    <ToolbarButton title="Draw rectangle" shortcut="5" active={drawMode === "rectangle"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("rectangle")}><Square size={17} /></ToolbarButton>
                    <ToolbarButton title="Draw circle" shortcut="6" active={drawMode === "circle"} disabled={!canDrawPolygon} onClick={() => setDrawModeWithGuard("circle")}><Circle size={17} /></ToolbarButton>
                    <ToolbarButton title={canEditGeometry ? "Delete selected" : "Multi-geometry layers are preview-only"} active={drawMode === "delete"} disabled={!canEditGeometry} onClick={() => setDrawModeWithGuard("delete")}><Trash2 size={17} /></ToolbarButton>
                    <button type="button" className={snapEnabled ? "snap-toggle active" : "snap-toggle"} disabled={!canEditGeometry} aria-pressed={snapEnabled} onClick={() => setSnapEnabled((current: boolean) => !current)}>Snap</button>
                    <ToolbarButton title="Add text annotation" onClick={addTextAnnotation}><Type size={17} /></ToolbarButton>
                    <ToolbarButton title="Keyboard shortcuts" shortcut="?" onClick={() => setShowShortcutDialog(true)}>?</ToolbarButton>
                  </div>
                  <Group defaultLayout={defaultLayout || undefined} onLayoutChanged={onLayoutChanged} className={tableMode === "maximized" ? "stage-panels table-maximized" : "stage-panels"} orientation="vertical">
                    <Panel id="map" defaultSize="74%" minSize="25%" panelRef={mapPanelRef}>
                      <MapCanvas project={project} selectedLayerId={selectedLayer.id} drawMode={drawMode} snapEnabled={snapEnabled} geometryEditingDisabled={!canEditGeometry} lassoSelectionEnabled={Boolean(selectedLayer)} onProjectChange={updateProject} onTileError={handleTileError} selectedFeature={selectedFeature} selectedFeatureIds={selectedFeatureIds} onSelectedFeatureChange={handleSelectedFeatureChange} onLassoComplete={handleLassoComplete} />
                    </Panel>
                    <Separator className="panel-resize-handle" />
                    <Panel id="attributes" defaultSize="26%" minSize={tableMode === "minimized" ? "6%" : "14%"} panelRef={tablePanelRef}>
                      <AttributeTable project={project} layer={selectedLayer} mode={tableMode} setMode={setTableMode} filter={attributeFilter} setFilter={setAttributeFilter} showFieldsDialog={showFieldsDialog} setShowFieldsDialog={setShowFieldsDialog} newField={newField} setNewField={setNewField} renameFrom={renameFrom} setRenameFrom={setRenameFrom} renameTo={renameTo} setRenameTo={setRenameTo} updateProject={updateProject} selectedFeatureId={selectedFeature?.layerId === selectedLayer.id ? selectedFeature.featureId : ""} onSelectedFeatureChange={handleSelectedFeatureChange} />
                    </Panel>
                  </Group>
                </>
              ) : <EmptyState busy={busy} onImportZip={startZipImport} onImportFolder={startImport} />}
            </section>
          </Panel>
          <Separator className="workspace-resize-handle" />
          <Panel id="right-panel" defaultSize="26%" minSize="20%" maxSize="45%" collapsible collapsedSize="0%" panelRef={inspectorPanelRef}>
            {project ? <InspectorShell project={project} selectedLayer={selectedLayer} inspectorMode={inspectorMode} logoInputRef={logoInputRef} presetBasemapProvider={presetBasemapProvider} setPresetBasemapProvider={setPresetBasemapProvider} baseMapPresetGroups={baseMapPresetGroups} updateProject={updateProject} importLogo={importLogo} updateBasemapField={updateBasemapField} moveBasemap={moveBasemap} removeBasemap={removeBasemap} setDefaultBasemap={setDefaultBasemap} addPresetBasemap={addPresetBasemap} addCustomBasemap={addCustomBasemap} setMapSetting={setMapSetting} resetToExportView={resetToExportView} updateManualLegendItems={(manualLegendItems) => updateProject({ ...project, manualLegendItems })} clearSelectedFeature={() => setSelectedFeature(null)} selectedGeometryKind={selectedGeometryKind} selectedFeatureIds={selectedFeatureIds} selectedLayerHasMultiGeometry={selectedLayerHasMultiGeometry} {...inspectorActions} selectedFeatureData={inspectorActions.selectedFeatureData || null} addManualLegendItem={inspectorActions.addManualLegend} /> : <div className="inspector inspector-empty" aria-hidden="true" />}
          </Panel>
        </Group>
        {leftPanelCollapsed && <button data-testid="left-panel-expand" type="button" className="left-panel-expand" aria-label="Expand side panel" onClick={() => setWorkspaceLeftPanelCollapsed(false)}><span>☰</span></button>}
      </section>
      {showShortcutDialog && (
        <div className="dialog-overlay" role="presentation" onClick={() => setShowShortcutDialog(false)}>
          <div className="dialog-content shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn dialog-close" aria-label="Close shortcuts" onClick={() => setShowShortcutDialog(false)}><XCircle size={16} /></button>
            <h2 id="shortcut-dialog-title">Editing Shortcuts</h2>
            <p>Use number keys to swap geometry tools quickly. Undo and redo work with the standard keyboard shortcuts while focus stays outside input fields.</p>
            <div className="shortcut-grid">
              {shortcutRows(selectedGeometryKind, canEditGeometry).map((item) => <div className="shortcut-row" key={item.keycap}><kbd>{item.keycap}</kbd><span>{item.label}</span></div>)}
            </div>
            <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setShowShortcutDialog(false)}>Close</Button></div>
          </div>
        </div>
      )}
    </>
  );
}
