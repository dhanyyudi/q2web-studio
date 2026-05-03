import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const debugUrl = (path = "/") => `${path}${path.includes("?") ? "&" : "?"}debug=1`;

const fixtureZip = join(process.cwd(), "docs", "example_export", "qgis2web_2026_04_22-06_30_44_400659.zip");

async function importFixture(page: import("@playwright/test").Page) {
  await page.locator('input[accept*=".zip"]').setInputFiles(fixtureZip);
}

async function assertRenderedMap(page: import("@playwright/test").Page, requests: string[], consoleErrors: string[]) {
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.waitForFunction(() => Boolean((window as Window & { __q2ws_map?: { _loaded?: boolean } }).__q2ws_map?._loaded), null, { timeout: 15000 });

  const mapLoaded = await page.evaluate(() => Boolean((window as Window & { __q2ws_map?: { _loaded?: boolean } }).__q2ws_map?._loaded));
  expect(mapLoaded).toBe(true);
  const center = await page.evaluate(() => {
    const map = (window as Window & { __q2ws_map?: { getCenter: () => { lat: number; lng: number } } }).__q2ws_map;
    return map?.getCenter();
  });
  expect(center?.lng).toBeGreaterThan(108.44);
  expect(center?.lng).toBeLessThan(108.50);
  expect(center?.lat).toBeGreaterThan(-6.81);
  expect(center?.lat).toBeLessThan(-6.75);

  await page.waitForTimeout(2000);

  const renderedFeatures = await page.evaluate(() => {
    return document.querySelectorAll(".leaflet-overlay-pane path, .leaflet-overlay-pane canvas, .leaflet-marker-pane > *, .leaflet-canvas-container canvas").length;
  });
  expect(renderedFeatures).toBeGreaterThan(0);
  expect(requests.some((url) => url.includes("arcgisonline.com") || url.includes("cartocdn.com"))).toBe(true);
  expect(consoleErrors).toEqual([]);
}

async function unzipToDirectory(zipPath: string, outputDir: string) {
  const zipBuffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      const destination = join(outputDir, entry.name);
      if (entry.dir) {
        await mkdir(destination, { recursive: true });
        return;
      }
      await mkdir(join(destination, ".."), { recursive: true });
      const content = await entry.async("nodebuffer");
      await writeFile(destination, content);
    })
  );
}

async function saveDownloadToTempDir(download: import("@playwright/test").Download, prefix: string): Promise<{ tempDir: string; zipPath: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), prefix));
  const zipPath = join(tempDir, download.suggestedFilename() || basename(await download.path() || "export.zip"));
  await download.saveAs(zipPath);
  return { tempDir, zipPath };
}

async function createTranslateFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "q2ws-translate-fixture-"));
  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(join(root, "index.html"), `<!doctype html><html><head></head><body><div id="map"></div><script src="data/SimplePoint_1.js"></script><script src="data/SimpleLine_2.js"></script><script src="data/SimplePolygon_3.js"></script><script>var map = L.map('map'); var layer_SimplePoint_1 = new L.geoJson(json_SimplePoint_1, {}); var layer_SimpleLine_2 = new L.geoJson(json_SimpleLine_2, {}); var layer_SimplePolygon_3 = new L.geoJson(json_SimplePolygon_3, {}); map.addLayer(layer_SimplePoint_1); map.addLayer(layer_SimpleLine_2); map.addLayer(layer_SimplePolygon_3);</script></body></html>`);
  await writeFile(join(root, "data", "SimplePoint_1.js"), `var json_SimplePoint_1 = {"type":"FeatureCollection","name":"SimplePoint","features":[{"type":"Feature","properties":{"name":"point-one"},"geometry":{"type":"Point","coordinates":[108.45,-6.78]}},{"type":"Feature","properties":{"name":"point-two"},"geometry":{"type":"Point","coordinates":[108.49,-6.74]}}]};`);
  await writeFile(join(root, "data", "SimpleLine_2.js"), `var json_SimpleLine_2 = {"type":"FeatureCollection","name":"SimpleLine","features":[{"type":"Feature","properties":{"name":"line-one"},"geometry":{"type":"LineString","coordinates":[[108.46,-6.79],[108.47,-6.78]]}},{"type":"Feature","properties":{"name":"line-two"},"geometry":{"type":"LineString","coordinates":[[108.51,-6.74],[108.52,-6.73]]}}]};`);
  await writeFile(join(root, "data", "SimplePolygon_3.js"), `var json_SimplePolygon_3 = {"type":"FeatureCollection","name":"SimplePolygon","features":[{"type":"Feature","properties":{"name":"polygon-one"},"geometry":{"type":"Polygon","coordinates":[[[108.43,-6.81],[108.44,-6.81],[108.44,-6.80],[108.43,-6.80],[108.43,-6.81]]]}},{"type":"Feature","properties":{"name":"polygon-two"},"geometry":{"type":"Polygon","coordinates":[[[108.50,-6.75],[108.51,-6.75],[108.51,-6.74],[108.50,-6.74],[108.50,-6.75]]]}}]};`);
  return root;
}

async function createCategorizedEmptyFixtureZip(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "q2ws-empty-category-fixture-"));
  const zipPath = join(tempDir, "categorized-empty.zip");
  const zip = new JSZip();
  const root = "categorized-empty/";
  zip.file(`${root}index.html`, `<!doctype html><html><head><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>#map{height:400px}</style><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script></head><body><div id="map"></div><script src="data/CategoryTest_1.js"></script><script>var bounds_group = new L.featureGroup([]); var map = L.map('map', { zoomControl:true, maxZoom:28, minZoom:1 }).fitBounds([[-6.81,108.43],[-6.74,108.51]]); var layer_CategoryTest_1 = new L.geoJson(json_CategoryTest_1, {}); map.addLayer(layer_CategoryTest_1);</script></body></html>`);
  zip.file(`${root}data/CategoryTest_1.js`, `var json_CategoryTest_1 = {"type":"FeatureCollection","name":"CategoryTest_1","features":[{"type":"Feature","properties":{"GROUP":"Filled","NAME":"filled"},"geometry":{"type":"Polygon","coordinates":[[[108.43,-6.81],[108.44,-6.81],[108.44,-6.80],[108.43,-6.80],[108.43,-6.81]]]}},{"type":"Feature","properties":{"GROUP":"","NAME":"empty"},"geometry":{"type":"Polygon","coordinates":[[[108.45,-6.81],[108.46,-6.81],[108.46,-6.80],[108.45,-6.80],[108.45,-6.81]]]}},{"type":"Feature","properties":{"GROUP":null,"NAME":"nullish"},"geometry":{"type":"Polygon","coordinates":[[[108.47,-6.81],[108.48,-6.81],[108.48,-6.80],[108.47,-6.80],[108.47,-6.81]]]}},{"type":"Feature","properties":{"NAME":"missing"},"geometry":{"type":"Polygon","coordinates":[[[108.49,-6.81],[108.50,-6.81],[108.50,-6.80],[108.49,-6.80],[108.49,-6.81]]]}}]};`);
  await writeFile(zipPath, await zip.generateAsync({ type: "nodebuffer" }));
  return zipPath;
}

async function displayNameBySource(page: import("@playwright/test").Page, sourceFileName: string): Promise<string> {
  return page.evaluate((fileName) => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; sourcePath: string }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.sourcePath.endsWith(`/data/${fileName}`));
    if (!layer) throw new Error(`Expected layer from ${fileName}.`);
    return layer.displayName;
  }, sourceFileName);
}

async function layerCoordinates(page: import("@playwright/test").Page, layerName: string): Promise<unknown[]> {
  return page.evaluate((name) => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === name);
    if (!layer) throw new Error(`Expected layer ${name}.`);
    return layer.geojson.features.map((feature) => feature.geometry?.coordinates);
  }, layerName);
}

async function lassoFirstFeature(page: import("@playwright/test").Page, layerName: string) {
  await page.getByTitle(/Lasso select multiple features \(7\)/i).click();
  await page.evaluate((name) => {
    const map = (window as Window & { __q2ws_map?: { fire: (type: string, data: unknown) => void } }).__q2ws_map;
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === name);
    if (!map || !layer) throw new Error("Expected debug map and layer.");
    const values = JSON.stringify(layer.geojson.features[0]?.geometry?.coordinates).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const pairs: Array<[number, number]> = [];
    for (let index = 0; index < values.length - 1; index += 2) pairs.push([values[index], values[index + 1]]);
    const lngs = pairs.map(([lng]) => lng);
    const lats = pairs.map(([, lat]) => lat);
    const west = Math.min(...lngs) - 0.01;
    const south = Math.min(...lats) - 0.01;
    const east = Math.max(...lngs) + 0.01;
    const north = Math.max(...lats) + 0.01;
    const points = [[north, west], [north, east], [south, east], [south, west], [north, west]];
    map.fire("mousedown", { latlng: { lat: points[0][0], lng: points[0][1] } });
    points.slice(1).forEach(([lat, lng]) => map.fire("mousemove", { latlng: { lat, lng } }));
    map.fire("mouseup", { latlng: { lat: points[0][0], lng: points[0][1] } });
  }, layerName);
  await expect(page.getByTestId("multi-select-panel")).toContainText("1 features selected");
}

