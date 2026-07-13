/**
 * enrich-psu-tiers.ts  —  Optional local PSU tier enrichment
 *
 * Reads .data/intake-snapshot.json and uses conservative fuzzy matching +
 * optional one-PSU-at-a-time OpenRouter LLM assist to fill PsuTierOverride
 * entries for PSUs that cannot be matched deterministically.
 *
 * This script is NOT part of the required data pipeline (data:local/data:prod/
 * data:preview). It is an optional local reconciliation tool for improving
 * tier coverage. Existing overrides in .data/psu-tier-overrides.json are
 * always consumed by intake:sql regardless of whether this script is run.
 *
 * Matching priority:
 *   1. Exact deterministic match (via sql.ts psuTierForPart) — skipped/kept.
 *   2. Valid cached override (rowId still in current psuTierEntries) — reused.
 *   3. Conservative fuzzy auto-match (brand match + score margin + wattage) —
 *      checkpointed immediately.
 *   4. LLM assist (one PSU per call, OPENROUTER_API_KEY required) —
 *      checkpointed per match.
 *
 * The overrides file is written atomically after each accepted match, so
 * killing the script mid-run does not lose previous results.
 *
 * Usage:  OPENROUTER_API_KEY=... npx tsx scripts/enrich-psu-tiers.ts
 *         npx tsx scripts/enrich-psu-tiers.ts              # cache-only, no LLM
 *
 * Fixed settings:
 *   Model:              google/gemini-2.5-flash-lite
 *   Candidates per PSU: 7
 *   Fuzzy min score:    4.0
 *   Fuzzy min margin:   1.0
 *   LLM timeout:        30 s
 *   LLM max retries:    3
 *   Confidence thresh:  0.72
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GenericPart, IntakeResult, PsuTierEntry, PsuTierOverride } from "../src/types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const snapshotPath = resolve(".data/intake-snapshot.json");
const overridesPath = resolve(".data/psu-tier-overrides.json");
const unresolvedPath = resolve(".data/psu-tier-unresolved.json");

// ---------------------------------------------------------------------------
// Fixed configuration
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 0.72;
const MAX_CANDIDATES_PER_PSU = 7;
const AUTO_MATCH_MIN_SCORE = 4.0;
const AUTO_MATCH_MIN_MARGIN = 1.0;
const LLM_RETRIES = 3;
const LLM_TIMEOUT_MS = 30_000;
const LLM_DELAY_MS = 3_000;
const LLM_BACKOFF_MS = 60_000;

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";
const HTTP_REFERER = "https://sff.builder";
const APP_TITLE = "SFF Builder PSU Enrichment";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeBrand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function wattageNumbers(value: string): string[] {
  return [...value.matchAll(/\d{3,4}(?=\s*W|\s*\/|\s*-|$)/gi)].map((m) => m[0]);
}

function getWattageString(part: GenericPart): string {
  return String(part.specs?.wattage ?? part.specs?.watt ?? part.specs?.watts ?? "");
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(
    a.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean),
  );
  const tokensB = new Set(
    b.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean),
  );
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const tok of tokensA) {
    if (tokensB.has(tok)) intersection++;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

function extractJson(raw: string): string | null {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

async function writeAtomic(target: string, content: string) {
  await mkdir(resolve(target, ".."), { recursive: true });
  const tmp = target + ".tmp";
  await writeFile(tmp, content, "utf8");
  await rename(tmp, target);
}

// ---------------------------------------------------------------------------
// Candidate scoring (shared with old logic)
// ---------------------------------------------------------------------------

interface Candidate {
  entry: PsuTierEntry;
  score: number;
}

function tierListBrand(entry: PsuTierEntry): string {
  return normalizeBrand(entry.brand);
}

function psuBrand(part: GenericPart): string {
  return normalizeBrand(part.brand);
}

function selectCandidates(part: GenericPart, allEntries: PsuTierEntry[]): Candidate[] {
  const partBrand = psuBrand(part);
  const partDisplay = part.displayName.toLowerCase();
  const partWattages = wattageNumbers(getWattageString(part));

  const scored = allEntries.map((entry) => {
    let score = 0;
    const entryBrand = tierListBrand(entry);

    if (entryBrand && entryBrand === partBrand) score += 3.0;
    else if (entryBrand && partBrand && entryBrand.includes(partBrand)) score += 1.5;
    else if (entryBrand && partBrand && partBrand.includes(entryBrand)) score += 1.5;

    score += tokenOverlap(partDisplay, entry.displayName.toLowerCase()) * 2.0;

    const entryWattages = wattageNumbers(entry.wattages);
    if (entryWattages.length && partWattages.length) {
      const overlap = partWattages.filter((w) => entryWattages.includes(w)).length;
      if (overlap > 0) score += 1.0;
    }

    return { entry, score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const minScore = sorted.length > 0 ? sorted[0].score * 0.15 : 0;
  return sorted.filter((c) => c.score >= minScore).slice(0, MAX_CANDIDATES_PER_PSU);
}

// ---------------------------------------------------------------------------
// Fuzzy auto-match
// ---------------------------------------------------------------------------

/**
 * Conservative auto-match that only accepts when there's a strong signal.
 * Returns an override or null.
 */
