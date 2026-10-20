# Active & Completed Tasks

## Completed Tasks
- [x] **Rapid 3-to-4 Beat Pacing for Short-Form Video:**
  - Lowered `MAX_BEAT_WORDS` to 5 and `MAX_BEAT_SECONDS` to 1.8 in `src/services/beatSplitting.ts`.
  - Added spatial introductory clause isolation (preserving "Above ground," as Beat 1).
  - Applied universal ceiling normalization in `geminiClient.ts` and `ResultsView.tsx`.
- [x] **Biomechanical Anatomy & Accurate Gestures:**
  - Added anti-mannequin protocol (limb proportions, weight distribution, contrapposto torso/hip twist, hand/wrist curvature arcs, head/gaze vectors) to Image and Video mode prompts.
- [x] **Atmospheric Micro-Environment & Tactile Physics:**
  - Added weather and particulate physics (snow accumulation, frost crystals, breath vapor) and surface tactility to prompt directives.
- [x] **Comprehensive Test Verification:**
  - Verified with 43 automated tests passing in `src/tests/systemTestSuite.ts`.
  - Verified clean compilation (`npm run build`) and clean type-checking (`tsc --noEmit`).
- [x] **Persistent Memory System Setup:**
  - Created persistent memory structure (`INDEX.md`, `MEMORY.md`, `PROJECTS.md`, `DECISIONS.md`, `KNOWLEDGE.md`, `TASKS.md`) capturing all approved conventions and decisions.
- [x] **Five Visual Detail Pillars, Optics, Audio Isolation & Anti-Hallucination Engine:**
  - Embedded fixed biometric identity, tactile materials, Kelvin lighting curves, biomechanical posture/gestures, and layered outfit architecture into prompts.
  - Added lens optics prescriptions (focal length and f-stop depth of field).
  - Enforced strict audio cue isolation: mandated for Text-to-Video prompts and video beats; strictly prohibited and stripped from Text-to-Image prompts.
  - Implemented kinetic velocity progression for video shots.
  - Built grounded anti-hallucination constraint (zero unstated inventions, concrete nouns only).
  - Implemented automated prompt deduplication removing duplicate sentences and redundant continuity blocks.
  - Verified with 47 automated system tests passing and clean compilation.
- [x] **Direct Sequential Scene Layout & Streamlined Storyboard View:**
  - Implemented immediate sequential display from Scene 1 to Scene N upon breakdown completion.
  - Added default Detailed View with all beat cards, spoken clauses, camera tags, and compiled model prompts visible and directly copyable.
  - Added segmented view toggle (Detailed vs Compact Grid) in top navigation bar.
  - Streamlined character continuity: hid duplicate sheets from primary flow; provided on-demand "Character Packets" modal for Midjourney `--cref`.
  - Enforced design rules: Title Case buttons, 8px/sharp corners (zero pill buttons), zero purple gradients, zero em dashes.
  - Verified with 47 automated system tests passing, clean TypeScript check, and clean production build.
- [x] **Streamline JSON Schema Overhead & Clear Stage Feedback in the Loading Screen:**
  - Configured progressive illumination and polished stage feedback messages in the generator loading overlay (`GeneratorForm.tsx`).
  - Streamlined JSON schema parsing and response generation overhead in client-side Gemini API calls (`geminiClient.ts` & `enhanceStoryArchitect.ts`).
  - Verified clean compilation and successful build execution.
- [x] **Compact View Default & Unconditional Zack D. Films Hook Enforcement:**
  - Removed the detailed view layout and toggle, defaulting the Results View exclusively to the clean compact matrix and mobile filmstrip with tap-to-view bottom sheet modals (`ResultsView.tsx`).
  - Strengthened Assistant Chat instructions (`assistantChatService.ts`) to mandate that all user story prompts and ideas are unconditionally transformed into high-retention Zack D. Films hook architecture.

- [x] **Bugfix: Resolved ReferenceError for expandedDesktopBeats:**
  - Removed lingering references and unused expansion helper functions (`expandedDesktopBeats`, `handleCollapseDesktopBeat`, `handleToggleAllBeatsInScene`) in `ResultsView.tsx` after defaulting exclusively to the compact matrix view.
  - Verified clean compilation and zero TypeScript errors with `lint_applet`.
