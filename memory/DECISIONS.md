# Approved Decisions

## Rapid Beat Pacing for Short-Form Video
- **Fact/Decision:** Lowered the short-form visual ceiling from 8 words / 2.0s down to 5 words / 1.8s, and made introductory spatial phrases (e.g., "Above ground,") strictly form their own standalone establishing beat (Beat 1).
- **Context:** In short-form vertical video (TikTok, Reels, Shorts), holding a single static image for 3.5 to 5.0 seconds causes viewer swipe-aways. Quick pattern interrupts every 1.2 to 1.8 seconds sustain retention.
- **Date:** 2026-10-06
- **Status:** Active

## Biomechanical Anatomy & Accurate Gestures Engine
- **Fact/Decision:** Prompts across Image and Video modes must explicitly specify limb proportions, grounded weight distribution (preventing floating feet), contrapposto torso/hip twist (preventing wooden mannequin poses), hand/wrist arcs with tendon tension (preventing distorted digits), and head/neck gaze vectors.
- **Context:** Generative diffusion models (Flux, Midjourney, Kling, Sora) default to stiff, wooden poses or malformed hands without explicit kinetic and anatomical constraints.
- **Date:** 2026-10-06
- **Status:** Active

## Atmospheric Micro-Environment & Tactile Physics
- **Fact/Decision:** Prompts must incorporate physical weather and environmental interactions, such as powdery snow accumulating in fabric seams, frost on wood grain, breath vapor condensation, and damp needles compressed underfoot.
- **Context:** Elevates prompts from generic background labels to rich, tactile cinematic scenes with natural depth.
- **Date:** 2026-10-06
- **Status:** Active

## Mode & Duration Separation
- **Fact/Decision:** Separated duration parameters into `durationSeconds` (total story runtime for Image Mode) and `targetVideoDuration` (single shot clip length for Video Mode).
- **Context:** Prevents cross-mode parameter pollution and guarantees video suitability calculations reflect single-shot generative video model constraints (5s-15s clips).
- **Date:** 2026-09-27
- **Status:** Active

## Zack D. Films Hook Architecture
- **Fact/Decision:** Strict ban on opening cliches ("Imagine a world where...", "Have you ever wondered...") in Enhance Story mode, enforcing the 6 authentic Zack D. Films 2-second retention hook formulas.
- **Context:** Opening 2 seconds determine short-form video retention; abstract openers cause immediate swipe-away.
- **Date:** 2026-09-27
- **Status:** Active
