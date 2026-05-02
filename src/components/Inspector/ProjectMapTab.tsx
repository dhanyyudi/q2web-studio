import { ArrowDown, ArrowUp, Layers3, Plus, Settings2, Trash2, Wand2 } from "lucide-react";
import type {
  BasemapConfig,
  InitialZoomMode,
  LayerControlMode,
  LegendItem,
  MapViewMode,
  Qgis2webProject
} from "../../types/project";
import { ColorInput, PanelTitle, RangeInput, SegmentedControl, SelectField, SwitchLabel } from "./controls";

export type ProjectMapTabProps = {
  project: Qgis2webProject;
  presetBasemapProvider: string;
  setPresetBasemapProvider: (value: string) => void;
  baseMapPresetGroups: { name: string; items: BasemapConfig[] }[];
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

export function ProjectMapTab(props: ProjectMapTabProps) {
  const { project } = props;

  return (
    <>
      <PanelTitle icon={<Layers3 size={16} />} title="Map View" />
      {project.basemaps.length > 0 && (
        <div className="basemap-list">
          {project.basemaps.map((basemap, index) => (
            <div key={basemap.id} className="basemap-row">
              <input type="radio" name="default-basemap" checked={project.mapSettings.basemap === basemap.id || basemap.default} onChange={() => props.setDefaultBasemap(basemap.id)} />
              <div className="basemap-row-content">
                <input className="basemap-label-input" value={basemap.label} onChange={(event) => props.updateBasemapField(basemap.id, "label", event.target.value)} />
                <input className="basemap-url-input" value={basemap.url} placeholder="Tile URL https://..." onChange={(event) => props.updateBasemapField(basemap.id, "url", event.target.value)} />
                <input className="basemap-url-input" value={basemap.attribution} placeholder="Attribution" onChange={(event) => props.updateBasemapField(basemap.id, "attribution", event.target.value)} />
                <input className="basemap-url-input" type="number" min="1" max="24" value={basemap.maxZoom} onChange={(event) => props.updateBasemapField(basemap.id, "maxZoom", Number(event.target.value) || 20)} />
                <label><input type="checkbox" checked={basemap.enabled} onChange={(event) => props.updateBasemapField(basemap.id, "enabled", event.target.checked)} /> Enabled</label>
              </div>
              <small>{basemap.source}</small>
              <div className="basemap-row-actions">
                <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => props.moveBasemap(basemap.id, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-button" title="Move down" disabled={index === project.basemaps.length - 1} onClick={() => props.moveBasemap(basemap.id, 1)}><ArrowDown size={14} /></button>
                {project.basemaps.length > 1 && <button type="button" className="icon-button" title="Remove basemap" onClick={() => props.removeBasemap(basemap.id)}><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <PanelTitle title="Add Basemap" />
      <div className="basemap-provider-tabs">
        {props.baseMapPresetGroups.map((group) => <button key={group.name} type="button" className={props.presetBasemapProvider === group.name ? "active" : ""} onClick={() => props.setPresetBasemapProvider(group.name)}>{group.name}</button>)}
      </div>
      <div className="basemap-card-grid preset-grid">
        {(props.baseMapPresetGroups.find((group) => group.name === props.presetBasemapProvider)?.items || []).map((basemap) => {
          const added = project.basemaps.some((item) => item.id === basemap.id || item.url === basemap.url);
          return <button key={basemap.id} type="button" className="basemap-card" disabled={added} onClick={() => props.addPresetBasemap(basemap)}><span className="basemap-card-preview" style={{ backgroundImage: `url(${basemapPreviewUrl(basemap.url)})` }} /><strong>{basemap.label}</strong><small>{added ? "Added" : props.presetBasemapProvider}</small></button>;
        })}
      </div>
      <button type="button" className="btn compact full" onClick={props.addCustomBasemap}><Plus size={14} /> Add custom tile URL</button>
      <SegmentedControl label="Layer display" value={project.mapSettings.viewMode} options={[{ value: "all", label: "All layers" }, { value: "selected", label: "Selected layer" }]} onChange={(value) => props.setMapSetting("viewMode", value as MapViewMode)} />
      <SelectField label="Layer control" value={project.mapSettings.layerControlMode} onChange={(value) => props.setMapSetting("layerControlMode", value as LayerControlMode)} options={[{ value: "compact", label: "Compact" }, { value: "expanded", label: "Expanded" }, { value: "tree", label: "Tree" }]} />
      <SelectField label="Initial zoom" value={project.mapSettings.initialZoomMode} onChange={(value) => props.setMapSetting("initialZoomMode", value as InitialZoomMode)} options={[{ value: "fit", label: "Fit visible layers" }, { value: "fixed", label: "Use fixed zoom level" }]} />
      <RangeInput label="Zoom level" value={project.mapSettings.initialZoom} min={5} max={20} step={1} onChange={(value) => props.setMapSetting("initialZoom", value)} />
      {project.runtime.widgets.length > 0 && <><PanelTitle icon={<Settings2 size={16} />} title="Original Widgets" /><div className="widget-list">{project.runtime.widgets.map((widget) => <label key={widget.id} className="widget-row"><input type="checkbox" checked={widget.enabled} onChange={(event) => props.toggleRuntimeWidget(widget.id, event.target.checked)} /><span>{widget.label}</span><small>{widget.assetPaths.length ? `${widget.assetPaths.length} assets` : "detected"}</small></label>)}</div></>}
      <PanelTitle icon={<Wand2 size={16} />} title="Legend" />
      <div className="toggle-grid"><SwitchLabel label="Show legend" checked={project.legendSettings.enabled} onCheckedChange={(checked) => props.setLegendSetting("enabled", checked)} testId="legend-enabled" /></div>
      <label className="field" data-testid="legend-placement-field"><span>Legend placement</span><select data-testid="legend-placement" value={project.legendSettings.placement} onChange={(event) => props.setLegendSetting("placement", event.target.value as Qgis2webProject["legendSettings"]["placement"])}><option value="hidden">Hidden</option><option value="inside-control">Inside layer control</option><option value="floating-bottom-right">Floating bottom right</option><option value="floating-bottom-left">Floating bottom left</option><option value="floating-top-right">Floating top right</option><option value="floating-top-left">Floating top left</option></select></label>
      <div className="toggle-grid"><SwitchLabel label="Group by layer" checked={project.legendSettings.groupByLayer} onCheckedChange={(checked) => props.setLegendSetting("groupByLayer", checked)} /><SwitchLabel label="Start collapsed" checked={project.legendSettings.collapsed} onCheckedChange={(checked) => props.setLegendSetting("collapsed", checked)} /></div>
      <div className="manual-legend-panel" data-testid="project-manual-legend">
        <PanelTitle title="Manual Legend" />
        <p className="editor-note">Manual legend items are project-wide. Use them for symbols or notes that do not come from a single layer style.</p>
        <button type="button" className="btn full" onClick={props.addManualLegendItem}><Plus size={15} /> Add legend item</button>
        {project.manualLegendItems.map((item) => (
          <div className="category-row" key={item.id}>
            <input value={item.label} onChange={(event) => props.updateManualLegendItems(project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, label: event.target.value } : legend))} />
            <input type="color" value={item.fillColor} onChange={(event) => props.updateManualLegendItems(project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, fillColor: event.target.value } : legend))} />
          </div>
        ))}
      </div>
      <PanelTitle title="Popup Style" />
      <SelectField label="Popup style" value={project.popupSettings.style} onChange={(value) => props.setPopupSetting("style", value as Qgis2webProject["popupSettings"]["style"])} options={[{ value: "card", label: "Card" }, { value: "compact", label: "Compact" }, { value: "minimal", label: "Minimal" }]} />
      <ColorInput label="Accent" value={project.popupSettings.accentColor} onChange={(value) => props.setPopupSetting("accentColor", value)} />
      <ColorInput label="Background" value={project.popupSettings.backgroundColor} onChange={(value) => props.setPopupSetting("backgroundColor", value)} />
      <ColorInput label="Text" value={project.popupSettings.textColor} onChange={(value) => props.setPopupSetting("textColor", value)} />
      <ColorInput label="Label" value={project.popupSettings.labelColor} onChange={(value) => props.setPopupSetting("labelColor", value)} />
      <RangeInput label="Radius" value={project.popupSettings.radius} min={0} max={22} step={1} onChange={(value) => props.setPopupSetting("radius", value)} />
      <RangeInput label="Shadow" value={project.popupSettings.shadow} min={0} max={42} step={1} onChange={(value) => props.setPopupSetting("shadow", value)} />
    </>
  );
}

function basemapPreviewUrl(url: string): string {
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/World_Imagery")) return "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/7/12";
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base")) return "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/4/7/12";
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base")) return "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/4/7/12";
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/World_Street_Map")) return "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/4/7/12";
  if (url.includes("arcgisonline.com/ArcGIS/rest/services/World_Topo_Map")) return "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/4/7/12";
  if (url.includes("cartocdn.com/dark_all")) return "https://a.basemaps.cartocdn.com/dark_all/4/12/7.png";
  if (url.includes("cartocdn.com/light_all")) return "https://a.basemaps.cartocdn.com/light_all/4/12/7.png";
  if (url.includes("cartocdn.com/voyager")) return "https://a.basemaps.cartocdn.com/rastertiles/voyager/4/12/7.png";
  return "https://a.tile.openstreetmap.org/4/12/7.png";
}
