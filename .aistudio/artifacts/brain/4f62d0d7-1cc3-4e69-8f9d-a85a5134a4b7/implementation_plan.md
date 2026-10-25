# Direct Universal Visual Prompts with Non-Frugal Visual Density & Aspect Ratio Enforcement

Consolidate prompt output into a single, high-fidelity universal visual prompt format, remove all third-party model selectors (Midjourney, Kling, Runway, Luma) and the "Universal" word/label to free up UI real estate, and eliminate frugal brevity by embedding explicit aspect ratio tags (`--ar 9:16` or `--ar 16:9`), cinematography, lighting, lens optics, and rich visual textures into every beat.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Zero Model Selectors / Third-Party Tabs:** Remove model selector dropdowns, tabs, and references to Kling, Runway, Luma, and Midjourney. The app outputs one direct, universally compatible visual prompt.
> - **Remove "Universal" Labeling:** Remove the word "Universal" across the interface (headers, dropdowns, prompt badges) to eliminate visual clutter and save screen real estate.
> - **Aspect Ratio Enforcement on Every Beat:** Explicitly specify portrait ratio (`Vertical 9:16 portrait composition` and `--ar 9:16`) for short-form, and landscape ratio (`Wide 16:9 landscape composition` and `--ar 16:9`) for long-form, preventing external generators from defaulting to landscape or 1:1.
> - **Non-Frugal Visual Prompt Density:** Upgrade prompt compilation and generation so beat descriptions are never terse or minimal. Each beat embeds rich physical textures, environmental depth, lighting Kelvin/direction, lens optics, and biomechanics.

---

## 1. Overview & Core Concept

- **What It Does:** Simplifies StoryFrame's results UI by replacing model-switching tabs with a single, highly detailed visual prompt per beat. Every prompt is ready to paste into any state-of-the-art image or video generator (Midjourney, Flux, Kling, Runway, Luma, Ideogram, Leonardo).
- **Aspect Ratio Problem Solved:** Previously, beats lacked an explicit aspect ratio flag when using the universal fallback, causing external tools to produce unexpected widescreen or square images instead of 9:16 portrait. Every beat now carries explicit ratio phrasing and `--ar 9:16` / `--ar 16:9` tags.
- **Visual Richness:** The previous universal fallback was minimal (1 sentence). The new universal prompt compiles the full sensory composition: framing, lighting, optics, character visual lock, action physics, and atmosphere.

---

## 2. Technical Implementation Details

### A. Prompt Compiler (`src/services/promptCompiler.ts`)
1. Refactor `compileBeatPrompt` to produce an expansive, non-frugal prompt containing:
   - Composition & Aspect Ratio (`Vertical 9:16 portrait framing` or `Wide 16:9 landscape framing`).
   - Camera Shot Type, Camera Angle, and Camera Movement.
   - Core visual subject, locked biometric/wardrobe identity, and action.
   - Micro-environment, lighting, and tactile physical surface textures.
   - Camera lens and optics (e.g. `Shot on 35mm prime lens, shallow depth of field`).
   - Art style and harmonious color grading.
   - Ending aspect ratio tag: `--ar 9:16` (short) or `--ar 16:9` (long).
   - Video motion directives when in video mode (velocity, continuous motion, physical stability).
   - High-quality universal negative prompt.
2. Ensure `budgetWordCount` allows rich 70-110 word visual descriptions without triggering lint truncation warnings.

### B. Gemini Client & Stage Prompts (`src/services/geminiClient.ts` & `src/services/stage3PromptWriter.ts`)
1. In `geminiClient.ts`, instruct the prompt generation engine to explicitly integrate the required aspect ratio into every beat's `imagePrompt`.
2. Guarantee that the final beat prompt sanitization enforces the presence of `--ar 9:16` (for short-form) or `--ar 16:9` (for long-form).
3. Update `stage3PromptWriter.ts` to instruct the per-scene prompt writer to include rich visual details and the explicit aspect ratio.

### C. UI Simplification (`src/components/ResultsView.tsx` & `src/components/BeatBottomSheet.tsx`)
1. In `ResultsView.tsx`:
   - Remove the Target Model selector `<select>` container from the top action bar to free space.
   - Keep the clean "Copy All Prompts" button.
   - Remove any residual "Universal" labels.
2. In `BeatBottomSheet.tsx`:
   - Remove the model badge tag.
   - Cleanly label the prompt as "Visual Prompt" (Image mode) or "Video Prompt" (Video mode).
   - Show the full, rich compiled prompt with one-click copy.

---

## 3. Verification & Quality Checklist

- [x] Zero references to model tabs (Kling, Runway, Luma, Midjourney) in the results interface.
- [x] Zero occurrences of the word "Universal" taking up screen space in headers or badges.
- [x] Every visual beat prompt contains explicit aspect ratio phrasing and `--ar 9:16` or `--ar 16:9`.
- [x] Visual prompts are richly detailed (lighting, lens, textures, action), never frugal.
- [x] Applet compiles with zero TypeScript errors via `compile_applet`.
