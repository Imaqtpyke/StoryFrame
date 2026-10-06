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
- **Command:** `npx tsx src/tests/systemTestSuite.ts` executes the 43 system assertions across all modes, boundaries, duration limits, and hook patterns.
