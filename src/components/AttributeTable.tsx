import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Maximize2, Minimize2, Settings2, Table2, X } from "lucide-react";
import { toast } from "sonner";
import { addField, deleteField, renameField, updateFeatureProperty } from "../lib/projectUpdates";
import { fieldNames } from "../lib/style";
import type { LayerManifest, Qgis2webProject } from "../types/project";

export type TableMode = "open" | "minimized" | "maximized";

type AttributeTableProps = {
  project: Qgis2webProject;
  layer: LayerManifest;
  mode: TableMode;
  setMode: (mode: TableMode) => void;
  filter: string;
  setFilter: (value: string) => void;
  showFieldsDialog: boolean;
  setShowFieldsDialog: (value: boolean) => void;
  newField: string;
  setNewField: (value: string) => void;
  renameFrom: string;
  setRenameFrom: (value: string) => void;
  renameTo: string;
  setRenameTo: (value: string) => void;
  updateProject: (project: Qgis2webProject) => void;
};

export function AttributeTable(props: AttributeTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const fields = useMemo(() => fieldNames(props.layer), [props.layer]);
  const deferredFilter = useDeferredValue(props.filter);
  const normalizedFilter = deferredFilter.trim().toLowerCase();
  const sourceIndexByFeature = useMemo(
    () => new Map(props.layer.geojson.features.map((feature, index) => [feature, index])),
    [props.layer.geojson.features]
  );
  const rows = useMemo(
    () =>
      normalizedFilter
        ? props.layer.geojson.features.filter((feature) =>
            fields.some((field) => String(feature.properties?.[field] ?? "").toLowerCase().includes(normalizedFilter))
          )
        : props.layer.geojson.features,
    [fields, normalizedFilter, props.layer.geojson.features]
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 12
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const topSpacer = virtualRows[0]?.start ?? 0;
  const bottomSpacer = virtualRows.length > 0 ? Math.max(0, totalSize - virtualRows[virtualRows.length - 1].end) : 0;

  useEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [props.layer.id, normalizedFilter, rowVirtualizer]);

  return (
    <section className={props.mode === "minimized" ? "attribute-panel minimized" : "attribute-panel"}>
      <div className="attribute-toolbar">
        <div className="attribute-title">
          <h2>
            <Table2 size={16} /> Attribute Table: {props.layer.displayName}
          </h2>
          <span>
            Showing {rows.length.toLocaleString()} of {props.layer.geojson.features.length.toLocaleString()} features
          </span>
        </div>
        <div className="attribute-actions">
          <input
            className="attribute-filter"
            placeholder="Filter attributes"
            value={props.filter}
            onChange={(event) => props.setFilter(event.target.value)}
          />
          <button type="button" className="btn compact" onClick={() => props.setShowFieldsDialog(true)}>
            <Settings2 size={15} /> Fields
          </button>
          <button type="button" className="btn compact" onClick={() => props.setMode(props.mode === "minimized" ? "open" : "minimized")}>
            <Minimize2 size={15} /> {props.mode === "minimized" ? "Open" : "Minimize"}
          </button>
          <button type="button" className="btn compact" onClick={() => props.setMode(props.mode === "maximized" ? "open" : "maximized")}>
            <Maximize2 size={15} /> {props.mode === "maximized" ? "Restore" : "Maximize"}
          </button>
        </div>
      </div>
      {props.mode !== "minimized" && (
        <div className="table-scroll" ref={parentRef}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                {fields.map((field) => (
                  <th key={field}>{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSpacer > 0 && (
                <tr className="virtual-spacer">
                  <td colSpan={fields.length + 1} style={{ height: topSpacer }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const feature = rows[virtualRow.index];
                const sourceIndex = sourceIndexByFeature.get(feature) ?? virtualRow.index;
                return (
                  <tr key={String(feature.id || `${sourceIndex}-${virtualRow.index}`)}>
                    <td>{sourceIndex + 1}</td>
                    {fields.map((field) => (
                      <td key={field}>
                        <input
                          value={String(feature.properties?.[field] ?? "")}
                          onChange={(event) =>
                            props.updateProject(
                              updateFeatureProperty(props.project, props.layer.id, sourceIndex, field, event.target.value)
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {bottomSpacer > 0 && (
                <tr className="virtual-spacer">
                  <td colSpan={fields.length + 1} style={{ height: bottomSpacer }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  props.updateProject(addField(props.project, props.layer.id, props.newField));
                  props.setNewField("");
                  toast.success("Field added");
                }}
              >
                Add Field
              </button>
              <SelectField
                label="Rename or delete"
                value={props.renameFrom}
                onChange={props.setRenameFrom}
                options={[{ value: "", label: "Select field" }, ...fields.map((field) => ({ value: field, label: field }))]}
              />
              <TextInput label="New name" value={props.renameTo} onChange={props.setRenameTo} />
              <div className="field-dialog-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    props.updateProject(renameField(props.project, props.layer.id, props.renameFrom, props.renameTo));
                    props.setRenameFrom("");
                    props.setRenameTo("");
                    toast.success("Field renamed");
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    if (!props.renameFrom) return;
                    props.updateProject(deleteField(props.project, props.layer.id, props.renameFrom));
                    props.setRenameFrom("");
                    toast.success("Field deleted");
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
