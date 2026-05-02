import JSZip from "jszip";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { exportProjectZip } from "../src/lib/exportProject";
import { parseQgis2webProject } from "../src/lib/qgis2webParser";
import type { Qgis2webProject, VirtualFile } from "../src/types/project";

const fixtureName = "qgis2web_2026_04_22-06_30_44_400659";
const fixtureRoot = join(process.cwd(), "docs", "example_export", fixtureName);
const fixtureZipPath = join(process.cwd(), "docs", "example_export", `${fixtureName}.zip`);

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
    const zip = await JSZip.loadAsync(await readFile(fixtureZipPath));
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
    branding: {
      ...project.branding,
      welcome: { ...project.branding.welcome }
    },
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

if (!enabledIndex.includes('Content-Security-Policy') || !enabledIndex.includes("default-src 'self' blob:")) {
  throw new Error("Expected exported index.html to include patched CSP meta for q2ws runtime assets.");
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

if (enabledConfig.popupSettings?.style !== "card") {
  throw new Error(`Expected exported config to preserve default card popup style. Got: ${enabledConfig.popupSettings?.style}`);
}

if (enabledConfig.mapSettings?.layerControlMode !== "collapsed") {
  throw new Error(`Expected exported config to default to collapsed qgis2web parity layer control. Got: ${enabledConfig.mapSettings?.layerControlMode}`);
}

if (enabledConfig.layerControlSettings?.mode !== "collapsed" || enabledConfig.layerControlSettings?.position !== "top-right") {
  throw new Error(`Expected exported config to preserve layerControlSettings defaults. Got: ${JSON.stringify(enabledConfig.layerControlSettings)}`);
}

if (enabledConfig.legendSettings?.enabled || enabledConfig.legendSettings?.placement !== "hidden") {
  throw new Error(`Expected exported config to keep legend hidden by default. Got: enabled=${enabledConfig.legendSettings?.enabled}, placement=${enabledConfig.legendSettings?.placement}`);
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
const popupOverrideProject = cloneProject(project);
popupOverrideProject.layers = popupOverrideProject.layers.map((layer) =>
  layer.displayName === "Batas Desa"
    ? {
        ...layer,
        popupSettings: {
          ...popupOverrideProject.popupSettings,
          style: "compact",
          accentColor: "#1976d2",
          backgroundColor: "#eff6ff",
          textColor: "#0f172a",
          labelColor: "#1d4ed8",
          radius: 17,
          shadow: 34
        }
      }
    : layer
);
const popupOverrideZip = await exportZip(popupOverrideProject);
const popupOverrideConfig = JSON.parse(await zipText(popupOverrideZip, `${root}q2ws-config.json`));
const popupOverrideLayer = popupOverrideConfig.layers?.find((layer: { displayName: string; popupSettings?: { style?: string; accentColor?: string; shadow?: number } }) => layer.displayName === "Batas Desa");
if (!popupOverrideLayer?.popupSettings || popupOverrideLayer.popupSettings.accentColor !== "#1976d2" || popupOverrideLayer.popupSettings.shadow !== 34) {
  throw new Error("Expected q2ws-config.json to preserve per-layer popup style overrides.");
}
if (popupOverrideLayer.popupSettings.style !== "compact") {
  throw new Error(`Expected per-layer popup style override to survive export. Got: ${popupOverrideLayer.popupSettings.style}`);
}
const floatingLegendProject = cloneProject(project);
floatingLegendProject.legendSettings = {
  ...floatingLegendProject.legendSettings,
  enabled: true,
  placement: "floating-top-left",
  collapsed: false
};
floatingLegendProject.layerControlSettings = {
  ...floatingLegendProject.layerControlSettings,
  position: "bottom-left",
  backgroundColor: "#112233",
  backgroundOpacity: 64,
  textColor: "#f8fafc",
  textSize: 17,
  borderRadius: 9
};
const floatingLegendZip = await exportZip(floatingLegendProject);
const floatingLegendConfig = JSON.parse(await zipText(floatingLegendZip, `${root}q2ws-config.json`));
if (!floatingLegendConfig.legendSettings?.enabled || floatingLegendConfig.legendSettings?.placement !== "floating-top-left") {
  throw new Error(`Expected q2ws-config.json to preserve floating top-left legend placement. Got: ${JSON.stringify(floatingLegendConfig.legendSettings)}`);
}
if (
  floatingLegendConfig.layerControlSettings?.position !== "bottom-left" ||
  floatingLegendConfig.layerControlSettings?.backgroundColor !== "#112233" ||
  floatingLegendConfig.layerControlSettings?.backgroundOpacity !== 64 ||
  floatingLegendConfig.layerControlSettings?.textColor !== "#f8fafc" ||
  floatingLegendConfig.layerControlSettings?.textSize !== 17 ||
  floatingLegendConfig.layerControlSettings?.borderRadius !== 9
) {
  throw new Error(`Expected q2ws-config.json to preserve custom layerControlSettings. Got: ${JSON.stringify(floatingLegendConfig.layerControlSettings)}`);
}
const runtimeSourceForLegend = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedLegendCode of ["q2ws-legend-top-left", "q2ws-legend-top-right", "q2ws-legend-bottom-left", "q2ws-legend-bottom-right", "function runtimeLegendPositionClass"]) {
  if (!runtimeSourceForLegend.includes(expectedLegendCode)) {
    throw new Error(`Expected runtime floating legend support to include: ${expectedLegendCode}`);
  }
}
const editorCssForLegend = await readFile(join(process.cwd(), "src", "styles.css"), "utf8");
for (const expectedEditorCss of [".legend-bottom-right", ".legend-bottom-left", ".legend-top-right", ".legend-top-left", ".map-shell-header-top-full .legend-preview.legend-top-right", ".map-shell-header-top-right-pill .legend-preview.legend-top-right"]) {
  if (!editorCssForLegend.includes(expectedEditorCss)) {
    throw new Error(`Expected editor floating legend CSS to include: ${expectedEditorCss}`);
  }
}

const treeModeProject = cloneProject(project);
treeModeProject.mapSettings = {
  ...treeModeProject.mapSettings,
  layerControlMode: "tree"
};
const treeModeZip = await exportZip(treeModeProject);
const treeModeConfig = JSON.parse(await zipText(treeModeZip, `${root}q2ws-config.json`));
if (treeModeConfig.mapSettings?.layerControlMode !== "tree") {
  throw new Error(`Expected q2ws-config.json to preserve tree layer control mode. Got: ${treeModeConfig.mapSettings?.layerControlMode}`);
}
const runtimeSourceForTree = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedTreeCode of ["q2ws-layer-tree-group", "q2ws-layer-tree-toggle", "q2ws-layer-tree-items", "treeToggle.onclick"] ) {
  if (!runtimeSourceForTree.includes(expectedTreeCode)) {
    throw new Error(`Expected runtime tree layer control support to include: ${expectedTreeCode}`);
  }
}
const editorPanelSourceForTree = await readFile(join(process.cwd(), "src", "components", "mapCanvasPanels.tsx"), "utf8");
for (const expectedEditorTreeCode of ["layer-tree-group", "layer-tree-toggle", "layer-tree-items", "setTreeOpen"]) {
  if (!editorPanelSourceForTree.includes(expectedEditorTreeCode)) {
    throw new Error(`Expected editor tree layer control support to include: ${expectedEditorTreeCode}`);
  }
}

