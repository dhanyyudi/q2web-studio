import JSZip from "jszip";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { exportProjectZip } from "../src/lib/exportProject";
import { parseQgis2webProject } from "../src/lib/qgis2webParser";
import { buildGraduatedRanges } from "../src/lib/graduatedBreaks";
import { categoriesForField } from "../src/lib/style";
import type { Qgis2webProject, VirtualFile } from "../src/types/project";

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

const categorizedProject = cloneProject(project);
categorizedProject.layers = categorizedProject.layers.map((layer) => {
  if (layer.displayName !== "Batas Desa") return layer;
  return {
    ...layer,
    style: {
      ...layer.style,
      mode: "categorized",
      categoryField: "WADMKK",
      categories: categoriesForField(layer, "WADMKK")
    }
  };
});
const categorizedZip = await exportZip(categorizedProject);
const categorizedConfig = JSON.parse(await zipText(categorizedZip, `${root}q2ws-config.json`));
const categorizedLayerConfig = categorizedConfig.layers?.find((layer: { displayName: string; style: { mode?: string; categoryField?: string; categories?: Array<{ value: string; label: string }> } }) => layer.displayName === "Batas Desa");
if (categorizedLayerConfig?.style?.mode !== "categorized" || categorizedLayerConfig.style?.categoryField !== "WADMKK") {
  throw new Error(`Expected q2ws-config.json to preserve categorized style mode and chosen field. Got: ${JSON.stringify(categorizedLayerConfig?.style)}`);
}
if (!Array.isArray(categorizedLayerConfig.style?.categories) || categorizedLayerConfig.style.categories.length !== 2) {
  throw new Error(`Expected q2ws-config.json to preserve regenerated categories for WADMKK. Got: ${JSON.stringify(categorizedLayerConfig?.style?.categories)}`);
}
const runtimeSourceForCategorized = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
if (!runtimeSourceForCategorized.includes("function normalizeCategoryValue(value)") || !runtimeSourceForCategorized.includes("normalizeCategoryValue(feature.properties[field])")) {
  throw new Error("Expected runtime categorized style lookup to use editor parity normalization for null, missing, undefined, and empty category values.");
}

