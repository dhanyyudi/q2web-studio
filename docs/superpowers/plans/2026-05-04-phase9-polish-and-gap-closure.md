# Phase 9 Polish and Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Audit V4 Phase 9 polish while re-reviewing merged Phase 7 and Phase 8, then close any honest remaining gaps that are still inside shipped scope.

**Architecture:** Keep this as one bounded polish PR that does not reopen Phase 6 preview architecture or expand into Phase 10 docs-only work. The implementation should focus on three tracks that can ship together, diagnostics and layer-list polish from Audit V4, Phase 7 closure checks that are still inside explicit style mode scope, and Phase 8 closure checks that are still inside raster parity scope, especially runtime-served parity and WMS interaction fidelity.

**Tech Stack:** React 18, TypeScript, Vite, Leaflet, Playwright, JSZip, existing smoke scripts, qgis2web parser, editor preview, runtime preview, ZIP runtime.

---

## Scope check

This plan intentionally covers one combined subsystem, post-merge polish and gap closure. It does **not** include:

- rule-based styling as a new feature system
- custom CRS reprojection
- dark mode
- major visual redesign outside the audited Phase 9 polish
- new backend or Cloudflare changes

It **does** include three things together because they are now tightly related in acceptance:

1. **Phase 9 polish** from Audit V4, mainly diagnostics visibility, layer search, and small shell affordances.
2. **Phase 7 re-review fixes**, only if the merged style-mode work still misses parity inside the shipped `single`, `categorized`, `graduated` scope.
3. **Phase 8 re-review fixes**, only if the merged raster work still misses parity inside the shipped `raster-image`, `raster-wms`, `raster-pmtiles` scope.

## Re-review findings to carry into implementation

### Phase 7, merged, current honest status

**Closed and should stay closed:**
- explicit `single`, `categorized`, `graduated` style modes
- graduated editor parity
- graduated runtime parity
- smoke and Playwright coverage
- screenshots and runtime evidence

**Do not reopen in this PR:**
- rule-based styling, still future scope by Audit V4
- jenks support, still intentionally deferred

**Minor closure check to include in this PR:**
- verify no style-mode regressions when layer list filtering and diagnostics UI are introduced
- keep `single`, `categorized`, `graduated` runtime parity test green in the full smoke map gate

### Phase 8, merged, current honest status

**Closed and should stay closed:**
- parser support for `raster-image`, `raster-wms`, `raster-pmtiles`
- editor preview path for image overlay, WMS, PMTiles
- runtime config/export parity
- PMTiles editor fetch proof
- evidence pack and PR merge

**Remaining honest gaps still worth fixing:**
- exported ZIP runtime is visually asserted only for image overlay, not yet for WMS and PMTiles in a served browser runtime path
- WMS parity currently preserves layer config and runtime wiring, but there is no explicit browser assertion for a served WMS runtime request after ZIP export
- Audit V4 references WMS behavior closer to qgis2web, including GetFeatureInfo expectations, and current code does not yet surface a runtime interaction contract for WMS clicks
- PMTiles runtime is wired, but served runtime browser evidence is still thinner than image overlay because current tests stop at config preservation

**Decision for this PR:**
- add browser-served ZIP runtime assertions for WMS and PMTiles
- add the smallest WMS click behavior that produces a verifiable user-facing result, if qgis2web export contract in the repo already expects it
- if GetFeatureInfo turns out not to be realistically supportable inside this bounded PR without large runtime redesign, log it as an explicit deferred gap instead of pretending it shipped

## File structure

### Existing files to modify

- `src/components/SidePanel.tsx`
  - add layer search input
  - improve diagnostics visibility and empty-state behavior without changing panel architecture
- `src/styles.css`
  - styles for layer search, diagnostics emphasis, and any small accessibility affordances
- `tests/map-render.spec.ts`
  - add failing tests first for layer search, diagnostics surfacing, and served ZIP runtime parity for WMS and PMTiles
- `scripts/smoke-export.ts`
  - extend smoke assertions if runtime export assets or config for WMS and PMTiles need stronger guarantees
- `scripts/smoke-fixture.ts`
  - extend fixture assertions if diagnostics or raster fixture expectations need stronger coverage
