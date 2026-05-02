import type { MutableRefObject } from "react";
import { toast } from "sonner";
import { filesFromDataTransferItems, filesFromFileList, filesFromZipFile } from "../lib/fileImport";
import { downloadBlob, exportProjectZip } from "../lib/exportProject";
import { clearProjectFromOpfs, saveProjectToOpfs } from "../lib/opfs";
import { parseProjectInWorker } from "../lib/workerClient";
import type { DrawMode, Qgis2webProject, SelectedFeatureRef } from "../types/project";

export type ProjectHistoryState = {
  past: Array<{ project: Qgis2webProject; label: string; group?: string; updatedAt: number }>;
  future: Array<{ project: Qgis2webProject; label: string; group?: string; updatedAt: number }>;
};

export type UseImportExportArgs = {
  project: Qgis2webProject | null;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  zipInputRef: MutableRefObject<HTMLInputElement | null>;
  setProject: (project: Qgis2webProject | null) => void;
  setSelectedLayerId: (layerId: string) => void;
  setSelectedFeature: (selection: SelectedFeatureRef | null) => void;
  setInspectorMode: (mode: "project" | "layer") => void;
  setDrawMode: (mode: DrawMode) => void;
  setPreviewOpen: (open: boolean) => void;
  setAttributeFilter: (value: string) => void;
  setHistory: (history: ProjectHistoryState) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  hydrateProject: (project: Qgis2webProject) => Qgis2webProject;
  warnAboutLargeDatasets: (project: Qgis2webProject) => void;
};

export function useImportExport({
  project,
  inputRef,
  zipInputRef,
  setProject,
  setSelectedLayerId,
  setSelectedFeature,
  setInspectorMode,
  setDrawMode,
  setPreviewOpen,
  setAttributeFilter,
  setHistory,
  setBusy,
  setStatus,
  hydrateProject,
  warnAboutLargeDatasets
}: UseImportExportArgs) {
  async function persistProject(next: Qgis2webProject, successMessage?: string): Promise<boolean> {
    try {
      const result = await saveProjectToOpfs(next);
      showOpfsWarning(result);
      if (successMessage) {
        toast.success(successMessage);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project could not be saved to browser cache.";
      toast.error(message);
      return false;
    }
  }

  function showOpfsWarning(result: { warning?: string }) {
    if (result.warning) {
      toast.warning(result.warning, { duration: 9000 });
    }
  }

  async function importParsedProject(parsedSource: Qgis2webProject, successMessage: string) {
    const parsed = hydrateProject(parsedSource);
    setProject(parsed);
    setSelectedLayerId(parsed.layers[0]?.id || "");
    setHistory({ past: [], future: [] });
    warnAboutLargeDatasets(parsed);
    await persistProject(parsed);
    setStatus(successMessage);
    return parsed;
  }

  async function importFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setStatus("Parsing qgis2web folder in a worker...");
    const toastId = toast.loading("Importing qgis2web folder");
    try {
      const files = await filesFromFileList(fileList);
      const parsed = await parseProjectInWorker(files);
      await importParsedProject(parsed, `Imported ${parsed.layers.length} layers from ${parsed.name}.`);
      toast.success(`Imported ${parsed.layers.length} layers from ${parsed.name}.`, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importZip(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await importZipFile(file);
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  async function importZipFile(file: File) {
    setBusy(true);
    setStatus("Reading qgis2web ZIP locally...");
    const toastId = toast.loading("Importing qgis2web ZIP");
    try {
      const files = await filesFromZipFile(file);
      const parsed = await parseProjectInWorker(files);
      await importParsedProject(parsed, `Imported ${parsed.layers.length} layers from ${file.name}.`);
      toast.success(`Imported ${parsed.layers.length} layers from ${file.name}.`, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ZIP import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function importVirtualFiles(files: Awaited<ReturnType<typeof filesFromDataTransferItems>>, source: string) {
    if (files.length === 0) return;
    setBusy(true);
    setStatus(`Parsing qgis2web folder from ${source}...`);
    const toastId = toast.loading("Importing qgis2web folder");
    try {
      const parsed = await parseProjectInWorker(files);
      await importParsedProject(parsed, `Imported ${parsed.layers.length} layers from ${parsed.name}.`);
      toast.success(`Imported ${parsed.layers.length} layers from ${parsed.name}.`, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function startImport() {
    inputRef.current?.click();
  }

  function startZipImport() {
    zipInputRef.current?.click();
  }

  async function closeProject() {
    setProject(null);
    setSelectedLayerId("");
    setSelectedFeature(null);
    setInspectorMode("project");
    setDrawMode("select");
    setPreviewOpen(false);
    setAttributeFilter("");
    setHistory({ past: [], future: [] });
    setStatus("Project closed. Import a qgis2web export to start editing.");
    try {
      await clearProjectFromOpfs();
      toast.success("Project closed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project cache could not be cleared.";
      toast.warning(message);
    }
  }

  async function exportZip() {
    if (!project) return;
    setBusy(true);
    setStatus("Building static qgis2web ZIP with Studio runtime...");
    const toastId = toast.loading("Exporting ZIP");
    try {
      const blob = await exportProjectZip(project);
      downloadBlob(blob, `${project.name}-studio.zip`);
      setStatus("Export complete.");
      toast.success("Export ZIP complete", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return {
    closeProject,
    exportZip,
    importFiles,
    importVirtualFiles,
    importZip,
    importZipFile,
    persistProject,
    startImport,
    startZipImport
  };
}
