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

## Five Visual Detail Pillars & Optics Prescriptions
- **Fact/Decision:** Embedded fixed biometric identity (facial bone structure, hair volume/texture), tactile materials (skin pores, textured fabrics like ribbed knit/raw denim/weathered leather, brass patina), emotional lighting Kelvin and contrast curve (explicit Kelvin e.g. 3200K vs 5600K vs 6500K with key-to-fill ratio), expression/posture/biomechanical gestures (gaze vector, contrapposto, finger tendon tension, grounded foot contact), and layered outfit architecture directly into prompts without cluttering the UI. Lens optics prescriptions specify focal length and f-stop depth of field.
- **Context:** Eliminates mannequin poses and visual drift in downstream diffusion models while maintaining a clean, spacious UI.
- **Date:** 2026-10-07
- **Status:** Active

## Audio Cue Mode Isolation & Kinetic Velocity
- **Fact/Decision:** Audio, sound design, and foley cues are strictly mandated for Text-to-Video prompts and video beats, and strictly prohibited and stripped from Text-to-Image prompts. Video beats incorporate explicit kinetic velocity and tempo progression cues.
- **Context:** Diffusion image models cannot render audio and waste tokens if audio instructions are included, whereas video generation and post-production editing rely on explicit sound design and motion velocity.
- **Date:** 2026-10-07
- **Status:** Active

## Grounded Anti-Hallucination & Deduplication Engine
- **Fact/Decision:** Strict zero-unstated-inventions constraint forbidding unprompted characters, random weapons, or plot twists not in the user's premise. Automated post-processing deduplication removes duplicate sentences, redundant continuity blocks, and trailing boilerplate loops.
- **Context:** Prevents token bloat, keeps prompts punchy (45 to 80 words), and guarantees downstream image and video models render faithful visuals without hallucinations.
- **Date:** 2026-10-07
- **Status:** Active

## "The Difference" Juxtaposition & User Request Abort Control
- **Fact/Decision:** In hypothetical, comparative, and counterfactual story premises, visual beats strictly delineate baseline reality (e.g. temperate modern biosphere) from the what-if divergence (e.g. untamed primeval mega-flora and apex predators). Consecutive beats enforce progression with >75% similarity checks rewriting repetitive angles. Network requests feature user-facing "Cancel Request" controls via AbortController and adaptive timeouts scaled to story length (up to 180s for long-form scripts).
- **Context:** Eliminates duplicated scenes across consecutive micro-beats, prevents socket stalls from freezing the UI indefinitely, and guarantees user control during long narrative generations.
- **Date:** 2026-10-08
- **Status:** Active

## Assistant Model Respect, Friendly Error Masking & Prompt Edit
- **Fact/Decision:** StoryFrame Assistant strictly respects the user-configured model quality tier (Standard: gemini-3.8-flash, Pro: gemini-3.1-pro-preview) without unrequested model fallback switching. Server errors (such as 503 or 504) halt the assistant immediately, completely mask raw error codes, display the friendly text "An error occurred, please try again.", and render a prominent "Retry Again" button. User message bubbles feature an "Edit" button accessible after the assistant completes responding to modify and resubmit prompts.
- **Context:** Protects user agency in choosing model tiers, eliminates unsightly technical stack codes from the UI, and provides frictionless editing and retry flows.
- **Date:** 2026-10-08
- **Status:** Active

## Strict Zero Fallback Policy & Direct User Model Choice
- **Fact/Decision:** Both the AI Assistant and the main Story Breakdown generators (Standard and Enhance Architect pipelines) strictly execute using the exact model selected by the user in Model Options (Standard = gemini-3.8-flash, Pro Quality = gemini-3.1-pro-preview). All candidate-model fallback loops have been completely eliminated from the codebase. If an upstream service error (e.g. 503) occurs, the app stops cleanly and allows the user to retry or select an alternate model manually. Fixed the `TypeError: w is not a function` bug by exposing `setModelQuality` and `modelQuality` inside the `ApiKeyContext.Provider` value prop.
- **Context:** Guarantees total user control over which model processes their data and prevents unexpected background model switches.
- **Date:** 2026-10-08
- **Status:** Active

