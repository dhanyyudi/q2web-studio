import type { RefObject } from "react";
import { Download, Eye, FolderOpen, Heart, Monitor, Moon, Redo2, Save, Sun, Undo2, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import type { Qgis2webProject } from "../types/project";

export type AppThemeMode = "light" | "dark" | "system";

type TopbarProps = {
  inputRef: RefObject<HTMLInputElement>;
  zipInputRef: RefObject<HTMLInputElement>;
  project: Qgis2webProject | null;
  busy: boolean;
  appTheme: AppThemeMode;
  historyPastLabel: string;
  historyFutureLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  onFolderInputChange: (files: FileList | null) => void;
  onZipInputChange: (files: FileList | null) => void;
  onStartZipImport: () => void;
  onStartFolderImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onThemeChange: (theme: AppThemeMode) => void;
  onSaveLocal: () => void;
  onCloseProject: () => void;
  onOpenPreview: () => void;
  onExportZip: () => void;
};

export function Topbar({
  inputRef,
  zipInputRef,
  project,
  busy,
  appTheme,
  historyPastLabel,
  historyFutureLabel,
  canUndo,
  canRedo,
  onFolderInputChange,
  onZipInputChange,
  onStartZipImport,
  onStartFolderImport,
  onUndo,
  onRedo,
  onThemeChange,
  onSaveLocal,
  onCloseProject,
  onOpenPreview,
  onExportZip
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">q2</div>
        <div>
          <h1>q2webstudio</h1>
          <p>Local-first low-code editor for qgis2web Leaflet exports.</p>
        </div>
      </div>
      <div className="topbar-actions">
        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => onFolderInputChange(event.target.files)}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
        <input
          ref={zipInputRef}
          className="hidden-input"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => onZipInputChange(event.target.files)}
        />
        <Button type="button" disabled={busy} onClick={onStartZipImport}>
          <FolderOpen size={16} /> Import ZIP
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onStartFolderImport}>
          <FolderOpen size={16} /> Import Folder
        </Button>
        <Button type="button" variant="outline" disabled={!project || busy || !canUndo} onClick={onUndo}>
          <Undo2 size={16} /> Undo {historyPastLabel ? `(${historyPastLabel})` : ""}
        </Button>
        <Button type="button" variant="outline" disabled={!project || busy || !canRedo} onClick={onRedo}>
          <Redo2 size={16} /> Redo {historyFutureLabel ? `(${historyFutureLabel})` : ""}
        </Button>
        <div className="theme-toggle" aria-label="App theme">
          <button type="button" className={appTheme === "light" ? "active" : ""} title="Light theme" onClick={() => onThemeChange("light")}>
            <Sun size={15} />
          </button>
          <button type="button" className={appTheme === "dark" ? "active" : ""} title="Dark theme" onClick={() => onThemeChange("dark")}>
            <Moon size={15} />
          </button>
          <button type="button" className={appTheme === "system" ? "active" : ""} title="Use system theme" onClick={() => onThemeChange("system")}>
            <Monitor size={15} />
          </button>
        </div>
        <Button type="button" variant="outline" disabled={!project || busy} onClick={onSaveLocal}>
          <Save size={16} /> Save Local
        </Button>
        <Button type="button" variant="outline" disabled={!project || busy} onClick={onCloseProject}>
          <XCircle size={16} /> Close Project
        </Button>
        <a data-testid="support-link" className="support-fab" href="https://tiptap.gg/dhanypedia" target="_blank" rel="noreferrer" aria-label="Support this project" title="Support this project">
          <Heart size={16} />
        </a>
        <Button data-testid="open-preview" type="button" variant="outline" disabled={!project || busy} onClick={onOpenPreview}>
          <Eye size={16} /> Preview
        </Button>
        <Button type="button" variant="outline" disabled={!project || busy} onClick={onExportZip}>
          <Download size={16} /> Export ZIP
        </Button>
      </div>
    </header>
  );
}