async function exportedGeojson(zipPath: string, dataFileName: string): Promise<GeoJSON.FeatureCollection> {
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const entry = Object.keys(zip.files).find((path) => path.endsWith(`/data/${dataFileName}`));
  if (!entry) throw new Error(`Expected exported ${dataFileName}.`);
  const dataText = await zip.file(entry)!.async("string");
  return JSON.parse(dataText.replace(/^var\s+[A-Za-z0-9_]+\s*=\s*/, "").replace(/;\s*$/, ""));
}

async function startStaticServer(rootDir: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const relativePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = join(rootDir, relativePath.replace(/^\//, ""));
      const body = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const contentType = extension === ".html"
        ? "text/html; charset=utf-8"
        : extension === ".js"
          ? "application/javascript; charset=utf-8"
          : extension === ".css"
            ? "text/css; charset=utf-8"
            : extension === ".json"
              ? "application/json; charset=utf-8"
              : undefined;
      response.writeHead(200, contentType ? { "Content-Type": contentType } : undefined);
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected static server to bind to a TCP port.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

test("imports fixture and renders map", async ({ page }) => {
  const requests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    requests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await assertRenderedMap(page, requests, consoleErrors);

  const debugBufferExists = await page.evaluate(() => Array.isArray((window as Window & { __q2wsDebugEvents?: unknown[] }).__q2wsDebugEvents));
  expect(debugBufferExists).toBe(true);

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: /Editing Shortcuts/i })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByRole("dialog", { name: /Editing Shortcuts/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Editing Shortcuts/i })).toHaveCount(0);

  await page.getByRole("button", { name: /Sungai/i }).click();
  await expect(page.locator(".draw-status")).toContainText(/preview-only/i);
  await page.keyboard.press("3");
  await expect(page.locator(".draw-status")).toContainText(/preview-only/i);
  await expect(page.getByTitle(/Draw line \(3\)/i)).toBeDisabled();
  await page.keyboard.press("7");
  await expect(page.locator(".draw-status")).toContainText(/lasso/i);

  await page.evaluate(() => {
    (window as Window & { __q2wsDebugEvents?: unknown[] }).__q2wsDebugEvents = [];
  });
  await expect(page.getByRole("button", { name: "Snap" })).toBeDisabled();
  await page.waitForTimeout(400);
  const autoFitEvents = await page.evaluate(() => {
    const events = (window as Window & { __q2wsDebugEvents?: Array<{ source?: string; event?: string }> }).__q2wsDebugEvents || [];
    return events.filter((entry) => entry.source === "autofit").map((entry) => entry.event);
  });
  expect(autoFitEvents).not.toContain("apply");
});

test("audit v4 phase 2a keeps App thin and project state extracted", async () => {
  const appSource = await readFile(join(process.cwd(), "src", "App.tsx"), "utf8");
  const appLines = appSource.split(/\r?\n/).length;
  expect(appLines).toBeLessThanOrEqual(700);

  const requiredFiles = [
    join(process.cwd(), "src", "hooks", "useProjectState.ts"),
    join(process.cwd(), "src", "lib", "projectHydration.ts"),
    join(process.cwd(), "src", "lib", "geometryTransforms.ts"),
    join(process.cwd(), "src", "lib", "appHelpers.ts")
  ];
  for (const filePath of requiredFiles) {
    expect(existsSync(filePath), `${filePath} should exist`).toBe(true);
  }

  expect(appSource).not.toContain("function hydrateProject");
  expect(appSource).not.toContain("function translateGeometry");
  expect(appSource).not.toContain("function selectedFeatureTitle");
});

test("audit v4 phase 2 debt keeps App shell below 400 lines", async () => {
  const { readFile } = await import("node:fs/promises");
  const appSource = await readFile("src/App.tsx", "utf8");
  const lines = appSource.trimEnd().split("\n");
  expect(lines.length).toBeLessThanOrEqual(400);
});

test("production headers restore strict main app CSP after service worker preview", async ({ page }) => {
  const response = await page.goto("/_headers");
  expect(response?.ok()).toBe(true);
  const headers = await page.locator("body").textContent();
  expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(headers).toContain("style-src 'self' 'unsafe-inline'");
  expect(headers).toContain("worker-src 'self' blob:");
  expect(headers).toContain("frame-src 'self'");
  expect(headers).not.toContain("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' blob:");
  expect(headers).not.toContain("style-src 'self' 'unsafe-inline' blob:");
  expect(headers).not.toContain("frame-src 'self' blob:");
  expect(headers).not.toContain("TEMPORARY: 'unsafe-inline' + blob: required for blob-iframe Preview");
});

test("selected feature header uses a readable label and cannot overflow inspector", async ({ page }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  const heading = page.getByTestId("selected-feature-title");
  await expect(heading).toBeVisible();
  await expect(heading).not.toContainText(/::/);
  await expect(heading).toContainText(/\S+/);
  const hasHorizontalOverflow = await page.locator(".inspector").evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test("phase 2b layer inspector uses ordered sections with sticky selection toolbar and geometry-specific ops", async ({ page }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Sungai/i }).click();

  const layerPanel = page.getByTestId("layer-tab-panel");
  await expect(layerPanel).toBeVisible();

  const sectionOrder = await layerPanel.locator('[data-testid^="layer-section-"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-testid"))
  );
  expect(sectionOrder).toEqual([
    "layer-section-tabs",
    "layer-section-selection-toolbar",
    "layer-section-selected-feature",
    "layer-section-geometry-ops",
    "layer-section-layer-settings",
    "layer-section-labels"
  ]);

  const inspectorScopes = page.locator(".inspector > .inspector-scope");
  await expect(inspectorScopes).toHaveCount(1);
  await expect(inspectorScopes.first()).toContainText(/Project\s*\/\s*Sungai/i);

  const toolbar = page.getByTestId("layer-selection-toolbar");
  await expect(toolbar).toContainText(/0 features selected|1 features selected/i);
  const toolbarPosition = await toolbar.evaluate((element) => window.getComputedStyle(element).position);
  expect(toolbarPosition).toBe("sticky");

  const geometryOps = page.getByTestId("layer-geometry-ops");
  await expect(geometryOps.getByRole("button", { name: /Split line/i })).toBeVisible();
  await expect(geometryOps.getByRole("button", { name: /Divide line/i })).toBeVisible();
  await expect(geometryOps.getByRole("button", { name: /Simplify selected feature/i })).toBeVisible();
  await expect(geometryOps.getByRole("button", { name: /Convex hull/i })).toBeVisible();
  await expect(geometryOps.getByRole("button", { name: /Polygon to line/i })).toHaveCount(0);
  await expect(geometryOps.getByRole("button", { name: /Split line/i })).toBeDisabled();
  await expect(geometryOps.getByRole("button", { name: /Divide line/i })).toBeDisabled();
  await expect(geometryOps.getByRole("button", { name: /Simplify selected feature/i })).toBeDisabled();
  await expect(geometryOps.getByRole("button", { name: /Convex hull/i })).toBeDisabled();

  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(geometryOps.getByRole("button", { name: /Split line/i })).toBeEnabled();
  await expect(geometryOps.getByRole("button", { name: /Divide line/i })).toBeEnabled();
  await expect(geometryOps.getByRole("button", { name: /Simplify selected feature/i })).toBeEnabled();
  await expect(geometryOps.getByRole("button", { name: /Convex hull/i })).toBeEnabled();

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  const polygonOps = page.getByTestId("layer-geometry-ops");
  await expect(polygonOps.getByRole("button", { name: /Polygon to line/i })).toBeVisible();
  await expect(polygonOps.getByRole("button", { name: /Convex hull/i })).toBeVisible();
  await expect(polygonOps.getByRole("button", { name: /Split line/i })).toHaveCount(0);
  await expect(polygonOps.getByRole("button", { name: /Divide line/i })).toHaveCount(0);
});

test("phase 2b manual legend lives in project inspector instead of layer inspector", async ({ page }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Sungai/i }).click();
  await expect(page.getByRole("tab", { name: /^Legend$/i })).toHaveCount(0);

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await expect(page.getByTestId("project-manual-legend")).toBeVisible();
  await expect(page.getByText(/Manual legend items are project-wide/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Add legend item/i })).toBeVisible();
});

test("initial zoom setting reapplies the editor map view", async ({ page }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator('label:has-text("Initial zoom") select').selectOption("fixed");
  const zoomSlider = page.locator('.range-number-field:has-text("Zoom level") input[type="range"]');
  await zoomSlider.fill("9");
  await expect.poll(() => page.evaluate(() => (window as Window & { __q2ws_map?: { getZoom: () => number } }).__q2ws_map?.getZoom())).toBe(9);
});

