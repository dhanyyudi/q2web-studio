import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import JSZip from 'jszip';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const fixtureZip = join(repoRoot, 'docs', 'example_export', 'qgis2web_2026_04_22-06_30_44_400659.zip');
const screenshotDir = join(repoRoot, 'docs', 'screenshots', 'phase-9');
const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const runtimeShot = join(screenshotDir, `runtime-${ts}.png`);
const runtimePreviewShot = join(screenshotDir, `runtime-preview-${ts}.png`);

async function unzipToDirectory(zipPath, outputDir) {
  const zipBuffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  await Promise.all(Object.values(zip.files).map(async (entry) => {
    const destination = join(outputDir, entry.name);
    if (entry.dir) {
      await mkdir(destination, { recursive: true });
      return;
    }
    await mkdir(join(destination, '..'), { recursive: true });
    const content = await entry.async('nodebuffer');
    await writeFile(destination, content);
  }));
}

async function startStaticServer(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const relativePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filePath = join(rootDir, relativePath.replace(/^\//, ''));
      const body = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const contentType = extension === '.html'
        ? 'text/html; charset=utf-8'
        : extension === '.js'
          ? 'application/javascript; charset=utf-8'
          : extension === '.css'
            ? 'text/css; charset=utf-8'
            : extension === '.json'
              ? 'application/json; charset=utf-8'
              : undefined;
      response.writeHead(200, contentType ? { 'Content-Type': contentType } : undefined);
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

async function waitForDevServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server not ready at ${url}`);
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const devPort = 4179;
  const devUrl = `http://127.0.0.1:${devPort}/?debug=1`;
  const dev = spawn('npm', ['run', 'dev', '--', '--port', String(devPort)], {
    cwd: repoRoot,
    stdio: 'ignore',
    detached: true
  });

  let browser;
  let runtimeServer;
  let extractedDir;
  try {
    await waitForDevServer(`http://127.0.0.1:${devPort}`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(devUrl);
    await page.locator('input[accept*=".zip"]').setInputFiles(fixtureZip);
    await page.locator('.status-box').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.status-box').filter({ hasText: /Imported 4 layers/i }).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => Boolean(window.__q2ws_map?._loaded), null, { timeout: 15000 });

    const previewButton = page.getByRole('button', { name: /Preview/i });
    if (await previewButton.isVisible().catch(() => false)) {
      await previewButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: runtimePreviewShot, fullPage: true });
      const closeButton = page.getByRole('button', { name: /Close preview|Close/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click().catch(() => {});
      }
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export ZIP/i }).click()
    ]);

    const tempDir = await mkdtemp(join(tmpdir(), 'q2ws-phase9-runtime-'));
    const zipPath = join(tempDir, download.suggestedFilename() || basename((await download.path()) || 'export.zip'));
    await download.saveAs(zipPath);

    extractedDir = join(tempDir, 'unzipped');
    await mkdir(extractedDir, { recursive: true });
    await unzipToDirectory(zipPath, extractedDir);
    let serveRoot = extractedDir;
    try {
      await readFile(join(serveRoot, 'index.html'));
    } catch {
      const children = await readdir(extractedDir, { withFileTypes: true });
      const nestedDir = children.find((entry) => entry.isDirectory());
      if (!nestedDir) throw new Error('Exported runtime missing root directory.');
      serveRoot = join(extractedDir, nestedDir.name);
      await readFile(join(serveRoot, 'index.html'));
    }

    runtimeServer = await startStaticServer(serveRoot);
    const runtimePage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await runtimePage.goto(`${runtimeServer.origin}/index.html`);
    await runtimePage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await runtimePage.waitForTimeout(3000);
    await runtimePage.screenshot({ path: runtimeShot, fullPage: true });

    console.log(JSON.stringify({ runtimeShot, runtimePreviewShot: existsSync(runtimePreviewShot) ? runtimePreviewShot : null }, null, 2));
  } finally {
    if (runtimeServer) await runtimeServer.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-dev.pid); } catch {}
    if (extractedDir) {
      await rm(join(extractedDir, '..'), { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