## Silent Auto-Retry on 503 Overload (No 3-Retry Ceiling, User Cancellation Preserved)
- **Fact/Decision:** When Google Gemini returns a transient 503 Service Unavailable or server overloaded response, the system does not display a 503 error or halt abruptly with a hard 3-retry cap. Instead, it continuously and silently re-executes using the user's chosen model with adaptive backoff until the response successfully arrives. The loading screen remains active, and the user can click "Cancel Request" at any time. If an unrecoverable non-transient error occurs, friendly non-technical copy is displayed without raw 503 codes.
- **Context:** Eliminates jarring 503 error screens during temporary Google cluster spikes, respects user model selection without fallback switching, and gives the user full control to wait or cancel.
- **Date:** 2026-10-14
- **Status:** Active

## Streamlined JSON Schema Overhead & Clear Loading Stage Feedback
- **Fact/Decision:** Optimized client-side Gemini requests to streamline JSON schema generation overhead and ensure lightning-fast API dispatch. Configured progressive illumination and transparent stage feedback in the loading overlay (`GeneratorForm.tsx`) tracking phases from screenplay analysis to final storyboard synthesis.
- **Context:** Reduces parsing latency and provides smooth, informative real-time feedback during breakdown generation without blocking or cluttering the interface.
- **Date:** 2026-10-14

## Exponential Backoff Retry Strategy for 503 / 429 Service Overload
- **Fact/Decision:** Implemented client-side exponential backoff via `fetchWithExponentialBackoff` in `src/utils/retryFetch.ts` with progressive delay doubling (initial 2s, doubling on each subsequent retry up to 30s max, 4 attempts) and transparent real-time status updates in `ResultsSkeleton.tsx` and `AssistantChatDrawer.tsx`. Avoids immediate retries that strain busy servers.
- **Context:** Protects user sessions from abrupt failures during Google API traffic spikes while keeping the user informed of backoff progress.
- **Date:** 2026-10-15
- **Status:** Active

## Grounded StoryFrame Pipeline for Long-Form 16:9 Landscape Text-to-Image
- **Fact/Decision:** Implemented a 5-stage generation architecture (Stage 0: Word indexing and optional timing/NOTES parsing; Stage 1: Structured Story Bible covering cast, threat, locations, motifs, events, referents, withheld elements, forbidden anachronisms, worldStyle, and assumptions; Stage 2: Picture-grounded beat planning with strict pacing constants `MIN_DWELL = 0.8s`, `FAST_CUT_BELOW = 1.2s`, `MAX_DWELL = 3.0s`, fast-cut ceilings, and contiguous word-range tiling; Stage 3: Self-contained prompts in strict order without spoken text, quotes, or fake precision; Stage 4: 7 deterministic code checks, up to 2 repair rounds, and an independent scene critic). Eliminated the 8 observed defects (narration leaks, subject-less prompts, picture-less fragment beats, unresolved figurative lines, near-duplicates, invented content, style bleed, and fake precision). Added `RELEASE_CHECK.md`, `tests/fixtures/ravenhollow.txt`, and verified with 48 automated test assertions.
- **Context:** Fixes text leakage and hallucinations while producing production-ready widescreen prompt blueprints that reflect true narrative meaning.
- **Date:** 2026-10-15
- **Status:** Active

## Universal Story Bible Across Formats, Video Clip Mapping & Enhance Diff
- **Fact/Decision:** Applied the Story Bible architecture universally across text-to-video, text-to-image (short/long), enhance mode, and portrait mode. Implemented session caching for the Story Bible per story (hash of story text + NOTES block), video clip mapping (one beat = one clip, or max 2-3 consecutive beats with same subject and location capped at 8s), short-form rapid pacing (`MIN_DWELL 0.8s`, `FAST_CUT_BELOW 1.1s`, `MAX_DWELL 2.0s`, target average 1.2s to 1.8s), enhance mode diff check against the Bible with subsequent Bible rebuilding, portrait bottom-fifth and lateral safety zone clearances, NOTES block stripping, and comprehensive test suites (67 automated assertions passing including portrait, video, enhance non-horror, and bible cache).
- **Context:** Unifies story architecture and quality guardrails across all generation formats and modes while ensuring zero text leaks and strict adherence to author canon.
- **Date:** 2026-10-15
- **Status:** Active

