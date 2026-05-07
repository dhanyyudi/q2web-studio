# Final re-review, audit-v4-phase8-raster-parity

## Verdict
CHANGES REQUIRED

## Blockers only

- PMTiles editor parity is still not evidenced as actually rendering, so the previous PMTiles parity blocker is not fully closed.
  - `tests/map-render.spec.ts:2083-2112` only verifies that the PMTiles fixture imports and that project state contains a `raster-pmtiles` layer with the expected URL and options.
  - There is no assertion that the editor preview renders PMTiles output, no assertion that a PMTiles tile request or `sample.pmtiles` fetch occurs, and no visual evidence dedicated to the PMTiles fixture.
  - `docs/screenshots/phase-8/network-tile-20260504-072851.json` shows `pmtiles.js` loading, but does not show a fetch for `sample.pmtiles`, vector tile requests derived from it, or any PMTiles specific runtime asset proving render parity.
  - This matters because the prior blocker was specifically PMTiles editor parity, not just parser parity or config preservation.

## Non-blocking notes

- Evidence completeness for Phase 8 is otherwise present in repo, build, smoke fixture, smoke export, Playwright log, editor screenshot, runtime preview screenshot, runtime screenshot, console log, and network log are all available under `docs/screenshots/phase-8/`.
- Runtime parity for raster image and WMS looks covered better than before, including export config assertions in `scripts/smoke-export.ts` and runtime hooks in `src/runtime/runtime.ts`.
- Root AGENTS and parent changelog were intentionally not reviewed per instruction.