- `src/runtime/runtime.ts`
  - only if WMS runtime click handling or raster runtime parity needs minimal code changes
- `src/lib/exportProject.ts`
  - only if runtime config must expose extra WMS or PMTiles data for served runtime parity assertions
- `docs/QA-CHECKLIST-PER-PHASE.md`
  - add explicit Phase 9 checklist section and update Phase 8 regression notes only after code is stable

### Files to inspect before coding

- `src/lib/qgis2webParser.ts`
  - confirm what diagnostics are already produced and whether WMS metadata is already available for GetFeatureInfo
- `src/lib/rasterParsing.ts`
  - confirm WMS and PMTiles parser outputs before extending runtime contracts
- `docs/AUDIT-2026-05-01-v4.md`
  - keep Audit V4 scope honest, especially diagnostics panel and raster expectations
- `docs/screenshots/phase-7/`
  - use as parity baseline, do not overwrite
- `docs/screenshots/phase-8/`
  - use as parity baseline, do not overwrite until final evidence refresh

### New files to create

- `docs/screenshots/phase-9/`
  - evidence folder for build, smoke, Playwright, editor screenshot, runtime screenshot if visual changes are material

---

### Task 1: Confirm post-merge gap list and lock PR scope

**Files:**
- Modify: none
- Inspect: `docs/AUDIT-2026-05-01-v4.md`, `src/components/SidePanel.tsx`, `src/runtime/runtime.ts`, `scripts/smoke-export.ts`, `tests/map-render.spec.ts`

- [ ] **Step 1: Verify branch baseline before planning execution**

Run:

```bash
git switch main
git pull --ff-only origin main
git status --short
```

Expected:
- on `main`
- no tracked local modifications in app repo
- only known untracked local utility files remain

- [ ] **Step 2: Inspect current open gaps with targeted grep**

Run:

```bash
rg -n "diagnostics|sample\.pmtiles|tileLayer\.wms|GetFeatureInfo|layer search|search" src tests scripts docs/AUDIT-2026-05-01-v4.md
```

Expected:
- diagnostics rendering found in `src/components/SidePanel.tsx`
- WMS runtime wiring found in `src/runtime/runtime.ts`
- no dedicated layer search UI yet
- no explicit served ZIP WMS or PMTiles runtime assertions yet

- [ ] **Step 3: Create the work branch**

Run:

```bash
git switch -c audit-v4-phase9-polish-gap-closure
```

Expected:
- new feature branch created from up to date `main`

- [ ] **Step 4: Commit nothing yet**

Reason:
- this task is only scope locking and evidence gathering

### Task 2: Add failing tests for Phase 9 polish and honest Phase 8 runtime gaps

**Files:**
- Modify: `tests/map-render.spec.ts`
- Test: `tests/map-render.spec.ts`

- [ ] **Step 1: Write the failing layer search test**

Add a focused test near other shell tests:

```ts
test("phase 9 side panel can filter layer names", async ({ page }) => {
  await page.goto("/");
  await importFixture(page);
  await expect(page.locator(".status-box")).toContainText(/Imported 4 layers/i, { timeout: 15000 });

  const search = page.getByLabel(/Search layers/i);
  await search.fill("Batas");

  await expect(page.locator(".layer-row")).toHaveCount(1);
  await expect(page.locator(".layer-row .layer-main")).toContainText("Batas Desa");
});
```

- [ ] **Step 2: Write the failing diagnostics visibility test**

Use a parser warning fixture by evaluating project state directly if no dedicated warning fixture exists yet:

```ts
test("phase 9 diagnostics panel stays visible when project has warnings", async ({ page }) => {
  await page.goto("/");
  await importFixture(page);
  await page.evaluate(() => {
    const runtimeWindow = window as Window & { __q2ws_project?: { diagnostics: string[] } };
    if (!runtimeWindow.__q2ws_project) throw new Error("Expected loaded project.");
    runtimeWindow.__q2ws_project.diagnostics = ["Synthetic warning for diagnostics coverage"];
  });
  await page.reload();
  await expect(page.locator(".diagnostics-panel")).toContainText("Synthetic warning for diagnostics coverage");
});
```