function tryAutoMatch(
  part: GenericPart,
  candidates: Candidate[],
): PsuTierOverride | null {
  if (!candidates.length) return null;

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];

  // Brand must match exactly (normalized)
  const partBrand = psuBrand(part);
  const topBrand = tierListBrand(top.entry);
  if (!partBrand || !topBrand || partBrand !== topBrand) return null;

  // Minimum score
  if (top.score < AUTO_MATCH_MIN_SCORE) return null;

  // Must beat second place by margin
  if (sorted.length > 1 && top.score - sorted[1].score < AUTO_MATCH_MIN_MARGIN) return null;

  // When both have wattage info, wattage must overlap
  const partWattages = wattageNumbers(getWattageString(part));
  const entryWattages = wattageNumbers(top.entry.wattages);
  if (partWattages.length > 0 && entryWattages.length > 0) {
    const overlap = partWattages.filter((w) => entryWattages.includes(w)).length;
    if (overlap === 0) return null;
  }

  const margin = sorted.length > 1 ? top.score - sorted[1].score : top.score;
  return {
    partId: part.id,
    rowId: top.entry.rowId,
    reason: `Fuzzy auto-match: brand match, score=${top.score.toFixed(1)}, margin=${margin.toFixed(1)}`,
    confidence: Math.min(top.score / 5.0, 0.95),
    matchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// LLM fetch helpers
// ---------------------------------------------------------------------------

function buildLLMPrompt(part: GenericPart, candidates: Candidate[]): { system: string; user: string } {
  const labels = candidates.map((c, i) => {
    const label = String.fromCharCode(65 + i); // A, B, C, …
    return `${label}. brand="${c.entry.brand}", series="${c.entry.series}", qualifier="${c.entry.qualifier}", variant="${c.entry.variant}", wattages="${c.entry.wattages}", tier="${c.entry.tier}", displayName="${c.entry.displayName}"`;
  }).join("\n");

  return {
    system:
      "You are a PSU matching assistant. Respond ONLY with a valid JSON object. No markdown, no explanation.",
    user: [
      `PSU: "${part.displayName}", brand="${part.brand}"`,
      "Candidates:",
      labels,
      "",
      'Select the best match or NONE. Return JSON: {"choice":"A"|"B"|…|"NONE","confidence":0.0,"reason":"short explanation"}',
    ].join("\n"),
  };
}

/**
 * One PSU LLM call with retry + timeout.
 * Returns override on success, null on recoverable failure.
 * Throws FatalLLMError on fatal status (400/401/402/403).
 */
class FatalLLMError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
    this.name = "FatalLLMError";
  }
}

