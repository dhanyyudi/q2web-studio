import { expect, test } from "@playwright/test";
import { join } from "node:path";

const fixtureRoot = join(process.cwd(), "docs", "example_export", "qgis2web_2026_04_22-06_30_44_400659");

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

  await expect(page.locator('.status-box')).toContainText(/Imported 4 layers/i, { timeout: 15000 });
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
    return document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane canvas, .leaflet-marker-pane > *, .leaflet-canvas-container canvas').length;
  });
  expect(renderedFeatures).toBeGreaterThan(0);

  expect(requests.some((url) => url.includes("arcgisonline.com") || url.includes("cartocdn.com"))).toBe(true);
  expect(consoleErrors).toEqual([]);
});