const graduatedProject = cloneProject(project);
graduatedProject.layers = graduatedProject.layers.map((layer) => {
  if (layer.displayName !== "Zona Nilai Tanah") return layer;
  return {
    ...layer,
    style: {
      ...layer.style,
      mode: "graduated",
      graduated: {
        ...layer.style.graduated,
        field: "q2wHide_KELASNILAI",
        method: "equal",
        classCount: 5,
        ranges: buildGraduatedRanges(layer, "q2wHide_KELASNILAI", "equal", 5)
      }
    }
  };
});
const graduatedZip = await exportZip(graduatedProject);
const graduatedConfig = JSON.parse(await zipText(graduatedZip, `${root}q2ws-config.json`));
const graduatedLayerConfig = graduatedConfig.layers?.find((layer: { displayName: string; style?: { mode?: string; graduated?: { field?: string; method?: string; ranges?: Array<{ fillColor?: string }> } } }) => layer.displayName === "Zona Nilai Tanah");
if (graduatedLayerConfig?.style?.mode !== "graduated" || graduatedLayerConfig.style?.graduated?.field !== "q2wHide_KELASNILAI") {
  throw new Error(`Expected q2ws-config.json to preserve graduated style mode and chosen field. Got: ${JSON.stringify(graduatedLayerConfig?.style)}`);
}
if (!Array.isArray(graduatedLayerConfig.style?.graduated?.ranges) || graduatedLayerConfig.style.graduated.ranges.length !== 5) {
  throw new Error(`Expected q2ws-config.json to preserve generated graduated ranges. Got: ${JSON.stringify(graduatedLayerConfig?.style?.graduated?.ranges)}`);
}
const graduatedRangeColors = new Set(graduatedLayerConfig.style.graduated.ranges.map((range) => range.fillColor).filter(Boolean));
if (graduatedRangeColors.size < 2) {
  throw new Error(`Expected graduated export to preserve more than one fill color. Got: ${JSON.stringify(graduatedLayerConfig.style.graduated.ranges)}`);
}
if (!runtimeSourceForCategorized.includes("function graduatedRangeForFeature(style, feature)") || !runtimeSourceForCategorized.includes("graduatedRangeForFeature(style, feature)")) {
  throw new Error("Expected runtime graduated style support to survive export source generation.");
}
if (runtimeSourceForCategorized.includes("window.__q2wsStyleFor")) {
  throw new Error("Expected exported runtime not to expose a permanent __q2wsStyleFor debug hook.");
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

const rasterImageProject = parseQgis2webProject(await fixtureFilesFromZip(rasterImageFixtureZipPath));
const rasterImageZip = await exportZip(rasterImageProject);
const rasterImageRoot = `${rasterImageProject.name}/`;
const rasterImageConfig = JSON.parse(await zipText(rasterImageZip, `${rasterImageRoot}q2ws-config.json`));
const exportedRasterImage = rasterImageConfig.layers?.find((layer: { kind?: string; imagePath?: string; opacity?: number }) => layer.kind === "raster-image");
if (!exportedRasterImage) {
  throw new Error("Expected exported config to preserve raster image overlay layer.");
}
if (exportedRasterImage.imagePath !== "images/raster-overlay.png") {
  throw new Error(`Expected exported raster image path to be runtime-relative. Got: ${exportedRasterImage.imagePath}`);
}
if (exportedRasterImage.opacity !== 0.75) {
  throw new Error(`Expected exported raster opacity 0.75. Got: ${exportedRasterImage.opacity}`);
}
expectFile(rasterImageZip, `${rasterImageRoot}images/raster-overlay.png`);
const runtimeSourceForRasterImage = await readFile(join(process.cwd(), "src", "runtime", "runtime.ts"), "utf8");
for (const expectedRasterCode of ["function createRasterLayer(layerConfig)", "layerConfig.kind === \"raster-image\"", "window.L.imageOverlay(layerConfig.imagePath, layerConfig.bounds"]) {
  if (!runtimeSourceForRasterImage.includes(expectedRasterCode)) {
    throw new Error(`Expected runtime raster image support to include: ${expectedRasterCode}`);
  }
}

const rasterWmsProject = parseQgis2webProject(await fixtureFilesFromZip(rasterWmsFixtureZipPath));
const rasterWmsZip = await exportZip(rasterWmsProject);
const rasterWmsRoot = `${rasterWmsProject.name}/`;
const rasterWmsConfig = JSON.parse(await zipText(rasterWmsZip, `${rasterWmsRoot}q2ws-config.json`));
const exportedRasterWms = rasterWmsConfig.layers?.find((layer: { kind?: string; url?: string; layersParam?: string; opacity?: number }) => layer.kind === "raster-wms");
if (!exportedRasterWms || exportedRasterWms.url !== "https://ahocevar.com/geoserver/wms" || exportedRasterWms.layersParam !== "topp:states") {
  throw new Error(`Expected exported config to preserve WMS raster layer. Got: ${JSON.stringify(exportedRasterWms)}`);
}
if (exportedRasterWms.opacity !== 0.65) {
  throw new Error(`Expected exported WMS opacity 0.65. Got: ${exportedRasterWms.opacity}`);
}

const rasterPmtilesProject = parseQgis2webProject(await fixtureFilesFromZip(rasterPmtilesFixtureZipPath));
const rasterPmtilesZip = await exportZip(rasterPmtilesProject);
const rasterPmtilesRoot = `${rasterPmtilesProject.name}/`;
const rasterPmtilesConfig = JSON.parse(await zipText(rasterPmtilesZip, `${rasterPmtilesRoot}q2ws-config.json`));
const exportedRasterPmtiles = rasterPmtilesConfig.layers?.find((layer: { kind?: string; url?: string; opacity?: number; maxZoom?: number }) => layer.kind === "raster-pmtiles");
if (!exportedRasterPmtiles || exportedRasterPmtiles.url !== "tiles/sample.pmtiles") {
  throw new Error(`Expected exported config to preserve runtime-relative PMTiles path. Got: ${JSON.stringify(exportedRasterPmtiles)}`);
}
if (exportedRasterPmtiles.opacity !== 0.85 || exportedRasterPmtiles.maxZoom !== 14) {
  throw new Error(`Expected exported PMTiles options to be preserved. Got: ${JSON.stringify(exportedRasterPmtiles)}`);
}
expectFile(rasterPmtilesZip, `${rasterPmtilesRoot}tiles/sample.pmtiles`);
for (const expectedRasterRuntimeCode of ["layerConfig.kind === \"raster-wms\"", "window.L.tileLayer.wms", "layerConfig.kind === \"raster-pmtiles\"", "window.pmtiles.leafletRasterLayer"]) {
  if (!runtimeSourceForRasterImage.includes(expectedRasterRuntimeCode)) {
    throw new Error(`Expected runtime WMS and PMTiles support to include: ${expectedRasterRuntimeCode}`);
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

console.log("Export smoke verified q2ws runtime files, config fidelity, raster export parity, enabled widget assets, and disabled widget asset removal.");
