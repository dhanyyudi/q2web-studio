# DONE

## Summary
Replaced the out-of-scope WMS GetFeatureInfo Phase 9 test in `tests/map-render.spec.ts` with the served ZIP WMS tile request characterization test from the updated plan.

## Files
- `tests/map-render.spec.ts`: changed only the WMS Phase 9 test title and assertions to verify served runtime WMS tile requests.

## Test results
- `npx playwright test tests/map-render.spec.ts -g "phase 9" --reporter=line`: FAIL as expected for red tests.
  - PASS: `phase 9 exported WMS runtime performs tile requests when served`
  - FAIL: `phase 9 side panel can filter layer names`
  - FAIL: `phase 9 diagnostics panel stays visible when project has warnings`
  - FAIL: `phase 9 exported PMTiles runtime fetches sample archive when served`

## Commit
- `f4248fd test(raster): keep wms served runtime characterization`

## Notes
- No production code changed.
