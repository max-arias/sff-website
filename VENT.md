# VENT

Feedback log. Repeated/systemic workflow friction that should become future automation, docs, or workflow fixes.

## 26-10-09 19:17 — missing_tooling

Symptom: `xd://lsp` repeatedly returns "No language server found for this action" for TypeScript references.
Trigger: Mandatory symbol-reference checks before exported type and normalizer changes.
Workaround: Three unavailable reference requests; used targeted source reads and grep, then Astro typechecking.
Suggested fix: Configure the TypeScript language server for this workspace, or expose server availability before mandatory reference requests.
Impact: low

## 26-10-09 19:17 — tooling_dependency

Symptom: `npm test` fails with "The given account is not valid or is not authorized to access this service [code: 7403]" after all preceding offline suites pass.
Trigger: The default test script includes a remote Cloudflare D1 budget check.
Workaround: Ran every offline test command separately, retaining the remote failure as a verification blocker.
Suggested fix: Keep remote budget checks in the existing `test:d1-budget` command; let the default suite run without Cloudflare credentials.
Impact: medium
