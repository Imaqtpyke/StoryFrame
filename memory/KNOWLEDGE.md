# Reusable Knowledge & Procedures

## Dynamic Visual-Event & Selective Rapid Montage Pacing & Narration Coverage
- **Pattern:** Default Option A (~1.5s to 3.0s) merges tiny grammar glue fragments so plain sentences never clone. However, deliberate rapid cuts (~0.7s to 1.2s minimum floor) are preserved via `extractMontageFocalCategory` and `hasDistinctMontageFocalSubject` for: (a) serialized action lists (`every blink, every breath, every move`), (b) semantic-anchor + temporal-origin flashbacks (`It's an entity / that has studied / you since birth`, with infant inside crib and entity lurking behind slats), (c) repeated rhetorical negations (`You never reach out. / You never cross.`), and (d) climax timing-lag vs smile turns (`half-second late / Now it's smiling / And you never smiled`). Infancy flashbacks are shielded from adult wardrobe and bedroom bleed via `isInfancyOrChildhoodFlashback`.
- **Implementation:** `beatProgressionEngine.ts` (`deduplicateAndProgressSceneBeats`, `injectCompactCharacterLocks`, `auditScenesForRepair`, `verifyAndRepairSceneNarrationCoverage`, `normalizeStoryboardForDisplay`) and `promptCompiler.ts` (`lintStoryboard`).

## Natural Biomechanical Grounding for Image & Video Prompts
- **Pattern:** Image diffusion models (Flux.1, Midjourney v6, SDXL) and video diffusion models (Kling, Runway, Sora) produce distorted anatomy when prompts omit kinetic grounding, while numeric degree angles or body-weight percentages ("70% weight", "15 degrees") confuse diffusion attention.
- **Rules to Enforce:**
  1. *Grounded Stance:* Describe natural foot placement and balance in concrete physical terms (e.g., "both boots planted shoulder-width on uneven stone, leaning forward into a steady stride").
  2. *Posture & Torso Dynamics:* Describe natural shoulder, ribcage, and hip engagement without degree angles.
  3. *Hand & Grip Action:* Describe concrete grip, finger curvature, and wrist tension in plain visual language.
  4. *Head/Gaze:* Direct head orientation and eye focus clearly toward the subject of attention.
  5. *Sanitizer:* `sanitizeFakePrecisionMath` strips any accidental percentage or degree tokens from generated prompts.

## Proportional Duration Subdivision
- **Pattern:** When subdividing an oversized sentence into 2 to 4 beats, durations must be split proportionally (`totalSeconds / subPhrases.length`) based on speaking rate (~2.0-2.2 words/second).
- **Safeguard:** Never assign a flat 2.5s minimum floor to individual sub-beats, which would artificially inflate a 5-second sentence into 10 seconds.

## Test Suite Execution
- **Command:** `npx tsx src/tests/systemTestSuite.ts` executes the 165 comprehensive system assertions across all modes, dynamic montage/flashback beat preservation, infancy wardrobe/location bleed shield, 8-9 word dense beat auditor, narration coverage recovery, clone detection, expression-free character identity locking, monochrome lighting lock, entity key expansion, metadata synchronization, portrait safe zones, video clip mapping, mirror-horror CTA classification, enhance mode diffs, duration limits, and hook patterns.

## Monochrome & Expression-Free Sheet Hygiene
- **Pattern:** Pure black-and-white / manga styles (`no gray gradients`) render muddy or tinted when fed Kelvin temperatures (`3200K warm`, `cold 5400K`) or hue tokens (`cold cyan`, `amber`), and character sheets containing transient expressions (`eyes wide`, `neutral expression`, `mouth open`) contradict dramatic beat or thumbnail emotions.
- **Helpers:** `stripTransientExpressionsAndPoses`, `isMonochromeStyle`, `sanitizeMonochromeLighting`, `expandEntityKeysInPrompt`, and `sanitizeStillImageMotionAndOptics` in `src/services/beatProgressionEngine.ts` enforce purity across beat repair, `promptCompiler.ts`, `geminiClient.ts`, and `enhanceStoryArchitect.ts`.

## Exponential Backoff Retry Pattern for Gemini 503 / 429
- **Pattern:** When Google Generative Language API experiences service overload (503 Service Unavailable) or rate limiting (429), immediate retries exacerbate cluster congestion.
- **Rule:** Double delay on each attempt ($2\text{s} \times 2^{\text{attempt}-1}$) with jitter, capped at 30s. Provide live status updates via callback to display progressive countdowns in the UI instead of failing abruptly.

## Perplexity Universal Hook Taxonomy
- **Pattern:** High-retention narrative openings across all genres (horror, educational, historical, drama) rely on visceral pattern interrupts within the first 2 seconds.
- **Archetypes:**
  1. *Counter-Intuitive Flip:* Subvert common assumptions immediately.
  2. *Urgent Danger / Stakes:* Immediate physical, environmental, or existential peril.
  3. *Visceral Internal Anatomy:* Microscopic or internal physiological mechanics.
  4. *Seemingly Harmless Everyday Object:* Reveal lethal or surprising properties of mundane objects.
  5. *Extreme Hypothetical:* What happens under unprecedented conditions.
  6. *Curiosity Gap / Mystery Box:* Tease an unresolved contradiction.
  7. *Time-Bomb / Ticking Clock:* Finite deadline or countdown.
  8. *Identity / Direct Address:* Target viewer's personal situation or biology directly.
