APPROVED

Blockers: none.

Notes:
- Task 4 stays inside served ZIP runtime parity scope. The branch diff since `main` is limited to `tests/map-render.spec.ts` for the raster parity portion, with no scope creep into unrelated runtime redesign.
- It does not implement WMS GetFeatureInfo. The plan was explicitly narrowed from GetFeatureInfo toward served runtime characterization for WMS tile requests, and the current tests only assert served WMS requests plus PMTiles archive fetches.
- PMTiles served runtime parity is addressed at the test harness level, which is justified by the stated gap in the plan: production/runtime wiring for PMTiles already exists in `src/runtime/runtime.ts` and export config coverage already exists in `scripts/smoke-export.ts`; the missing piece was served browser runtime assertion. The new Playwright test now covers that by asserting a served exported runtime requests `sample.pmtiles`.
- `smoke-export` remains aligned with this scope. `scripts/smoke-export.ts` already contains explicit WMS and PMTiles export assertions, including runtime config preservation and `tiles/sample.pmtiles` presence, so Task 4 does not leave that gate behind even though commit `7438721` itself only adjusts Playwright coverage.
