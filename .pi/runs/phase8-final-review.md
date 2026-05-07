# PR Review, audit-v4-phase8-raster-parity

## Verdict

CHANGES REQUIRED

## Hard violations

- [ ] Phase 8 scope is incomplete for PMTiles editor parity. `src/components/mapCanvasHooks.ts` parses PMTiles into project state, but `useRasterLayers()` only renders `raster-image` and `raster-wms`. There is no PMTiles render branch in the editor path, so the required editor preview parity for PMTiles is not implemented.
- [ ] Phase 8 scope is incomplete for runtime PMTiles unless the original export already provides `window.pmtiles`. `src/runtime/runtime.ts` calls `window.pmtiles.PMTiles` and `window.pmtiles.leafletRasterLayer`, but this PR does not show runtime bundling or injection of the PMTiles library into exported ZIP. `package.json` adds `pmtiles`, but `q2ws-runtime.js` is a string runtime and does not import that package. This is an unsafe assumption for ZIP runtime parity.
- [ ] Raster layer inspector and basic layer affordances are intentionally disabled. `src/components/SidePanel.tsx` marks non-vector layers as `disabled`, blocks selection, and disables visibility toggles with “preview only for now”. This contradicts the Phase 8 plan, which requires raster inspector support for visibility, opacity, and source summary, plus visible toggle and layer-control parity.
- [ ] Required Phase 8 evidence is incomplete. `docs/screenshots/phase-8/` contains only four text logs. Missing required visual and diagnostic evidence: editor screenshot, runtime preview screenshot, ZIP runtime screenshot, console log, and network tile/request log.
- [ ] Required docs/log updates are incomplete. The Phase 8 plan requires updating `docs/QA-CHECKLIST-PER-PHASE.md`, root `../AGENTS.MD`, and `../docs/agents/changelog/2026-05.md`. Diff does not include the QA checklist, and grep did not find a Phase 8 raster log entry in the root AGENTS log or training changelog.
- [ ] Playwright evidence does not prove the stated parity. The Phase 8 Playwright log only runs two tests. The runtime test checks exported `q2ws-config.json` and asset existence for image overlay, but does not serve ZIP runtime and assert `.leaflet-image-layer`. WMS and PMTiles have no runtime-render assertion at all.

## Evidence checklist

- [x] `npm run build` log present and PASS: `docs/screenshots/phase-8/npm-run-build-20260504-070748.txt`.
- [x] `npm run smoke:fixture` log present and PASS: `docs/screenshots/phase-8/npm-run-smoke-fixture-20260504-070748.txt`.
- [x] `npm run smoke:export` log present and PASS: `docs/screenshots/phase-8/npm-run-smoke-export-20260504-070748.txt`.
- [x] Targeted Playwright log present and PASS for 2 tests: `docs/screenshots/phase-8/npx-playwright-phase-8-20260504-070748.txt`.
- [ ] Full map-render regression gate evidence is not shown, only `-g "phase 8"` targeted tests.
- [ ] Editor screenshot missing.
- [ ] Runtime preview screenshot missing.
- [ ] ZIP runtime screenshot missing.
- [ ] Console log dump missing.
- [ ] Network request log missing, especially important for WMS and PMTiles.
- [ ] Root AGENTS.MD Phase 8 log entry missing.
- [ ] QA checklist Phase 8 update missing.

## Soft warnings

- The branch is a moderately large multi-file change, 761 insertions across 27 files. It is still within a single subsystem, raster parity, but the implementation bundles image overlay, WMS, PMTiles, UI affordance changes, fixtures, parser, runtime, export, and tests. The plan itself asked for task and commit separation, but final review should still require complete evidence because the blast radius includes parser, editor preview, runtime, and export.
- `src/lib/rasterParsing.ts` uses regex parsing for qgis2web JavaScript. That is acceptable for current parser style, but the PR should document fixture coverage and known limitations in PR notes, especially for PMTiles signatures.
- WMS support does not appear to cover GetFeatureInfo behavior, while Audit V4 specifically names WMS tile plus GetFeatureInfo parity. If intentionally deferred, the PR description should state that gap explicitly. If not deferred, add implementation and tests.
- The new `pmtiles` dependency needs documented API verification evidence. The plan explicitly required fetching PMTiles Leaflet integration docs before coding API calls. I did not find evidence of that research in committed docs or PR evidence.

