export type GeometryOpsPanelProps = {
  selectedLayerHasMultiGeometry: boolean;
};

export function GeometryOpsPanel({ selectedLayerHasMultiGeometry }: GeometryOpsPanelProps) {
  if (!selectedLayerHasMultiGeometry) return null;
  return <div className="editor-note">This layer contains multi-geometry features. Style, popup, legend, and attributes remain editable, but vertex editing is disabled to keep the data safe.</div>;
}
