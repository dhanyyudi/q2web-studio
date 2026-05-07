import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import http from 'node:http';

const ts = process.env.TS;
const dest = process.env.DEST;
const fixtureZip = path.join(process.cwd(), 'docs/example_export/qgis2web_2026_04_22-06_30_44_400659.zip');
const consoleLines = [];
const networkTiles = [];
function startDev(){
  const child = spawn('npm', ['run','dev','--','--port','5173'], {stdio:['ignore','pipe','pipe']});
  const lines=[];
  child.stdout.on('data', d=>lines.push(d.toString()));
  child.stderr.on('data', d=>lines.push(d.toString()));
  return {child, lines};
}
async function waitUrl(url, timeout=30000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    try { const res = await fetch(url); if(res.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error('dev server not ready');
}
async function unzip(zipPath, outDir){
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  for (const entry of Object.values(zip.files)) {
    const p = path.join(outDir, entry.name);
    if (entry.dir) { await mkdir(p, { recursive: true }); continue; }
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, await entry.async('nodebuffer'));
  }
}
function serve(root){
  const server = http.createServer(async (req,res)=>{
    try{
      const u = new URL(req.url||'/', 'http://127.0.0.1');
      const rel = decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).replace(/^\//,'');
      const p = path.join(root, rel);
      const body = await readFile(p);
      const ext = path.extname(p);
      res.writeHead(200, {'Content-Type': ext==='.html'?'text/html': ext==='.js'?'application/javascript': ext==='.css'?'text/css':'application/octet-stream'});
      res.end(body);
    }catch{ res.writeHead(404); res.end('not found'); }
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server, url:`http://127.0.0.1:${server.address().port}`})));
}
const dev = startDev();
try {
  await waitUrl('http://127.0.0.1:5173');
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000}, acceptDownloads:true});
  const page = await context.newPage();
  page.on('console', msg=>consoleLines.push(`[editor] ${msg.type()} ${msg.text()}`));
  page.on('requestfinished', async req=>{ const url=req.url(); if(/arcgisonline.com|cartocdn.com|tile.openstreetmap.org/.test(url)){ const r=await req.response(); networkTiles.push({context:'editor', url, status:r?.status()}); }});
  page.on('requestfailed', req=>{ const url=req.url(); if(/arcgisonline.com|cartocdn.com|tile.openstreetmap.org/.test(url)) networkTiles.push({context:'editor', url, failed:req.failure()?.errorText}); });
  await page.goto('http://127.0.0.1:5173/?debug=1');
  await page.locator('input[accept*=".zip"]').setInputFiles(fixtureZip);
  await page.locator('.status-box').filter({hasText:/Imported 4 layers/i}).waitFor({timeout:15000});
  await page.waitForFunction(() => window.__q2ws_map?._loaded, null, {timeout:15000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(dest, `editor-${ts}.png`), fullPage:true});
  await page.getByRole('button', {name:/Project Settings/i}).click();
  await page.getByRole('tab', {name:/Map/i}).click();
  const legendEnabled = page.getByTestId('legend-enabled');
  await legendEnabled.waitFor({timeout:10000});
  const checked = await legendEnabled.getAttribute('data-state');
  if (checked !== 'checked') await legendEnabled.click();
  await page.getByTestId('legend-placement').selectOption('floating-bottom-right');
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(dest, `editor-legend-bottom-right-${ts}.png`), fullPage:true});
  await page.getByTestId('legend-placement').selectOption('floating-top-left');
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(dest, `editor-legend-top-left-${ts}.png`), fullPage:true});
  await page.getByTestId('open-preview').click();
  await page.locator('iframe').first().waitFor({timeout:15000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(dest, `runtime-preview-${ts}.png`), fullPage:true});
  const dl = page.waitForEvent('download');
  await page.locator('.preview-overlay .btn.primary').click();
  const download = await dl;
  const zipPath = path.join(dest, `phase4-export-${ts}.zip`);
  await download.saveAs(zipPath);
  const extractDir = path.join('/tmp', `q2ws-phase4-${ts}`);
  await rm(extractDir,{recursive:true,force:true});
  await mkdir(extractDir,{recursive:true});
  await unzip(zipPath, extractDir);
  const {server, url} = await serve(extractDir);
  const runtime = await context.newPage();
  runtime.on('console', msg=>consoleLines.push(`[runtime] ${msg.type()} ${msg.text()}`));
  runtime.on('requestfinished', async req=>{ const u=req.url(); if(/arcgisonline.com|cartocdn.com|tile.openstreetmap.org/.test(u)){ const r=await req.response(); networkTiles.push({context:'runtime', url:u, status:r?.status()}); }});
  runtime.on('requestfailed', req=>{ const u=req.url(); if(/arcgisonline.com|cartocdn.com|tile.openstreetmap.org/.test(u)) networkTiles.push({context:'runtime', url:u, failed:req.failure()?.errorText}); });
  await runtime.goto(`${url}/index.html`);
  await runtime.waitForTimeout(3000);
  await runtime.screenshot({path:path.join(dest, `runtime-${ts}.png`), fullPage:true});
  server.close();
  await browser.close();
  await writeFile(path.join(dest, `devserver-${ts}.txt`), dev.lines.join(''));
  await writeFile(path.join(dest, `console-${ts}.txt`), consoleLines.join('\n')+'\n');
  await writeFile(path.join(dest, `network-tile-${ts}.json`), JSON.stringify(networkTiles,null,2));
} finally {
  dev.child.kill('SIGTERM');
}
