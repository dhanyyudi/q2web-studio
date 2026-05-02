import type { LayerManifest, PopupSettings } from "../../types/project";
import { renderLayerPopupHtml } from "../../lib/popupRendering";

export function PopupPreview({ layer, settings }: { layer: LayerManifest; settings: PopupSettings }) {
  const feature = layer.geojson.features[0];
  if (!feature) {
    return <div className="popup-preview-empty">No feature available for popup preview.</div>;
  }

  return (
    <div className="popup-preview-card" aria-label="Popup live preview">
      <div dangerouslySetInnerHTML={{ __html: renderLayerPopupHtml({ layer, feature, settings }) }} />
    </div>
  );
}