test("phase 1 branding uses q2webstudio and support button floats bottom left", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("q2webstudio");
  await expect(page.getByRole("heading", { level: 1, name: "q2webstudio" })).toBeVisible();
  await expect(page.locator(".empty-state")).toContainText("Visual editor untuk hasil export qgis2web");
  const supportLink = page.getByTestId("support-link");
  await expect(supportLink).toBeVisible();
  await expect(supportLink).toHaveAttribute("href", "https://tiptap.gg/dhanypedia");
  const supportBox = await supportLink.boundingBox();
  if (!supportBox) throw new Error("Expected support button bounds.");
  expect(supportBox.width).toBeLessThanOrEqual(40);
  expect(supportBox.x).toBeLessThan(40);
});

test("phase 1 shell persists left panel collapse state", async ({ page }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  const collapseButton = page.getByRole("button", { name: /Collapse side panel/i });
  await expect(collapseButton).toBeVisible();
  await collapseButton.click();
  await expect(page.locator('[data-testid="left-panel-expand"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-testid="left-panel-expand"]')).toBeVisible();
  await page.getByTestId("left-panel-expand").click();
  await expect(page.getByRole("button", { name: /Collapse side panel/i })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("react-resizable-panels:q2ws-workspace-layout:left-panel:main-stage:right-panel", JSON.stringify({ "left-panel": 24, "main-stage": 50, "right-panel": 26 }));
    localStorage.setItem("q2ws-left-panel-collapsed", "false");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /Collapse side panel/i })).toBeVisible();
  await page.getByRole("button", { name: /Collapse side panel/i }).click();
  await expect(page.locator('[data-testid="left-panel-expand"]')).toBeVisible();
  await page.getByTestId("left-panel-expand").click();
  await expect(page.getByRole("button", { name: /Collapse side panel/i })).toBeVisible();
  const storedLayout = await page.evaluate(() => localStorage.getItem("react-resizable-panels:q2ws-workspace-layout:left-panel:main-stage:right-panel"));
  if (!storedLayout) throw new Error("Expected stored workspace layout.");
  const leftPanelWidth = await page.locator('[data-testid="left-panel"]').boundingBox();
  const workspaceWidth = await page.locator('[data-testid="workspace-panels"]').boundingBox();
  if (!leftPanelWidth || !workspaceWidth) throw new Error("Expected workspace panel bounds.");
  expect(leftPanelWidth.width / workspaceWidth.width).toBeGreaterThan(0.21);
});

test("lasso selects multiple features in the selected layer", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const lassoLayerName = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.geojson.features.length > 0);
    if (!layer) throw new Error("Expected a layer for lasso selection.");
    return layer.displayName;
  });
  await page.getByRole("button", { name: new RegExp(lassoLayerName, "i") }).click();
  await expect(page.locator(".draw-status")).toContainText(/preview-only/i);
  await page.evaluate(() => {
    (window as Window & { __q2wsDebugEvents?: unknown[] }).__q2wsDebugEvents = [];
  });

  await page.getByTitle(/Lasso select multiple features \(7\)/i).click();
  await expect(page.locator(".draw-status")).toContainText(/lasso/i);
  await page.evaluate((layerName) => {
    const map = (window as Window & { __q2ws_map?: { fire: (type: string, data: unknown) => void } }).__q2ws_map;
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === layerName);
    if (!map || !layer) throw new Error("Expected debug map and project.");
    const coordinates = layer.geojson.features.flatMap((feature) => {
      const geometry = feature.geometry;
      if (!geometry) return [];
      const values = JSON.stringify(geometry.coordinates).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      const pairs: Array<[number, number]> = [];
      for (let index = 0; index < values.length - 1; index += 2) pairs.push([values[index], values[index + 1]]);
      return pairs;
    });
    const lngs = coordinates.map(([lng]) => lng);
    const lats = coordinates.map(([, lat]) => lat);
    const west = Math.min(...lngs) - 0.001;
    const south = Math.min(...lats) - 0.001;
    const east = Math.max(...lngs) + 0.001;
    const north = Math.max(...lats) + 0.001;
    const points = [[north, west], [north, east], [south, east], [south, west], [north, west]];
    map.fire("mousedown", { latlng: { lat: points[0][0], lng: points[0][1] } });
    points.slice(1).forEach(([lat, lng]) => map.fire("mousemove", { latlng: { lat, lng } }));
    map.fire("mouseup", { latlng: { lat: points[0][0], lng: points[0][1] } });
  }, lassoLayerName);

  await expect(page.getByTestId("multi-select-panel")).toContainText(/\d+ features selected/);
  const selectedCount = await page.getByTestId("multi-select-panel").textContent();
  expect(Number(selectedCount?.match(/(\d+) features selected/)?.[1] || 0)).toBeGreaterThan(0);
  const terraDrawEvents = await page.evaluate(() => {
    const events = (window as Window & { __q2wsDebugEvents?: Array<{ source?: string; event?: string }> }).__q2wsDebugEvents || [];
    return events.filter((entry) => entry.source === "terradraw").map((entry) => entry.event);
  });
  expect(terraDrawEvents).toEqual([]);

  const featureClickPoint = await page.evaluate((layerName) => {
    const map = (window as Window & { __q2ws_map?: { latLngToContainerPoint: (latLng: [number, number]) => { x: number; y: number } } }).__q2ws_map;
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === layerName);
    if (!map || !layer) throw new Error("Expected debug map and project.");
    const geometry = layer.geojson.features[0].geometry;
    const values = JSON.stringify(geometry?.coordinates).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const pairs: Array<[number, number]> = [];
    for (let index = 0; index < values.length - 1; index += 2) pairs.push([values[index], values[index + 1]]);
    const lngs = pairs.map(([lng]) => lng);
    const lats = pairs.map(([, lat]) => lat);
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const point = map.latLngToContainerPoint([lat, lng]);
    const rect = document.querySelector(".map-canvas")!.getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, lassoLayerName);
  await page.mouse.click(featureClickPoint.x, featureClickPoint.y);
  await expect(page.getByTestId("multi-select-panel")).toContainText("0 features selected");
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  await page.getByRole("button", { name: /Select all/i }).click();
  await expect(page.getByTestId("multi-select-panel")).toContainText(/\d+ features selected/);
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await expect(page.getByTestId("multi-select-panel")).toContainText("0 features selected");
  expect(consoleErrors).toEqual([]);
});

