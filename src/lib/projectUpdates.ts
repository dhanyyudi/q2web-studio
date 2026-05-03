import type { FeatureCollection } from "geojson";
import { defaultLayerControlSettings } from "./defaults";
import { isVectorLayer, normalizeProjectLayerKind } from "./rasterParsing";
import { normalizeGraduatedStyle, normalizeLayerStyleMode } from "./styleMode";
import type { LayerControlMode, LayerManifest, Qgis2webProject } from "../types/project";

function featureMatchesId(feature: FeatureCollection["features"][number], featureId: string): boolean {
  return String(feature.properties?.__q2ws_id ?? feature.id ?? "") === featureId;
}

const phaseCLayerControlModes: LayerControlMode[] = ["collapsed", "expanded", "tree"];

export function migrateProject(project: Qgis2webProject): Qgis2webProject {
  const legacyLayerControlMode = project.mapSettings?.layerControlMode;
  const layerControlMode = normalizeLayerControlMode(legacyLayerControlMode);
  const legacyLegendEnabled = (project as Qgis2webProject & { legendShow?: boolean }).legendShow === true;
  const legendWasEnabled = project.legendSettings?.enabled ?? legacyLegendEnabled;
  const legendPlacement = project.legendSettings?.placement || (legacyLegendEnabled ? "inside-control" : undefined);

  return {
    ...project,
    mapSettings: {
      ...project.mapSettings,
      layerControlMode
    },
    legendSettings: {
      ...project.legendSettings,
      enabled: legendWasEnabled,
      placement: legendPlacement || (legendWasEnabled ? "inside-control" : "hidden")
    },
    layers: (project.layers || []).map((inputLayer) => {
      const layer = normalizeProjectLayerKind(inputLayer);
      if (!isVectorLayer(layer)) return layer;
      return {
        ...layer,
        style: normalizeLayerStyle(layer)
      };
    })
  };
}

function normalizeLayerStyle(layer: LayerManifest): LayerManifest["style"] {
  return {
    ...layer.style,
    mode: normalizeLayerStyleMode(layer.style),
    graduated: normalizeGraduatedStyle(layer.style?.graduated)
  };
}

function normalizeLayerControlMode(mode: LayerControlMode | "compact" | undefined): LayerControlMode {
  if (mode === "compact") return "collapsed";
  if (mode && phaseCLayerControlModes.includes(mode)) return mode;
  return defaultLayerControlSettings.mode;
}

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
  featureId: string,
  key: string,
  value: string
): Qgis2webProject {
  return setFeatureProperty(project, layerId, featureId, key, value);
}

export function addFeatureProperty(
  project: Qgis2webProject,
  layerId: string,
  featureId: string,
  key: string,
  value: string
): Qgis2webProject {
  const cleanKey = key.trim().replace(/\s+/g, "_");
  if (!cleanKey) return project;
  return setFeatureProperty(project, layerId, featureId, cleanKey, value);
}

export function deleteFeatureProperty(project: Qgis2webProject, layerId: string, featureId: string, key: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || !isVectorLayer(layer) || !key || key === "__q2ws_id") return project;
  const features = layer.geojson.features.map((feature) => {
    if (!featureMatchesId(feature, featureId)) return feature;
    const properties = { ...(feature.properties || {}) };
    delete properties[key];
    return { ...feature, properties };
  });
  return updateLayerGeojson(project, layerId, { ...layer.geojson, features });
}

function setFeatureProperty(project: Qgis2webProject, layerId: string, featureId: string, key: string, value: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || !isVectorLayer(layer) || !key) return project;
  const features = layer.geojson.features.map((feature) =>
    featureMatchesId(feature, featureId)
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
  if (!layer || !isVectorLayer(layer) || !key.trim()) return project;
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
  if (!layer || !isVectorLayer(layer) || !oldKey || !cleanKey || oldKey === cleanKey) return project;
  const features = layer.geojson.features.map((feature) => {
    const properties = { ...(feature.properties || {}) };
    properties[cleanKey] = properties[oldKey];
    delete properties[oldKey];
    return { ...feature, properties };
  });
  const popupFields = layer.popupFields.map((field) => field.key === oldKey ? { ...field, key: cleanKey } : field);
  const popupTemplate = layer.popupTemplate
    ? {
        ...layer.popupTemplate,
        html: layer.popupTemplate.html.replaceAll(`{{${oldKey}}}`, `{{${cleanKey}}}`),
        fields: layer.popupTemplate.fields.map((field) => field.key === oldKey ? { ...field, key: cleanKey } : field)
      }
    : undefined;
  const label = layer.label
    ? {
        ...layer.label,
        field: layer.label.field === oldKey ? cleanKey : layer.label.field,
        htmlTemplate: layer.label.htmlTemplate?.replaceAll(`{{${oldKey}}}`, `{{${cleanKey}}}`)
      }
    : undefined;
  return updateLayer(project, layerId, {
    geojson: { ...layer.geojson, features },
    popupFields,
    popupTemplate,
    label,
    style: normalizeLayerStyle({
      ...layer,
      style: {
        ...layer.style,
        categoryField: layer.style.categoryField === oldKey ? cleanKey : layer.style.categoryField,
        graduated: {
          ...layer.style.graduated,
          field: layer.style.graduated?.field === oldKey ? cleanKey : layer.style.graduated?.field || ""
        }
      }
    })
  });
}

export function deleteField(project: Qgis2webProject, layerId: string, key: string): Qgis2webProject {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || !isVectorLayer(layer) || !key || key === "__q2ws_id") return project;
  const features = layer.geojson.features.map((feature) => {
    const properties = { ...(feature.properties || {}) };
    delete properties[key];
    return { ...feature, properties };
  });
  const remainingFields = layer.popupFields.filter((field) => field.key !== key);
  const nextLabelField = remainingFields[0]?.key || "";
  const popupTemplate = layer.popupTemplate
    ? {
        ...layer.popupTemplate,
        fields: layer.popupTemplate.fields.filter((field) => field.key !== key)
      }
    : undefined;
  const label = layer.label
    ? {
        ...layer.label,
        enabled: layer.label.field === key ? false : layer.label.enabled,
        field: layer.label.field === key ? nextLabelField : layer.label.field,
        htmlTemplate: layer.label.field === key ? (nextLabelField ? `{{${nextLabelField}}}` : "") : layer.label.htmlTemplate
      }
    : undefined;
  return updateLayer(project, layerId, {
    geojson: { ...layer.geojson, features },
    popupFields: remainingFields,
    popupTemplate,
    label,
    style: normalizeLayerStyle({
      ...layer,
      style: {
        ...layer.style,
        categoryField: layer.style.categoryField === key ? "" : layer.style.categoryField,
        graduated: {
          ...layer.style.graduated,
          field: layer.style.graduated?.field === key ? "" : layer.style.graduated?.field || ""
        }
      }
    })
  });
}
