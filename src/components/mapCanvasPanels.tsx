import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import type { LegendGroup } from "../lib/style";
import { renderMarkdownContent } from "../lib/sidebarMarkdown";
import type { LayerManifest, LegendItem, Qgis2webProject } from "../types/project";

export function MapHeader({ project }: { project: Qgis2webProject }) {
  if (!project.branding.showHeader || project.branding.headerPlacement === "hidden") return null;
  return (
    <div
      className={`map-header-preview header-${project.branding.headerPlacement} logo-${project.branding.logoPlacement}`}
      style={{
        background: project.theme.accent,
        minHeight: project.theme.headerHeight,
        borderRadius: project.theme.radius,
        boxShadow: `0 ${Math.max(8, project.theme.shadow)}px ${Math.max(16, project.theme.shadow * 1.8)}px rgba(0, 0, 0, 0.22)`
      }}
    >
      {project.branding.logoPath && project.branding.logoPlacement !== "hidden" && <img src={project.branding.logoPath} alt="" />}
      <div>
        <strong>{project.branding.title}</strong>
        <span>{project.branding.subtitle}</span>
      </div>
    </div>
  );
}

export function MapFooter({ project }: { project: Qgis2webProject }) {
  if (!project.branding.showFooter || project.branding.footerPlacement === "hidden") return null;
  return <div className={`map-footer-preview footer-${project.branding.footerPlacement}`}>{project.branding.footer}</div>;
}

export function WelcomeOverlay({ project }: { project: Qgis2webProject }) {
  const welcome = project.branding.welcome;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [welcome.enabled, welcome.title, welcome.subtitle, welcome.placement]);
  if (!welcome.enabled || dismissed) return null;
  return (
    <div className={`map-welcome-preview welcome-${welcome.placement}`}>
      <div>
        <h2>{welcome.title || project.branding.title}</h2>
        <div className="map-welcome-content" dangerouslySetInnerHTML={{ __html: renderMarkdownContent(welcome.subtitle || project.branding.subtitle) }} />
        <button type="button" onClick={() => setDismissed(true)}>{welcome.ctaLabel || "Mulai jelajah"}</button>
      </div>
    </div>
  );
}

export function SidebarPanel({ project }: { project: Qgis2webProject }) {
  if (!project.sidebar.enabled) return null;
  return (
    <aside className={`map-sidebar-preview side-${project.sidebar.side}`} style={{ width: project.sidebar.width }}>
      <div className="map-sidebar-content" dangerouslySetInnerHTML={{ __html: renderMarkdownContent(project.sidebar.content) }} />
    </aside>
  );
}

export function LayerControl({
  layers,
  layerVisibility,
  onLayerVisibilityChange
}: {
  layers: LayerManifest[];
  layerVisibility?: Record<string, boolean>;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
}) {
  const toggleableLayers = layers.filter((layer) => layer.showInLayerControl);
  if (toggleableLayers.length === 0) return null;
  return (
    <aside className="layer-toggle-preview">
      <h3>
        <Layers3 size={15} /> Layers
      </h3>
      {toggleableLayers.map((layer) => {
        const checked = layerVisibility?.[layer.id] ?? layer.visible;
        return (
          <label key={layer.id}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onLayerVisibilityChange?.(layer.id, event.target.checked)}
            />
            <span>{layer.displayName}</span>
          </label>
        );
      })}
    </aside>
  );
}

export function LegendPanel({
  groups,
  open,
  position,
  onOpenChange
}: {
  groups: LegendGroup[];
  open: boolean;
  position: Qgis2webProject["legendSettings"]["position"];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <aside className={`legend-preview legend-${position} ${open ? "" : "collapsed"}`}>
      <button type="button" className="legend-toggle" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>Legenda</span>
      </button>
      {open && (
        <div className="legend-groups">
          {groups.map((group) => (
            <div className="legend-group" key={group.id}>
              <h4>{group.label}</h4>
              {group.items.map((item) => (
                <LegendRow key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function LegendRow({ item }: { item: LegendItem }) {
  return (
    <div className={`legend-row symbol-${item.symbolType}`}>
      <span
        style={{
          background: item.symbolType === "line" ? "transparent" : item.fillColor,
          borderColor: item.strokeColor,
          borderTopWidth: item.symbolType === "line" ? Math.max(2, item.strokeWidth) : undefined,
          borderStyle: item.dashArray ? "dashed" : "solid"
        }}
      />
      {item.label}
    </div>
  );
}