test("translates selected simple features in place", async ({ page }) => {
  const fixtureDir = await createTranslateFixture();
  try {
    await page.goto("/?debug=1");
    await page.locator('input[webkitdirectory]').setInputFiles(fixtureDir);
    await expect(page.locator(".status-box")).toContainText(/Imported 3 layers/i, { timeout: 15000 });

    for (const sourceFileName of ["SimplePoint_1.js", "SimpleLine_2.js", "SimplePolygon_3.js"]) {
      const layerName = await displayNameBySource(page, sourceFileName);
      await page.getByRole("button", { name: new RegExp(layerName, "i") }).click();
      const before = await layerCoordinates(page, layerName);
      await lassoFirstFeature(page, layerName);
      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toMatch(/dx/i);
        await dialog.accept("0.001 -0.002 999");
      });
      await page.getByTestId("multi-select-panel").getByRole("button", { name: /Translate selected/i }).click();
      const afterInvalid = await layerCoordinates(page, layerName);
      expect(afterInvalid).toEqual(before);

      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toMatch(/dx/i);
        await dialog.accept("0.001, -0.002");
      });
      await page.getByTestId("multi-select-panel").getByRole("button", { name: /Translate selected/i }).click();
      await expect(page.getByTestId("multi-select-panel")).toContainText("1 features selected");

      const after = await layerCoordinates(page, layerName);
      expect(after[0]).not.toEqual(before[0]);
      expect(after[1]).toEqual(before[1]);
    }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("exports translated coordinates in ZIP data", async ({ page }) => {
  const fixtureDir = await createTranslateFixture();
  try {
    await page.goto("/?debug=1");
    await page.locator('input[webkitdirectory]').setInputFiles(fixtureDir);
    await expect(page.locator(".status-box")).toContainText(/Imported 3 layers/i, { timeout: 15000 });

    const lineLayerName = await displayNameBySource(page, "SimpleLine_2.js");
    await page.getByRole("button", { name: new RegExp(lineLayerName, "i") }).click();
    await lassoFirstFeature(page, lineLayerName);
    page.once("dialog", async (dialog) => {
      await dialog.accept("0.001, -0.002");
    });
    await page.getByRole("button", { name: /Translate selected/i }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export ZIP/i }).click()
    ]);
    const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-translate-export-");
    try {
      const geojson = await exportedGeojson(zipPath, "SimpleLine_2.js");
      expect(geojson.features[0]?.geometry?.coordinates).toEqual([[108.461, -6.792], [108.471, -6.782]]);
      expect(geojson.features[1]?.geometry?.coordinates).toEqual([[108.51, -6.74], [108.52, -6.73]]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("undoes and redoes selected feature translation", async ({ page }) => {
  const fixtureDir = await createTranslateFixture();
  try {
    await page.goto("/?debug=1");
    await page.locator('input[webkitdirectory]').setInputFiles(fixtureDir);
    await expect(page.locator(".status-box")).toContainText(/Imported 3 layers/i, { timeout: 15000 });

    const lineLayerName = await displayNameBySource(page, "SimpleLine_2.js");
    await page.getByRole("button", { name: new RegExp(lineLayerName, "i") }).click();
    await lassoFirstFeature(page, lineLayerName);
    const before = await layerCoordinates(page, lineLayerName);
    page.once("dialog", async (dialog) => {
      await dialog.accept("0.001, -0.002");
    });
    await page.getByTestId("multi-select-panel").getByRole("button", { name: /Translate selected/i }).click();
    const translated = await layerCoordinates(page, lineLayerName);
    expect(translated).not.toEqual(before);

    await page.getByRole("button", { name: /Undo \(Translate selected features\)/i }).click();
    await expect(page.getByRole("button", { name: /Redo \(Translate selected features\)/i })).toBeEnabled();
    expect(await layerCoordinates(page, lineLayerName)).toEqual(before);

    await page.getByRole("button", { name: /Redo \(Translate selected features\)/i }).click();
    await expect(page.getByRole("button", { name: /Undo \(Translate selected features\)/i })).toBeEnabled();
    expect(await layerCoordinates(page, lineLayerName)).toEqual(translated);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("rotates selected simple features in place and exports coordinates", async ({ page }) => {
  const fixtureDir = await createTranslateFixture();
  try {
    await page.goto("/?debug=1");
    await page.locator('input[webkitdirectory]').setInputFiles(fixtureDir);
    await expect(page.locator(".status-box")).toContainText(/Imported 3 layers/i, { timeout: 15000 });

    const lineLayerName = await displayNameBySource(page, "SimpleLine_2.js");
    await page.getByRole("button", { name: new RegExp(lineLayerName, "i") }).click();
    await lassoFirstFeature(page, lineLayerName);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/degrees/i);
      await dialog.accept("90");
    });
    await page.getByTestId("multi-select-panel").getByRole("button", { name: /Rotate selected/i }).click();

    const after = await layerCoordinates(page, lineLayerName);
    expect(after[0]).toEqual([[108.47, -6.79], [108.46, -6.78]]);
    expect(after[1]).toEqual([[108.51, -6.74], [108.52, -6.73]]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export ZIP/i }).click()
    ]);
    const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-rotate-export-");
    try {
      const geojson = await exportedGeojson(zipPath, "SimpleLine_2.js");
      expect(geojson.features[0]?.geometry?.coordinates).toEqual([[108.47, -6.79], [108.46, -6.78]]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("scales selected simple features in place and exports coordinates", async ({ page }) => {
  const fixtureDir = await createTranslateFixture();
  try {
    await page.goto("/?debug=1");
    await page.locator('input[webkitdirectory]').setInputFiles(fixtureDir);
    await expect(page.locator(".status-box")).toContainText(/Imported 3 layers/i, { timeout: 15000 });

    const lineLayerName = await displayNameBySource(page, "SimpleLine_2.js");
    await page.getByRole("button", { name: new RegExp(lineLayerName, "i") }).click();
    await lassoFirstFeature(page, lineLayerName);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/factor/i);
      await dialog.accept("2");
    });
    await page.getByTestId("multi-select-panel").getByRole("button", { name: /Scale selected/i }).click();

    const after = await layerCoordinates(page, lineLayerName);
    expect(after[0]).toEqual([[108.455, -6.795], [108.475, -6.775]]);
    expect(after[1]).toEqual([[108.51, -6.74], [108.52, -6.73]]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export ZIP/i }).click()
    ]);
    const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-scale-export-");
    try {
      const geojson = await exportedGeojson(zipPath, "SimpleLine_2.js");
      expect(geojson.features[0]?.geometry?.coordinates).toEqual([[108.455, -6.795], [108.475, -6.775]]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test("phase 6 preview uses service worker route instead of blob iframe", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByTestId("open-preview").click();
  const frame = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(frame).toHaveAttribute("src", /\/preview\/[A-Za-z0-9-]+\/index\.html/);
  expect(consoleErrors).toEqual([]);
});

test("phase 6 preview renders after main app CSP reverts to strict mode", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toHaveAttribute("src", /\/preview\/[A-Za-z0-9-]+\/index\.html/);
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  await expect(frame.locator("#q2ws-layer-control")).toBeVisible({ timeout: 15000 });
  expect(consoleErrors).toEqual([]);
});

test("phase 6 initial view can match qgis2web export-original bounds", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const projectView = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { mapSettings: { initialZoomMode: string; initialBounds?: [[number, number], [number, number]] } } }).__q2ws_project;
    const map = (window as Window & { __q2ws_map?: { getCenter: () => { lat: number; lng: number }; getBounds: () => { contains: (latLng: [number, number]) => boolean } } }).__q2ws_map;
    if (!project || !map || !project.mapSettings.initialBounds) throw new Error("Expected imported project and map.");
    const center = map.getCenter();
    return {
      mode: project.mapSettings.initialZoomMode,
      containsSouthWest: map.getBounds().contains(project.mapSettings.initialBounds[0]),
      containsNorthEast: map.getBounds().contains(project.mapSettings.initialBounds[1]),
      center: [center.lat, center.lng]
    };
  });
  expect(projectView.mode).toBe("export-original");
  expect(projectView.containsSouthWest).toBe(true);
  expect(projectView.containsNorthEast).toBe(true);
  expect(projectView.center[0]).toBeGreaterThan(-6.81);
  expect(projectView.center[0]).toBeLessThan(-6.75);
  expect(projectView.center[1]).toBeGreaterThan(108.44);
  expect(projectView.center[1]).toBeLessThan(108.50);

  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByRole("button", { name: "Match qgis2web export view" })).toBeVisible();

  await page.getByTestId("open-preview").click();
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  const runtimeView = await frame.locator("body").evaluate(() => {
    const runtimeWindow = window as Window & {
      map?: { getCenter: () => { lat: number; lng: number }; getBounds: () => { contains: (latLng: [number, number]) => boolean } };
      __q2wsConfig?: { mapSettings: { initialZoomMode: string; initialBounds?: [[number, number], [number, number]] } };
    };
    if (!runtimeWindow.map || !runtimeWindow.__q2wsConfig?.mapSettings.initialBounds) throw new Error("Expected runtime map and config.");
    const center = runtimeWindow.map.getCenter();
    return {
      mode: runtimeWindow.__q2wsConfig.mapSettings.initialZoomMode,
      containsSouthWest: runtimeWindow.map.getBounds().contains(runtimeWindow.__q2wsConfig.mapSettings.initialBounds[0]),
      containsNorthEast: runtimeWindow.map.getBounds().contains(runtimeWindow.__q2wsConfig.mapSettings.initialBounds[1]),
      center: [center.lat, center.lng]
    };
  });
  expect(runtimeView.mode).toBe("export-original");
  expect(runtimeView.containsSouthWest).toBe(true);
  expect(runtimeView.containsNorthEast).toBe(true);
});

test("phase 7 style mode selector shows single-style empty state", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const singleLayerName = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; style: { mode: string; categories: unknown[] } }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName !== "Sungai" && candidate.style.mode === "single" && candidate.style.categories.length === 0);
    if (!layer) throw new Error("Expected an actually single-style fixture layer that is not Sungai.");
    return layer.displayName;
  });

  await page.getByRole("button", { name: new RegExp(singleLayerName, "i") }).click();
  await page.getByRole("tab", { name: "Style" }).click();
  const selector = page.getByLabel("Style mode");
  await expect(selector).toBeVisible();
  await expect(selector).toHaveValue("single");
  await expect(selector.locator("option")).toHaveText(["Single symbol", "Categorized", "Graduated"]);
  await expect(page.getByTestId("single-style-empty-state")).toContainText(/shown with one symbol/i);
  await expect(page.locator(".category-row")).toHaveCount(0);

  await selector.selectOption("categorized");
  await expect(page.getByTestId("categorized-style-panel")).toBeVisible();
  await expect(page.getByTestId("categorized-style-panel")).toContainText(/Choose a field/i);
  await expect(page.locator(".category-row")).toHaveCount(0);
});

test("phase 7 categorized style regenerates categories from chosen field", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByLabel("Style mode").selectOption("categorized");

  const categoryField = page.getByLabel("Category field");
  await expect(categoryField).toBeVisible();
  await categoryField.selectOption("WADMKK");

  await expect(page.locator(".category-row")).toHaveCount(2);
  await expect(page.locator(".category-row").first().locator("input").first()).not.toHaveValue("");

  const categorizedLayer = await page.evaluate(() => {
    const project = (window as Window & {
      __q2ws_project?: {
        layers: Array<{
          displayName: string;
          style: {
            mode: string;
            categoryField: string;
            categories: Array<{ value: string; label: string }>;
          };
        }>;
      };
    }).__q2ws_project;
    return project?.layers.find((layer) => layer.displayName === "Batas Desa")?.style;
  });

  expect(categorizedLayer).toMatchObject({
    mode: "categorized",
    categoryField: "WADMKK"
  });
  expect(categorizedLayer?.categories.length).toBe(2);
  expect(categorizedLayer?.categories.every((category) => category.label)).toBe(true);
});