async function callLLM(
  part: GenericPart,
  candidates: Candidate[],
  attemptLabel: string,
): Promise<PsuTierOverride | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const { system, user } = buildLLMPrompt(part, candidates);
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
    temperature: 0,
    max_tokens: 1024,
    response_format: { type: "json_object" },
  });

  const url = OPENROUTER_BASE_URL;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": HTTP_REFERER,
    "X-OpenRouter-Title": APP_TITLE,
  };

  // Retry loop for transient errors (429/502/503/network)
  let lastErr: Error | null = null;
  let backoff = LLM_DELAY_MS;

  for (let attempt = 0; attempt <= LLM_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        // Parse response
        const parsed = await response.json() as {
          choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
        };
        const text = parsed?.choices?.[0]?.message?.content;
        const finishReason = parsed?.choices?.[0]?.finish_reason;

        if (!text) {
          console.warn(`  ${attemptLabel} — empty content (finish_reason: ${finishReason ?? "none"})`);
          clearTimeout(timer);
          continue; // retry
        }

        const cleaned = extractJson(text);
        if (!cleaned) {
          console.warn(`  ${attemptLabel} — no JSON in response (finish_reason: ${finishReason ?? "none"}): ${text.slice(0, 150)}`);
          clearTimeout(timer);
          continue; // retry
        }

        let result: { choice?: string; confidence?: number; reason?: string };
        try {
          result = JSON.parse(cleaned);
        } catch {
          console.warn(`  ${attemptLabel} — JSON parse error: ${cleaned.slice(0, 150)}`);
          clearTimeout(timer);
          continue;
        }

        const choice = result?.choice;
        const confidence = result?.confidence;
        const reason = result?.reason;

        if (choice === "NONE" || choice === undefined || choice === null) {
          // Model explicitly says no match
          clearTimeout(timer);
          return null;
        }

        // Map letter back to candidate index
        const idx = typeof choice === "string" && choice.length === 1
          ? choice.toUpperCase().charCodeAt(0) - 65
          : -1;
        if (idx < 0 || idx >= candidates.length) {
          console.warn(`  ${attemptLabel} — invalid choice "${choice}", candidates A-${String.fromCharCode(64 + candidates.length)}`);
          clearTimeout(timer);
          continue; // retry
        }

        if (typeof confidence !== "number" || confidence < CONFIDENCE_THRESHOLD) {
          console.warn(`  ${attemptLabel} — confidence ${confidence} < threshold ${CONFIDENCE_THRESHOLD}`);
          clearTimeout(timer);
          return null; // don't retry for low confidence — model made a decision
        }

        if (typeof reason !== "string" || !reason.trim()) {
          console.warn(`  ${attemptLabel} — missing reason`);
          clearTimeout(timer);
          return null;
        }

        clearTimeout(timer);
        return {
          partId: part.id,
          rowId: candidates[idx].entry.rowId,
          reason,
          confidence,
          matchedAt: new Date().toISOString(),
        };
      }

      // Non-2xx
      clearTimeout(timer);

      if (response.status === 400) {
        const bodyText = await response.text().catch(() => "");
        throw new FatalLLMError(400, `HTTP 400 (bad request): ${bodyText.slice(0, 300)}`);
      }
      if (response.status === 401) {
        throw new FatalLLMError(401, "HTTP 401: OPENROUTER_API_KEY invalid or missing");
      }
      if (response.status === 402) {
        throw new FatalLLMError(402, "HTTP 402: OpenRouter credits exhausted");
      }
      if (response.status === 403) {
        throw new FatalLLMError(403, "HTTP 403: OpenRouter rejected request (key/model access)");
      }

      const isRetryable = response.status === 429 || response.status === 502 || response.status === 503;
      if (!isRetryable) {
        const bodyText = await response.text().catch(() => "");
        console.warn(`  ${attemptLabel} — HTTP ${response.status} (not retried): ${bodyText.slice(0, 300)}`);
        return null;
      }

      // Retryable — wait with backoff
      if (attempt >= LLM_RETRIES) {
        console.warn(`  ${attemptLabel} — HTTP ${response.status} after ${LLM_RETRIES + 1} attempt(s)`);
        return null;
      }

      let waitMs = response.status === 429 ? LLM_BACKOFF_MS : backoff;
      waitMs = Math.min(waitMs, LLM_BACKOFF_MS);
      const jitter = Math.round(waitMs * (0.75 + Math.random() * 0.5));
      console.warn(`  ${attemptLabel} — HTTP ${response.status}, retry ${attempt + 1}/${LLM_RETRIES} in ${(jitter / 1000).toFixed(1)}s`);
      await sleep(jitter);
      backoff = Math.min(backoff * 2, LLM_BACKOFF_MS);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof FatalLLMError) throw err;

      const message = err instanceof Error ? err.message : String(err);
      // AbortError = timeout, other network errors
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`  ${attemptLabel} — request timed out after ${LLM_TIMEOUT_MS / 1000}s`);
      } else {
        console.warn(`  ${attemptLabel} — network error: ${message}`);
      }

      if (attempt >= LLM_RETRIES) {
        console.warn(`  ${attemptLabel} — giving up after ${LLM_RETRIES + 1} attempt(s)`);
        return null;
      }

      const jitter = Math.round(backoff * (0.75 + Math.random() * 0.5));
      await sleep(jitter);
      backoff = Math.min(backoff * 2, LLM_BACKOFF_MS);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Unresolved report entry
