import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Toaster, toast } from "sonner";
import {
  Circle,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Layers3,
  MousePointer2,
  Paintbrush,
  PenLine,
  Plus,
  Save,
  Settings2,
  Square,
  Table2,
  Trash2,
  Type,
  Wand2,
  X
} from "lucide-react";
import bbox from "@turf/bbox";
import type { Feature, Point } from "geojson";
import { MapCanvas } from "./components/MapCanvas";
import { ToolbarButton } from "./components/ToolbarButton";
import { filesFromDataTransferItems, filesFromDirectoryHandle, filesFromFileList, filesFromZipFile } from "./lib/fileImport";
import { downloadBlob, exportProjectZip } from "./lib/exportProject";
import { addField, deleteField, renameField, updateFeatureProperty, updateLayer } from "./lib/projectUpdates";
import { loadProjectFromOpfs, saveProjectToOpfs } from "./lib/opfs";
import { parseProjectInWorker } from "./lib/workerClient";
import { fieldNames } from "./lib/style";
import type {
  BasemapId,
  DrawMode,
  LayerManifest,
  MapViewMode,
  Qgis2webProject,
  TextAnnotation
} from "./types/project";

type WindowWithDirectoryPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<Parameters<typeof filesFromDirectoryHandle>[0]>;
  };

const BASEMAP_LABELS: Record<BasemapId, string> = {
  osm: "OpenStreetMap",
  "carto-voyager": "Carto Voyager",
  "esri-imagery": "Esri World Imagery",
  none: "None"
};

