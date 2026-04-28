import type { FeatureCollection } from "geojson";
import type { LayerManifest, Qgis2webProject } from "../types/project";

export function updateLayer(project: Qgis2webProject, layerId: string, patch: Partial<LayerManifest>): Qgis2webProject {
  return {
    ...project,
    layers: project.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer))
  };
}

export function updateLayerGeojson(
  project: Qgis2webProject,
  layerId: string,
  geojson: FeatureCollection
): Qgis2webProject {
  return updateLayer(project, layerId, { geojson });
}

export function updateFeatureProperty(
  project: Qgis2webProject,
  layerId: string,
  featureIndex: number,
  key: string,
  value: string
): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return project;
  const features = layer.geojson.features.map((feature, index) =>
    index === featureIndex
      ? {
          ...feature,
          properties: {
            ...(feature.properties || {}),
            [key]: value
          }
        }
      : feature
  );
  return updateLayerGeojson(project, layerId, { ...layer.geojson, features });
}

export function addField(project: Qgis2webProject, layerId: string, key: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || !key.trim()) return project;
  const cleanKey = key.trim().replace(/\s+/g, "_");
  const features = layer.geojson.features.map((feature) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      [cleanKey]: ""
    }
  }));
  return updateLayer(project, layerId, {
    geojson: { ...layer.geojson, features },
    popupFields: [
      ...layer.popupFields,
      {
        key: cleanKey,
        label: cleanKey,
        visible: true,
        header: false
      }
    ]
  });
}

export function renameField(project: Qgis2webProject, layerId: string, oldKey: string, newKey: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  const cleanKey = newKey.trim().replace(/\s+/g, "_");
  if (!layer || !oldKey || !cleanKey || oldKey === cleanKey) return project;
  const features = layer.geojson.features.map((feature) => {
    const properties = { ...(feature.properties || {}) };
    properties[cleanKey] = properties[oldKey];
    delete properties[oldKey];
    return { ...feature, properties };
  });
  return updateLayer(project, layerId, {
    geojson: { ...layer.geojson, features },
    popupFields: layer.popupFields.map((field) =>
      field.key === oldKey ? { ...field, key: cleanKey, label: cleanKey } : field
    )
  });
}

export function deleteField(project: Qgis2webProject, layerId: string, key: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || !key) return project;
  const features = layer.geojson.features.map((feature) => {
    const properties = { ...(feature.properties || {}) };
    delete properties[key];
    return { ...feature, properties };
  });
  return updateLayer(project, layerId, {
    geojson: { ...layer.geojson, features },
    popupFields: layer.popupFields.filter((field) => field.key !== key)
  });
}
