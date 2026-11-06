# Reusable Knowledge & Procedures

## Visual-Event Beat Pacing (Option A) & Narration Coverage
- **Pattern:** Cutting on hyper-fragmented 1-to-4 word connective phrases produces duplicate image prompts. Under Option A Visual-Event Pacing (~1.5s to 3.0s per visual event), each beat corresponds to a genuine physical action, object state change, perspective shift, or reveal, while short connective filler phrases merge into adjacent action beats and 100% of spoken words in `scene.narratorLine` remain preserved across `scene.beats[].textSpan`.
- **Implementation:** `beatProgressionEngine.ts` (`deduplicateAndProgressSceneBeats`, `verifyAndRepairSceneNarrationCoverage`, `normalizeStoryboardForDisplay`) and `beatSplitting.ts` (`enforceBeatCeilings`).

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
- **Command:** `npx tsx src/tests/systemTestSuite.ts` executes the 156 comprehensive system assertions across all modes, visual-event pacing, narration coverage recovery, clone detection, character identity locking, metadata synchronization, portrait safe zones, video clip mapping, enhance mode diffs, duration limits, and hook patterns.

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
