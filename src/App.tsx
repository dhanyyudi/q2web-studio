import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Circle,
  Download,
  FolderOpen,
  MousePointer2,
  PenLine,
  Plus,
  Save,
  Square,
  Table2,
  Trash2,
  Type,
  Wand2
} from "lucide-react";
import bbox from "@turf/bbox";
import type { Feature, Point } from "geojson";
import { MapCanvas } from "./components/MapCanvas";
import { ToolbarButton } from "./components/ToolbarButton";
import { filesFromDirectoryHandle, filesFromFileList } from "./lib/fileImport";
import { downloadBlob, exportProjectZip } from "./lib/exportProject";
import { addField, deleteField, renameField, updateFeatureProperty, updateLayer } from "./lib/projectUpdates";
import { loadProjectFromOpfs, saveProjectToOpfs } from "./lib/opfs";
import { parseProjectInWorker } from "./lib/workerClient";
import { fieldNames } from "./lib/style";
import type { DrawMode, LayerManifest, Qgis2webProject, TextAnnotation } from "./types/project";

type WindowWithDirectoryPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<Parameters<typeof filesFromDirectoryHandle>[0]>;
  };

export function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [project, setProject] = useState<Qgis2webProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [status, setStatus] = useState("Drop folder hasil export qgis2web atau pilih folder dari komputer.");
  const [busy, setBusy] = useState(false);
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
        setProject(cached);
        setSelectedLayerId(cached.layers[0]?.id || "");
        setStatus("Project terakhir dipulihkan dari OPFS browser cache.");
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
    setStatus("Membaca folder dan parsing qgis2web di worker...");
    try {
      const files = await filesFromFileList(fileList);
      const parsed = await parseProjectInWorker(files);
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      setStatus(`Import selesai: ${parsed.layers.length} layer terbaca dari ${parsed.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import gagal.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importDirectoryHandle(handle: Parameters<typeof filesFromDirectoryHandle>[0]) {
    setBusy(true);
    setStatus("Membaca folder lewat File System Access API...");
    try {
      const files = await filesFromDirectoryHandle(handle);
      const parsed = await parseProjectInWorker(files);
      setProject(parsed);
      setSelectedLayerId(parsed.layers[0]?.id || "");
      await saveProjectToOpfs(parsed);
      setStatus(`Import selesai: ${parsed.layers.length} layer terbaca dari ${parsed.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportClick() {
    const directoryPicker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (directoryPicker) {
      try {
        const handle = await directoryPicker();
        await importDirectoryHandle(handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("Import dibatalkan.");
          return;
        }
        setStatus("Folder picker modern gagal. Menggunakan fallback browser.");
      }
    }
    inputRef.current?.click();
  }

  async function exportZip() {
    if (!project) return;
    setBusy(true);
    setStatus("Membuat ZIP static qgis2web dengan q2ws runtime...");
    try {
      const blob = await exportProjectZip(project);
      downloadBlob(blob, `${project.name}-studio.zip`);
      setStatus("Export selesai. ZIP berisi q2ws-config, runtime, CSS, dan data GeoJSON terbaru.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export gagal.");
    } finally {
      setBusy(false);
    }
  }

  function updateProject(next: Qgis2webProject) {
    setProject(next);
    saveProjectToOpfs(next);
  }

  function patchSelectedLayer(patch: Partial<LayerManifest>) {
    if (!project || !selectedLayer) return;
    updateProject(updateLayer(project, selectedLayer.id, patch));
  }

  function addManualLegend() {
    if (!project) return;
    updateProject({
      ...project,
      manualLegendItems: [
        ...project.manualLegendItems,
        {
          id: crypto.randomUUID(),
          label: "Item legenda manual",
          fillColor: project.theme.accent,
          strokeColor: "#172026",
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
        text: "Label baru",
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

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>qgis2web Studio</h1>
          <p>Local-first editor untuk export qgis2web Leaflet.</p>
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
          <button type="button" disabled={busy} onClick={handleImportClick}>
            <FolderOpen size={16} /> Import Folder
          </button>
          <button type="button" disabled={!project || busy} onClick={() => project && saveProjectToOpfs(project).then(() => setStatus("Project tersimpan ke OPFS browser cache."))}>
            <Save size={16} /> Save Local
          </button>
          <button type="button" disabled={!project || busy} onClick={exportZip}>
            <Download size={16} /> Export ZIP
          </button>
        </div>
      </header>

      <section
        className="workspace"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          importFiles(event.dataTransfer.files);
        }}
      >
        <aside className="side-panel">
          <PanelTitle icon={<Wand2 size={16} />} title="Project" />
          <div className="status-box">{busy ? "Working..." : status}</div>
          <CapabilityGrid />

          {project && (
            <>
              <PanelTitle title="Theme" />
              <TextInput label="Title" value={project.branding.title} onChange={(title) => updateProject({ ...project, branding: { ...project.branding, title } })} />
              <TextInput label="Subtitle" value={project.branding.subtitle} onChange={(subtitle) => updateProject({ ...project, branding: { ...project.branding, subtitle } })} />
              <TextInput label="Footer" value={project.branding.footer} onChange={(footer) => updateProject({ ...project, branding: { ...project.branding, footer } })} />
              <ColorInput label="Accent" value={project.theme.accent} onChange={(accent) => updateProject({ ...project, theme: { ...project.theme, accent } })} />
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

              <PanelTitle title="Layers" />
              <div className="layer-list">
                {project.layers.map((layer) => (
                  <button
                    type="button"
                    key={layer.id}
                    className={layer.id === selectedLayer?.id ? "layer-row selected" : "layer-row"}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <span>{layer.displayName}</span>
                    <small>{layer.geometryType}</small>
                  </button>
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
              <FolderOpen size={40} />
              <h2>Import folder qgis2web Leaflet</h2>
              <p>Pilih folder seperti `qgis2web_2026_04_22-06_30_44_400659`, lalu editor akan membaca layer, atribut, style, dan legend.</p>
            </div>
          )}
        </section>

        {project && selectedLayer && (
          <aside className="inspector">
            <PanelTitle title="Layer Editor" />
            <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => patchSelectedLayer({ displayName })} />
            <div className="toggle-grid">
              <label><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => patchSelectedLayer({ visible: event.target.checked })} />Visible</label>
              <label><input type="checkbox" checked={selectedLayer.popupEnabled} onChange={(event) => patchSelectedLayer({ popupEnabled: event.target.checked })} />Popup</label>
              <label><input type="checkbox" checked={selectedLayer.legendEnabled} onChange={(event) => patchSelectedLayer({ legendEnabled: event.target.checked })} />Legend</label>
              <label><input type="checkbox" checked={selectedLayer.showInLayerControl} onChange={(event) => patchSelectedLayer({ showInLayerControl: event.target.checked })} />Toggle</label>
            </div>

            <PanelTitle title="Spatial Style" />
            <ColorInput label="Fill" value={selectedLayer.style.fillColor} onChange={(fillColor) => patchSelectedLayer({ style: { ...selectedLayer.style, fillColor } })} />
            <ColorInput label="Stroke" value={selectedLayer.style.strokeColor} onChange={(strokeColor) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeColor } })} />
            <RangeInput label="Fill opacity" value={selectedLayer.style.fillOpacity} min={0} max={1} step={0.05} onChange={(fillOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, fillOpacity } })} />
            <RangeInput label="Stroke width" value={selectedLayer.style.strokeWidth} min={0} max={12} step={0.5} onChange={(strokeWidth) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeWidth } })} />
            <RangeInput label="Point radius" value={selectedLayer.style.pointRadius} min={2} max={24} step={1} onChange={(pointRadius) => patchSelectedLayer({ style: { ...selectedLayer.style, pointRadius } })} />
            <TextInput label="Dash array" value={selectedLayer.style.dashArray} onChange={(dashArray) => patchSelectedLayer({ style: { ...selectedLayer.style, dashArray } })} />

            <PanelTitle title="Categorized Style" />
            <select value={selectedLayer.style.categoryField} onChange={(event) => patchSelectedLayer({ style: { ...selectedLayer.style, categoryField: event.target.value } })}>
              <option value="">No category field</option>
              {fieldNames(selectedLayer).map((field) => <option key={field} value={field}>{field}</option>)}
            </select>
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

            <PanelTitle title="Manual Legend" />
            <button type="button" onClick={addManualLegend}><Plus size={15} /> Add legend item</button>
            {project.manualLegendItems.map((item) => (
              <div className="category-row" key={item.id}>
                <input value={item.label} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, label: event.target.value } : legend) })} />
                <input type="color" value={item.fillColor} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, fillColor: event.target.value } : legend) })} />
              </div>
            ))}
          </aside>
        )}
      </section>
    </main>
  );
}

