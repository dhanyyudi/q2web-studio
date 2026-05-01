import * as Tabs from "@radix-ui/react-tabs";
import { ArrowDown, ArrowUp, Layers3, Paintbrush, Plus, Settings2, Trash2, Wand2 } from "lucide-react";
import { ColorField } from "./ColorField";
import type {
  BasemapConfig,
  InitialZoomMode,
  LayerControlMode,
  MapViewMode,
  Qgis2webProject
} from "../types/project";

export type ProjectInspectorProps = {
  project: Qgis2webProject;
  logoInputRef: React.RefObject<HTMLInputElement>;
  presetBasemapProvider: string;
  setPresetBasemapProvider: (value: string) => void;
  baseMapPresetGroups: { name: string; items: BasemapConfig[] }[];
  updateProject: (project: Qgis2webProject, options?: { label?: string; group?: string; coalesceMs?: number }) => void;
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
  setPopupSetting: <K extends keyof Qgis2webProject["popupSettings"]>(key: K, value: Qgis2webProject["popupSettings"][K]) => void;
};

export function ProjectInspector(props: ProjectInspectorProps) {
  const { project } = props;
  return (
    <Tabs.Root defaultValue="branding" className="tabs-root">
      <Tabs.List className="tabs-list two" aria-label="Project settings">
        <Tabs.Trigger value="branding">Branding</Tabs.Trigger>
        <Tabs.Trigger value="map">Map</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="branding" className="tabs-content">
        <PanelTitle icon={<Paintbrush size={16} />} title="Branding and Theme" />
        <TextInput label="Title" value={project.branding.title} onChange={(title) => props.updateProject({ ...project, branding: { ...project.branding, title } })} />
        <TextInput label="Subtitle" value={project.branding.subtitle} onChange={(subtitle) => props.updateProject({ ...project, branding: { ...project.branding, subtitle } })} />
        <TextInput label="Footer" value={project.branding.footer} onChange={(footer) => props.updateProject({ ...project, branding: { ...project.branding, footer } })} />
        <input ref={props.logoInputRef} className="hidden-input" type="file" accept="image/*" aria-hidden="true" tabIndex={-1} onChange={(event) => props.importLogo(event.target.files)} />
        <button type="button" className="btn full" onClick={() => props.logoInputRef.current?.click()}>
          <Plus size={15} /> Add or Replace Logo
        </button>
        <SelectField
          label="Logo placement"
          value={project.branding.logoPlacement}
          onChange={(logoPlacement) => props.updateProject({ ...project, branding: { ...project.branding, logoPlacement: logoPlacement as Qgis2webProject["branding"]["logoPlacement"] } })}
          options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }, { value: "hidden", label: "Hidden" }]}
        />
        <div className="toggle-grid">
          {(["showHeader", "showFooter"] as const).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={project.branding[key]} onChange={(event) => props.updateProject({ ...project, branding: { ...project.branding, [key]: event.target.checked } })} />
              {key.replace("show", "")}
            </label>
          ))}
        </div>
        <SelectField
          label="Header placement"
          value={project.branding.headerPlacement}
          onChange={(headerPlacement) => props.updateProject({ ...project, branding: { ...project.branding, headerPlacement: headerPlacement as Qgis2webProject["branding"]["headerPlacement"] } })}
          options={[{ value: "top-full", label: "Top full" }, { value: "top-left-pill", label: "Top left pill" }, { value: "top-right-pill", label: "Top right pill" }, { value: "top-center-card", label: "Top center card" }, { value: "hidden", label: "Hidden" }]}
        />
        <SelectField
          label="Footer placement"
          value={project.branding.footerPlacement}
          onChange={(footerPlacement) => props.updateProject({ ...project, branding: { ...project.branding, footerPlacement: footerPlacement as Qgis2webProject["branding"]["footerPlacement"] } })}
          options={[{ value: "bottom-full", label: "Bottom full" }, { value: "bottom-left-pill", label: "Bottom left pill" }, { value: "bottom-right-pill", label: "Bottom right pill" }, { value: "hidden", label: "Hidden" }]}
        />
        <PanelTitle title="Welcome" />
        <div className="toggle-grid">
          <label><input type="checkbox" checked={project.branding.welcome.enabled} onChange={(event) => props.updateProject({ ...project, branding: { ...project.branding, showWelcome: event.target.checked, welcome: { ...project.branding.welcome, enabled: event.target.checked } } })} />Enabled</label>
          <label><input type="checkbox" checked={project.branding.welcome.showOnce} onChange={(event) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, showOnce: event.target.checked } } })} />Show once</label>
        </div>
        <TextInput label="Welcome title" value={project.branding.welcome.title} onChange={(title) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, title } } })} />
        <TextAreaInput label="Welcome subtitle markdown" value={project.branding.welcome.subtitle} onChange={(subtitle) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, subtitle } } })} />
        <TextInput label="CTA label" value={project.branding.welcome.ctaLabel} onChange={(ctaLabel) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, ctaLabel } } })} />
        <SelectField
          label="Auto dismiss"
          value={project.branding.welcome.autoDismiss}
          onChange={(autoDismiss) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, autoDismiss: autoDismiss as Qgis2webProject["branding"]["welcome"]["autoDismiss"] } } })}
          options={[{ value: "never", label: "Never" }, { value: "3", label: "3 seconds" }, { value: "5", label: "5 seconds" }, { value: "10", label: "10 seconds" }]}
        />
        <SegmentedControl
          label="Welcome placement"
          value={project.branding.welcome.placement}
          options={[{ value: "center", label: "Center modal" }, { value: "bottom", label: "Bottom sheet" }]}
          onChange={(placement) => props.updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, placement: placement as Qgis2webProject["branding"]["welcome"]["placement"] } } })}
        />
        <PanelTitle title="Sidebar" />
        <div className="toggle-grid">
          <label><input type="checkbox" checked={project.sidebar.enabled} onChange={(event) => props.updateProject({ ...project, sidebar: { ...project.sidebar, enabled: event.target.checked } })} />Enabled</label>
        </div>
        <SegmentedControl label="Sidebar side" value={project.sidebar.side} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={(side) => props.updateProject({ ...project, sidebar: { ...project.sidebar, side: side as Qgis2webProject["sidebar"]["side"] } })} />
        <RangeInput label="Sidebar width" value={project.sidebar.width} min={260} max={520} step={10} onChange={(width) => props.updateProject({ ...project, sidebar: { ...project.sidebar, width } })} />
        <TextAreaInput label="Sidebar markdown" value={project.sidebar.content} onChange={(content) => props.updateProject({ ...project, sidebar: { ...project.sidebar, content } })} />
        <ColorInput label="Accent" value={project.theme.accent} onChange={(accent) => props.updateProject({ ...project, theme: { ...project.theme, accent } })} />
        <ColorInput label="Surface" value={project.theme.surface} onChange={(surface) => props.updateProject({ ...project, theme: { ...project.theme, surface } })} />
        <ColorInput label="Text" value={project.theme.text} onChange={(text) => props.updateProject({ ...project, theme: { ...project.theme, text } })} />
        <ColorInput label="Muted" value={project.theme.muted} onChange={(muted) => props.updateProject({ ...project, theme: { ...project.theme, muted } })} />
        <RangeInput label="Radius" value={project.theme.radius} min={0} max={18} step={1} onChange={(radius) => props.updateProject({ ...project, theme: { ...project.theme, radius } })} />
        <RangeInput label="Shadow" value={project.theme.shadow} min={0} max={40} step={1} onChange={(shadow) => props.updateProject({ ...project, theme: { ...project.theme, shadow } })} />
        <RangeInput label="Header height" value={project.theme.headerHeight} min={36} max={92} step={2} onChange={(headerHeight) => props.updateProject({ ...project, theme: { ...project.theme, headerHeight } })} />
      </Tabs.Content>

      <Tabs.Content value="map" className="tabs-content">
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
        <div className="toggle-grid"><label><input data-testid="legend-enabled" type="checkbox" checked={project.legendSettings.enabled} onChange={(event) => props.setLegendSetting("enabled", event.target.checked)} />Show legend</label></div>
        <label className="field" data-testid="legend-placement-field"><span>Legend placement</span><select data-testid="legend-placement" value={project.legendSettings.placement} onChange={(event) => props.setLegendSetting("placement", event.target.value as Qgis2webProject["legendSettings"]["placement"])}><option value="hidden">Hidden</option><option value="inside-control">Inside layer control</option><option value="floating-bottom-right">Floating bottom right</option><option value="floating-bottom-left">Floating bottom left</option><option value="floating-top-right">Floating top right</option><option value="floating-top-left">Floating top left</option></select></label>
        <div className="toggle-grid"><label><input type="checkbox" checked={project.legendSettings.groupByLayer} onChange={(event) => props.setLegendSetting("groupByLayer", event.target.checked)} />Group by layer</label><label><input type="checkbox" checked={project.legendSettings.collapsed} onChange={(event) => props.setLegendSetting("collapsed", event.target.checked)} />Start collapsed</label></div>
        <PanelTitle title="Popup Style" />
        <SelectField label="Popup style" value={project.popupSettings.style} onChange={(value) => props.setPopupSetting("style", value as Qgis2webProject["popupSettings"]["style"])} options={[{ value: "card", label: "Card" }, { value: "compact", label: "Compact" }, { value: "minimal", label: "Minimal" }]} />
        <ColorInput label="Accent" value={project.popupSettings.accentColor} onChange={(value) => props.setPopupSetting("accentColor", value)} />
        <ColorInput label="Background" value={project.popupSettings.backgroundColor} onChange={(value) => props.setPopupSetting("backgroundColor", value)} />
        <ColorInput label="Text" value={project.popupSettings.textColor} onChange={(value) => props.setPopupSetting("textColor", value)} />
        <ColorInput label="Label" value={project.popupSettings.labelColor} onChange={(value) => props.setPopupSetting("labelColor", value)} />
        <RangeInput label="Radius" value={project.popupSettings.radius} min={0} max={22} step={1} onChange={(value) => props.setPopupSetting("radius", value)} />
        <RangeInput label="Shadow" value={project.popupSettings.shadow} min={0} max={42} step={1} onChange={(value) => props.setPopupSetting("shadow", value)} />
      </Tabs.Content>
    </Tabs.Root>
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function TextAreaInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><textarea className="popup-custom-textarea" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SegmentedControl(props: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="field"><span>{props.label}</span><div className="segmented">{props.options.map((option) => <button key={option.value} type="button" className={props.value === option.value ? "active" : ""} onClick={() => props.onChange(option.value)}>{option.label}</button>)}</div></div>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <ColorField label={label} value={value} onChange={onChange} />;
}

function RangeInput(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{props.label}: {props.value}</span><input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} /></label>;
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
