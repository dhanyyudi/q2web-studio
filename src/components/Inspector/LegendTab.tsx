import { Plus } from "lucide-react";
import type { Qgis2webProject } from "../../types/project";
import { PanelTitle } from "./controls";

type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };

export type LegendTabProps = {
  project: Qgis2webProject;
  updateProject: (project: Qgis2webProject, options?: UpdateProjectOptions) => void;
  addManualLegend: () => void;
};

export function LegendTab({ project, updateProject, addManualLegend }: LegendTabProps) {
  return (
    <>
      <PanelTitle title="Manual Legend" />
      <button type="button" className="btn full" onClick={addManualLegend}><Plus size={15} /> Add legend item</button>
      {project.manualLegendItems.map((item) => (
        <div className="category-row" key={item.id}>
          <input value={item.label} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, label: event.target.value } : legend) })} />
          <input type="color" value={item.fillColor} onChange={(event) => updateProject({ ...project, manualLegendItems: project.manualLegendItems.map((legend) => legend.id === item.id ? { ...legend, fillColor: event.target.value } : legend) })} />
        </div>
      ))}
    </>
  );
}