test("phase 7 categorized style keeps empty values aligned with rendered lookup", async ({ page }) => {
  const zipPath = await createCategorizedEmptyFixtureZip();
  await page.goto(debugUrl("/"));
  await page.locator('input[accept*=".zip"]').setInputFiles(zipPath);
  await expect(page.locator(".status-box")).toContainText(/Imported 1 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Category Test/i }).click();
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByLabel("Style mode").selectOption("categorized");
  await page.getByLabel("Category field").selectOption("GROUP");

  await expect(page.locator(".category-row")).toHaveCount(2);
  await expect(page.locator(".category-row").first().locator("input").first()).toHaveValue("(empty)");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath: exportedZipPath } = await saveDownloadToTempDir(download, "q2ws-category-empty-export-");

  try {
    await unzipToDirectory(exportedZipPath, tempDir);
    const rootEntries = await readdir(tempDir, { withFileTypes: true });
    const exportRoot = rootEntries.find((entry) => entry.isDirectory());
    if (!exportRoot) throw new Error("Expected exported ZIP root directory.");

    const server = await startStaticServer(join(tempDir, exportRoot.name));
    const runtimePage = await page.context().browser()!.newPage();
    try {
      const runtimeErrors: string[] = [];
      runtimePage.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });

      await runtimePage.goto(`${server.origin}/index.html`);
      await runtimePage.waitForFunction(() => Boolean((window as Window & { layer_CategoryTest_1?: unknown; __q2wsConfig?: unknown }).layer_CategoryTest_1 && window.__q2wsConfig), null, { timeout: 15000 });

      const runtimeState = await runtimePage.evaluate(() => {
        const runtimeWindow = window as Window & {
          __q2wsConfig?: {
            layers?: Array<{
              displayName: string;
              style?: { categoryField?: string; categories?: Array<{ value: string; label: string; fillColor?: string; strokeColor?: string }> };
            }>;
          };
          layer_CategoryTest_1?: { eachLayer: (callback: (featureLayer: { feature?: GeoJSON.Feature; options?: { fillColor?: string; color?: string } }) => void) => void };
        };

        const layerConfig = runtimeWindow.__q2wsConfig?.layers?.find((layer) => layer.displayName === "Category Test");
        if (!layerConfig?.style?.categoryField || !layerConfig.style.categories) throw new Error("Expected categorized runtime config.");
        const rendered: Array<{ name: string | null; rawValue: unknown; matchedValue: string | null; matchedLabel: string | null; fillColor: string | null; strokeColor: string | null }> = [];
        runtimeWindow.layer_CategoryTest_1?.eachLayer((featureLayer) => {
          const rawValue = featureLayer.feature?.properties?.[layerConfig.style?.categoryField as string];
          const normalizedValue = rawValue == null ? "" : String(rawValue);
          const matched = layerConfig.style?.categories?.find((category) => category.value === normalizedValue) || null;
          rendered.push({
            name: typeof featureLayer.feature?.properties?.NAME === "string" ? featureLayer.feature.properties.NAME : null,
            rawValue: rawValue ?? null,
            matchedValue: matched?.value ?? null,
            matchedLabel: matched?.label ?? null,
            fillColor: featureLayer.options?.fillColor ?? null,
            strokeColor: featureLayer.options?.color ?? null
          });
        });
        return {
          categories: layerConfig.style.categories,
          rendered
        };
      });

      expect(runtimeState.categories).toMatchObject([
        { value: "", label: "(empty)" },
        { value: "Filled", label: "Filled" }
      ]);
      expect(runtimeState.rendered).toEqual([
        { name: "filled", rawValue: "Filled", matchedValue: "Filled", matchedLabel: "Filled", fillColor: runtimeState.categories[1]?.fillColor ?? null, strokeColor: runtimeState.categories[1]?.strokeColor ?? null },
        { name: "empty", rawValue: "", matchedValue: "", matchedLabel: "(empty)", fillColor: runtimeState.categories[0]?.fillColor ?? null, strokeColor: runtimeState.categories[0]?.strokeColor ?? null },
        { name: "nullish", rawValue: null, matchedValue: "", matchedLabel: "(empty)", fillColor: runtimeState.categories[0]?.fillColor ?? null, strokeColor: runtimeState.categories[0]?.strokeColor ?? null },
        { name: "missing", rawValue: null, matchedValue: "", matchedLabel: "(empty)", fillColor: runtimeState.categories[0]?.fillColor ?? null, strokeColor: runtimeState.categories[0]?.strokeColor ?? null }
      ]);
      expect(runtimeErrors).toEqual([]);
    } finally {
      await runtimePage.close();
      await server.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase 6 preview can reopen repeatedly without orphan state", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId("open-preview").click();
    const iframe = page.locator('[data-testid="runtime-preview-frame"]');
    await expect(iframe).toHaveAttribute("src", /\/preview\/[A-Za-z0-9-]+\/index\.html/);
    await expect(page.frameLocator('[data-testid="runtime-preview-frame"]').locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Exit Preview/i }).click();
    await expect(iframe).toHaveCount(0);
  }
  expect(consoleErrors).toEqual([]);
});

test("runtime preview mirrors exported map path", async ({ page }) => {
  const requests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await assertRenderedMap(page, requests, consoleErrors);

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-same-origin");
  await expect(iframe).toHaveAttribute("src", /\/preview\/[A-Za-z0-9-]+\/index\.html/);
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  await expect(frame.locator("#q2ws-layer-control")).toBeVisible({ timeout: 15000 });
  const openTabButton = page.getByRole("button", { name: /Open Tab/i });
  await expect(openTabButton).toBeEnabled();

  const [previewTab] = await Promise.all([
    page.waitForEvent("popup"),
    openTabButton.click()
  ]);
  try {
    await previewTab.waitForLoadState("domcontentloaded");
    await expect(previewTab.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    await expect(previewTab.locator("#q2ws-layer-control")).toBeVisible({ timeout: 15000 });
  } finally {
    await previewTab.close();
  }
  expect(consoleErrors).toEqual([]);
});

test("runtime preview mirrors disabled widget export state", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator(".widget-row", { hasText: /Measure tool/i }).locator('input[type="checkbox"]').uncheck();
  await page.locator(".widget-row", { hasText: /Address search/i }).locator('input[type="checkbox"]').uncheck();

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  await expect(iframe).toHaveAttribute("src", /\/preview\/[A-Za-z0-9-]+\/index\.html/);
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  await expect(frame.locator(".leaflet-control-measure")).toHaveCount(0);

  const previewHtml = await page.evaluate(async () => {
    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="runtime-preview-frame"]');
    if (!iframe?.src) return "";
    return fetch(iframe.src).then((response) => response.text());
  });
  expect(previewHtml).not.toContain("leaflet-measure.css");
  expect(previewHtml).not.toContain("leaflet.photon.css");
  expect(consoleErrors).toEqual([]);
});

