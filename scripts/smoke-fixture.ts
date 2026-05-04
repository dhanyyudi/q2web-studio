import JSZip from "jszip";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseQgis2webProject } from "../src/lib/qgis2webParser";
import { hydrateStoredProjectForTest } from "../src/lib/opfs";
import type { VirtualFile } from "../src/types/project";

const fixtureName = "qgis2web_2026_04_22-06_30_44_400659";
const fixtureRoot = join(process.cwd(), "docs", "example_export", fixtureName);
const fixtureZipPath = join(process.cwd(), "docs", "example_export", `${fixtureName}.zip`);
const rasterImageFixtureZipPath = join(process.cwd(), "docs", "example_export", "qgis2web_raster_image_overlay.zip");
const rasterWmsFixtureZipPath = join(process.cwd(), "docs", "example_export", "qgis2web_raster_wms.zip");
const rasterPmtilesFixtureZipPath = join(process.cwd(), "docs", "example_export", "qgis2web_raster_pmtiles.zip");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : Promise.resolve([path]);
    })
  );
  return nested.flat();
}

async function fixtureFilesFromZip(zipPath: string): Promise<VirtualFile[]> {
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/") && !entry.name.endsWith("/.DS_Store") && !entry.name.endsWith(".DS_Store"));
  return Promise.all(entries.map(async (entry) => {
    const rel = entry.name;
    const isText = /\.(html|js|css|json|txt|svg)$/i.test(rel);
    if (isText) {
      return {
        path: rel,
        name: rel.split("/").pop() || rel,
        kind: "text" as const,
        text: await entry.async("string")
      };
    }
    const buffer = await entry.async("nodebuffer");
    return {
      path: rel,
      name: rel.split("/").pop() || rel,
      kind: "binary" as const,
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    };
  }));
}

async function fixtureFiles(): Promise<VirtualFile[]> {
  try {
    await access(fixtureRoot);
    const paths = await walk(fixtureRoot);
    return Promise.all(
      paths.map(async (path) => {
        const rel = `${fixtureName}/${relative(fixtureRoot, path).replaceAll("\\", "/")}`;
        const isText = /\.(html|js|css|json|txt|svg)$/i.test(path);
        if (isText) {
          return {
            path: rel,
            name: rel.split("/").pop() || rel,
            kind: "text" as const,
            text: await readFile(path, "utf8")
          };
        }
        const buffer = await readFile(path);
        return {
          path: rel,
          name: rel.split("/").pop() || rel,
          kind: "binary" as const,
          buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        };
      })
    );
  } catch {
    return fixtureFilesFromZip(fixtureZipPath);
  }
}

const files = await fixtureFiles();

const syntheticRasterKinds = ["raster-image", "raster-wms", "raster-pmtiles"];
if (!syntheticRasterKinds.every((kind) => ["raster-image", "raster-wms", "raster-pmtiles"].includes(kind))) {
  throw new Error("Expected raster layer kinds to be declared for Phase 8.");
}

const project = parseQgis2webProject(files);
const rasterImageProject = parseQgis2webProject(await fixtureFilesFromZip(rasterImageFixtureZipPath));
const rasterWmsProject = parseQgis2webProject(await fixtureFilesFromZip(rasterWmsFixtureZipPath));
const rasterPmtilesProject = parseQgis2webProject(await fixtureFilesFromZip(rasterPmtilesFixtureZipPath));
const layerNames = project.layers.map((layer) => layer.displayName).sort();

if (project.engine !== "leaflet") {
  throw new Error(`Expected leaflet engine, got ${project.engine}`);
}

for (const expected of ["Batas Desa", "Jaringan Jalan", "Sungai", "Zona Nilai Tanah"]) {
  if (!layerNames.includes(expected)) {
    throw new Error(`Missing expected layer: ${expected}. Got: ${layerNames.join(", ")}`);
  }
}

const znt = project.layers.find((layer) => layer.displayName === "Zona Nilai Tanah");
const roads = project.layers.find((layer) => layer.displayName === "Jaringan Jalan");
const rivers = project.layers.find((layer) => layer.displayName === "Sungai");
const boundary = project.layers.find((layer) => layer.displayName === "Batas Desa");

