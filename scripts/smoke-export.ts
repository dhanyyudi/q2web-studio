import JSZip from "jszip";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { exportProjectZip } from "../src/lib/exportProject";
import { parseQgis2webProject } from "../src/lib/qgis2webParser";
import type { Qgis2webProject, VirtualFile } from "../src/types/project";

const fixtureName = "qgis2web_2026_04_22-06_30_44_400659";
const fixtureRoot = join(process.cwd(), "docs", "example_export", fixtureName);

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

async function fixtureFiles(): Promise<VirtualFile[]> {
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
}

async function exportZip(project: Qgis2webProject): Promise<JSZip> {
  const blob = await exportProjectZip(project);
  const buffer = await blob.arrayBuffer();
  return JSZip.loadAsync(buffer);
}

async function zipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Expected exported ZIP to contain ${path}`);
  return file.async("string");
}

function expectFile(zip: JSZip, path: string): void {
  if (!zip.file(path)) throw new Error(`Expected exported ZIP to contain ${path}`);
}

function expectMissingFile(zip: JSZip, path: string): void {
  if (zip.file(path)) throw new Error(`Expected exported ZIP to omit ${path}`);
}

function cloneProject(project: Qgis2webProject): Qgis2webProject {
  return {
    ...project,
    runtime: {
      ...project.runtime,
      widgets: project.runtime.widgets.map((widget) => ({ ...widget, assetPaths: [...widget.assetPaths] }))
    },
    sidebar: { ...project.sidebar }
  };
}

const project = parseQgis2webProject(await fixtureFiles());
const enabledZip = await exportZip(project);
const root = `${project.name}/`;
const enabledIndex = await zipText(enabledZip, `${root}index.html`);
const enabledConfig = JSON.parse(await zipText(enabledZip, `${root}q2ws-config.json`));

for (const path of [
  `${root}q2ws-runtime.js`,
  `${root}q2ws-custom.css`,
  `${root}css/leaflet-measure.css`,
  `${root}js/leaflet-measure.js`,
  `${root}css/leaflet.photon.css`,
  `${root}js/leaflet.photon.js`
]) {
  expectFile(enabledZip, path);
}

if (!enabledIndex.includes("q2ws-runtime.js") || !enabledIndex.includes("q2ws-custom.css")) {
  throw new Error("Expected exported index.html to include q2ws runtime and custom CSS.");
}

if (!enabledIndex.includes("js/leaflet-measure.js") || !enabledIndex.includes("css/leaflet-measure.css")) {
  throw new Error("Expected enabled measure widget assets to remain referenced in exported index.html.");
}

if (!enabledConfig.runtime?.widgets?.some((widget: { id: string; enabled: boolean }) => widget.id === "measure" && widget.enabled)) {
  throw new Error("Expected q2ws-config.json to preserve enabled measure widget state.");
}

if (!enabledConfig.layers?.some((layer: { displayName: string; popupTemplate?: { html?: string } }) => layer.displayName === "Zona Nilai Tanah" && layer.popupTemplate?.html?.includes("Kabupaten/Kota"))) {
  throw new Error("Expected q2ws-config.json to preserve imported popup template HTML.");
}

const sidebarProject = cloneProject(project);
sidebarProject.sidebar = {
  enabled: true,
  side: "right",
  width: 340,
  content: "# Tentang peta\n\n1. Sumber: BPN\n2. Tahun: **2026**"
};
const sidebarZip = await exportZip(sidebarProject);
const sidebarConfig = JSON.parse(await zipText(sidebarZip, `${root}q2ws-config.json`));
if (!sidebarConfig.sidebar?.enabled || !String(sidebarConfig.sidebar?.content || "").includes("Tentang peta")) {
  throw new Error("Expected q2ws-config.json to preserve enabled sidebar settings.");
}
const runtimeSource = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
if (!runtimeSource.includes('openList("ol")') || !runtimeSource.includes('^\\d+\\.\\s+(.+)$')) {
  throw new Error("Expected runtime sidebar markdown renderer to preserve ordered lists.");
}

const disabledProject = cloneProject(project);
disabledProject.runtime.widgets = disabledProject.runtime.widgets.map((widget) => widget.id === "measure" ? { ...widget, enabled: false } : widget);
const disabledZip = await exportZip(disabledProject);
const disabledIndex = await zipText(disabledZip, `${root}index.html`);

expectMissingFile(disabledZip, `${root}css/leaflet-measure.css`);
expectMissingFile(disabledZip, `${root}js/leaflet-measure.js`);
expectFile(disabledZip, `${root}js/leaflet.photon.js`);

if (disabledIndex.includes("leaflet-measure.css") || disabledIndex.includes("leaflet-measure.js")) {
  throw new Error("Expected disabled measure widget references to be removed from exported index.html.");
}

if (!disabledIndex.includes("leaflet.photon.js")) {
  throw new Error("Expected unrelated Photon widget asset reference to remain after disabling measure.");
}

console.log("Export smoke verified q2ws runtime files, config fidelity, enabled widget assets, and disabled widget asset removal.");