test("Export Now downloads the same runtime ZIP from preview", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByTestId("open-preview").click();
  await expect(page.locator('[data-testid="runtime-preview-frame"]')).toBeVisible({ timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export Now/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-export-now-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const entries = Object.keys(zip.files);
    expect(download.suggestedFilename()).toBe("qgis2web_2026_04_22-06_30_44_400659-studio.zip");
    expect(entries).toContain("qgis2web_2026_04_22-06_30_44_400659/q2ws-config.json");
    expect(entries).toContain("qgis2web_2026_04_22-06_30_44_400659/q2ws-runtime.js");
    expect(entries).toContain("qgis2web_2026_04_22-06_30_44_400659/q2ws-custom.css");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("runtime preview can reopen without leaking blob URLs", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await page.evaluate(() => {
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const active = new Set<string>();
    (window as Window & { __q2wsBlobUrls?: Set<string> }).__q2wsBlobUrls = active;
    URL.createObjectURL = ((value: Blob | MediaSource) => {
      const url = originalCreate(value);
      active.add(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      active.delete(url);
      originalRevoke(url);
    }) as typeof URL.revokeObjectURL;
  });
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId("open-preview").click();
    await expect(page.locator('[data-testid="runtime-preview-frame"]')).toBeVisible({ timeout: 15000 });
    await expect(page.frameLocator('[data-testid="runtime-preview-frame"]').locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Exit Preview/i }).click();
    await expect(page.locator('[data-testid="runtime-preview-frame"]')).toHaveCount(0);
  }

  const activeBlobUrls = await page.evaluate(() => (window as Window & { __q2wsBlobUrls?: Set<string> }).__q2wsBlobUrls?.size || 0);
  expect(activeBlobUrls).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("applies simplify to selected line feature", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: "Sungai MultiLineString" }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  const before = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Sungai");
    const feature = layer?.geojson.features[0];
    return JSON.stringify(feature?.geometry || null);
  });

  await page.getByRole("button", { name: /Simplify selected feature/i }).click();

  await page.waitForFunction(
    (previousGeometry) => {
      const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
      const layer = project?.layers.find((candidate) => candidate.displayName === "Sungai");
      const feature = layer?.geojson.features[0];
      return JSON.stringify(feature?.geometry || null) !== previousGeometry;
    },
    before,
    { timeout: 15000 }
  );

  const after = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Sungai");
    const feature = layer?.geojson.features[0];
    return JSON.stringify(feature?.geometry || null);
  });
  expect(after).not.toBe(before);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-simplify-smoke-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const dataEntry = zip.file("qgis2web_2026_04_22-06_30_44_400659/data/Sungai_5.js");
    expect(dataEntry).toBeTruthy();
    const dataText = await dataEntry!.async("string");
    const geojson = JSON.parse(dataText.replace(/^var\s+json_Sungai_5\s*=\s*/, "").replace(/;\s*$/, ""));
    expect(JSON.stringify(geojson.features[0].geometry)).toBe(after);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("merge all polygon features in layer creates a union output layer", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: "Zona Nilai Tanah" }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  const beforeFeatureCount = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Zona Nilai Tanah");
    return layer?.geojson.features.length ?? 0;
  });
  expect(beforeFeatureCount).toBeGreaterThan(1);

  await page.getByRole("button", { name: /Merge layer/i }).click();

  await page.waitForFunction(
    () => {
      const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string }> } }).__q2ws_project;
      return project?.layers.some((layer) => layer.displayName.includes("merge")) ?? false;
    },
    null,
    { timeout: 15000 }
  );

  const mergeLayer = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ id: string; displayName: string; geojson: GeoJSON.FeatureCollection; layerTreeGroup?: string }> } }).__q2ws_project;
    return project?.layers.find((layer) => layer.displayName.includes("merge")) ?? null;
  });
  expect(mergeLayer).not.toBeNull();
  expect(mergeLayer?.geojson.features.length).toBe(1);
  expect(mergeLayer?.layerTreeGroup).toBe("Analysis");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-merge-smoke-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const mergeDataEntry = Object.keys(zip.files).find((name) => name.includes("data/") && name.includes("merge"));
    expect(mergeDataEntry).toBeTruthy();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("creates polygon to line analysis output for selected polygon feature", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: "Batas Desa MultiPolygon" }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  const sourceBefore = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Batas Desa");
    return JSON.stringify(layer?.geojson.features[0]?.geometry || null);
  });

  await page.getByRole("button", { name: /Polygon to line/i }).click();

  await expect(page.getByRole("button", { name: /Batas Desa polygon to line/i })).toBeVisible({ timeout: 15000 });

  const sourceAfter = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Batas Desa");
    return JSON.stringify(layer?.geojson.features[0]?.geometry || null);
  });
  expect(sourceAfter).toBe(sourceBefore);

  const analysisLayer = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geometryType: string; layerTreeGroup?: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    return project?.layers.find((layer) => layer.displayName === "Batas Desa polygon to line") || null;
  });
  expect(analysisLayer?.geometryType).toMatch(/LineString/);
  expect(analysisLayer?.layerTreeGroup).toBe("Analysis");
  expect(analysisLayer?.geojson.features.length).toBeGreaterThan(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-polygon-to-line-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const generatedDataEntry = Object.keys(zip.files).find((entry) => /data\/.*polygon_to_line.*\.js$/i.test(entry));
    expect(generatedDataEntry).toBeTruthy();
    const dataText = await zip.file(generatedDataEntry!)!.async("string");
    expect(dataText).toContain("source_layer");
    expect(dataText).toContain("BatasDesa");
    expect(dataText).toContain("LineString");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("merge aborts without creating output layer when union fails", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1&forceMergeUnionError=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: "Zona Nilai Tanah" }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  await page.getByRole("button", { name: /Merge layer/i }).click();

  await expect(page.getByText(/Merge failed\./i)).toBeVisible({ timeout: 15000 });

  const mergeLayerExists = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string }> } }).__q2ws_project;
    return project?.layers.some((layer) => layer.displayName.includes("merge")) ?? false;
  });
  expect(mergeLayerExists).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test("creates convex hull layer from selected polygon feature", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Zona Nilai Tanah/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  await page.getByRole("button", { name: /Convex hull/i }).click();

  await page.waitForFunction(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    return project?.layers.some((candidate) => candidate.displayName === "Zona Nilai Tanah convex hull") || false;
  }, null, { timeout: 15000 });

  const hullLayer = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geometryType: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Zona Nilai Tanah convex hull");
    return layer ? {
      geometryType: layer.geometryType,
      featureCount: layer.geojson.features.length,
      featureId: String(layer.geojson.features[0]?.properties?.__q2ws_id ?? ""),
      geometry: JSON.stringify(layer.geojson.features[0]?.geometry ?? null)
    } : null;
  });
  expect(hullLayer).not.toBeNull();
  expect(hullLayer?.geometryType).toBe("Polygon");
  expect(hullLayer?.featureCount).toBe(1);
  expect(hullLayer?.featureId).toContain("convex_hull");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-convex-hull-smoke-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const entries = Object.keys(zip.files);
    const hullDataPath = entries.find((entry) => /data\/.*convex_hull.*\.js$/.test(entry));
    expect(hullDataPath).toBeTruthy();
    const dataText = await zip.file(hullDataPath!)!.async("string");
    const variableMatch = dataText.match(/^var\s+([A-Za-z0-9_]+)\s*=\s*/);
    expect(variableMatch).not.toBeNull();
    const geojson = JSON.parse(dataText.replace(/^var\s+[A-Za-z0-9_]+\s*=\s*/, "").replace(/;\s*$/, ""));
    expect(geojson.features).toHaveLength(1);
    expect(JSON.stringify(geojson.features[0].geometry)).toBe(hullLayer?.geometry);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("divides selected line feature into equal parts", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Sungai/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  await page.getByRole("button", { name: /Divide line/i }).click();

  await page.waitForFunction(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    return project?.layers.some((candidate) => candidate.displayName === "Sungai divided (3 parts)") || false;
  }, null, { timeout: 15000 });

  const dividedLayer = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geometryType: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Sungai divided (3 parts)");
    return layer ? {
      geometryType: layer.geometryType,
      featureCount: layer.geojson.features.length,
      featureIds: layer.geojson.features.map((f) => String(f.properties?.__q2ws_id ?? "")),
      geometries: layer.geojson.features.map((f) => f.geometry)
    } : null;
  });
  expect(dividedLayer).not.toBeNull();
  expect(dividedLayer?.geometryType).toBe("LineString");
  expect(dividedLayer?.featureCount).toBe(3);
  expect(dividedLayer?.featureIds.every((id) => id.includes("divided"))).toBe(true);
  expect(dividedLayer?.geometries.every((geometry) => geometry?.type === "LineString")).toBe(true);
  expect(dividedLayer?.geometries.some((geometry) => geometry?.type === "LineString" && geometry.coordinates.length > 2)).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-divide-smoke-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const entries = Object.keys(zip.files);
    const dividedDataPath = entries.find((entry) => /data\/.*divided.*\.js$/.test(entry));
    expect(dividedDataPath).toBeTruthy();
    const dataText = await zip.file(dividedDataPath!)!.async("string");
    const variableMatch = dataText.match(/^var\s+([A-Za-z0-9_]+)\s*=\s*/);
    expect(variableMatch).not.toBeNull();
    const geojson = JSON.parse(dataText.replace(/^var\s+[A-Za-z0-9_]+\s*=\s*/, "").replace(/;\s*$/, ""));
    expect(geojson.features).toHaveLength(3);
    expect(geojson.features.every((f: GeoJSON.Feature) => f.geometry?.type === "LineString")).toBe(true);
    expect(geojson.features.some((f: GeoJSON.Feature) => f.geometry?.type === "LineString" && f.geometry.coordinates.length > 2)).toBe(true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("splits selected line feature at midpoint", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Sungai/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  await page.getByRole("button", { name: /Split line/i }).click();

  await page.waitForFunction(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string }> } }).__q2ws_project;
    return project?.layers.some((candidate) => candidate.displayName === "Sungai split midpoint") || false;
  }, null, { timeout: 15000 });

  const splitLayer = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geometryType: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((candidate) => candidate.displayName === "Sungai split midpoint");
    return layer ? {
      geometryType: layer.geometryType,
      featureCount: layer.geojson.features.length,
      operations: layer.geojson.features.map((f) => String(f.properties?.operation ?? "")),
      geometries: layer.geojson.features.map((f) => f.geometry)
    } : null;
  });
  expect(splitLayer).not.toBeNull();
  expect(splitLayer?.geometryType).toBe("LineString");
  expect(splitLayer?.featureCount).toBe(2);
  expect(splitLayer?.operations).toEqual(["split_line", "split_line"]);
  expect(splitLayer?.geometries.every((geometry) => geometry?.type === "LineString")).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-split-smoke-");
  try {
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const entries = Object.keys(zip.files);
    const splitDataPath = entries.find((entry) => /data\/.*split_midpoint.*\.js$/.test(entry));
    expect(splitDataPath).toBeTruthy();
    const dataText = await zip.file(splitDataPath!)!.async("string");
    const geojson = JSON.parse(dataText.replace(/^var\s+[A-Za-z0-9_]+\s*=\s*/, "").replace(/;\s*$/, ""));
    expect(geojson.features).toHaveLength(2);
    expect(geojson.features.every((f: GeoJSON.Feature) => f.geometry?.type === "LineString")).toBe(true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  expect(consoleErrors).toEqual([]);
});