if (znt?.style.mode !== "categorized") {
  throw new Error(`Expected Zona Nilai Tanah style mode to be categorized. Got: ${znt?.style.mode || "none"}`);
}

if (boundary?.style.mode !== "single") {
  throw new Error(`Expected Batas Desa style mode to be single. Got: ${boundary?.style.mode || "none"}`);
}

if (!project.layers.every((layer) => layer.kind === "vector")) {
  throw new Error(`Expected fixture baseline layers to stay vector-only before raster parser lands. Got: ${project.layers.map((layer) => `${layer.displayName}:${layer.kind}`).join(", ")}`);
}

if (!project.layers.every((layer) => ["single", "categorized", "graduated"].includes(layer.style.mode))) {
  throw new Error(`Expected every layer to have a valid style mode. Got: ${project.layers.map((layer) => `${layer.displayName}:${layer.style.mode}`).join(", ")}`);
}

if (!znt?.style.categories.some((category) => category.label.includes("100.000"))) {
  throw new Error(`Expected Zona Nilai Tanah legend labels to use value ranges. Got: ${znt?.style.categories.map((category) => category.label).join(", ")}`);
}

if (znt.style.categories.some((category) => category.label === category.value)) {
  throw new Error("Expected Zona Nilai Tanah category labels to be parsed from overlaysTree, not raw hidden codes.");
}

if (!roads?.style.categories.some((category) => category.strokeColor.toLowerCase() === "#f4a300")) {
  throw new Error("Expected Jaringan Jalan to preserve orange Jalan Kolektor style.");
}

if (!rivers?.style.categories.every((category) => category.symbolType === "line")) {
  throw new Error("Expected Sungai legend categories to render as line symbols.");
}

if (boundary?.style.symbolType !== "line" || boundary.style.strokeColor.toLowerCase() !== "#ffffff") {
  throw new Error("Expected Batas Desa to preserve white line boundary style.");
}

const rasterImageLayer = rasterImageProject.layers.find((layer) => layer.kind === "raster-image");
if (!rasterImageLayer || rasterImageLayer.kind !== "raster-image") {
  throw new Error("Expected raster image overlay fixture to parse a raster-image layer.");
}
if (rasterImageLayer.imagePath !== "qgis2web_raster_image_overlay/images/raster-overlay.png") {
  throw new Error(`Expected raster image path to stay project-relative. Got: ${rasterImageLayer.imagePath}`);
}
if (rasterImageLayer.opacity !== 0.75) {
  throw new Error(`Expected raster image overlay opacity 0.75. Got: ${rasterImageLayer.opacity}`);
}
if (!rasterImageProject.layers.some((layer) => layer.kind === "vector")) {
  throw new Error("Expected raster image overlay fixture to keep vector layers alongside raster.");
}

const rasterWmsLayer = rasterWmsProject.layers.find((layer) => layer.kind === "raster-wms");
if (!rasterWmsLayer || rasterWmsLayer.kind !== "raster-wms") {
  throw new Error("Expected raster WMS fixture to parse a raster-wms layer.");
}
if (rasterWmsLayer.url !== "https://ahocevar.com/geoserver/wms" || rasterWmsLayer.layersParam !== "topp:states") {
  throw new Error(`Expected raster WMS url and layersParam. Got: ${JSON.stringify(rasterWmsLayer)}`);
}
if (rasterWmsLayer.opacity !== 0.65 || rasterWmsLayer.transparent !== true || rasterWmsLayer.version !== "1.1.1") {
  throw new Error(`Expected raster WMS options to be preserved. Got: ${JSON.stringify(rasterWmsLayer)}`);
}

