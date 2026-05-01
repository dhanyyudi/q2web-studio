import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const fixtureRoot = join(process.cwd(), "docs", "example_export", "qgis2web_2026_04_22-06_30_44_400659");

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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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

test("lasso selects multiple features in the selected layer", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });
  await expect(page.getByTestId("multi-select-panel")).toContainText("0 features selected");
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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
  await assertRenderedMap(page, requests, consoleErrors);

  await page.getByTestId("open-preview").click();
  const iframe = page.locator('[data-testid="runtime-preview-frame"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-same-origin");
  await expect(iframe).toHaveAttribute("src", /blob:/);
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

test("Export Now downloads the same runtime ZIP from preview", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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

test("creates convex hull layer from selected polygon feature", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?debug=1");
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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
  await page.locator('input[webkitdirectory]').setInputFiles(fixtureRoot);
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
