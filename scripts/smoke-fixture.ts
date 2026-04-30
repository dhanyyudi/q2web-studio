import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseQgis2webProject } from "../src/lib/qgis2webParser";
import type { VirtualFile } from "../src/types/project";

const fixtureRoot = join(process.cwd(), "docs", "example_export", "qgis2web_2026_04_22-06_30_44_400659");

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

const paths = await walk(fixtureRoot);
const files: VirtualFile[] = await Promise.all(
  paths.map(async (path) => {
    const rel = `qgis2web_2026_04_22-06_30_44_400659/${relative(fixtureRoot, path).replaceAll("\\", "/")}`;
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

const project = parseQgis2webProject(files);
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

console.log(`Fixture parsed: ${project.layers.length} layers, ${files.length} files. Widgets, basemaps, labels, popup templates, legend labels, line styles, and runtime widget disable hardening verified.`);
