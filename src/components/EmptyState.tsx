import { FolderOpen } from "lucide-react";
import { Button } from "./ui/button";

type EmptyStateProps = {
  busy: boolean;
  onImportZip: () => void;
  onImportFolder: () => void;
};

export function EmptyState({ busy, onImportZip, onImportFolder }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="drop-card">
        <FolderOpen size={42} />
        <h2>Import qgis2web export</h2>
        <p>Visual editor untuk hasil export qgis2web</p>
        <small>Recommended: ZIP export for the cleanest browser import. Use Import Folder if drag and drop is blocked by the browser.</small>
        <p className="empty-state-note">q2webstudio is an independent editor for qgis2web exports and is not affiliated with qgis2web or OSGeo.</p>
      </div>
      <div className="empty-actions">
        <Button type="button" disabled={busy} onClick={onImportZip}>
          <FolderOpen size={16} /> Import ZIP
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onImportFolder}>
          <FolderOpen size={16} /> Import Folder
        </Button>
      </div>
    </div>
  );
}