test("exported runtime keeps measure and photon assets when enabled", async ({ page, browser }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-widget-enabled-");
  await unzipToDirectory(zipPath, tempDir);

  const extractedRoot = join(tempDir, "qgis2web_2026_04_22-06_30_44_400659");
  const indexHtml = await readFile(join(extractedRoot, "index.html"), "utf8");
  expect(indexHtml).toContain("leaflet-measure.css");
  expect(indexHtml).toContain("leaflet.photon.css");

  const staticServer = await startStaticServer(extractedRoot);
  const runtimePage = await browser.newPage();
  try {
    await runtimePage.goto(`${staticServer.origin}/?debug=1`);
    await runtimePage.waitForFunction(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded), null, { timeout: 15000 });
    await expect(runtimePage.locator(".leaflet-control-measure")).toBeVisible({ timeout: 15000 });
  } finally {
    await runtimePage.close();
    await staticServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("exported runtime removes measure and photon assets when disabled", async ({ page, browser }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator(".widget-row", { hasText: /Measure tool/i }).locator('input[type="checkbox"]').uncheck();
  await page.locator(".widget-row", { hasText: /Address search/i }).locator('input[type="checkbox"]').uncheck();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-widget-disabled-");
  await unzipToDirectory(zipPath, tempDir);

  const extractedRoot = join(tempDir, "qgis2web_2026_04_22-06_30_44_400659");
  const indexHtml = await readFile(join(extractedRoot, "index.html"), "utf8");
  expect(indexHtml).not.toContain("leaflet-measure.css");
  expect(indexHtml).not.toContain("leaflet.photon.css");

  const staticServer = await startStaticServer(extractedRoot);
  const runtimePage = await browser.newPage();
  try {
    await runtimePage.goto(`${staticServer.origin}/?debug=1`);
    await runtimePage.waitForFunction(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded), null, { timeout: 15000 });
    await expect(runtimePage.locator(".leaflet-control-measure")).toHaveCount(0);
  } finally {
    await runtimePage.close();
    await staticServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("exported runtime keeps labels and layer tree when enabled", async ({ page, browser }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-labels-tree-enabled-");
  await unzipToDirectory(zipPath, tempDir);

  const extractedRoot = join(tempDir, "qgis2web_2026_04_22-06_30_44_400659");
  const indexHtml = await readFile(join(extractedRoot, "index.html"), "utf8");
  expect(indexHtml).toContain("labels.js");
  expect(indexHtml).toContain("L.Control.Layers.Tree");

  const staticServer = await startStaticServer(extractedRoot);
  const runtimePage = await browser.newPage();
  try {
    await runtimePage.goto(`${staticServer.origin}/?debug=1`);
    await runtimePage.waitForFunction(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded), null, { timeout: 15000 });
    await expect(runtimePage.locator(".leaflet-tooltip").first()).toBeVisible({ timeout: 15000 });
    await expect(runtimePage.locator(".leaflet-control-layers")).toHaveCount(1);
  } finally {
    await runtimePage.close();
    await staticServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("exported runtime removes labels and layer tree when disabled", async ({ page, browser }) => {
  await page.goto("/?debug=1");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator(".widget-row", { hasText: /Permanent labels/i }).locator('input[type="checkbox"]').uncheck();
  await page.locator(".widget-row", { hasText: /Layer tree control/i }).locator('input[type="checkbox"]').uncheck();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-labels-tree-disabled-");
  await unzipToDirectory(zipPath, tempDir);

  const extractedRoot = join(tempDir, "qgis2web_2026_04_22-06_30_44_400659");
  const indexHtml = await readFile(join(extractedRoot, "index.html"), "utf8");
  expect(indexHtml).not.toContain("labels.js");
  expect(indexHtml).not.toContain("L.Control.Layers.Tree");

  const staticServer = await startStaticServer(extractedRoot);
  const runtimePage = await browser.newPage();
  try {
    await runtimePage.goto(`${staticServer.origin}/?debug=1`);
    await runtimePage.waitForFunction(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded), null, { timeout: 15000 });
    await expect(runtimePage.locator(".leaflet-tooltip")).toHaveCount(0);
    await expect(runtimePage.locator(".leaflet-control-layers")).toHaveCount(0);
  } finally {
    await runtimePage.close();
    await staticServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("exports ZIP and rendered runtime stays healthy", async ({ page, browser }, testInfo) => {
  const editorRequests: string[] = [];
  const editorConsoleErrors: string[] = [];
  page.on("request", (request) => {
    editorRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") editorConsoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await importFixture(page);
  await assertRenderedMap(page, editorRequests, editorConsoleErrors);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export ZIP/i }).click()
  ]);
  const { tempDir, zipPath } = await saveDownloadToTempDir(download, "q2ws-export-smoke-");
  await unzipToDirectory(zipPath, tempDir);

  const extractedRoot = join(tempDir, "qgis2web_2026_04_22-06_30_44_400659");
  const staticServer = await startStaticServer(extractedRoot);
  const runtimePage = await browser.newPage();
  const runtimeRequests: string[] = [];
  const runtimeConsoleErrors: string[] = [];
  runtimePage.on("request", (request) => {
    runtimeRequests.push(request.url());
  });
  runtimePage.on("console", (message) => {
    if (message.type() === "error") runtimeConsoleErrors.push(message.text());
  });

  try {
    await runtimePage.goto(`${staticServer.origin}/?debug=1`);
    await runtimePage.waitForFunction(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded), null, { timeout: 15000 });
    await runtimePage.waitForTimeout(2000);

    const loaded = await runtimePage.evaluate(() => Boolean((window as Window & { map?: { _loaded?: boolean } }).map?._loaded));
    expect(loaded).toBe(true);
    const runtimeRenderedFeatures = await runtimePage.evaluate(() => {
      const renderedDom = document.querySelectorAll(".leaflet-overlay-pane path, .leaflet-overlay-pane canvas, .leaflet-marker-pane > *, .leaflet-canvas-container canvas").length;
      const layerGlobals = Object.keys(window).filter((key) => key.startsWith("layer_"));
      const renderedLayerFeatures = layerGlobals.reduce((total, key) => {
        const layer = (window as Window & Record<string, { getLayers?: () => unknown[] }>)[key];
        return total + (layer?.getLayers?.().length || 0);
      }, 0);
      return renderedDom + renderedLayerFeatures;
    });
    expect(runtimeRenderedFeatures).toBeGreaterThan(0);
    expect(runtimeRequests.some((url) => url.includes("arcgisonline.com") || url.includes("cartocdn.com"))).toBe(true);
    expect(runtimeConsoleErrors).toEqual([]);
  } finally {
    await runtimePage.close();
    await staticServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }

  await testInfo.attach("export-zip-name", {
    body: Buffer.from(download.suggestedFilename() || "unknown", "utf8"),
    contentType: "text/plain"
  });
});

test("phase 3 project sliders have synced numeric inputs with units", async ({ page }) => {
  await page.goto("/");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Branding/i }).click();

  const sidebarWidthField = page.locator(".range-number-field", { hasText: /Sidebar width/i });
  const sidebarWidthNumber = sidebarWidthField.locator('input[type="number"]');
  await sidebarWidthNumber.fill("360");
  await sidebarWidthNumber.blur();
  await expect(sidebarWidthNumber).toHaveValue("360");

  const sidebarWidthSlider = sidebarWidthField.locator('input[type="range"]');
  await expect(sidebarWidthSlider).toHaveValue("360");
  await expect(sidebarWidthField.getByText("px")).toBeVisible();
});

test("phase 3 dash array field supports presets and custom values", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.getByRole("tab", { name: /^Style$/i }).click();

  await page.getByRole("button", { name: /Dash-dot-dot/i }).click();
  const customInput = page.getByLabel(/Dash array custom/i);
  await expect(customInput).toHaveValue("10 4 2 4 2 4");
  const dashArrayField = customInput.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' dash-array-field ')][1]");

  const appliedDashArray = async () => page.evaluate(() => {
    const project = (window as Window & {
      __q2ws_project?: { layers: Array<{ displayName: string; style?: { dashArray?: string | null } }> };
    }).__q2ws_project;
    const layer = project?.layers.find((candidate) => /Batas Desa/i.test(candidate.displayName));
    return layer?.style?.dashArray ?? "";
  });

  await expect.poll(appliedDashArray).toBe("10 4 2 4 2 4");

  await page.getByRole("button", { name: /^Custom$/i }).click();
  await customInput.fill("6 x 4");
  await customInput.blur();
  await expect(dashArrayField.getByRole("alert")).toBeVisible();
  await expect(appliedDashArray()).resolves.toBe("10 4 2 4 2 4");

  await customInput.fill("6 4");
  await customInput.blur();
  await expect(customInput).toHaveValue("6 4");
  await expect(dashArrayField.getByRole("alert")).toHaveCount(0);
  await expect.poll(appliedDashArray).toBe("6 4");
});