const rasterPmtilesLayer = rasterPmtilesProject.layers.find((layer) => layer.kind === "raster-pmtiles");
if (!rasterPmtilesLayer || rasterPmtilesLayer.kind !== "raster-pmtiles") {
  throw new Error("Expected raster PMTiles fixture to parse a raster-pmtiles layer.");
}
if (rasterPmtilesLayer.url !== "qgis2web_raster_pmtiles/tiles/sample.pmtiles") {
  throw new Error(`Expected raster PMTiles path to stay project-relative. Got: ${rasterPmtilesLayer.url}`);
}
if (rasterPmtilesLayer.opacity !== 0.85 || rasterPmtilesLayer.maxZoom !== 14) {
  throw new Error(`Expected raster PMTiles options to be preserved. Got: ${JSON.stringify(rasterPmtilesLayer)}`);
}

const measureWidget = project.runtime.widgets.find((widget) => widget.id === "measure");
if (!measureWidget?.enabled) {
  throw new Error("Expected original measure widget to be detected and enabled.");
}

if (!measureWidget.assetPaths.includes("qgis2web_2026_04_22-06_30_44_400659/css/leaflet-measure.css") || !measureWidget.assetPaths.includes("qgis2web_2026_04_22-06_30_44_400659/js/leaflet-measure.js")) {
  throw new Error(`Expected measure widget assets to be preserved. Got: ${measureWidget.assetPaths.join(", ")}`);
}

const photonWidget = project.runtime.widgets.find((widget) => widget.id === "photon");
if (!photonWidget?.enabled) {
  throw new Error("Expected original Photon search widget to be detected and enabled.");
}

if (!photonWidget.assetPaths.includes("qgis2web_2026_04_22-06_30_44_400659/css/leaflet.photon.css") || !photonWidget.assetPaths.includes("qgis2web_2026_04_22-06_30_44_400659/js/leaflet.photon.js")) {
  throw new Error(`Expected Photon widget assets to be preserved. Got: ${photonWidget.assetPaths.join(", ")}`);
}

if (!project.basemaps.some((basemap) => basemap.label.includes("Voyager")) || !project.basemaps.some((basemap) => basemap.label.includes("Imagery"))) {
  throw new Error(`Expected imported Carto Voyager and Esri imagery basemaps. Got: ${project.basemaps.map((basemap) => basemap.label).join(", ")}`);
}

if (!project.basemaps[0]?.label.includes("Imagery") || !project.basemaps[1]?.label.includes("Voyager")) {
  throw new Error(`Expected basemap order to preserve qgis2web layer tree. Got: ${project.basemaps.map((basemap) => basemap.label).join(", ")}`);
}

if (project.basemaps.some((basemap) => basemap.label.toLowerCase().startsWith("layer "))) {
  throw new Error(`Expected imported basemap labels to strip layer_ prefix. Got: ${project.basemaps.map((basemap) => basemap.label).join(", ")}`);
}

if (project.layers.some((layer) => layer.showInLayerControl === false)) {
  throw new Error(`Expected imported fixture layers to stay available in layer control. Got: ${project.layers.map((layer) => `${layer.displayName}:${layer.showInLayerControl}`).join(", ")}`);
}

if (project.mapSettings.layerControlMode !== "collapsed") {
  throw new Error(`Expected fresh imports to default to collapsed qgis2web parity layer control. Got: ${project.mapSettings.layerControlMode}`);
}

if (project.popupSettings?.style !== "card") {
  throw new Error(`Expected new imports to default popup style to card. Got: ${project.popupSettings?.style}`);
}

if (project.legendSettings.enabled || project.legendSettings.placement !== "hidden") {
  throw new Error(`Expected fresh imports to keep legend hidden by default. Got: enabled=${project.legendSettings.enabled}, placement=${project.legendSettings.placement}`);
}

if (boundary?.label?.field !== "NAMOBJ") {
  throw new Error(`Expected Batas Desa label field NAMOBJ. Got: ${boundary?.label?.field || "none"}`);
}

if (!boundary?.label?.htmlTemplate?.includes("font-size: 10pt") || !boundary.label.htmlTemplate.includes("{{NAMOBJ}}")) {
  throw new Error(`Expected Batas Desa label template to preserve original inline HTML. Got: ${boundary?.label?.htmlTemplate || "none"}`);
}

if (!boundary?.label?.cssText?.includes("text-shadow") || !boundary.label.cssText.includes("#fafafa")) {
  throw new Error(`Expected Batas Desa label CSS to preserve original halo. Got: ${boundary?.label?.cssText || "none"}`);
}