## Dual AI Provider Architecture (Google Gemini + Groq Cloud) & Custom Editorial Dropdown UI
- **Fact/Decision:** Replaced Muse API with Groq Cloud (`https://api.groq.com/openai/v1/chat/completions`) using active console models: `openai/gpt-oss-120b` (recommended flagship 120B reasoning model), `qwen/qwen3.8-27b` (Alibaba Cloud 27B versatile model), and `openai/gpt-oss-20b` (ultra-fast 20B model), plus manual custom model ID entry. Enhanced `CustomDropdown.tsx` with animated options, badges, icons, subtitles, and descriptions to eliminate plain browser selects while maintaining dark editorial aesthetics and zero UI cramping. Keys are stored in `byok_gemini_key` and `byok_groq_key` with zero server telemetry.
- **Context:** Fixes model deprecation errors from retired Llama models on Groq Cloud, provides direct access to 120B and 27B reasoning, and gives users a rich, premium selection interface.
- **Date:** 2026-10-17
- **Status:** Active

## Manuscript Ingestion Engine & 11-Episode Series Continuity Tracking
- **Fact/Decision:** Built deterministic manuscript ingestion (`scriptParser.ts`) enabling instant import of pre-structured episodic screenplays (such as Episode 1: Twelve Suspects from `storyframe_episode_1_twelve_suspects_d92e002c.md`) directly into 12 discrete 4-second scenes (48s total, vertical 9:16 text-to-video mode) with 8-part video prompts (camera motion, character biometrics, lighting, foley sound cues) and start-frame keyframe prompts. Integrated `ManuscriptIngestModal.tsx` in `GeneratorForm.tsx` with 1-click storyboard transition or form population, and added `SeriesRoadmapModal.tsx` in `ResultsView.tsx` to maintain the 11-episode arc, eliminated contestants, and the strict language rule forbidding "gay" or "straight" labels.
- **Context:** Solves the challenge of executing finished episodic manuscripts without having an LLM re-write or hallucinate changes to author-crafted 4-second clip structures.
- **Date:** 2026-10-20
- **Status:** Active

## Smart Script Auto-Detection & Uncluttered Textarea Ingestion
- **Fact/Decision:** Removed separate "Ingest Manuscript" and "Upload File" buttons, as well as `ManuscriptIngestModal.tsx`. Built inline smart format auto-detection in `GeneratorForm.tsx` that inspects the story textarea for structured clip markers (`### Clip` and `Voice-over:`) in real time, displays a subtle amber badge (`Script Detected: X clips`), and automatically routes to deterministic manuscript ingestion upon clicking Generate (zero API token cost, no key required). Standard story prose routes to normal AI generation. Decoupled hardcoded demo titles in favor of dynamic manuscript/result titles.
- **Context:** Eliminates UI cramping above the story input box, removes unnecessary file picker dialogs, and allows users to paste any story idea, long-form prose, or multi-clip manuscript directly into a single unified input.
- **Date:** 2026-10-22
- **Status:** Active





## Modality Header, Kinetic Motion Sanitizer, Style Decoupling & Visual Information Budget
- **Fact/Decision:** Resolved narrative misalignment, Gemini modality confusion (generating video instead of still images on active-verb prompts like Beat 3), and style-vs-casting contradictions:
  1. Compiles explicit model modality headers: `Generate a single still image of:` with frozen-frame constraints (`Static frame. One exact moment in time. No animation, no video`) and negative prompts for Image Mode, versus `Generate a continuous video clip of:` for Video Mode in `promptCompiler.ts`.
  2. Implemented `sanitizeKineticMotionForImage` converting active process verbs (`streaming`, `swirl above`, `flickers`, `churns`, `fluid motion`) into frozen visual states (`suspended in a thin frozen ribbon`, `dense curved storm-cloud formations hang frozen above`, `captured in a single frozen lightning strike`, `has crisp frozen ripples`) to stop Gemini/diffusion routers from triggering video mode.
  3. Implemented `resolveStyleAndCastingCompatibility` stripping mascot/animal/character requirements from art style when a scene is tagged `no characters` or describes an empty environment.
  4. Enforced Visual Information Budget & Reveal Discipline across `geminiClient.ts` and `enhanceStoryArchitect.ts`: setup beats (e.g. "If you pour tea") strictly withhold destination ("harbor") until the reveal beat arrives.
  5. Added Linter rules L07 (Style vs Casting Contradiction) and L08 (Premature Information Leakage) to `lintStoryboard`.
- **Context:** Prevents diffusion models from generating unwanted video clips, hallucinating bizarre rubber hose characters in empty landscapes, or spoiling narrative twists prematurely.
- **Date:** 2026-10-22
- **Status:** Active
