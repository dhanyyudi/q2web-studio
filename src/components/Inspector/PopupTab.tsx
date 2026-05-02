import type { LayerManifest, PopupTemplateMode, Qgis2webProject } from "../../types/project";
import { ColorInput, PanelTitle, RangeInput, SelectField } from "./controls";

export type PopupTabProps = {
  project: Qgis2webProject;
  selectedLayer: LayerManifest;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
  ensurePopupTemplate: (layer: LayerManifest) => NonNullable<LayerManifest["popupTemplate"]>;
  renameSelectedPopupField: (oldKey: string, newKey: string) => void;
};

export function PopupTab({ project, selectedLayer, patchSelectedLayer, ensurePopupTemplate, renameSelectedPopupField }: PopupTabProps) {
  const popupTemplate = ensurePopupTemplate(selectedLayer);
  const popupSettings = selectedLayer.popupSettings;

  return (
    <>
      <PanelTitle title="Popup Template" />
      <SelectField
        label="Template mode"
        value={popupTemplate.mode}
        onChange={(mode) => patchSelectedLayer({ popupTemplate: { ...popupTemplate, mode: mode as PopupTemplateMode, fields: selectedLayer.popupFields } })}
        options={[{ value: "original", label: "Original HTML" }, { value: "field-grid", label: "Field grid" }, { value: "custom", label: "Custom HTML" }]}
      />
      {popupTemplate.mode === "custom" && (
        <>
          <PanelTitle title="Custom Popup HTML" />
          <textarea className="popup-custom-textarea" rows={6} value={popupTemplate.html || ""} placeholder="<table><tr><th>Field</th><td>{{FIELDNAME}}</td></tr></table>" onChange={(event) => patchSelectedLayer({ popupTemplate: { ...popupTemplate, html: event.target.value, fields: selectedLayer.popupFields } })} />
          <small className="popup-custom-hint">Use {"{{FIELDNAME}}"} for dynamic values. Allowed tags: table, tr, th, td, strong, br, span, div, p, b, i, em.</small>
        </>
      )}
      <PanelTitle title="Popup Style" />
      <div className="toggle-grid">
        <label>
          <input type="checkbox" checked={Boolean(selectedLayer.popupSettings)} onChange={(event) => patchSelectedLayer({ popupSettings: event.target.checked ? { ...project.popupSettings } : undefined })} />
          Override project style
        </label>
      </div>
      {popupSettings && (
        <>
          <ColorInput label="Accent" value={popupSettings.accentColor} onChange={(accentColor) => patchSelectedLayer({ popupSettings: { ...popupSettings, accentColor } })} />
          <ColorInput label="Background" value={popupSettings.backgroundColor} onChange={(backgroundColor) => patchSelectedLayer({ popupSettings: { ...popupSettings, backgroundColor } })} />
          <ColorInput label="Text" value={popupSettings.textColor} onChange={(textColor) => patchSelectedLayer({ popupSettings: { ...popupSettings, textColor } })} />
          <ColorInput label="Label" value={popupSettings.labelColor} onChange={(labelColor) => patchSelectedLayer({ popupSettings: { ...popupSettings, labelColor } })} />
          <RangeInput label="Radius" value={popupSettings.radius} min={0} max={22} step={1} onChange={(radius) => patchSelectedLayer({ popupSettings: { ...popupSettings, radius } })} />
          <RangeInput label="Shadow" value={popupSettings.shadow} min={0} max={42} step={1} onChange={(shadow) => patchSelectedLayer({ popupSettings: { ...popupSettings, shadow } })} />
        </>
      )}
      <PanelTitle title="Popup Fields" />
      <div className="popup-fields">
        {selectedLayer.popupFields.map((field) => (
          <div className="popup-field-row" key={field.key}>
            <label className="popup-field-toggle">
              <input type="checkbox" checked={field.visible} onChange={(event) => {
                const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, visible: event.target.checked } : item);
                patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
              }} />
              Visible
            </label>
            <input className="popup-field-key-input" value={field.key} onChange={(event) => renameSelectedPopupField(field.key, event.target.value)} />
            <input className="popup-field-label-input" value={field.label} onChange={(event) => {
              const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, label: event.target.value } : item);
              patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
            }} />
            <label className="popup-field-toggle">
              <input type="checkbox" checked={field.header} onChange={(event) => {
                const popupFields = selectedLayer.popupFields.map((item) => item.key === field.key ? { ...item, header: event.target.checked } : item);
                patchSelectedLayer({ popupFields, popupTemplate: { ...ensurePopupTemplate(selectedLayer), fields: popupFields } });
              }} />
              Header
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
