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
  return (
    <>
      <div className="selected-feature-actions" data-testid="layer-geometry-ops">
        {selectedGeometryKind === "polygon" && (
          <button type="button" className="btn compact" onClick={polygonToLineSelectedFeature}>Polygon to line</button>
        )}
        {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && (
          <button type="button" className="btn compact" onClick={convexHullSelectedFeature}>Convex hull</button>
        )}
        {selectedGeometryKind === "line" && (
          <>
            <button type="button" className="btn compact" onClick={splitLineSelectedFeature} disabled={!selectedFeatureData?.layer.geometryType.includes("Line")}>Split line</button>
            <button type="button" className="btn compact" onClick={divideLineSelectedFeature} disabled={!selectedFeatureData?.layer.geometryType.includes("Line")}>Divide line</button>
          </>
        )}
        {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && (
          <button type="button" className="btn compact" onClick={simplifySelectedFeature}>Simplify selected feature</button>
        )}
      </div>
      {selectedLayerHasMultiGeometry && (
        <div className="editor-note">This layer contains multi-geometry features. Style, popup, legend, and attributes remain editable, but vertex editing is disabled to keep the data safe.</div>
      )}
    </>
  );
}
