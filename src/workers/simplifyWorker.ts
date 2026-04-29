import simplify from "@turf/simplify";
import type { FeatureCollection } from "geojson";

type SimplifyLayerRequest = {
  id: string;
  geojson: FeatureCollection;
};

type SimplifyRequest = {
  type: "simplify";
  requestId: number;
  tolerance: number;
  layers: SimplifyLayerRequest[];
};

self.onmessage = (event: MessageEvent<SimplifyRequest>) => {
  const message = event.data;
  if (message.type !== "simplify") return;
  const simplified = message.layers.map((layer) => ({
    id: layer.id,
    geojson: simplify(layer.geojson, {
      tolerance: message.tolerance,
      highQuality: false,
      mutate: false
    }) as FeatureCollection
  }));
  self.postMessage({ requestId: message.requestId, simplified });
};