export function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [project, setProject] = useState<Qgis2webProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [status, setStatus] = useState("Import a qgis2web Leaflet export folder to start editing.");
  const [busy, setBusy] = useState(false);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [newField, setNewField] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const selectedLayer = useMemo(
    () => project?.layers.find((layer) => layer.id === selectedLayerId) || project?.layers[0],
    [project, selectedLayerId]
  );

  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
    inputRef.current?.setAttribute("directory", "");
    loadProjectFromOpfs().then((cached) => {
      if (cached && !project) {
        const hydrated = hydrateProject(cached);
        setProject(hydrated);
        setSelectedLayerId(hydrated.layers[0]?.id || "");
        setStatus("Last project restored from browser cache.");
      }
    });
  }, []);

  useEffect(() => {
    if (project && !selectedLayerId) {
      setSelectedLayerId(project.layers[0]?.id || "");
    }
  }, [project, selectedLayerId]);

  async function importFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setStatus("Parsing qgis2web folder in a worker...");
    const toastId = toast.loading("Importing qgis2web folder");
    try {
      const files = await filesFromFileList(fileList);
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${parsed.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
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
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${file.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ZIP import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function importDirectoryHandle(handle: Parameters<typeof filesFromDirectoryHandle>[0]) {
    setBusy(true);
    setStatus("Reading qgis2web folder...");
    const toastId = toast.loading("Reading local folder");
    try {
      const files = await filesFromDirectoryHandle(handle);
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${parsed.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
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
      const parsed = hydrateProject(await parseProjectInWorker(files));
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      const message = `Imported ${parsed.layers.length} layers from ${parsed.name}.`;
      setStatus(message);
      toast.success(message, { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setStatus(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function startImport() {
    const directoryPicker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (directoryPicker) {
      try {
        const handle = await directoryPicker();
        await importDirectoryHandle(handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("Import cancelled.");
          return;
        }
        toast.warning("Opening another folder selector.");
      }
    }
    inputRef.current?.click();
  }

  function startZipImport() {
    zipInputRef.current?.click();
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

  function updateProject(next: Qgis2webProject) {
    const hydrated = hydrateProject(next);
    setProject(hydrated);
    saveProjectToOpfs(hydrated);
  }

  function patchSelectedLayer(patch: Partial<LayerManifest>) {
    if (!project || !selectedLayer) return;
    updateProject(updateLayer(project, selectedLayer.id, patch));
  }

  function setMapSetting<K extends keyof Qgis2webProject["mapSettings"]>(
    key: K,
    value: Qgis2webProject["mapSettings"][K]
  ) {
    if (!project) return;
    updateProject({ ...project, mapSettings: { ...project.mapSettings, [key]: value } });
  }

  function addManualLegend() {
    if (!project) return;
    updateProject({
      ...project,
      manualLegendItems: [
        ...project.manualLegendItems,
        {
          id: crypto.randomUUID(),
          label: "Manual legend item",
          fillColor: project.theme.accent,
          strokeColor: "#172026",
          strokeWidth: 2,
          dashArray: "",
          symbolType: "polygon",
          sourceImagePath: "",
          visible: true
        }
      ]
    });
  }

  function addTextAnnotation() {
    if (!project) return;
    const center = projectCenter(project);
    const annotation: TextAnnotation = {
      type: "Feature",
      id: crypto.randomUUID(),
      properties: {
        text: "New label",
        fontSize: 14,
        color: project.theme.text,
        anchor: "center"
      },
      geometry: {
        type: "Point",
        coordinates: center
      } satisfies Point
    };
    updateProject({ ...project, textAnnotations: [...project.textAnnotations, annotation] });
  }

  async function importLogo(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !project) return;
    const dataUrl = await fileToDataUrl(file);
    updateProject({ ...project, branding: { ...project.branding, logoPath: dataUrl, logoPlacement: "left" } });
    toast.success("Logo added to header preview");
  }

  return (
    <main className="app">
      <Toaster richColors position="top-right" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">q2</div>
          <div>
            <h1>qgis2web Studio</h1>
            <p>Local-first low-code editor for qgis2web Leaflet exports.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            multiple
            onChange={(event) => importFiles(event.target.files)}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
          <input
            ref={zipInputRef}
            className="hidden-input"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(event) => importZip(event.target.files)}
          />
          <button type="button" className="btn primary" disabled={busy} onClick={startZipImport}>
            <FolderOpen size={16} /> Import ZIP
          </button>
          <button type="button" className="btn" disabled={busy} onClick={startImport}>
            <FolderOpen size={16} /> Import Folder
          </button>
          <button
            type="button"
            className="btn"
            disabled={!project || busy}
            onClick={() =>
              project &&
              saveProjectToOpfs(project).then(() => {
                setStatus("Project saved to browser cache.");
                toast.success("Project saved locally");
              })
            }
          >
            <Save size={16} /> Save Local
          </button>
          <button type="button" className="btn" disabled={!project || busy} onClick={exportZip}>
            <Download size={16} /> Export ZIP
          </button>
        </div>
      </header>

      <section
        className="workspace"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const droppedFolderFiles = await filesFromDataTransferItems(event.dataTransfer.items);
          if (droppedFolderFiles.length > 0) {
            await importVirtualFiles(droppedFolderFiles, "drag and drop");
            return;
          }
          const zipFile = Array.from(event.dataTransfer.files).find((file) => file.name.toLowerCase().endsWith(".zip"));
          if (zipFile) {
            await importZipFile(zipFile);
            return;
          }
          importFiles(event.dataTransfer.files);
        }}
      >
        <aside className="side-panel">
          <PanelTitle icon={<Wand2 size={16} />} title="Project" />
          <div className="status-box">{busy ? "Working..." : status}</div>

          {project && (
            <>
              <PanelTitle icon={<Settings2 size={16} />} title="Map View" />
              <SelectField
                label="Basemap"
                value={project.mapSettings.basemap}
                onChange={(value) => setMapSetting("basemap", value as BasemapId)}
                options={Object.entries(BASEMAP_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <SegmentedControl
                label="Layer display"
                value={project.mapSettings.viewMode}
                options={[
                  { value: "all", label: "All layers" },
                  { value: "selected", label: "Selected layer" }
                ]}
                onChange={(value) => setMapSetting("viewMode", value as MapViewMode)}
              />

              <PanelTitle icon={<Layers3 size={16} />} title="Layers" />
              <div className="layer-list">
                {project.layers.map((layer) => (
                  <div key={layer.id} className={layer.id === selectedLayer?.id ? "layer-row selected" : "layer-row"}>
                    <button type="button" className="layer-main" onClick={() => setSelectedLayerId(layer.id)}>
                      <span>{layer.displayName}</span>
                      <small>{layer.geometryType}</small>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={layer.visible ? "Hide layer" : "Show layer"}
                      onClick={() => updateProject(updateLayer(project, layer.id, { visible: !layer.visible }))}
                    >
                      {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="main-stage">
          {project && selectedLayer ? (
            <>
              <div className="toolbar">
                <ToolbarButton title="Select and edit" active={drawMode === "select"} onClick={() => setDrawMode("select")}>
                  <MousePointer2 size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw point" active={drawMode === "point"} onClick={() => setDrawMode("point")}>
                  <Circle size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw line" active={drawMode === "linestring"} onClick={() => setDrawMode("linestring")}>
                  <PenLine size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw polygon" active={drawMode === "polygon"} onClick={() => setDrawMode("polygon")}>
                  <Square size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw rectangle" active={drawMode === "rectangle"} onClick={() => setDrawMode("rectangle")}>
                  <Square size={17} />
                </ToolbarButton>
                <ToolbarButton title="Draw circle" active={drawMode === "circle"} onClick={() => setDrawMode("circle")}>
                  <Circle size={17} />
                </ToolbarButton>
                <ToolbarButton title="Delete selected" active={drawMode === "delete"} onClick={() => setDrawMode("delete")}>
                  <Trash2 size={17} />
                </ToolbarButton>
                <ToolbarButton title="Add text annotation" onClick={addTextAnnotation}>
                  <Type size={17} />
                </ToolbarButton>
              </div>
              <MapCanvas project={project} selectedLayerId={selectedLayer.id} drawMode={drawMode} onProjectChange={updateProject} />
              <AttributeTable
                project={project}
                layer={selectedLayer}
                showFieldsDialog={showFieldsDialog}
                setShowFieldsDialog={setShowFieldsDialog}
                newField={newField}
                setNewField={setNewField}
                renameFrom={renameFrom}
                setRenameFrom={setRenameFrom}
                renameTo={renameTo}
                setRenameTo={setRenameTo}
                updateProject={updateProject}
              />
            </>
          ) : (
            <div className="empty-state">
              <FolderOpen size={42} />
              <h2>Import qgis2web Leaflet folder</h2>
              <p>Import a qgis2web export to start editing.</p>
              <div className="empty-actions">
                <button type="button" className="btn primary" disabled={busy} onClick={startZipImport}>
                  <FolderOpen size={16} /> Import ZIP
                </button>
                <button type="button" className="btn" disabled={busy} onClick={startImport}>
                  <FolderOpen size={16} /> Import Folder
                </button>
              </div>
            </div>
          )}
        </section>

        {project && selectedLayer && (
          <aside className="inspector">
            <Tabs.Root defaultValue="branding" className="tabs-root">
              <Tabs.List className="tabs-list" aria-label="Editor sections">
                <Tabs.Trigger value="branding">Branding</Tabs.Trigger>
                <Tabs.Trigger value="layer">Layer</Tabs.Trigger>
                <Tabs.Trigger value="style">Style</Tabs.Trigger>
                <Tabs.Trigger value="popup">Popup</Tabs.Trigger>
                <Tabs.Trigger value="legend">Legend</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="branding" className="tabs-content">
                <PanelTitle icon={<Paintbrush size={16} />} title="Header and Theme" />
                <TextInput label="Title" value={project.branding.title} onChange={(title) => updateProject({ ...project, branding: { ...project.branding, title } })} />
                <TextInput label="Subtitle" value={project.branding.subtitle} onChange={(subtitle) => updateProject({ ...project, branding: { ...project.branding, subtitle } })} />
                <TextInput label="Footer" value={project.branding.footer} onChange={(footer) => updateProject({ ...project, branding: { ...project.branding, footer } })} />
                <input ref={logoInputRef} className="hidden-input" type="file" accept="image/*" onChange={(event) => importLogo(event.target.files)} />
                <button type="button" className="btn full" onClick={() => logoInputRef.current?.click()}>
                  <Plus size={15} /> Add or Replace Logo
                </button>
                <SelectField
                  label="Logo placement"
                  value={project.branding.logoPlacement}
                  onChange={(logoPlacement) => updateProject({ ...project, branding: { ...project.branding, logoPlacement: logoPlacement as Qgis2webProject["branding"]["logoPlacement"] } })}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" },
                    { value: "hidden", label: "Hidden" }
                  ]}
                />
                <div className="toggle-grid">
                  {(["showHeader", "showFooter", "showWelcome", "showSidebar"] as const).map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={project.branding[key]}
                        onChange={(event) => updateProject({ ...project, branding: { ...project.branding, [key]: event.target.checked } })}
                      />
                      {key.replace("show", "")}
                    </label>
                  ))}
                </div>
                <ColorInput label="Accent" value={project.theme.accent} onChange={(accent) => updateProject({ ...project, theme: { ...project.theme, accent } })} />
                <ColorInput label="Surface" value={project.theme.surface} onChange={(surface) => updateProject({ ...project, theme: { ...project.theme, surface } })} />
                <ColorInput label="Text" value={project.theme.text} onChange={(text) => updateProject({ ...project, theme: { ...project.theme, text } })} />
                <ColorInput label="Muted" value={project.theme.muted} onChange={(muted) => updateProject({ ...project, theme: { ...project.theme, muted } })} />
                <RangeInput label="Radius" value={project.theme.radius} min={0} max={18} step={1} onChange={(radius) => updateProject({ ...project, theme: { ...project.theme, radius } })} />
                <RangeInput label="Shadow" value={project.theme.shadow} min={0} max={40} step={1} onChange={(shadow) => updateProject({ ...project, theme: { ...project.theme, shadow } })} />
                <RangeInput label="Header height" value={project.theme.headerHeight} min={36} max={92} step={2} onChange={(headerHeight) => updateProject({ ...project, theme: { ...project.theme, headerHeight } })} />
              </Tabs.Content>

              <Tabs.Content value="layer" className="tabs-content">
                <PanelTitle title="Layer Editor" />
                <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => patchSelectedLayer({ displayName })} />
                <div className="toggle-grid">
                  <label><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => patchSelectedLayer({ visible: event.target.checked })} />Visible</label>
                  <label><input type="checkbox" checked={selectedLayer.popupEnabled} onChange={(event) => patchSelectedLayer({ popupEnabled: event.target.checked })} />Popup</label>
                  <label><input type="checkbox" checked={selectedLayer.legendEnabled} onChange={(event) => patchSelectedLayer({ legendEnabled: event.target.checked })} />Legend</label>
                  <label><input type="checkbox" checked={selectedLayer.showInLayerControl} onChange={(event) => patchSelectedLayer({ showInLayerControl: event.target.checked })} />Layer toggle</label>
                </div>
              </Tabs.Content>

              <Tabs.Content value="style" className="tabs-content">
                <PanelTitle title="Spatial Style" />
                <ColorInput label="Fill" value={selectedLayer.style.fillColor} onChange={(fillColor) => patchSelectedLayer({ style: { ...selectedLayer.style, fillColor } })} />
                <ColorInput label="Stroke" value={selectedLayer.style.strokeColor} onChange={(strokeColor) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeColor } })} />
                <RangeInput label="Fill opacity" value={selectedLayer.style.fillOpacity} min={0} max={1} step={0.05} onChange={(fillOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, fillOpacity } })} />
                <RangeInput label="Stroke width" value={selectedLayer.style.strokeWidth} min={0} max={12} step={0.5} onChange={(strokeWidth) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeWidth } })} />
                <RangeInput label="Point radius" value={selectedLayer.style.pointRadius} min={2} max={24} step={1} onChange={(pointRadius) => patchSelectedLayer({ style: { ...selectedLayer.style, pointRadius } })} />
                <TextInput label="Dash array" value={selectedLayer.style.dashArray} onChange={(dashArray) => patchSelectedLayer({ style: { ...selectedLayer.style, dashArray } })} />
                <PanelTitle title="Categorized Style" />
                <SelectField
                  label="Field"
                  value={selectedLayer.style.categoryField}
                  onChange={(categoryField) => patchSelectedLayer({ style: { ...selectedLayer.style, categoryField } })}
                  options={[{ value: "", label: "No category field" }, ...fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))]}
                />
                {selectedLayer.style.categories.map((category, index) => (
                  <div className="category-row" key={category.value}>
                    <input value={category.label} onChange={(event) => {
                      const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
                      patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
                    }} />
                    <input type="color" value={category.fillColor} onChange={(event) => {
                      const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, fillColor: event.target.value } : item);
                      patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
                    }} />
                  </div>
                ))}
              </Tabs.Content>

              <Tabs.Content value="popup" className="tabs-content">
                <PanelTitle title="Popup Fields" />
                <div className="popup-fields">
                  {selectedLayer.popupFields.map((field) => (
                    <label key={field.key}>
                      <input
                        type="checkbox"
                        checked={field.visible}
                        onChange={(event) => patchSelectedLayer({ popupFields: selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, visible: event.target.checked } : item) })}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              </Tabs.Content>

              <Tabs.Content value="legend" className="tabs-content">
                <PanelTitle title="Manual Legend" />
                <button type="button" className="btn full" onClick={addManualLegend}><Plus size={15} /> Add legend item</button>
                {project.manualLegendItems.map((item) => (
                  <div className="category-row" key={item.id}>
                    <input value={item.label} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, label: event.target.value } : legend) })} />
                    <input type="color" value={item.fillColor} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, fillColor: event.target.value } : legend) })} />
                  </div>
                ))}
              </Tabs.Content>
            </Tabs.Root>
          </aside>
        )}
      </section>
    </main>
  );
}

