import { Paintbrush, Plus } from "lucide-react";
import type { Qgis2webProject } from "../../types/project";
import { RangeNumberField } from "../forms/RangeNumberField";
import { ColorInput, PanelTitle, SegmentedControl, SelectField, TextAreaInput, TextInput } from "./controls";

type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };

export type BrandingTabProps = {
  project: Qgis2webProject;
  logoInputRef: React.RefObject<HTMLInputElement>;
  updateProject: (project: Qgis2webProject, options?: UpdateProjectOptions) => void;
  importLogo: (files: FileList | null) => void;
};

export function BrandingTab({ project, logoInputRef, updateProject, importLogo }: BrandingTabProps) {
  return (
    <>
      <PanelTitle icon={<Paintbrush size={16} />} title="Branding and Theme" />
      <TextInput label="Title" value={project.branding.title} onChange={(title) => updateProject({ ...project, branding: { ...project.branding, title } })} />
      <TextInput label="Subtitle" value={project.branding.subtitle} onChange={(subtitle) => updateProject({ ...project, branding: { ...project.branding, subtitle } })} />
      <TextInput label="Footer" value={project.branding.footer} onChange={(footer) => updateProject({ ...project, branding: { ...project.branding, footer } })} />
      <input ref={logoInputRef} className="hidden-input" type="file" accept="image/*" aria-hidden="true" tabIndex={-1} onChange={(event) => importLogo(event.target.files)} />
      <button type="button" className="btn full" onClick={() => logoInputRef.current?.click()}>
        <Plus size={15} /> Add or Replace Logo
      </button>
      <SelectField
        label="Logo placement"
        value={project.branding.logoPlacement}
        onChange={(logoPlacement) => updateProject({ ...project, branding: { ...project.branding, logoPlacement: logoPlacement as Qgis2webProject["branding"]["logoPlacement"] } })}
        options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }, { value: "hidden", label: "Hidden" }]}
      />
      <div className="toggle-grid">
        {(["showHeader", "showFooter"] as const).map((key) => (
          <label key={key}>
            <input type="checkbox" checked={project.branding[key]} onChange={(event) => updateProject({ ...project, branding: { ...project.branding, [key]: event.target.checked } })} />
            {key.replace("show", "")}
          </label>
        ))}
      </div>
      <SelectField
        label="Header placement"
        value={project.branding.headerPlacement}
        onChange={(headerPlacement) => updateProject({ ...project, branding: { ...project.branding, headerPlacement: headerPlacement as Qgis2webProject["branding"]["headerPlacement"] } })}
        options={[{ value: "top-full", label: "Top full" }, { value: "top-left-pill", label: "Top left pill" }, { value: "top-right-pill", label: "Top right pill" }, { value: "top-center-card", label: "Top center card" }, { value: "hidden", label: "Hidden" }]}
      />
      <SelectField
        label="Footer placement"
        value={project.branding.footerPlacement}
        onChange={(footerPlacement) => updateProject({ ...project, branding: { ...project.branding, footerPlacement: footerPlacement as Qgis2webProject["branding"]["footerPlacement"] } })}
        options={[{ value: "bottom-full", label: "Bottom full" }, { value: "bottom-left-pill", label: "Bottom left pill" }, { value: "bottom-right-pill", label: "Bottom right pill" }, { value: "hidden", label: "Hidden" }]}
      />
      <PanelTitle title="Welcome" />
      <div className="toggle-grid">
        <label><input type="checkbox" checked={project.branding.welcome.enabled} onChange={(event) => updateProject({ ...project, branding: { ...project.branding, showWelcome: event.target.checked, welcome: { ...project.branding.welcome, enabled: event.target.checked } } })} />Enabled</label>
        <label><input type="checkbox" checked={project.branding.welcome.showOnce} onChange={(event) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, showOnce: event.target.checked } } })} />Show once</label>
      </div>
      <TextInput label="Welcome title" value={project.branding.welcome.title} onChange={(title) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, title } } })} />
      <TextAreaInput label="Welcome subtitle markdown" value={project.branding.welcome.subtitle} onChange={(subtitle) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, subtitle } } })} />
      <TextInput label="CTA label" value={project.branding.welcome.ctaLabel} onChange={(ctaLabel) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, ctaLabel } } })} />
      <SelectField
        label="Auto dismiss"
        value={project.branding.welcome.autoDismiss}
        onChange={(autoDismiss) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, autoDismiss: autoDismiss as Qgis2webProject["branding"]["welcome"]["autoDismiss"] } } })}
        options={[{ value: "never", label: "Never" }, { value: "3", label: "3 seconds" }, { value: "5", label: "5 seconds" }, { value: "10", label: "10 seconds" }]}
      />
      <SegmentedControl
        label="Welcome placement"
        value={project.branding.welcome.placement}
        options={[{ value: "center", label: "Center modal" }, { value: "bottom", label: "Bottom sheet" }]}
        onChange={(placement) => updateProject({ ...project, branding: { ...project.branding, welcome: { ...project.branding.welcome, placement: placement as Qgis2webProject["branding"]["welcome"]["placement"] } } })}
      />
      <PanelTitle title="Sidebar" />
      <div className="toggle-grid">
        <label><input type="checkbox" checked={project.sidebar.enabled} onChange={(event) => updateProject({ ...project, sidebar: { ...project.sidebar, enabled: event.target.checked } })} />Enabled</label>
      </div>
      <SegmentedControl label="Sidebar side" value={project.sidebar.side} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={(side) => updateProject({ ...project, sidebar: { ...project.sidebar, side: side as Qgis2webProject["sidebar"]["side"] } })} />
      <RangeNumberField label="Sidebar width" value={project.sidebar.width} min={260} max={520} step={10} unit="px" onChange={(width) => updateProject({ ...project, sidebar: { ...project.sidebar, width } })} />
      <TextAreaInput label="Sidebar markdown" value={project.sidebar.content} onChange={(content) => updateProject({ ...project, sidebar: { ...project.sidebar, content } })} />
      <ColorInput label="Accent" value={project.theme.accent} onChange={(accent) => updateProject({ ...project, theme: { ...project.theme, accent } })} />
      <ColorInput label="Surface" value={project.theme.surface} onChange={(surface) => updateProject({ ...project, theme: { ...project.theme, surface } })} />
      <ColorInput label="Text" value={project.theme.text} onChange={(text) => updateProject({ ...project, theme: { ...project.theme, text } })} />
      <ColorInput label="Muted" value={project.theme.muted} onChange={(muted) => updateProject({ ...project, theme: { ...project.theme, muted } })} />
      <RangeNumberField label="Radius" value={project.theme.radius} min={0} max={18} step={1} unit="px" onChange={(radius) => updateProject({ ...project, theme: { ...project.theme, radius } })} />
      <RangeNumberField label="Shadow" value={project.theme.shadow} min={0} max={40} step={1} unit="px" onChange={(shadow) => updateProject({ ...project, theme: { ...project.theme, shadow } })} />
      <RangeNumberField label="Header height" value={project.theme.headerHeight} min={36} max={92} step={2} unit="px" onChange={(headerHeight) => updateProject({ ...project, theme: { ...project.theme, headerHeight } })} />
    </>
  );
}
