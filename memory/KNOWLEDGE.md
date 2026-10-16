# Reusable Knowledge & Procedures

## Short-Form Visual Retention Pacing
- **Pattern:** Short-form vertical viewers experience visual fatigue if a single image remains static for more than 2.0 seconds. High-performing content incorporates a visual cut or pattern interrupt every 1.2 to 2.0 seconds (~2 to 4 spoken words).
- **Implementation:** `splitPhraseIntoSubBeats()` and `enforceBeatCeilings()` in `src/services/beatSplitting.ts` subdivide sentences at commas, conjunctions, and hard 5-word / 1.8-second ceilings.

## Biomechanical Grounding for Image & Video Prompts
- **Pattern:** Image diffusion models (Flux.1, Midjourney v6, SDXL) and video diffusion models (Kling, Runway, Sora) produce distorted anatomy when prompts omit kinetic grounding.
- **Rules to Enforce:**
  1. *Stance & Weight:* Specify percentage of weight on feet (e.g., "75% weight anchored on left heel").
  2. *Contrapposto:* Specify counter-twist between torso and pelvis to avoid stiff mannequin postures.
  3. *Hand Biomechanics:* Dictate specific wrist angles and natural finger curvature arcs with tendon tension.
  4. *Head/Gaze:* Direct head orientation to lead or contrast the body motion.

## Proportional Duration Subdivision
- **Pattern:** When subdividing an oversized sentence into 3 or 4 beats, durations must be split proportionally (`totalSeconds / subPhrases.length`) based on speaking rate (~2.0-2.2 words/second).
- **Safeguard:** Never assign a flat 2.5s minimum floor to individual sub-beats, which would artificially inflate a 5-second sentence into 10 seconds.

## Test Suite Execution
- **Command:** `npx tsx src/tests/systemTestSuite.ts` executes the 67 comprehensive system assertions across all modes, portrait safe zones, video clip mapping, enhance mode diffs, duration limits, and hook patterns.

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