// ---------------------------------------------------------------------------

interface UnresolvedEntry {
  partId: string;
  displayName: string;
  brand: string;
  reason: string;
  topCandidates: Array<{
    rowId: string;
    brand: string;
    series: string;
    wattages: string;
    tier: string;
    score: number;
  }>;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load snapshot
  let snapshot: IntakeResult;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch {
    console.error(`Cannot read ${snapshotPath}. Run "npm run intake" first.`);
    process.exit(1);
  }

  // Validate core catalog (PSU tier-only is not enough)
  const coreEmpty = snapshot.parts.length === 0 && snapshot.cases.length === 0 && snapshot.gpus.length === 0;
  if (coreEmpty) {
    console.error(
      `FATAL: Snapshot has empty core catalog (0 parts, 0 cases, 0 GPUs).\n` +
      `This means the upstream fetch failed. Existing overrides were NOT modified.\n` +
      `Re-run "npm run intake" to refresh the snapshot first.`,
    );
    process.exit(1);
  }

  const allTierEntries = snapshot.psuTierEntries ?? [];
  if (!allTierEntries.length) {
    console.warn("No PSU tier entries in snapshot — nothing to enrich. Preserving existing overrides.");
    return;
  }

  // 2. Load existing overrides, validate cache
  let existingOverrides: PsuTierOverride[] = [];
  try {
    existingOverrides = JSON.parse(await readFile(overridesPath, "utf8"));
    if (!Array.isArray(existingOverrides)) existingOverrides = [];
  } catch {
    existingOverrides = [];
  }

  const validRowIds = new Set(allTierEntries.map((e) => e.rowId));
  const staleCount = existingOverrides.length - existingOverrides.filter((o) => validRowIds.has(o.rowId)).length;
  existingOverrides = existingOverrides.filter((o) => validRowIds.has(o.rowId));
  const cachedPartIds = new Set(existingOverrides.map((o) => o.partId));

  if (staleCount > 0) console.log(`  Discarded ${staleCount} stale cached override(s).`);
  if (existingOverrides.length > 0) console.log(`  Loaded ${existingOverrides.length} valid cached override(s).`);

  // 3. Build deterministic index
  const { psuTierByMatchKey, psuTierForPart } = await import("../src/lib/sql");
  const tierIndex = psuTierByMatchKey(snapshot);

  // 4. Categorize all PSUs
  const psuParts = snapshot.parts.filter(
    (p: GenericPart) => p.kind === "psu" && p.displayName,
  );

  // Merged overrides accumulator — starts with validated cache; new matches appended.
  const mergedOverrides: PsuTierOverride[] = [...existingOverrides];
  const seenPartIds = new Set(mergedOverrides.map((o) => o.partId));

  let exactCount = 0;
  let cacheCount = 0;
  const unresolved: GenericPart[] = [];

  for (const part of psuParts) {
    // Exact deterministic match takes priority
    if (psuTierForPart(part, tierIndex)) {
      exactCount++;
      continue;
    }
    // Valid cached override
    if (cachedPartIds.has(part.id)) {
      cacheCount++;
      continue;
    }
    unresolved.push(part);
  }

  const total = psuParts.length;
  console.log(
    `PSU parts: ${total} total, ${exactCount} exact, ${cacheCount} cache, ${unresolved.length} to resolve.`,
  );

  if (!unresolved.length) {
    console.log(`All PSUs matched. Writing ${mergedOverrides.length} override(s).`);
    await writeAtomic(overridesPath, JSON.stringify(mergedOverrides, null, 2));
    return;
  }

  // 5. Try fuzzy auto-match + LLM assist for each unresolved PSU

  let fuzzyCount = 0;
  let llmCount = 0;
  let llmSkippedCount = 0;
  const trulyUnresolved: Array<{ part: GenericPart; reason: string; topCandidates: Candidate[] }> = [];