## Rules audit

| Rule | Status | Note |
|---|---|---|
| Map init must include valid view | PASS | `<React.StrictMode>` remains on, and existing `L.map()` in `useLeafletMap()` includes `center` and `zoom`. |
| StrictMode must not be removed | PASS | `src/main.tsx` still wraps `<App />` in `<React.StrictMode>`. |
| One concern per PR | WARNING | Single subsystem, raster parity, but bundles three raster dialects and multiple hot paths. Acceptable only with complete tests and evidence. |
| Test both editor and ZIP runtime | FAIL | Image overlay editor is tested. ZIP runtime DOM render is not tested. WMS and PMTiles runtime render are not tested. |
| PR screenshot and smoke gate | FAIL | Build, smoke, and targeted Playwright logs exist. Required screenshots and console/network dumps are missing. |
| Parity sweep for editor/runtime/export | FAIL | No complete parity sweep evidence. Tests do not prove editor versus runtime versus ZIP parity for all raster kinds. |
| MapCanvas cap | PASS | `src/components/MapCanvas.tsx` is 186 lines, under cap. |
| Instrumentation gated | PASS | Existing debug globals remain gated by `?debug=1`. No new obvious permanent debug globals found in reviewed diff. |
| Do not invent API | FAIL | PMTiles runtime assumes `window.pmtiles.leafletRasterLayer` without visible docs evidence or runtime library bundling. |
| Runtime piggybacks original index.html | WARNING | Runtime still piggybacks original globals. Raster layers are created when no original global exists, which is fine for overlay config, but PMTiles depends on original page library availability unless export injects it. |
| Evidence and log updates | FAIL | Required Phase 8 evidence folder is incomplete, and required AGENTS or QA checklist updates are missing. |

## Focus findings

### Raster image overlay

- Parser and export config support are present.
- Editor render assertion exists via `.leaflet-image-layer`.
- ZIP runtime parity is not proven because the Playwright test only checks config and file existence after export, not actual runtime render served via static HTTP.

### WMS

- Parser shape and editor project state are covered by smoke and a weak Playwright assertion.
- Editor tile request rendering is not asserted.
- Runtime render is not asserted.
- GetFeatureInfo parity is not implemented or not evidenced, despite Audit V4 listing WMS plus GetFeatureInfo as the parity target.

### PMTiles

- Parser shape is covered.
- Editor rendering is missing in `useRasterLayers()`.
- Runtime rendering depends on `window.pmtiles`, with no visible library injection in export or runtime preview.
- Playwright does not assert PMTiles tile requests or any PMTiles runtime DOM/network behavior.

## Required changes before PR

1. Implement PMTiles editor rendering or explicitly remove PMTiles from this PR scope and tests.
2. Ensure ZIP runtime can load PMTiles support without relying on an undeclared original global, or prove the qgis2web PMTiles fixture includes the required runtime library and that export preserves it.
3. Add/select raster layer inspector behavior so raster layers can be selected and basic controls work: visibility, opacity, and source summary.
4. Add runtime-render Playwright coverage for image overlay, WMS, and PMTiles. At minimum serve exported ZIP and assert visible raster layer DOM or network requests for each kind.
5. Add WMS request assertion and clarify or implement GetFeatureInfo parity.
6. Complete Phase 8 evidence under `docs/screenshots/phase-8/`: editor, runtime preview, ZIP runtime, console dump, network request log, plus existing build/smoke/e2e logs.
7. Update `docs/QA-CHECKLIST-PER-PHASE.md` with Phase 8 manual checks.
8. Append required Phase 8 log entries to root `../AGENTS.MD` and `../docs/agents/changelog/2026-05.md` if project workflow requires both for this handoff.

## Notes

This branch is not ready for PR. The parser and smoke groundwork are useful, and image overlay support is partially validated, but PMTiles and WMS parity rely on unsafe assumptions and insufficient tests. Merge should be blocked until runtime parity and required evidence are complete.