const generatedLayerProject = cloneProject(project);
const sourceLayer = generatedLayerProject.layers[0];
generatedLayerProject.layers = [
  ...generatedLayerProject.layers,
  {
    ...sourceLayer,
    id: "generated_buffer_test",
    displayName: "Generated Buffer Test",
    sourcePath: `${root}data/generated_buffer_test.js`,
    dataVariable: "json_generated_buffer_test",
    layerVariable: "layer_generated_buffer_test",
    layerTreeGroup: "Analysis",
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "generated_buffer_test::1",
          properties: { name: "generated" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [108.46, -6.79],
              [108.47, -6.79],
              [108.47, -6.78],
              [108.46, -6.78],
              [108.46, -6.79]
            ]]
          }
        }
      ]
    }
  }
];
const generatedLayerZip = await exportZip(generatedLayerProject);
const generatedLayerConfig = JSON.parse(await zipText(generatedLayerZip, `${root}q2ws-config.json`));
const generatedLayerConfigItem = generatedLayerConfig.layers?.find((layer: { id: string; geojson?: unknown }) => layer.id === "generated_buffer_test");
if (!generatedLayerConfigItem?.geojson || (generatedLayerConfigItem.geojson as { type?: string }).type !== "FeatureCollection") {
  throw new Error("Expected q2ws-config.json to include GeoJSON for Studio-generated layers so runtime export can instantiate them.");
}
const runtimeSourceForGeneratedLayers = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedGeneratedLayerCode of ["layerConfig.geojson", "window.L.geoJSON", "window[layerConfig.layerVariable]"]) {
  if (!runtimeSourceForGeneratedLayers.includes(expectedGeneratedLayerCode)) {
    throw new Error(`Expected runtime generated-layer support to include: ${expectedGeneratedLayerCode}`);
  }
}

const appSourceForBuffer = await readFile(join(process.cwd(), "src", "App.tsx"), "utf8");
if (!appSourceForBuffer.includes("selectedFeatureData.feature.geometry")) {
  throw new Error("Expected Buffer action to guard selected features with null geometry before calling Turf.");
}

const welcomeProject = cloneProject(project);
welcomeProject.branding = {
  ...welcomeProject.branding,
  showWelcome: true,
  welcome: {
    ...welcomeProject.branding.welcome,
    enabled: true,
    title: "Selamat datang di Cirebon",
    subtitle: "#### Halo **semua**\n\n> Ringkasan aman\n\n<script>alert(1)</script>\n\n1. Jelajahi layer",
    ctaLabel: "Mulai jelajah"
  }
};
const welcomeZip = await exportZip(welcomeProject);
const welcomeConfig = JSON.parse(await zipText(welcomeZip, `${root}q2ws-config.json`));
if (!welcomeConfig.branding?.welcome?.enabled || !String(welcomeConfig.branding?.welcome?.subtitle || "").includes("<script>alert(1)</script>")) {
  throw new Error("Expected q2ws-config.json to preserve welcome markdown source before runtime sanitization.");
}
const runtimeSource = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedRuntimeCode of ['openList("ol")', '^\\d+\\.\\s+(.+)$', '^(#{1,6})\\s+(.+)$', 'var blockquote = trimmed.match', 'renderMarkdown(welcomeConfig.subtitle', 'q2ws-welcome-content']) {
  if (!runtimeSource.includes(expectedRuntimeCode)) {
    throw new Error(`Expected runtime welcome/sidebar markdown support to include: ${expectedRuntimeCode}`);
  }
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