function AttributeTable(props: {
  project: Qgis2webProject;
  layer: LayerManifest;
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
        <div className="field-actions">
          <input placeholder="new_field" value={props.newField} onChange={(event) => props.setNewField(event.target.value)} />
          <button type="button" onClick={() => {
            props.updateProject(addField(props.project, props.layer.id, props.newField));
            props.setNewField("");
          }}>Add Field</button>
          <select value={props.renameFrom} onChange={(event) => props.setRenameFrom(event.target.value)}>
            <option value="">Rename field</option>
            {fields.map((field) => <option key={field} value={field}>{field}</option>)}
          </select>
          <input placeholder="new name" value={props.renameTo} onChange={(event) => props.setRenameTo(event.target.value)} />
          <button type="button" onClick={() => {
            props.updateProject(renameField(props.project, props.layer.id, props.renameFrom, props.renameTo));
            props.setRenameFrom("");
            props.setRenameTo("");
          }}>Rename</button>
          <button type="button" onClick={() => props.renameFrom && props.updateProject(deleteField(props.project, props.layer.id, props.renameFrom))}>Delete</button>
        </div>
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
    </section>
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
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

function CapabilityGrid() {
  return (
    <div className="capability-grid">
      <span>Worker parser</span>
      <span>OPFS cache</span>
      <span>{crossOriginIsolated ? "SharedArrayBuffer ready" : "SAB optional"}</span>
      <span>Local only</span>
    </div>
  );
}

function projectCenter(project: Qgis2webProject): [number, number] {
  const box = bbox({
    type: "FeatureCollection",
    features: project.layers.flatMap((layer) => layer.geojson.features)
  });
  if (box.some((value) => !Number.isFinite(value))) return [0, 0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}