- [x] **Exponential Backoff Retry for 503 Service Unavailable / 429 Errors:**
  - Implemented robust `fetchWithExponentialBackoff` utility in `src/utils/retryFetch.ts` with progressive delay doubling (2s initial, up to 30s max, 4 attempts).
  - Integrated retry logic into `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `assistantChatService.ts`.
  - Added real-time retry status message feedback displaying server busy warnings in both the loading screen (`ResultsSkeleton.tsx`) and AI assistant chat (`AssistantChatDrawer.tsx`).
- [x] **Perplexity Universal Story Hook Taxonomy Integration:**
  - Enriched AI assistant system instructions with 8 universal hook archetypes (Counter-Intuitive Flip, Urgent Danger, Visceral Internal Anatomy, Harmless Everyday Object, Extreme Hypothetical, Curiosity Gap, Time-Bomb, Identity).
  - Verified clean compilation and zero build errors.

- [x] **Universal Story Bible Across Formats, Video Clip Mapping & Enhance Diff:**
  - Implemented session caching for Story Bibles (`bibleCache.ts`) based on story + NOTES hash.
  - Configured video clip mapping (`stage2BeatPlan.ts`) mapping one beat = one clip or max 2-3 consecutive beats with same subject/location within 8s.
  - Enforced short-form rapid pacing constants (`MIN_DWELL 0.8s`, `FAST_CUT_BELOW 1.1s`, `MAX_DWELL 2.0s`, target average 1.2s to 1.8s).
  - Built enhance mode Bible preservation diff check (`enhanceBibleDiff.ts`) and automatic Bible rebuilding upon user approval.
  - Added portrait safe zone clearances and NOTES stripping (`stage0Prepare.ts`).
  - Added test fixtures for portrait, video, and non-horror enhance stories.

- [x] **Dual AI Provider Architecture (Google Gemini + Groq Cloud) & Custom Editorial Dropdown UI:**
  - Replaced Muse API with Groq Cloud (`groqClient.ts` & `unifiedAiService.ts`) connecting directly from the browser to `https://api.groq.com/openai/v1/chat/completions`.
  - Configured active free-tier models verified from console: `openai/gpt-oss-120b` (flagship 120B reasoning), `qwen/qwen3.8-27b` (Alibaba Cloud 27B versatile), and `openai/gpt-oss-20b` (ultra-fast 20B), plus custom model ID entry.
  - Replaced plain browser `<select>` tags with a custom dark-editorial `CustomDropdown.tsx` featuring animated popovers, icons, model badges, and subtitles.
  - Implemented BYOK management with `byok_groq_key` in sessionStorage, key masking/visibility toggle, and direct link to `console.groq.com/keys`.
  - Connected Groq Cloud across all pipelines: Stage 0-4 grounded pipeline, Enhance Story Architect, and StoryFrame Assistant Chat drawer.
  - Updated automated test suite to 75 assertions in `src/tests/systemTestSuite.ts` (100% passing).
- [x] **Manuscript Ingestion Engine & 11-Episode Series Continuity Tracking:**
  - Created deterministic screenplay parser `src/services/scriptParser.ts` to directly ingest structured Markdown manuscripts (specifically `storyframe_episode_1_twelve_suspects_d92e002c.md` and custom script files).
  - Automatically partitioned Episode 1 into 12 discrete 4-second scenes (total 48 seconds, vertical 9:16 text-to-video mode) with 8-part video prompts containing camera movements, biometric character postures, lighting, foley sound cues, and start-frame keyframe prompts.
  - Implemented `ManuscriptIngestModal.tsx` in `GeneratorForm.tsx` providing 1-click loading into the production storyboard or form population with zero API overhead or hallucination risks.
  - Built `SeriesRoadmapModal.tsx` and integrated it into `ResultsView.tsx` to track the full 11-episode mystery series arc, locked continuity rules (including strict ban on "gay" / "straight" labels), and active vs planned episodes.
  - Verified with 97 automated tests passing in `src/tests/systemTestSuite.ts` and clean compilation.

## Next Steps / Active Tasks
- [ ] Monitor user workflow for subsequent episode drafting (Episode 2: "The First Name").
