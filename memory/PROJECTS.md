# Project Architecture & Stack

## StoryFrame
- **Description:** Story to Image Prompt & Narrator Script Generator / Story to Video Prompt & Production Script Generator.
- **Framework:** React SPA (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Dark editorial aesthetic, custom typography, gold/amber accents)
- **Backend / API Model:** Client-side Bring Your Own Key (BYOK) direct execution to Google Generative Language API (Gemini 2.5 Flash, Gemini 3.8 Flash, Gemini 3.1 Pro Preview). Keys remain strictly in client sessionStorage.

## System Modes & Capabilities
1. **Text to Image Mode:**
   - Generates nested scene cards with per-beat standalone visual prompts, camera framing taxonomy, narrator lines, and visual style profile.
   - Paced for short-form (9:16) and long-form (16:9).
   - Sanitizes shot prefixes to ensure clean subject-first image generation.
2. **Text to Video Mode:**
   - Generates production-ready 8-part structured video prompts (subject, action, camera, lighting, style, physics, audio, duration) plus initial keyframe `startFramePrompt`.
   - Calibrated to single-clip targets (1s to 60s, typically 5s to 15s).
   - Evaluates spoken voiceover density via `videoSuitability.ts`.
3. **Beat Pacing:**
   - **Automatic:** Algorithmic and model-driven segmentation based on clauses, punctuation, conjunctions, and hard word ceilings.
   - **Manual:** User-defined parenthetical markers `(beat 1)`, `(beat 2)` or via `CustomBeatEditor.tsx` / `BeatCutterModal.tsx`.
4. **Narrative Architects:**
   - **Original Story Pipeline:** In `geminiClient.ts` (`generateOriginalStory`), preserves pure user narrative rhythm.
   - **Enhance Story Pipeline:** In `enhanceStoryArchitect.ts` (`generateEnhancedStory`), performs automated concept research, causal mechanics breakdown, and Zack D. Films viral hook engineering.
