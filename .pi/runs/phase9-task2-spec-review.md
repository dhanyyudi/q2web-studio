CHANGES REQUIRED

Blockers only:

1. Not all added tests are failing as intended for TDD.
   - Commit `619a80c` adds four `phase 9` tests in `tests/map-render.spec.ts`.
   - Targeted run shows `phase 9 exported WMS runtime performs tile requests when served` already PASSes, while only three tests fail.
   - Task 2 explicitly called for intended failing tests before implementation, so this commit does not fully satisfy the spec.

2. The failing set does not cleanly match the intended gap set.
   - `phase 9 side panel can filter layer names` fails, which is appropriate for missing UI.
   - `phase 9 diagnostics panel stays visible when project has warnings` fails, which is appropriate for missing diagnostics surfacing.
   - `phase 9 exported PMTiles runtime fetches sample archive when served` fails, which is appropriate for an honest runtime parity gap.
   - But the WMS served runtime parity test already passes, so it is not a valid red test for Task 2.

3. Approval should wait for the test set to be adjusted so every newly added Task 2 test is red for the right reason.
   - Either replace the WMS assertion with a genuinely missing Phase 9 or honest Phase 8 gap, or narrow the Task 2 scope so the commit only introduces tests that currently fail.

Non-blocking confirmations:
- Commit scope is clean, only `tests/map-render.spec.ts` changed.
- The test file still compiles at TypeScript level, `npx tsc --noEmit` produced no errors.
