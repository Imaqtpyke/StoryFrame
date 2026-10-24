# Project Architecture & Stack

## StoryFrame
- **Description:** Story to Image Prompt & Narrator Script Generator / Story to Video Prompt & Production Script Generator.
- **Framework:** React SPA (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Dark editorial aesthetic, custom typography, gold/amber accents)
- **Backend / API Model:** Client-side Bring Your Own Key (BYOK) dual-provider architecture:
  - **Google Gemini:** Direct browser execution to Google Generative Language API (Gemini 3.8 Flash, Gemini 3.1 Pro Preview).
  - **Groq Cloud:** Direct browser execution to Groq Cloud OpenAI-compatible endpoint (`https://api.groq.com/openai/v1/chat/completions`) supporting Llama 3.3 70B Versatile (Recommended) and Llama 3.1 8B Instant (Ultra Fast Low Latency).
  - Keys remain strictly in client sessionStorage with zero server logging.

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
5. **Manuscript Ingestion & Series Continuity:**
   - Direct deterministic import of structured screenplay and episode markdown scripts (`src/services/scriptParser.ts`) via direct paste into the unified story textarea with real-time smart auto-detection (`Script Detected: X clips`).
   - Maps pre-timed clips into discrete 4-second scenes (e.g. 12 clips = 48s total, 9:16 vertical video) with camera motion, audio sound design cues, and start-frame keyframes without LLM hallucination risks or API key requirements.
   - Tracks 11-episode mystery series roadmaps, character continuity sheets, and locked continuity directives (including language bans) via `SeriesRoadmapModal.tsx`. Dynamic title resolution supports any episodic series.

6. **Modality Control & Visual Information Budget:**
   - Prepends explicit generation modality headers (`Generate a single still image of:` vs `Generate a continuous video clip of:`) and targeted negative prompts to eliminate model modality routing confusion (e.g. Gemini triggering video on Beat 3).
   - Sanitizes kinetic process verbs (`swirl above`, `flickers`, `churns`, `streaming`) into frozen visual states for still images.
   - Decouples art style from character casting when scenes have no characters.
   - Enforces Visual Information Budget and Reveal Discipline so setup beats strictly withhold future destinations until the reveal beat occurs.
7. **Geographic Demonym Entity Isolation & Cartographic Anchors:**
   - Automatically detects and isolates nationalities and demonyms (e.g. Swedish, British, French, German, Japanese, American), sovereign countries, and geographical landmarks into dedicated 1.0s to 1.5s micro-beats.
   - Generates tactile cartographic environment prompts (2.5D topographic maps or rotating terrestrial globes with illuminated borders, metallic dropped location pins, and authentic national flags) while withholding human characters until the subsequent beat.
   - Enforced across `beatSplitting.ts`, `promptCompiler.ts`, `geminiClient.ts`, and `enhanceStoryArchitect.ts`.