const uniqueBasemapUrls = new Set(project.basemaps.map((basemap) => basemap.url));
if (uniqueBasemapUrls.size !== project.basemaps.length) {
  throw new Error(`Expected imported basemaps to avoid duplicate default URLs. Got: ${project.basemaps.map((basemap) => `${basemap.id}:${basemap.url}`).join(", ")}`);
}

const zntPopupLabels = znt?.popupTemplate?.fields.map((field) => field.label).join(" | ") || "";
if (!zntPopupLabels.includes("Kabupaten/Kota") || !zntPopupLabels.includes("Kisaran Nilai Tanah") || !zntPopupLabels.includes("Tahun Data")) {
  throw new Error(`Expected ZNT popup labels from original HTML. Got: ${zntPopupLabels}`);
}

const zntPopupHtml = znt?.popupTemplate?.html || "";
if (zntPopupHtml.includes("/g,") || zntPopupHtml.includes("popupopen")) {
  throw new Error(`Expected ZNT popup template to exclude qgis2web JS fragments. Got: ${zntPopupHtml}`);
}

const runtimeSource = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedRuntimeCode of ["function applyDisabledWidgets", "removeControlCandidate(window.measureControl)", "removeControlCandidate(window.photonControl)", "disableLabels(config)", "clearHighlightState(config)"]) {
  if (!runtimeSource.includes(expectedRuntimeCode)) {
    throw new Error(`Expected runtime disable hardening code to include: ${expectedRuntimeCode}`);
  }
}

const legacyStoredProject = hydrateStoredProjectForTest({
  ...project,
  basemaps: undefined,
  runtime: undefined,
  popupSettings: undefined,
  sidebar: undefined,
  layers: project.layers.map((layer) => ({
    ...layer,
    popupTemplate: undefined,
    popupSettings: undefined
  }))
});
if (!legacyStoredProject.basemaps.length || !Array.isArray(legacyStoredProject.runtime.widgets)) {
  throw new Error("Expected legacy OPFS project hydration to restore basemaps and runtime defaults.");
}
if (!legacyStoredProject.popupSettings || !legacyStoredProject.sidebar) {
  throw new Error("Expected legacy OPFS project hydration to restore popup and sidebar defaults.");
}
if (legacyStoredProject.layers.some((layer) => !layer.layerTreeGroup || !layer.style.symbolType)) {
  throw new Error("Expected legacy OPFS project hydration to restore layer defaults.");
}

const legacyStyleProject = hydrateStoredProjectForTest({
  ...project,
  layers: project.layers.map((layer) => ({
    ...layer,
    style: {
      ...layer.style,
      mode: undefined,
      graduated: undefined
    }
  }))
});
if (legacyStyleProject.layers.some((layer) => !["single", "categorized", "graduated"].includes(layer.style.mode))) {
  throw new Error(`Expected legacy OPFS style hydration to restore valid style modes. Got: ${legacyStyleProject.layers.map((layer) => `${layer.displayName}:${String(layer.style.mode)}`).join(", ")}`);
}
const legacyCategorizedLayer = legacyStyleProject.layers.find((layer) => layer.displayName === "Zona Nilai Tanah");
if (legacyCategorizedLayer?.style.mode !== "categorized") {
  throw new Error(`Expected legacy OPFS style hydration to infer categorized mode. Got: ${legacyCategorizedLayer?.style.mode || "none"}`);
}
if (legacyStyleProject.layers.some((layer) => !layer.style.graduated || !Array.isArray(layer.style.graduated.ranges) || typeof layer.style.graduated.field !== "string")) {
  throw new Error("Expected legacy OPFS style hydration to restore graduated defaults.");
}

console.log(`Fixture parsed: ${project.layers.length} vector-baseline layers, ${files.length} files, plus raster image, WMS, and PMTiles fixtures. Widgets, basemaps, labels, popup templates, legacy OPFS hydration, legacy style normalization, legend labels, line styles, raster parsing, and runtime widget disable hardening verified.`);