If direct mutation proves unstable under React state, replace it with a tiny fixture import path in Task 3 and update this test there.

- [ ] **Step 3: Write the WMS served ZIP runtime characterization test and keep the missing-gap tests red**

During execution, first verify whether served ZIP WMS tile requests are already green. If they already pass, keep that test as a characterization baseline and do **not** force it to be red. The required red tests for Task 2 must then come from the still-open gaps only.

Use this WMS characterization test:

```ts
test("phase 9 exported WMS runtime performs tile requests when served", async ({ page, browser }) => {
  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (download) => downloads.push(download));

  await page.goto("/");
  await importFixtureZip(page, rasterWmsFixtureZip);
  await expect(page.locator(".status-box")).toContainText(/Imported 2 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Export ZIP/i }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(1);

  const { tempDir, zipPath } = await saveDownloadToTempDir(downloads[0], "q2ws-phase9-wms-runtime-");
  try {
    await unzipToDirectory(zipPath, tempDir);
    const rootEntries = await readdir(tempDir, { withFileTypes: true });
    const exportRoot = rootEntries.find((entry) => entry.isDirectory());
    if (!exportRoot) throw new Error("Expected exported ZIP root directory.");
    const server = await startStaticServer(join(tempDir, exportRoot.name));
    const runtimePage = await browser.newPage();
    const requests: string[] = [];
    runtimePage.on("requestfinished", (request) => {
      if (request.url().includes("geoserver/wms")) requests.push(request.url());
    });
    await runtimePage.goto(server.url);
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await runtimePage.close();
    await server.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

If this test is already PASS at red phase, keep it anyway as a baseline characterization test. Do **not** replace it with GetFeatureInfo here, because bounded WMS click parity is deferred to Task 5.

- [ ] **Step 4: Write the failing served ZIP PMTiles runtime parity test**

Add a browser-served runtime test that asserts exported PMTiles runtime fetches `sample.pmtiles`:

```ts
test("phase 9 exported PMTiles runtime fetches sample archive when served", async ({ page, browser }) => {
  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (download) => downloads.push(download));

  await page.goto("/");
  await importFixtureZip(page, rasterPmtilesFixtureZip);
  await expect(page.locator(".status-box")).toContainText(/Imported 2 layers/i, { timeout: 15000 });

  await page.getByRole("button", { name: /Export ZIP/i }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(1);

  const { tempDir, zipPath } = await saveDownloadToTempDir(downloads[0], "q2ws-phase9-pmtiles-runtime-");
  try {
    await unzipToDirectory(zipPath, tempDir);
    const rootEntries = await readdir(tempDir, { withFileTypes: true });
    const exportRoot = rootEntries.find((entry) => entry.isDirectory());
    if (!exportRoot) throw new Error("Expected exported ZIP root directory.");
    const server = await startStaticServer(join(tempDir, exportRoot.name));
    const runtimePage = await browser.newPage();
    const requests: string[] = [];
    runtimePage.on("requestfinished", (request) => {
      if (request.url().includes("sample.pmtiles")) requests.push(request.url());
    });
    await runtimePage.goto(server.url);
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await runtimePage.close();
    await server.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run the targeted tests and confirm failure before implementation**

Run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 9"
```

Expected:
- FAIL on missing layer search UI and any missing served runtime parity helper coverage

- [ ] **Step 6: Commit the failing tests**

```bash
git add tests/map-render.spec.ts
git commit -m "test(ui): add phase 9 polish and raster runtime gap coverage"
```

### Task 3: Implement layer search and diagnostics polish in the side panel

**Files:**
- Modify: `src/components/SidePanel.tsx`
- Modify: `src/styles.css`
- Test: `tests/map-render.spec.ts`

- [ ] **Step 1: Add local filter state and accessible search field to the side panel**

Update `src/components/SidePanel.tsx` to add a controlled search input with an accessible label.

Use this shape:

```tsx
import { useMemo, useState, type ReactNode } from "react";

const [layerQuery, setLayerQuery] = useState("");
const visibleLayers = useMemo(() => {
  if (!project) return [];
  const query = layerQuery.trim().toLowerCase();
  if (!query) return project.layers;
  return project.layers.filter((layer) => {
    const haystack = `${layer.displayName} ${isVectorLayer(layer) ? layer.geometryType : layer.kind}`.toLowerCase();
    return haystack.includes(query);
  });
}, [layerQuery, project]);
```

Render the field above the layer list:

```tsx
<div className="field">
  <label htmlFor="layer-search">Search layers</label>
  <input
    id="layer-search"
    type="search"
    value={layerQuery}
    onChange={(event) => setLayerQuery(event.target.value)}
    placeholder="Cari nama layer"
  />
</div>
```

Then replace `project.layers.map(...)` with `visibleLayers.map(...)`.

- [ ] **Step 2: Add empty state for no matching layers**

Render this immediately below the layer list when `visibleLayers.length === 0`:

```tsx
<div className="editor-note">Tidak ada layer yang cocok dengan pencarian kamu.</div>
```

- [ ] **Step 3: Strengthen diagnostics panel affordance without moving subsystem boundaries**

Keep diagnostics in the side panel, but make the warning state more visible. Update the diagnostics block to include a small intro line:

```tsx
<div className="diagnostics-panel" role="status" aria-live="polite">
  <strong>Perlu dicek</strong>
  {project.diagnostics.map((item, index) => (
    <div className="diagnostic-row" key={`${index}-${item}`}>
      {item}
    </div>
  ))}
</div>
```

Do not create a brand new diagnostics subsystem in this PR.

- [ ] **Step 4: Add styles for search and diagnostics emphasis**

In `src/styles.css`, add focused, small-scope rules only:

```css
.side-panel input[type="search"] {
  width: 100%;
}

.diagnostics-panel {
  display: grid;
  gap: 8px;
}

.diagnostics-panel strong {
  color: #8a5a00;
}
```

If the repo already has nearby styles for `.field input`, reuse them and only add the missing class selectors.

- [ ] **Step 5: Re-run the targeted shell tests**

Run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 9 side panel|phase 9 diagnostics"
```

Expected:
- PASS

- [ ] **Step 6: Commit the side panel polish**

```bash
git add src/components/SidePanel.tsx src/styles.css tests/map-render.spec.ts
git commit -m "feat(ui): add layer search and diagnostics polish"
```

### Task 4: Strengthen Phase 8 served ZIP runtime parity for WMS and PMTiles

**Files:**
- Modify: `tests/map-render.spec.ts`
- Modify: `scripts/smoke-export.ts`
- Modify: `src/lib/exportProject.ts` only if tests reveal missing runtime data
- Modify: `src/runtime/runtime.ts` only if tests reveal real runtime bug

- [ ] **Step 1: Add shared static server helper inside Playwright test file if not present**

If `tests/map-render.spec.ts` lacks a reusable static server helper, add a tiny helper near other ZIP helpers:

```ts
async function startStaticServer(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const { createServer } = await import("node:http");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const path = join(root, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
    try {
      const body = await readFile(path);
      res.writeHead(200);
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected numeric port.");
  return {
    url: `http://127.0.0.1:${address.port}/index.html`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
```

- [ ] **Step 2: Extend export smoke to prove WMS and PMTiles assets or config remain export-safe**

In `scripts/smoke-export.ts`, add explicit assertions like:

```ts
expect(config.layers?.find((layer) => layer.kind === "raster-wms")).toMatchObject({
  kind: "raster-wms",
  url: "https://ahocevar.com/geoserver/wms",
  layersParam: "topp:states"
});

expect(config.layers?.find((layer) => layer.kind === "raster-pmtiles")).toMatchObject({
  kind: "raster-pmtiles",
  url: "tiles/sample.pmtiles"
});
expectFile(rasterPmtilesZip, `${rasterPmtilesRoot}js/pmtiles.js`);
```

Only add what the current runtime genuinely expects.

- [ ] **Step 3: Fix runtime or export only if the served tests expose a real bug**

Possible minimal fixes, only if needed:

```ts
// src/runtime/runtime.ts
if (layerConfig.kind === "raster-wms" && layerConfig.url) {
  return window.L.tileLayer.wms(layerConfig.url, {
    layers: layerConfig.layersParam || "",
    format: layerConfig.format || "image/png",
    transparent: layerConfig.transparent !== false,
    version: layerConfig.version,
    attribution: layerConfig.attribution || "",
    opacity: Number(layerConfig.opacity == null ? 1 : layerConfig.opacity)
  });
}
```

```ts
// src/lib/exportProject.ts
// preserve exactly the runtime-relative `tiles/sample.pmtiles` path if current export rewrites it incorrectly
```

Do not invent a larger raster abstraction here.

- [ ] **Step 4: Re-run targeted Phase 8 gap tests**

Run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 9 exported WMS runtime|phase 9 exported PMTiles runtime"
npm run smoke:export
```

Expected:
- PASS

- [ ] **Step 5: Commit the raster runtime gap closure**

```bash
git add tests/map-render.spec.ts scripts/smoke-export.ts src/runtime/runtime.ts src/lib/exportProject.ts
git commit -m "test(raster): verify served zip runtime for wms and pmtiles"
```

### Task 5: Decide and implement bounded WMS click parity only if repo evidence shows a safe contract

**Files:**
- Inspect: `src/runtime/runtime.ts`, `docs/AUDIT-2026-05-01-v4.md`, any imported qgis2web WMS fixture assets
- Modify: `src/runtime/runtime.ts` only if bounded implementation is clearly supported
- Modify: `tests/map-render.spec.ts` only if bounded implementation is clearly supported

- [ ] **Step 1: Inspect whether the existing WMS fixture and parser carry enough information for click behavior**

Run:

```bash
rg -n "GetFeatureInfo|feature info|raster-wms|layersParam|info_format|query_layers" src docs/example_export tests
```

Expected:
- either enough metadata exists for a minimal click request contract,
- or it does not, in which case this feature stays deferred honestly

- [ ] **Step 2: If insufficient metadata exists, explicitly skip implementation and document deferral in the PR**

Use this exact PR note text later:

```md
WMS GetFeatureInfo remains deferred after Phase 9 review because the current imported fixture and runtime config preserve tile rendering parity, but do not yet carry a bounded, testable click-info contract without widening scope into a larger runtime interaction redesign.
```

No code change needed in that case.

- [ ] **Step 3: If sufficient metadata exists, write the failing test first**

Example bounded test:

```ts
test("phase 9 WMS runtime click issues GetFeatureInfo request", async ({ page, browser }) => {
  // export WMS fixture, serve ZIP, click map, assert request URL includes SERVICE=WMS and REQUEST=GetFeatureInfo
});
```

- [ ] **Step 4: Implement the smallest runtime click handler needed**

Only if the fixture and runtime config make it realistic. Keep the code local to WMS runtime handling.

```ts
layer.on("click", function (event) {
  // build request URL with query layers and map bbox, then fetch text response
});
```

Avoid popup rendering redesign in this step.

- [ ] **Step 5: Run the targeted WMS test if implemented**

Run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 9 WMS runtime click"
```

Expected:
- PASS if implemented
- otherwise no-op because the step was explicitly deferred

- [ ] **Step 6: Commit only if code changed**

```bash
git add src/runtime/runtime.ts tests/map-render.spec.ts
git commit -m "feat(raster): add bounded wms click parity"
```

### Task 6: Run full regression for merged Phase 7, Phase 8, and Phase 9 together

**Files:**
- Modify: none unless regressions are found
- Test: `tests/map-render.spec.ts`, `scripts/smoke-fixture.ts`, `scripts/smoke-export.ts`

- [ ] **Step 1: Run build and both smoke scripts**

Run:

```bash
npm run build
npm run smoke:fixture
npm run smoke:export
```

Expected:
- all PASS

- [ ] **Step 2: Run focused Playwright for Phase 7, Phase 8, and Phase 9**

Run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 7|phase 8|phase 9" --reporter=line
```

Expected:
- all PASS
- no new regressions in style modes or raster parity

- [ ] **Step 3: Run the full map smoke gate**

Run:

```bash
npm run smoke:map
```

Expected:
- PASS

- [ ] **Step 4: If any Phase 7 regression appears, fix it in the smallest responsible file**

Likely files if needed:
- `src/components/Inspector/StyleTab.tsx`
- `src/components/Inspector/GraduatedStylePanel.tsx`
- `src/lib/style.ts`
- `src/runtime/runtime.ts`

Do not expand scope beyond the failing regression.

- [ ] **Step 5: Commit only if a regression fix was required**

```bash
git add src tests scripts
git commit -m "fix(style): preserve phase 7 parity during phase 9 polish"
```

### Task 7: Capture Phase 9 evidence and update QA checklist

**Files:**
- Modify: `docs/QA-CHECKLIST-PER-PHASE.md`
- Create: `docs/screenshots/phase-9/` contents

- [ ] **Step 1: Add a new Phase 9 section to the QA checklist**

Append a section with at least these bullets:

```md
## Phase 9 — Diagnostics, layer search, and post-merge gap closure

- [ ] Layer search filters visible rows in the side panel.
- [ ] Diagnostics panel stays visible when parser warnings exist.
- [ ] Exported WMS runtime performs served browser requests.
- [ ] Exported PMTiles runtime fetches `sample.pmtiles` when served.
- [ ] Phase 7 style mode tests still pass.
- [ ] Phase 8 raster tests still pass.
```

- [ ] **Step 2: Capture evidence logs with one timestamp**

Run:

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p docs/screenshots/phase-9
npm run build > docs/screenshots/phase-9/npm-run-build-$TS.txt 2>&1
npm run smoke:fixture > docs/screenshots/phase-9/npm-run-smoke-fixture-$TS.txt 2>&1
npm run smoke:export > docs/screenshots/phase-9/npm-run-smoke-export-$TS.txt 2>&1
npx playwright test tests/map-render.spec.ts -g "phase 7|phase 8|phase 9" > docs/screenshots/phase-9/npx-playwright-phase-9-$TS.txt 2>&1
```

Expected:
- four evidence text files created

- [ ] **Step 3: Capture at least one editor screenshot if UI changed visibly**

Use Playwright or the existing evidence script approach. Minimum expected output:

```bash
# Example target artifact
# docs/screenshots/phase-9/editor-<timestamp>.png
```

If WMS runtime click behavior ships, capture one runtime screenshot too.

- [ ] **Step 4: Commit the checklist and evidence**

```bash
git add -f docs/QA-CHECKLIST-PER-PHASE.md docs/screenshots/phase-9
git commit -m "docs(qa): add phase 9 evidence and checklist"
```

### Task 8: Final review prep and honest PR notes

**Files:**
- Modify: none required in repo
- Create: temporary PR body file outside repo if desired

- [ ] **Step 1: Summarize honest shipped scope for the PR body**

Required summary points:
- Phase 9 layer search and diagnostics polish shipped
- Phase 7 parity rechecked and no new gaps remain inside its shipped scope
- Phase 8 served ZIP runtime parity for WMS and PMTiles is now verified
- WMS GetFeatureInfo either shipped in a bounded form or is explicitly deferred with a reason

- [ ] **Step 2: Run one final status check before requesting review**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected:
- clean working tree except ignored local utility files
- recent commits map clearly to tests, implementation, evidence

- [ ] **Step 3: Request review only after all evidence exists**

Required review checklist in PR body:
- `@codex`
- manual parity sweep
- evidence file paths
- whether WMS GetFeatureInfo is included or deferred

- [ ] **Step 4: Commit nothing**

Reason:
- this task is review preparation only

---

## Self-review

### Spec coverage
- Phase 9 diagnostics and layer search are covered by Tasks 2 and 3.
- Phase 7 re-review is covered by Task 6, with explicit constraint not to reopen out-of-scope style work.
- Phase 8 re-review gaps are covered by Tasks 2, 4, and 5.
- Evidence and QA updates are covered by Task 7.

### Placeholder scan
- No `TODO`, `TBD`, or "implement later" placeholders are left in task steps.
- Each code-changing task contains concrete code or command examples.
- Deferred WMS GetFeatureInfo is handled explicitly with a decision step, not hidden as a vague future note.

### Type consistency
- Raster layer names consistently use `raster-image`, `raster-wms`, `raster-pmtiles`.
- Style mode review consistently uses `single`, `categorized`, `graduated`.
- The plan treats Phase 7 gaps as regression-only, not as a new feature expansion.

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-phase9-polish-and-gap-closure.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
