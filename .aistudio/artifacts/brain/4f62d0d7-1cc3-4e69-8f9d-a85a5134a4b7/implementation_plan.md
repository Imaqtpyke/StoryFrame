# Implementation Plan: Bulletproof Long-Form Pipeline & Groq JSON Recovery

## 1. Core Objectives
- Ensure StoryFrame can process long-form narratives (up to 2,000 words) without crashing or throwing `.map()` errors.
- Make Groq Cloud and Google Gemini JSON pipelines 100% resilient against response truncation or malformed array formatting.
- Keep the user experience fast, stateless, and focused on instant cinematic breakdown generation.

## 2. Technical Solutions & Steps

### A. Defensive Array Safety Guards Across All Pipeline Stages
- **Files:** `groundedPipeline.ts`, `stage1StoryBible.ts`, `stage2BeatPlan.ts`, `stage3PromptWriter.ts`, `stage4VerifyRepair.ts`
- **Solution:** Wrap all `.map()`, `.forEach()`, and `.filter()` calls on model outputs in strict array validation checks (`Array.isArray(...) ? ... : []`). If an LLM response omits a field or returns undefined, supply safe empty arrays so execution never halts.

### B. Advanced Truncated JSON Repair & `failed_generation` Salvage
- **File:** `groqClient.ts`
- **Solution:** 
  - Explicitly set `max_tokens: 8192` on Groq requests to provide ample head-room for long scripts.
  - Automatically intercept Groq 400 JSON validation failures, extract `failed_generation`, and run heuristic bracket/quote repair (`tryRepairTruncatedJson`).
  - Provide an automatic raw-text fallback retry when strict JSON mode rejects an edge-case output.

### C. Clean Export & Markdown Packaging
- **File:** `ResultsView.tsx`, `timelineExport.ts`
- **Solution:** Enable seamless browser-side export of the full generated storyboard packet (`.md`, `.srt`, `.edl`) so users can compile multi-part stories into complete scripts without re-runner overhead.

## 3. Verification
- Run the 79-point automated system test suite (`systemTestSuite.ts`) and compile the applet to verify zero TypeScript errors and 100% test success.
