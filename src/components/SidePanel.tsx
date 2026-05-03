import type { ReactNode } from "react";
import { AlertTriangle, Eye, EyeOff, Layers3, Settings2, Wand2 } from "lucide-react";
import { isVectorLayer } from "../lib/rasterParsing";
import type { LayerManifest, MapViewMode, ProjectLayer, Qgis2webProject } from "../types/project";

type SidePanelProps = {
  project: Qgis2webProject | null;
  busy: boolean;
  status: string;
  inspectorMode: "project" | "layer";
  selectedLayer?: LayerManifest;
  onCollapse: () => void;
  onProjectSettings: () => void;
  onDefaultBasemap: (basemapId: string) => void;
  onMapViewModeChange: (mode: MapViewMode) => void;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layer: ProjectLayer) => void;
};

export function SidePanel({
  project,
  busy,
  status,
  inspectorMode,
  selectedLayer,
  onCollapse,
  onProjectSettings,
  onDefaultBasemap,
  onMapViewModeChange,
  onSelectLayer,
  onUpdateLayer
}: SidePanelProps) {
  return (
    <aside className="side-panel">
      <button type="button" className="panel-collapse-button" aria-label="Collapse side panel" onClick={onCollapse}>
        <span>☰</span>
      </button>
      <PanelTitle icon={<Wand2 size={16} />} title="Project" />
      <div className="status-box">{busy ? "Working..." : status}</div>

      {project && (
        <>
          <button
            type="button"
            className={inspectorMode === "project" ? "project-settings-button active" : "project-settings-button"}
            onClick={onProjectSettings}
          >
            <Settings2 size={16} /> Project Settings
          </button>

          <PanelTitle icon={<Settings2 size={16} />} title="Map View" />
          {project.basemaps.length > 0 && (
            <div className="sidebar-basemap-grid">
              {project.basemaps.map((basemap) => {
                const active = project.mapSettings.basemap === basemap.id || basemap.default;
                return (
                  <button key={basemap.id} type="button" className={`basemap-card compact ${active ? "active" : ""} ${basemap.enabled ? "" : "disabled"}`} onClick={() => onDefaultBasemap(basemap.id)}>
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
            onChange={(value) => onMapViewModeChange(value as MapViewMode)}
          />

          <PanelTitle icon={<Layers3 size={16} />} title="Layers" />
          <div className="layer-list">
            {project.layers.map((layer) => (
              <div key={layer.id} className={layer.id === selectedLayer?.id ? "layer-row selected" : "layer-row"}>
                <button type="button" className="layer-main" onClick={() => onSelectLayer(layer.id)}>
                  <span>{layer.displayName}</span>
                  <small>{isVectorLayer(layer) ? layer.geometryType : layer.kind}</small>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={() => onUpdateLayer({ ...layer, visible: !layer.visible })}
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
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
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

function basemapPreviewUrl(url: string): string {
  return url
    .replaceAll("{s}", "a")
    .replaceAll("{z}", "6")
    .replaceAll("{x}", "52")
    .replaceAll("{y}", "32")
    .replaceAll("{r}", "");
}