  const hasLLM = !!process.env.OPENROUTER_API_KEY;
  let llmFatal = false;

  for (const part of unresolved) {
    const candidates = selectCandidates(part, allTierEntries);

    if (!candidates.length) {
      trulyUnresolved.push({ part, reason: "no-candidates", topCandidates: [] });
      continue;
    }

    // 5a. Fuzzy auto-match
    const auto = tryAutoMatch(part, candidates);
    if (auto) {
      mergedOverrides.push(auto);
      seenPartIds.add(auto.partId);
      fuzzyCount++;
      // Checkpoint immediately
      await writeAtomic(overridesPath, JSON.stringify(mergedOverrides, null, 2));
      console.log(`  Fuzzy ✓ ${part.displayName} → ${auto.rowId} (score=${candidates[0].score.toFixed(1)})`);
      continue;
    }

    // 5b. LLM assist (only if available and no fatal error yet)
    if (!hasLLM || llmFatal) {
      if (llmFatal) llmSkippedCount++;
      trulyUnresolved.push({
        part,
        reason: hasLLM ? "llm-skipped-fatal" : "llm-unavailable",
        topCandidates: candidates.slice(0, 3),
      });
      continue;
    }

    const label = `LLM ${part.id.slice(-12)}`;
    try {
      const llmResult = await callLLM(part, candidates, label);
      if (llmResult) {
        mergedOverrides.push(llmResult);
        seenPartIds.add(llmResult.partId);
        llmCount++;
        await writeAtomic(overridesPath, JSON.stringify(mergedOverrides, null, 2));
        console.log(`  LLM   ✓ ${part.displayName} → ${llmResult.rowId} (confidence=${llmResult.confidence})`);
      } else {
        console.log(`  LLM   - ${part.displayName} — no match`);
        trulyUnresolved.push({ part, reason: "llm-no-match", topCandidates: candidates.slice(0, 3) });
      }
    } catch (err) {
      if (err instanceof FatalLLMError) {
        console.warn(`  ${label} — ${err.message}`);
        llmFatal = true;
        trulyUnresolved.push({
          part,
          reason: `llm-fatal-${err.status}`,
          topCandidates: candidates.slice(0, 3),
        });
      } else {
        console.warn(`  ${label} — unexpected: ${err instanceof Error ? err.message : String(err)}`);
        trulyUnresolved.push({ part, reason: "llm-error", topCandidates: candidates.slice(0, 3) });
      }
    }

    // Brief delay between LLM calls
    if (hasLLM && !llmFatal) {
      await sleep(LLM_DELAY_MS);
    }
  }

  // If llmFatal, note that remaining were skipped
  if (llmFatal) {
    console.log(`  LLM assist stopped due to fatal API error — some PSUs were skipped.`);
  }

  // 6. Final write of overrides
  await writeAtomic(overridesPath, JSON.stringify(mergedOverrides, null, 2));

  // 7. Write unresolved report (non-blocking)
  const unresolvedReport: UnresolvedEntry[] = trulyUnresolved.map(({ part, reason, topCandidates }) => ({
    partId: part.id,
    displayName: part.displayName,
    brand: part.brand,
    reason,
    topCandidates: topCandidates.map((c) => ({
      rowId: c.entry.rowId,
      brand: c.entry.brand,
      series: c.entry.series,
      wattages: c.entry.wattages,
      tier: c.entry.tier,
      score: c.score,
    })),
  }));
  await writeFile(unresolvedPath, JSON.stringify(unresolvedReport, null, 2));

  // 8. Summary
  const newCount = fuzzyCount + llmCount;
  console.log(`\nResults:`);
  console.log(`  Exact matches:  ${exactCount}`);
  console.log(`  Cache hits:     ${cacheCount}`);
  console.log(`  Fuzzy matches:  ${fuzzyCount}`);
  console.log(`  LLM matches:    ${llmCount}`);
  console.log(`  Unresolved:     ${trulyUnresolved.length}`);
  console.log(`Wrote ${mergedOverrides.length} override(s) to ${overridesPath}`);
  console.log(`Wrote ${trulyUnresolved.length} unresolved entry(ies) to ${unresolvedPath}`);
}

await main();
