CHANGES REQUIRED

Remaining blockers:
- PMTiles editor parity is still missing. `src/components/mapCanvasHooks.ts` `useRasterLayers()` renders `raster-image` and `raster-wms`, but still has no `raster-pmtiles` branch, so the editor path does not meet Phase 8 parity for PMTiles.
- Evidence is still incomplete for Phase 8. `docs/screenshots/phase-8/` only contains text logs, no required editor screenshot, runtime preview screenshot, ZIP runtime screenshot, console dump, or network log.
- Required log and checklist updates are still missing. I did not find a Phase 8 entry in root `../AGENTS.MD`, training changelog `../docs/agents/changelog/2026-05.md`, or an update in `docs/QA-CHECKLIST-PER-PHASE.md` tied to this handoff.
- Runtime parity evidence is still insufficient. The added Playwright coverage proves editor image overlay render and export config preservation, but it still does not serve exported ZIP and assert rendered runtime behavior for image overlay, WMS, and PMTiles.
