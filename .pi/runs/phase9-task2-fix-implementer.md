# Phase 9 Task 2 test fix done

## Summary
Adjusted `tests/map-render.spec.ts` so all four Task 2 phase 9 tests are honest red tests before production work.

The prior passing WMS served runtime test was replaced with a stricter missing parity test from Audit V4 scope, exported WMS runtime should issue a `GetFeatureInfo` request after a map click. This currently fails deterministically.

## Files
- `tests/map-render.spec.ts`: replaced the WMS tile request smoke assertion with a red `GetFeatureInfo` click parity test

## New deps
- None

## Test results
- `npx playwright test tests/map-render.spec.ts -g "phase 9"`: FAIL, 4 unexpected failures, as intended for red phase

Exact fail summary:
1. `phase 9 side panel can filter layer names`
   - FAIL, timeout waiting for `getByLabel(/Search layers/i)` at `tests/map-render.spec.ts:2170`
2. `phase 9 diagnostics panel stays visible when project has warnings`
   - FAIL, `.diagnostics-panel` not found at `tests/map-render.spec.ts:2181`
3. `phase 9 exported WMS runtime requests GetFeatureInfo on map click`
   - FAIL, expected `GetFeatureInfo` requests `> 0`, received `0` after click at `tests/map-render.spec.ts:2219`
4. `phase 9 exported PMTiles runtime fetches sample archive when served`
   - FAIL, expected sample PMTiles requests `> 0`, received `0` at `tests/map-render.spec.ts:2254`

## Commit
- `8ea45d6` , `test(ui): tighten phase 9 red coverage`

## Risk / follow-up
- The side panel filter test currently fails at missing accessible control discovery, not at filtering assertion itself. Still a valid red gap for Phase 9 because the search UI is absent.
- The new WMS runtime test is aligned with Audit V4 Phase 8b parity, specifically missing `GetFeatureInfo` request behavior.

## Next
- Handoff ke qa-runner phase=9
