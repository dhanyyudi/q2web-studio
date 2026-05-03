import * as Tabs from "@radix-ui/react-tabs";
import { BrandingTab, type BrandingTabProps } from "./Inspector/BrandingTab";
import { ProjectMapTab, type ProjectMapTabProps } from "./Inspector/ProjectMapTab";

export type ProjectInspectorProps = BrandingTabProps & ProjectMapTabProps;

export function ProjectInspector(props: ProjectInspectorProps) {
  return (
    <Tabs.Root defaultValue="branding" className="tabs-root">
      <Tabs.List className="tabs-list two" aria-label="Project settings">
        <Tabs.Trigger value="branding">Branding</Tabs.Trigger>
        <Tabs.Trigger value="map">Map</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="branding" className="tabs-content">
        <BrandingTab
          project={props.project}
          logoInputRef={props.logoInputRef}
          updateProject={props.updateProject}
          importLogo={props.importLogo}
        />
      </Tabs.Content>

      <Tabs.Content value="map" className="tabs-content">
        <ProjectMapTab
          project={props.project}
          resetToExportView={props.resetToExportView}
          presetBasemapProvider={props.presetBasemapProvider}
          setPresetBasemapProvider={props.setPresetBasemapProvider}
          baseMapPresetGroups={props.baseMapPresetGroups}
          updateBasemapField={props.updateBasemapField}
          moveBasemap={props.moveBasemap}
          removeBasemap={props.removeBasemap}
          setDefaultBasemap={props.setDefaultBasemap}
          addPresetBasemap={props.addPresetBasemap}
          addCustomBasemap={props.addCustomBasemap}
          setMapSetting={props.setMapSetting}
          setLayerControlSetting={props.setLayerControlSetting}
          toggleRuntimeWidget={props.toggleRuntimeWidget}
          setLegendSetting={props.setLegendSetting}
          updateManualLegendItems={props.updateManualLegendItems}
          addManualLegendItem={props.addManualLegendItem}
          setPopupSetting={props.setPopupSetting}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
