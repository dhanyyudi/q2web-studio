import type { LayerManifest } from "../../types/project";
import type { GeometryKind } from "./controls";

export type GeometryOpsPanelProps = {
  selectedFeatureData: { layer: LayerManifest; feature: GeoJSON.Feature } | null;
  selectedGeometryKind: GeometryKind;
  selectedLayerHasMultiGeometry: boolean;
  polygonToLineSelectedFeature: () => void;
  convexHullSelectedFeature: () => void;
  splitLineSelectedFeature: () => void;
  divideLineSelectedFeature: () => void;
  simplifySelectedFeature: () => void;
};

export function GeometryOpsPanel({ selectedFeatureData, selectedGeometryKind, selectedLayerHasMultiGeometry, polygonToLineSelectedFeature, convexHullSelectedFeature, splitLineSelectedFeature, divideLineSelectedFeature, simplifySelectedFeature }: GeometryOpsPanelProps) {
  const hasSelectedFeature = Boolean(selectedFeatureData);
  const lineFeatureSelected = Boolean(selectedFeatureData?.layer.geometryType.includes("Line"));

  return (
    <>
      <div className="selected-feature-actions" data-testid="layer-geometry-ops">
        {selectedGeometryKind === "polygon" && (
          <button type="button" className="btn compact" onClick={polygonToLineSelectedFeature} disabled={!hasSelectedFeature}>Polygon to line</button>
        )}
        {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && (
          <button type="button" className="btn compact" onClick={convexHullSelectedFeature} disabled={!hasSelectedFeature}>Convex hull</button>
        )}
        {selectedGeometryKind === "line" && (
          <>
            <button type="button" className="btn compact" onClick={splitLineSelectedFeature} disabled={!lineFeatureSelected}>Split line</button>
            <button type="button" className="btn compact" onClick={divideLineSelectedFeature} disabled={!lineFeatureSelected}>Divide line</button>
          </>
        )}
        {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && (
          <button type="button" className="btn compact" onClick={simplifySelectedFeature} disabled={!hasSelectedFeature}>Simplify selected feature</button>
        )}
      </div>
      {selectedLayerHasMultiGeometry && (
        <div className="editor-note">This layer contains multi-geometry features. Style, popup, legend, and attributes remain editable, but vertex editing is disabled to keep the data safe.</div>
      )}
    </>
  );
}