function AttributeTable(props: {
  project: Qgis2webProject;
  layer: LayerManifest;
  showFieldsDialog: boolean;
  setShowFieldsDialog: (value: boolean) => void;
  newField: string;
  setNewField: (value: string) => void;
  renameFrom: string;
  setRenameFrom: (value: string) => void;
  renameTo: string;
  setRenameTo: (value: string) => void;
  updateProject: (project: Qgis2webProject) => void;
}) {
  const fields = fieldNames(props.layer);
  const rows = props.layer.geojson.features.slice(0, 80);
  return (
    <section className="attribute-panel">
      <div className="attribute-toolbar">
        <h2><Table2 size={16} /> Attribute Table: {props.layer.displayName}</h2>
        <button type="button" className="btn compact" onClick={() => props.setShowFieldsDialog(true)}>
          <Settings2 size={15} /> Fields
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {fields.map((field) => <th key={field}>{field}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((feature, featureIndex) => (
              <tr key={String(feature.id || featureIndex)}>
                <td>{featureIndex + 1}</td>
                {fields.map((field) => (
                  <td key={field}>
                    <input
                      value={String(feature.properties?.[field] ?? "")}
                      onChange={(event) => props.updateProject(updateFeatureProperty(props.project, props.layer.id, featureIndex, field, event.target.value))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={props.showFieldsDialog} onOpenChange={props.setShowFieldsDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content field-dialog">
            <Dialog.Title>Manage Fields</Dialog.Title>
            <Dialog.Description>Add, rename, or delete fields for the selected layer.</Dialog.Description>
            <button type="button" className="dialog-close" onClick={() => props.setShowFieldsDialog(false)} aria-label="Close">
              <X size={16} />
            </button>
            <div className="field-dialog-grid">
              <TextInput label="New field" value={props.newField} onChange={props.setNewField} />
              <button type="button" className="btn primary" onClick={() => {
                props.updateProject(addField(props.project, props.layer.id, props.newField));
                props.setNewField("");
                toast.success("Field added");
              }}>Add Field</button>
              <SelectField
                label="Rename or delete"
                value={props.renameFrom}
                onChange={props.setRenameFrom}
                options={[{ value: "", label: "Select field" }, ...fields.map((field) => ({ value: field, label: field }))]}
              />
              <TextInput label="New name" value={props.renameTo} onChange={props.setRenameTo} />
              <div className="field-dialog-actions">
                <button type="button" className="btn" onClick={() => {
                  props.updateProject(renameField(props.project, props.layer.id, props.renameFrom, props.renameTo));
                  props.setRenameFrom("");
                  props.setRenameTo("");
                  toast.success("Field renamed");
                }}>Rename</button>
                <button type="button" className="btn danger" onClick={() => {
                  if (!props.renameFrom) return;
                  props.updateProject(deleteField(props.project, props.layer.id, props.renameFrom));
                  props.setRenameFrom("");
                  toast.success("Field deleted");
                }}>Delete</button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
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

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field inline"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function RangeInput(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{props.label}: {props.value}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}

function hydrateProject(project: Qgis2webProject): Qgis2webProject {
  return {
    ...project,
    mapSettings: project.mapSettings || { basemap: "carto-voyager", viewMode: "all" },
    theme: {
      ...project.theme,
      headerHeight: project.theme.headerHeight ?? 48
    },
    branding: {
      ...project.branding,
      logoPath: project.branding.logoPath || "",
      logoPlacement: project.branding.logoPlacement || "left"
    },
    layers: project.layers.map((layer) => ({
      ...layer,
      style: {
        ...layer.style,
        symbolType: layer.style.symbolType || (layer.geometryType.includes("Line") ? "line" : layer.geometryType.includes("Point") ? "point" : "polygon"),
        sourceImagePath: layer.style.sourceImagePath || "",
        categories: layer.style.categories.map((category) => ({
          ...category,
          strokeWidth: category.strokeWidth ?? layer.style.strokeWidth,
          dashArray: category.dashArray || "",
          symbolType: category.symbolType || layer.style.symbolType || "polygon",
          sourceImagePath: category.sourceImagePath || ""
        }))
      }
    })),
    manualLegendItems: project.manualLegendItems.map((item) => ({
      ...item,
      strokeWidth: item.strokeWidth ?? 2,
      dashArray: item.dashArray || "",
      symbolType: item.symbolType || "polygon",
      sourceImagePath: item.sourceImagePath || ""
    }))
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function projectCenter(project: Qgis2webProject): [number, number] {
  const box = bbox({
    type: "FeatureCollection",
    features: project.layers.flatMap((layer) => layer.geojson.features)
  });
  if (box.some((value) => !Number.isFinite(value))) return [0, 0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}
