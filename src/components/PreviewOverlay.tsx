import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { MapCanvas } from "./MapCanvas";
import { buildRuntimePreview, type RuntimePreviewBundle } from "../lib/runtimePreview";
import { evictPreviewEntries } from "../lib/previewBridge";
import type { Qgis2webProject } from "../types/project";

type PreviewOverlayProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  onClose: () => void;
  onExport: () => void;
  onProjectChange: (project: Qgis2webProject, options?: { label?: string; group?: string; coalesceMs?: number }) => void;
  onTileError: (message: string) => void;
};

type PreviewMode = "runtime" | "editor";

export function PreviewOverlay({
  project,
  selectedLayerId,
  onClose,
  onExport,
  onProjectChange,
  onTileError
}: PreviewOverlayProps) {
  const runtimePreviewRef = useRef<RuntimePreviewBundle | null>(null);
  const openTabUrlRef = useRef<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>("runtime");
  const [runtimePreview, setRuntimePreview] = useState<RuntimePreviewBundle | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(project.layers.map((layer) => [layer.id, layer.visible]))
  );

  useEffect(() => {
    setLayerVisibility(Object.fromEntries(project.layers.map((layer) => [layer.id, layer.visible])));
  }, [project.layers]);

  useEffect(() => {
    if (mode !== "runtime") return;
    let disposed = false;
    setRuntimeBusy(true);
    buildRuntimePreview(project)
      .then((bundle) => {
        if (disposed) {
          void evictPreviewEntries(bundle.token);
          return;
        }
        setRuntimePreview((current) => {
          if (current?.token && current.token !== bundle.token) void evictPreviewEntries(current.token);
          runtimePreviewRef.current = bundle;
          return bundle;
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Runtime preview failed.";
        setRuntimePreview((current) => {
          if (current?.token) void evictPreviewEntries(current.token);
          runtimePreviewRef.current = null;
          return null;
        });
        toast.error(message);
      })
      .finally(() => {
        if (!disposed) setRuntimeBusy(false);
      });
    return () => {
      disposed = true;
    };
  }, [mode, project]);

  useEffect(() => {
    runtimePreviewRef.current = runtimePreview;
  }, [runtimePreview]);

  useEffect(() => {
    return () => {
      if (runtimePreviewRef.current?.token) void evictPreviewEntries(runtimePreviewRef.current.token);
      runtimePreviewRef.current = null;
      openTabUrlRef.current = null;
    };
  }, []);

  function openRuntimePreview() {
    if (!runtimePreview) return;
    openTabUrlRef.current = runtimePreview.url;
    window.open(runtimePreview.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="preview-overlay" aria-label="Preview exported map">
      <div className="preview-topbar">
        <div>
          <strong>Preview</strong>
          <span>{mode === "runtime" ? "Runtime export simulation" : "Fast editor preview"} · {project.branding.title}</span>
        </div>
        <div className="preview-actions">
          <div className="segmented preview-mode-toggle">
            <button type="button" className={mode === "runtime" ? "active" : ""} onClick={() => setMode("runtime")}>Runtime</button>
            <button type="button" className={mode === "editor" ? "active" : ""} onClick={() => setMode("editor")}>Editor</button>
          </div>
          {mode === "runtime" && (
            <button type="button" className="btn" disabled={!runtimePreview || runtimeBusy} onClick={openRuntimePreview}>
              <ExternalLink size={16} /> Open Tab
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            <X size={16} /> Exit Preview
          </button>
          <button type="button" className="btn primary" onClick={onExport}>
            <Download size={16} /> Export Now
          </button>
        </div>
      </div>
      <div className="preview-map">
        {mode === "runtime" ? (
          runtimePreview && !runtimeBusy ? (
            <iframe
              title="Runtime preview"
              data-testid="runtime-preview-frame"
              className="runtime-preview-frame"
              sandbox="allow-scripts allow-popups allow-same-origin"
              src={runtimePreview.url}
            />
          ) : (
            <div className="runtime-preview-loading">Building runtime preview...</div>
          )
        ) : (
          <MapCanvas
            project={project}
            selectedLayerId={selectedLayerId}
            drawMode="select"
            preview
            showLayerControl
            layerVisibility={layerVisibility}
            onLayerVisibilityChange={(layerId, visible) =>
              setLayerVisibility((current) => ({
                ...current,
                [layerId]: visible
              }))
            }
            onProjectChange={onProjectChange}
            onTileError={onTileError}
            selectedFeature={null}
            onSelectedFeatureChange={() => undefined}
          />
        )}
      </div>
    </section>
  );
}