test("phase 3 add property form clears key and value after submit", async ({ page }) => {
  await page.goto("/");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.locator(".attribute-panel tbody tr").first().click();
  await expect(page.locator(".selected-feature-panel")).toBeVisible();

  const keyInput = page.getByLabel(/Property key/i);
  const valueInput = page.getByLabel(/Property value/i);
  await keyInput.fill("catatan");
  await valueInput.fill("uji phase 3");
  await page.getByRole("button", { name: /Add property/i }).click();

  await expect(keyInput).toHaveValue("");
  await expect(valueInput).toHaveValue("");
});

test("phase 4 editor legend placement supports all four floating corners", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.getByTestId("legend-enabled").click();

  const placementField = page.getByTestId("legend-placement");
  const placements = [
    { value: "floating-bottom-right", className: "legend-bottom-right" },
    { value: "floating-bottom-left", className: "legend-bottom-left" },
    { value: "floating-top-right", className: "legend-top-right" },
    { value: "floating-top-left", className: "legend-top-left" }
  ] as const;

  for (const placement of placements) {
    await placementField.selectOption(placement.value);
    await expect(page.locator(`.legend-preview.${placement.className}`)).toBeVisible();
  }
});

test("phase 4 qgis2web parity mode names use collapsed expanded tree with no Compact", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();

  const layerControlField = page.locator('label:has-text("Layer control") select');
  const optionLabels = await layerControlField.locator("option").evaluateAll((options) =>
    options.map((option) => ({ value: option.getAttribute("value") || "", label: option.textContent?.trim() || "" }))
  );
  expect(optionLabels).toEqual([
    { value: "collapsed", label: "Collapsed" },
    { value: "expanded", label: "Expanded" },
    { value: "tree", label: "Tree" }
  ]);
  expect(optionLabels.some((option) => /compact/i.test(option.label) || option.value === "compact")).toBe(false);
});

test("phase 4 layer control and legend stay in parity between editor and runtime preview", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.getByTestId("legend-enabled").click();
  await page.getByTestId("legend-placement").selectOption("floating-top-left");
  await page.locator('label:has-text("Layer control") select').selectOption("collapsed");
  await page.getByLabel("Control text size value").fill("18");
  await page.getByLabel("Control text size value").blur();

  const editorControl = page.locator(".layer-toggle-preview");
  const editorLegend = page.locator(".legend-preview.legend-top-left");
  await expect(editorControl).toBeVisible();
  await expect(editorLegend).toBeVisible();
  await expect(editorControl.locator("label span").first()).toHaveCSS("font-size", "18px");

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator("#q2ws-layer-control")).toHaveClass(/q2ws-layer-control-collapsed/);
  await expect(frame.locator("#q2ws-legend")).toHaveClass(/q2ws-legend-top-left/);
  await expect(frame.locator("#q2ws-layer-control label span").first()).toHaveCSS("font-size", "18px");
});

test("phase 5 popup styles and labels stay in parity between editor and runtime preview", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator('label:has-text("Popup style") select').selectOption("compact");

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.getByRole("tab", { name: /Popup/i }).click();
  await page.locator('label:has-text("Template mode") select').selectOption("field-grid");
  await page.getByText(/Use Nama/i).first().click();

  const popupPreview = page.getByLabel("Popup live preview");
  await expect(popupPreview).toContainText("Nama");
  const editorPreview = page.locator(".popup-preview-card .q2ws-popup");
  await expect(editorPreview).toHaveClass(/q2ws-popup-compact/);
  await expect(editorPreview).toContainText("Nama");

  const targetNama = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((item) => /Batas Desa/i.test(item.displayName));
    const value = layer?.geojson.features.find((feature) => feature.properties?.NAMOBJ)?.properties?.NAMOBJ;
    if (!value) throw new Error("Expected Batas Desa feature with NAMOBJ.");
    return String(value);
  });

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  const runtimeFrame = await (await iframe.elementHandle())?.contentFrame();
  if (!runtimeFrame) throw new Error("Expected runtime preview frame.");
  await runtimeFrame.evaluate((expectedNama) => {
    const runtimeWindow = window as Window & { map?: { eachLayer: (callback: (layer: { feature?: GeoJSON.Feature; fire?: (type: string) => void }) => void) => void } };
    let clicked = false;
    runtimeWindow.map?.eachLayer((layer) => {
      if (!clicked && layer.feature?.properties?.NAMOBJ === expectedNama && typeof layer.fire === "function") {
        layer.fire("click");
        clicked = true;
      }
    });
    if (!clicked) throw new Error(`Expected a clickable Batas Desa runtime feature for ${expectedNama}.`);
  }, targetNama);

  const runtimePopup = frame.locator(".leaflet-popup .q2ws-popup");
  await expect(runtimePopup).toHaveClass(/q2ws-popup-compact/);
  await expect(runtimePopup).toContainText("Nama");
});

test("phase 5 original popup template mode stays original despite project card default", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.locator('label:has-text("Popup style") select').selectOption("card");

  await page.getByRole("button", { name: /Batas Desa/i }).click();
  await page.getByRole("tab", { name: /Popup/i }).click();
  await page.locator('label:has-text("Template mode") select').selectOption("original");

  const popupPreview = page.getByLabel("Popup live preview");
  await expect(popupPreview.locator("table")).toBeVisible();
  await expect(popupPreview.locator(".q2ws-popup")).toHaveCount(0);

  const targetNama = await page.evaluate(() => {
    const project = (window as Window & { __q2ws_project?: { layers: Array<{ displayName: string; geojson: GeoJSON.FeatureCollection }> } }).__q2ws_project;
    const layer = project?.layers.find((item) => /Batas Desa/i.test(item.displayName));
    const value = layer?.geojson.features.find((feature) => feature.properties?.NAMOBJ)?.properties?.NAMOBJ;
    if (!value) throw new Error("Expected Batas Desa feature with NAMOBJ.");
    return String(value);
  });

  await page.getByTestId("open-preview").click();
  const iframeOriginal = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframeOriginal).toBeVisible({ timeout: 15000 });
  const runtimeFrameOriginal = await (await iframeOriginal.elementHandle())?.contentFrame();
  if (!runtimeFrameOriginal) throw new Error("Expected runtime preview frame.");
  await runtimeFrameOriginal.waitForSelector(".leaflet-container", { timeout: 15000 });
  await runtimeFrameOriginal.evaluate((expectedNama) => {
    const runtimeWindow = window as Window & { map?: { eachLayer: (callback: (layer: { feature?: GeoJSON.Feature; fire?: (type: string) => void }) => void) => void } };
    let clicked = false;
    runtimeWindow.map?.eachLayer((layer) => {
      if (!clicked && layer.feature?.properties?.NAMOBJ === expectedNama && typeof layer.fire === "function") {
        layer.fire("click");
        clicked = true;
      }
    });
    if (!clicked) throw new Error(`Expected a clickable Batas Desa runtime feature for ${expectedNama}.`);
  }, targetNama);

  const runtimeFrameLocator = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(runtimeFrameLocator.locator(".leaflet-popup table")).toBeVisible();
  await expect(runtimeFrameLocator.locator(".leaflet-popup .q2ws-popup")).toHaveCount(0);
});

test("phase 4 runtime legend reserves top-right layer control space conditionally", async ({ page }) => {
  await page.goto(debugUrl("/"));
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Project Settings/i }).click();
  await page.getByRole("tab", { name: /Map/i }).click();
  await page.getByTestId("legend-enabled").click();
  await page.getByTestId("legend-placement").selectOption("floating-top-right");
  await page.locator('label:has-text("Layer control") select').selectOption("expanded");

  const editorOffsets = await page.locator(".legend-preview.legend-top-right").evaluate((legend) => {
    const readOffsets = () => {
      const style = window.getComputedStyle(legend as HTMLElement);
      return {
        top: style.top,
        right: style.right
      };
    };

    const withControl = readOffsets();
    const control = document.querySelector(".layer-toggle-preview.layer-toggle-top-right");
    control?.parentElement?.removeChild(control);
    const withoutControl = readOffsets();
    return { withControl, withoutControl };
  });

  expect(editorOffsets.withControl.top).toBe(editorOffsets.withoutControl.top);
  expect(editorOffsets.withControl.right).toBe("248px");
  expect(editorOffsets.withoutControl.right).toBe("14px");

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  const frame = page.frameLocator('[data-testid="runtime-preview-frame"]');
  await expect(frame.locator("#q2ws-layer-control")).toHaveClass(/q2ws-layer-control-top-right/);
  await expect(frame.locator("#q2ws-legend")).toHaveClass(/q2ws-legend-top-right/);

  const offsets = await frame.locator("#q2ws-legend").evaluate((legend) => {
    const readOffsets = () => {
      const style = window.getComputedStyle(legend as HTMLElement);
      return {
        top: style.top,
        right: style.right
      };
    };

    const withControl = readOffsets();
    const control = document.querySelector("#q2ws-layer-control");
    control?.parentElement?.removeChild(control);
    const withoutControl = readOffsets();
    return { withControl, withoutControl };
  });

  expect(offsets.withControl.top).toBe(offsets.withoutControl.top);
  expect(offsets.withControl.right).toBe("248px");
  expect(offsets.withoutControl.right).toBe("14px");
});
