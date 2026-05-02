import * as Tabs from "@radix-ui/react-tabs";
import { ProjectInspector } from "../ProjectInspector";
import { LayerTab, type LayerTabProps } from "./LayerTab";
import { PopupTab, type PopupTabProps } from "./PopupTab";
import { StyleTab, type StyleTabProps } from "./StyleTab";
import type { BasemapConfig, LayerManifest, LegendItem, Qgis2webProject } from "../../types/project";
import type { GeometryKind } from "./controls";

type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };

type ProjectInspectorProps = {
  project: Qgis2webProject;
  logoInputRef: React.RefObject<HTMLInputElement>;
  presetBasemapProvider: string;
  setPresetBasemapProvider: (value: string) => void;
  baseMapPresetGroups: { name: string; items: BasemapConfig[] }[];
  updateProject: (project: Qgis2webProject, options?: UpdateProjectOptions) => void;
  importLogo: (files: FileList | null) => void;
  updateBasemapField: <K extends keyof BasemapConfig>(basemapId: string, key: K, value: BasemapConfig[K]) => void;
  moveBasemap: (basemapId: string, direction: -1 | 1) => void;
  removeBasemap: (basemapId: string) => void;
  setDefaultBasemap: (basemapId: string) => void;
  addPresetBasemap: (basemap: BasemapConfig) => void;
  addCustomBasemap: () => void;
  setMapSetting: <K extends keyof Qgis2webProject["mapSettings"]>(key: K, value: Qgis2webProject["mapSettings"][K]) => void;
  toggleRuntimeWidget: (widgetId: string, enabled: boolean) => void;
  setLegendSetting: <K extends keyof Qgis2webProject["legendSettings"]>(key: K, value: Qgis2webProject["legendSettings"][K]) => void;
  updateManualLegendItems: (items: LegendItem[]) => void;
  addManualLegendItem: () => void;
  setPopupSetting: <K extends keyof Qgis2webProject["popupSettings"]>(key: K, value: Qgis2webProject["popupSettings"][K]) => void;
};

export type InspectorShellProps = ProjectInspectorProps & Omit<LayerTabProps, "selectedLayer"> & Omit<StyleTabProps, "selectedLayer"> & Omit<PopupTabProps, "selectedLayer"> & {
  selectedLayer: LayerManifest | undefined;
  inspectorMode: "project" | "layer";
  selectedGeometryKind: GeometryKind;
};

export function InspectorShell(props: InspectorShellProps) {
  const { project, selectedLayer, inspectorMode } = props;

  return (
    <aside className="inspector">
      <div className="inspector-scope">
        <span>Project</span>
        {inspectorMode === "layer" && selectedLayer && <><span>/</span><strong>{selectedLayer.displayName}</strong></>}
      </div>
      {inspectorMode === "project" ? (
        <ProjectInspector
          project={project}
          logoInputRef={props.logoInputRef}
          presetBasemapProvider={props.presetBasemapProvider}
          setPresetBasemapProvider={props.setPresetBasemapProvider}
          baseMapPresetGroups={props.baseMapPresetGroups}
          updateProject={props.updateProject}
          importLogo={props.importLogo}
          updateBasemapField={props.updateBasemapField}
          moveBasemap={props.moveBasemap}
          removeBasemap={props.removeBasemap}
          setDefaultBasemap={props.setDefaultBasemap}
          addPresetBasemap={props.addPresetBasemap}
          addCustomBasemap={props.addCustomBasemap}
          setMapSetting={props.setMapSetting}
          toggleRuntimeWidget={props.toggleRuntimeWidget}
          setLegendSetting={props.setLegendSetting}
          updateManualLegendItems={props.updateManualLegendItems}
          addManualLegendItem={props.addManualLegendItem}
          setPopupSetting={props.setPopupSetting}
        />
      ) : selectedLayer ? (
        <div className="tabs-root" data-testid="layer-tab-panel">
          <Tabs.Root defaultValue="layer">
            <div className="inspector-scope" data-testid="layer-section-breadcrumb">
              <span>Project</span><span>/</span><strong>{selectedLayer.displayName}</strong>
            </div>
            <Tabs.List className="tabs-list three" aria-label="Layer editor" data-testid="layer-section-tabs">
              <Tabs.Trigger value="layer">Layer</Tabs.Trigger>
              <Tabs.Trigger value="style">Style</Tabs.Trigger>
              <Tabs.Trigger value="popup">Popup</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="layer" className="tabs-content"><LayerTab {...props} selectedLayer={selectedLayer} /></Tabs.Content>
            <Tabs.Content value="style" className="tabs-content"><StyleTab {...props} selectedLayer={selectedLayer} /></Tabs.Content>
            <Tabs.Content value="popup" className="tabs-content"><PopupTab {...props} selectedLayer={selectedLayer} /></Tabs.Content>
          </Tabs.Root>
        </div>
      ) : null}
    </aside>
  );
}
