DONE

Commit: 0833a46

Summary:
- Updated `tests/map-render.spec.ts` only.
- In `phase 9 exported WMS runtime performs tile requests when served`, replaced `runtimePage.on("requestfinished", ...)` with `runtimePage.on("request", ...)` for URLs containing `geoserver/wms`.
- Cleanup flow remains intact, `runtimePage.close()`, `server.close()`, and temp dir removal are unchanged.

Test summary:
- `npx playwright test tests/map-render.spec.ts -g "phase 9 exported WMS runtime performs tile requests when served" --reporter=line`: PASS
- Result: `1 passed (17.4s)`
