CHANGES REQUIRED

Blockers only:

1. `tests/map-render.spec.ts` no longer matches Task 2 scope for the WMS red test.
   - Plan Task 2 requires a served ZIP runtime parity test that proves WMS requests happen when served.
   - Commit `8ea45d6` changes that test to `phase 9 exported WMS runtime requests GetFeatureInfo on map click`.
   - In the plan, GetFeatureInfo is explicitly deferred to Task 5 and only to be added if the repo already exposes a safe, bounded contract. Pulling that assertion into Task 2 makes the red test broader than the agreed missing gap.

2. Because of that scope jump, not all new Phase 9 reds are honest Task 2 reds.
   - The layer search test, diagnostics visibility test, and PMTiles served runtime fetch test are still aligned with current missing gaps.
   - The new WMS GetFeatureInfo click failure does not map to the current Task 2 gap list. It maps to a conditional future branch from Task 5, or to an explicitly deferred gap.

3. Constraint check passed, but does not override blocker above.
   - `git show` confirms only `tests/map-render.spec.ts` changed in `8ea45d6`.
   - Targeted `phase 9` Playwright run fails on all four new tests, so they are red, but one red is not spec-honest for Task 2.
