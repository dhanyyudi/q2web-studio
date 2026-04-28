import { Download, X } from "lucide-react";
import { MapCanvas } from "./MapCanvas";
import type { Qgis2webProject } from "../types/project";

type PreviewOverlayProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  onClose: () => void;
  onExport: () => void;
  onProjectChange: (project: Qgis2webProject) => void;
  onTileError: (message: string) => void;
};

export function PreviewOverlay({
  project,
  selectedLayerId,
  onClose,
  onExport,
  onProjectChange,
  onTileError
}: PreviewOverlayProps) {
  return (
    <section className="preview-overlay" aria-label="Preview exported map">
      <div className="preview-topbar">
        <div>
          <strong>Preview</strong>
          <span>{project.branding.title}</span>
        </div>
        <div className="preview-actions">
          <button type="button" className="btn" onClick={onClose}>
            <X size={16} /> Exit Preview
          </button>
          <button type="button" className="btn primary" onClick={onExport}>
            <Download size={16} /> Export Now
          </button>
        </div>
      </div>
      <div className="preview-map">
        <MapCanvas
          project={project}
          selectedLayerId={selectedLayerId}
          drawMode="select"
          preview
          onProjectChange={onProjectChange}
          onTileError={onTileError}
        />
      </div>
    </section>
  );
}
