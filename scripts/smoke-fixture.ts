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

if (!project.runtime.widgets.some((widget) => widget.id === "measure" && widget.enabled)) {
  throw new Error("Expected original measure widget to be detected and enabled.");
}

if (!project.runtime.widgets.some((widget) => widget.id === "photon" && widget.enabled)) {
  throw new Error("Expected original Photon search widget to be detected and enabled.");
}

if (!project.basemaps.some((basemap) => basemap.label.includes("Voyager")) || !project.basemaps.some((basemap) => basemap.label.includes("Imagery"))) {
  throw new Error(`Expected imported Carto Voyager and Esri imagery basemaps. Got: ${project.basemaps.map((basemap) => basemap.label).join(", ")}`);
}

if (project.basemaps.some((basemap) => basemap.label.toLowerCase().startsWith("layer "))) {
  throw new Error(`Expected imported basemap labels to strip layer_ prefix. Got: ${project.basemaps.map((basemap) => basemap.label).join(", ")}`);
}

if (boundary?.label?.field !== "NAMOBJ") {
  throw new Error(`Expected Batas Desa label field NAMOBJ. Got: ${boundary?.label?.field || "none"}`);
}

const zntPopupLabels = znt?.popupTemplate?.fields.map((field) => field.label).join(" | ") || "";
if (!zntPopupLabels.includes("Kabupaten/Kota") || !zntPopupLabels.includes("Kisaran Nilai Tanah") || !zntPopupLabels.includes("Tahun Data")) {
  throw new Error(`Expected ZNT popup labels from original HTML. Got: ${zntPopupLabels}`);
}

console.log(`Fixture parsed: ${project.layers.length} layers, ${files.length} files. Widgets, basemaps, labels, popup templates, legend labels, and line styles verified.`);
