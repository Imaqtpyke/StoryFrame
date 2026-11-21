# Approved Decisions

## Rapid Beat Pacing for Short-Form Video
- **Fact/Decision:** Lowered the short-form visual ceiling from 8 words / 2.0s down to 5 words / 1.8s, and made introductory spatial phrases (e.g., "Above ground,") strictly form their own standalone establishing beat (Beat 1).
- **Context:** In short-form vertical video (TikTok, Reels, Shorts), holding a single static image for 3.5 to 5.0 seconds causes viewer swipe-aways. Quick pattern interrupts every 1.2 to 1.8 seconds sustain retention.
- **Date:** 2026-10-06
- **Status:** Outdated (Superseded by Visual-Event Beat Pacing Option A on 2026-11-06)

## Biomechanical Anatomy & Accurate Gestures Engine
- **Fact/Decision:** Prompts across Image and Video modes must explicitly specify limb proportions, grounded weight distribution (preventing floating feet), contrapposto torso/hip twist (preventing wooden mannequin poses), hand/wrist arcs with tendon tension (preventing distorted digits), and head/neck gaze vectors using natural descriptive language (numeric weight percentages and degree angles removed on 2026-11-06).
- **Context:** Generative diffusion models (Flux, Midjourney, Kling, Sora) default to stiff, wooden poses or malformed hands without explicit kinetic and anatomical constraints.
- **Date:** 2026-10-06
- **Status:** Active (Revised)

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

## Collapsible Mobile-First Thumbnail Blueprint
- **Fact/Decision:** Transformed the Cover & Thumbnail Blueprint into a collapsible accordion card in `src/components/ResultsView.tsx` defaulting to collapsed state (`isThumbnailExpanded = false`). Features an accessible header bar, compact hook preview badge (`Hook: "..."`), and a direct "Copy Prompt" action available without needing to expand the card.
- **Context:** Reclaims vertical viewport space on mobile and tablet devices upon storyboard load while retaining instant one-click access to the high-CTR cover prompt.
- **Date:** 2026-10-26
- **Status:** Active

## Story-Adaptive Call-to-Action Outro Visual Prompt Engine
- **Fact/Decision:** Implemented a dedicated Call-to-Action Outro engine in `src/services/promptCompiler.ts` and `src/components/ResultsView.tsx`, defaulting to collapsed state (`isCtaExpanded = false`):
  1. Story-Adaptive Question Derivation: Infers an intriguing moral dilemma, cliffhanger inquiry, or open curiosity question directly from narrative themes (mystery, survival, betrayal, sci-fi, fantasy, drama) to maximize viewer comments and algorithmic distribution. Supports 1-click alternate questions and custom question editing.
  2. Multi-Platform Safe Zones: Custom presets for TikTok (18% right action stack & 22% bottom caption clearance), YouTube Shorts (20% bottom channel/subscribe clearance & 15% right rail), and General Platforms (universal 10% perimeter margin for Instagram Reels, X, and web embeds).
  3. Modality Adaptation: Dual generator targeting Text-to-Video 3-second kinetic loop (subtle dolly-in, atmospheric particles, fourth-wall breaking lingering stare) vs Text-to-Image closing freeze frame.
  4. Overlay vs Clean Plate: Full prompt with story-adapted typography and UI action badge vs text-free clean plate for creators assembling titles in CapCut or Premiere.
  5. Default Collapsed UI: Defaults to collapsed on load with an active question preview badge and quick-copy button on the header, expanding on click or via top jump navigation.
  6. Export Integration: Included automatically in JSON payload and Markdown shot list exports.
- **Context:** Minimizes screen crowding upon results generation while giving creators instant access to platform-compliant closing engagement assets.
- **Date:** 2026-10-26
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

## Geographic Demonym Entity Beat Isolation & Cartographic Visual Anchors
- **Fact/Decision:** Implemented automatic segmentation and dedicated visual anchoring for geographic nationalities/demonyms (e.g. "Swedish", "British", "French", "American", "German"), countries, and locations:
  1. `isolateAnchorsAndEntities` and `splitPhraseIntoSubBeats` automatically partition phrases like "In 1896 Swedish scientist Svante Arrhenius" into exact dedicated micro-beats: Beat 1 ("In 1896"), Beat 2 ("Swedish"), and Beat 3 ("scientist Svante Arrhenius").
  2. For geographic demonym beats, `generateCartographicPrompt` synthesizes an environment-focused cartographic visual prompt: a tactile 2.5D topographic map or rotating vintage terrestrial globe with glowing illuminated national boundary lines, a metallic dropped location pin, and the authentic national flag or crest beside the country outline (with characters and people strictly excluded).
  3. `enforceBeatCeilings` automatically upgrades demonym beats to high-angle macro cartographic shots.
  4. Added the Geographic Demonym & Cartographic Anchor Rule to prompt schemas in `geminiClient.ts` and `enhanceStoryArchitect.ts`.
  5. Added Linter Rule L09 to `lintStoryboard` to verify cartographic environment focus on geographic beats.
- **Context:** Replicates high-retention documentary and explainer video editing standards (Vox, Johnny Harris, Kurzgesagt) where spoken country/nationality callouts cut to rapid cartographic map graphics before showing the historical character in the following beat.
- **Date:** 2026-10-23
- **Status:** Active

## Assistant Response Versatility, Strict Question Discipline & Minimized Action Buttons
- **Fact/Decision:** Upgraded StoryFrame Assistant in `assistantChatService.ts` and `AssistantChatDrawer.tsx`:
  1. Adapt to Any Genre or Style: Replaced the rigid Zack D. Films constraint with comprehensive style change triggers covering every phrasing pattern ("make it...", "write this in the style of...", "change the tone to...", "switch to...", "rewrite as...", "turn this into...", "give it a ... vibe", "rephrase in...", "narrate like...", "in the voice of...", "tell it as if...", "stylize as...", "transform into...", "render as...", "apply a ... aesthetic", "shift mood to...", "more cinematic", "less cheesy", "darker", "grittier", "sound more professional", "like an old-school broadcast", etc.) across documentary, viral shorts, fiction/cinema, technical breakdowns, and 12+ animation/art mediums.
  2. Strict Question-Answering Discipline: When the user asks a question, the assistant responds strictly and directly to what was asked without any unsolicited extra information, follow-up offers, or background fluff.
  3. Free-Tier Token Efficiency: Preserved lightweight payload with zero conversational filler or throat-clearing, protecting free-tier rate limits.
  4. UI Button Layout & Mobile Sizing: Excluded tool actions (edit, copy, stars) from inside the message bubble container so that only the text/words reside within the bubble. Reverted the icon tool sizes back to touch-friendly dimensions (`w-3.5 h-3.5` with `p-1.5` hit areas) positioned directly beneath each bubble for effortless mobile and desktop interaction, with the words "Edit" and "Copy" remaining completely removed.
- **Context:** Directly aligns with creator intent to maintain a pure, versatile creative assistant without bloating token usage, while eliminating distracting text labels on message cards and keeping touch controls comfortable on mobile screens.
- **Date:** 2026-10-24
- **Status:** Active

## Production Cover & Thumbnail Blueprint Engine
- **Fact/Decision:** Implemented a dedicated Cover & Thumbnail Blueprint engine in `src/services/promptCompiler.ts`, integrated across all generation pipelines (`geminiClient.ts`, `groundedPipeline.ts`, `enhanceStoryArchitect.ts`, `scriptParser.ts`), and rendered in `src/components/ResultsView.tsx`:
  1. Narrative Position: Placed cleanly between the final scene and the Complete Narrator Script, completely isolated from scene arrays, timing, SRT subtitles, and EDL cut lists.
  2. Story-Adaptive Typography: Font styling adapts dynamically to the narrative genre, tone, and character style via `inferStoryAdaptiveFont` (e.g. distressed weathered stencil for zombie/horror apocalypse, sleek futuristic neon sans-serif for cyberpunk, chiseled archaic roman serif for medieval dark fantasy, bold editorial headline serif for historical documentaries, playful bubble serif for 1930s rubber hose).
  3. Platform Safe Zones: 16:9 widescreen YouTube layout positions the subject on the left third with bottom-right duration badge clearance; 9:16 vertical TikTok/Shorts layout centers the face in the upper-middle band with top 12%, bottom 25%, and right-edge engagement button clearance.
  4. Dual Copy Options: Generates both the full production prompt with quoted headline text (<= 4 words in ALL CAPS) and a clean plate prompt leaving empty negative space for creators designing typography in Canva or Photoshop.
- **Context:** Resolves creator need for high-CTR publishing assets matching the storyboard's locked character identity and aesthetic while preserving export integrity.
- **Date:** 2026-10-25
- **Status:** Active

## Direct Universal Visual Prompts, Non-Frugal Density & Aspect Ratio Enforcement
- **Fact/Decision:** Consolidated prompt output into a single, high-fidelity universal visual prompt format and removed all model tabs (Kling, Runway, Luma, Midjourney) and the "Universal" word/label across the UI to free up screen real estate. Every prompt now embeds explicit aspect ratio phrasing (`Vertical 9:16 portrait composition` or `Cinematic 16:9 widescreen composition`) and tags (`--ar 9:16` or `--ar 16:9`). Visual prompt density is non-frugal, weaving framing, optics, lighting, locked biometrics, action biomechanics, and micro-environment textures into every beat.
- **Context:** Solves the issue where prompts lacked an explicit aspect ratio and defaulted to landscape in external diffusion tools, removes frugal 1-sentence prompt fallbacks, and eliminates unnecessary tool-switching clutter.
- **Date:** 2026-10-25
- **Status:** Active





## AI Assistant Top Nav Integration, Beat & Asset Revision Engine, and 403 Forbidden Page
- **Fact/Decision:** 
  1. Relocated the AI Assistant trigger from the bottom-left floating star icon to a clean text button labeled "AI Assistant" in the top navigation bar beside "History" in `Header.tsx`, removing the floating button entirely.
  2. Connected Assistant to live story state: when on home page with no story loaded, assistant operates as a general creative co-pilot; when a story is active or loaded from History, assistant automatically connects to that story with scene and beat continuity context.
  3. Built the Beat, Thumbnail & CTA Prompt Revision Engine (Anti-Duplication Protocol): allows creators to ask the assistant to rewrite specific beats (e.g. S1 B2 to deduplicate against S1 B1), Cover Thumbnail, or CTA Outro while preserving locked character continuity, Kelvin lighting, optics, and biomechanics.
  4. Structured Revision Tags with One-Click Apply and Undo: Assistant wraps revised prompts in structured tags (`[REVISE_BEAT scene=X beat=Y]`, `[REVISE_THUMBNAIL]`, `[REVISE_CTA]`), which `AssistantChatDrawer.tsx` renders as interactive cards with instant "Apply to Storyboard" and "Undo Change" actions that update both current state and local history.
  5. Removed the detached legacy "Recommended Negative Prompt" box from `BeatBottomSheet.tsx` since negative quality controls are integrated directly into visual prompts.
  6. Added a dedicated HTTP 403 Forbidden Error Page (`Forbidden403View.tsx`) with a self-service authorization checklist and direct routes back to settings when Google Generative Language API permissions or referrer restrictions fail.
- **Context:** Empowers creators to refine duplicated visual beats effortlessly without leaving the storyboard workflow, cleans up UI navigation, and provides clear self-healing steps for Google API permission rejections.
- **Date:** 2026-10-28
- **Status:** Active

## Kinematic Beat Progression, True Deduplication & Character Sheet Purity
- **Fact/Decision:**
  1. Completely deleted the legacy variation-prefix table ("The altered environment.", "Emphasizing grounded scale.", "Focusing on tactile textures.") and rotating camera labels from `enforceBeatToBeatProgression`.
  2. Implemented true semantic deduplication with 3-gram shingles and token overlap (`calculatePromptSimilarity`). If consecutive beats have >= 55% similarity:
     - If combined duration <= 2.8s: Merges narration spans and durations into one single beat, eliminating duplicate images for short grammatical fragments.
     - If combined duration > 2.8s: Dynamically pivots Beat N to an alternate contrasting perspective (interior POV, reverse reaction angle, or macro detail) without adding fake prefixes.
  3. Raised `MAX_BEAT_WORDS` from 5 to 10 and `MAX_BEAT_SECONDS` to 2.4s in `beatSplitting.ts` so normal spoken sentences do not get aggressively chopped into empty visual clones.
  4. Enforced Character Sheet Purity (`sanitizeCharacterIdentitySheet`): Strictly banned frozen physical poses, hand gestures, and specific props (e.g. clutching a Nokia phone, wrist angles, foot percentages) from global character descriptions so they do not contaminate unrelated scenes.
  5. Centralized Prompt Assembly (`assembleCleanPrompt`): Eliminates duplicate `--ar` flags and orientation text, strips broken degenerate prompts (e.g. "Extreme."), and guarantees exactly one clean orientation prefix and one `--ar` parameter.
  6. Synchronized scene duration math: `scene.estimatedSeconds` strictly equals the sum of its beat durations in both the application state and Markdown export tables.
- **Context:** Resolves the critical visual beat duplication issue identified across Tagalog and English stories, ensuring genuine sequential action progression across every storyboard beat.
- **Date:** 2026-10-31
- **Status:** Active

## Visual-Event Beat Pacing (Option A), Compact Character Locks (Option A) & Metadata Alignment
- **Fact/Decision:**
  1. Visual-Event Pacing (Option A, ~1.5s-3.0s per visual event): Cut to a new beat only when a genuine physical action, object state change, perspective shift, reaction, or narrative reveal occurs. Merge short connective filler fragments (e.g. "But he has one problem:", "target for kings", "him live.") into adjacent action beats instead of generating cloned stub beats.
  2. 100% Spoken Narration Coverage (`verifyAndRepairSceneNarrationCoverage`): Every spoken word in `scene.narratorLine` must appear sequentially across `scene.beats[].textSpan`. Any dropped or truncated trailing clauses are recovered into distinct continuation beats.
  3. Two-Phase Progression & Intra-Scene Clone Resolution (`beatProgressionEngine.ts`): Check all beat pairs `(i, j)` within each scene to eliminate adjacent and non-adjacent A-B-A-B clones, eliminate legacy placeholder strings, and preserve merged beats in `ResultsView.tsx` via `normalizeStoryboardForDisplay`.
  4. Compact Character Identity Locks (Option A, `injectCompactCharacterLocks`): Embed a concise 14-18 word locked visual identity and wardrobe/gear anchor into every character-present beat (including pronoun beats) while keeping character-free cartographic beats clean.
  5. Shot Metadata & Orientation Synchronization (`formatFinalBeatPrompt` & `assembleCleanPrompt`): Guarantee a single orientation declaration (`Vertical 9:16 portrait composition` or `Cinematic 16:9 widescreen composition`), exact 1-for-1 alignment between `shotType`/`cameraAngle` table metadata and prompt prose opening, and Linter rules L10 (intra-scene duplicates), L11 (truncated narration), and L12 (metadata contradiction).
  6. Natural Biomechanics & Chronological Era Locks: Strip robotic weight percentages ("70% weight") and degree angles ("15 degrees") via `sanitizeFakePrecisionMath` and scrub modern/futuristic scenery bleed from historical scenes via `sanitizeEraBleedAcrossScenes`.
- **Context:** Directly resolves intra-scene beat duplication, dropped trailing narration clauses (e.g. Scene VII), double orientation prefixes, shot metadata contradictions, and era bleed while preserving visual consistency across stateless diffusion models.
- **Date:** 2026-11-06
- **Status:** Outdated (Superseded by Dynamic Visual-Event & Selective Rapid Montage Pacing on 2026-11-13)

## Monochrome Style Lock, Twist Protection, Expression-Free Sheets & Mirror CTA
- **Fact/Decision:**
  1. Zero Spoken-Text Fallback Leakage & Chronological Twist Protection: Fallback and repair builders never interpolate literal spoken `textSpan` strings (`"turning point of..."`, `"escalating stakes of..."`), withhold late horror reveals (e.g. smiling/lagging reflections) until their exact scene, honor negations literally (`"You never reach out"`), and block unstated sound whispers or etched mirror dates in Image mode.
  2. Expression-Free CharacterSheets & Entity Expansion (`stripTransientExpressionsAndPoses`, `expandEntityKeysInPrompt`): Strip transient expressions (`eyes wide`, `neutral expression`, `horrified`, `mouth open`, `smiling`) and temporary poses from `characterSheet` across beats/Thumbnails/CTAs, keep footwear consistent (`barefoot` stays barefoot), break anchors cleanly at phrase boundaries (no `"neutral)"` truncation), and expand raw CamelCase keys (`DarkRoom`, `Protagonist`) into natural prose.
  3. Monochrome Style Lock (`isMonochromeStyle`, `sanitizeMonochromeLighting`): Automatically scrub chromatic Kelvin temps (`3200K warm tungsten`, `cold 5400K`) and color hues (`cold cyan`, `amber`) from beat prompts, Thumbnails, and CTAs whenever `styleProfile` specifies pure black-and-white / monochrome / manga ink.
  4. Still-Image Motion Filtering & OTS-vs-Angle Taxonomy: Clean video tracking phrases (`tracking left to reveal`), duplicate focal lengths (`35mm 35mm`), and double periods (`..`) in Image mode (`sanitizeStillImageMotionAndOptics`), keep framing (`Over-the-Shoulder (OTS)`, `Medium Close-Up`) strictly in `shotType` and vertical/tilt angles in `cameraAngle`, and extend Linter L12/L13.
  5. Genre-Accurate Horror CTA & Universal Flags: Evaluate mirror/supernatural horror keywords ahead of incidental moral words (`lie`) in `inferStoryAdaptiveCtaQuestion` and use clean `--ar 9:16` / `--ar 16:9` flags in `compileCtaPrompt` without legacy `--style raw --v 6.1`.
- **Context:** Resolved all prompt-craft, monochrome tint bleed, twist spoiler, expression clash, CamelCase leak, and CTA classification defects surfaced in the horror mirror storyboard test.
- **Date:** 2026-11-13
- **Status:** Active

## Dynamic Visual-Event & Selective Rapid Montage Pacing, Entity Sheet Locks & Infancy Flashback Shield
- **Fact/Decision:**
  1. Preserved Option A (~1.5s-3.0s) as baseline pacing for normal sentences and grammar-connector merging, while introducing selective rapid cuts (~0.7s-1.2s minimum floor) for: (a) parallel action triplets/lists (`every blink, every breath, every move`), (b) semantic-anchor + temporal-origin flashbacks (`It's an entity` -> `that has studied` -> `you since birth`), (c) repeated rhetorical negations (`You never reach out.` -> `You never cross.`), and (d) climax timing-lag vs smile turns (`half-second late.` -> `Now it's smiling.` -> `And you never smiled.`).
  2. Confirmed Infancy Flashback Framing (`you since birth`): Infant protagonist swaddled inside a wooden nursery crib while the entity hides/lurks in shadow behind crib slats watching; protected via `isInfancyOrChildhoodFlashback` so adult `characterSheet` wardrobe and present-day `locationSheet` rooms never bleed into infant crib frames.
  3. Protected deliberate rapid cuts in `deduplicateAndProgressSceneBeats` (Pass 2 & Pass 3) and `lintStoryboard` (L10) via `extractMontageFocalCategory` and `hasDistinctMontageFocalSubject` (requiring radically distinct shot scale and focal nouns per cut, raising clone threshold to `0.68` only when distinct focal subjects apply).
  4. Added `detectUnsplitDenseBeatPattern` in `auditScenesForRepair` to catch dense 7-14 word lines missed by the 15-word ceiling check, added recurring entity/antagonist locking in `characterSheet`, enforced forward-facing unaware protagonist separation in stalking beats, and locked Short-Form/Video/Beat Engine scope while leaving Long-Form `groundedPipeline.ts` for a later pass.
- **Context:** Directly solves merged action triplets, missing visual metaphors for temporal origin lines ("since birth"), merged climax beats, and entity drift while preserving zero stub-clone regressions on routine prose.
- **Date:** 2026-11-13
- **Status:** Active

## Text-to-Video Clip Duration Alignment & Multi-Clip Spill
- **Fact/Decision:** Updated Text-to-Video mode cleanly without modifying Text-to-Image behavior:
  1. Added `scaleBeatsToTargetDuration` in `src/services/beatProgressionEngine.ts` and passed `targetVideoDuration` into `runTwoPhaseProgressionAndRepair`, guaranteeing Video Mode scene durations stay locked to `targetVideoDuration` (e.g., `4s`), sub-beat durations sum accurately to `targetVideoDuration` (`4.0s`) after both Phase 2 repair and `normalizeStoryboardForDisplay`, and master `videoPrompt` duration notes synchronize post-repair.
  2. Refined `auditScenesForRepair` and Video Mode prompts (`geminiClient.ts`, `enhanceStoryArchitect.ts`, and Phase-2 `repairSystemPrompt`) so dense multi-concept lines stacking flashbacks and action triplets spill across consecutive `targetVideoDuration` clips (<= 3 cohesive beats summing to clip duration) instead of cramming 5-6 disparate cuts into one short clip.
  3. Kept Text-to-Image natural beat timing (`~0.7s-1.2s` montage / `~1.5s-3.0s` visual events) completely isolated and unaffected.
- **Context:** Prevents beat timing mismatches and AI video morphing when generating `4s` Video Mode clips on dense scripts while preserving full Image Mode fidelity.
- **Date:** 2026-11-13
- **Status:** Active

## Desktop-First UI/UX Overhaul & Visual System Unification
- **Fact/Decision:** Executed a cohesive desktop-first UI/UX overhaul across all views:
  1. Replaced rising amber particles and per-frame film grain loops in `BackgroundEffect.tsx` with a calm static CSS radial gradient backdrop.
  2. Expanded app containers to `max-w-7xl` with balanced 2-column desktop layouts (`GeneratorForm.tsx`, `ResultsView.tsx` with sticky right-side Beat Inspector `#desktop-beat-inspector` + Prev/Next stepping, and `LegalViews.tsx` with sticky sidebar navigation).
  3. Removed orphaned `HelpGuideModal.tsx`, consolidated Help & Guide into `LegalViews.tsx`, added direct `Help & Guide` and `API Keys` desktop header links, decluttered toolbars, and wired `StyleAndCharactersSection.tsx` to `Style & Cast`.
  4. Upgraded BYOK Security in `LegalViews.tsx` to manage both Google Gemini and Groq Cloud keys with show/hide eye toggles, and updated Help & Guide, Privacy, and Terms to reflect both providers, `4s` Video clip alignment, and `sessionStorage`/`localStorage` usage.
  5. Added live search and `All | Image | Video` mode filters to `HistoryModal.tsx`.
  6. Enforced unified obsidian + subtle amber/emerald styling: zero `rounded-full` pills, zero `purple-*` accents, Title Case buttons, and zero em/en dashes.
- **Context:** Eliminates visual motion distractions, cramped single-column layouts on PC/wide screens, duplicate guide surfaces, and design-system inconsistencies while preserving all 168 automated tests and functional IDs.
- **Date:** 2026-11-13
- **Status:** Active

## Gemini 4 Hydrogen Upgrade, Thinking-Part Safe Extraction & Version v3.7
- **Fact/Decision:** Replaced invalid `gemini-3.8-flash` references with `gemini-4-hydrogen` across all Gemini REST services (`unifiedAiService.ts`, `assistantChatService.ts`, `stage1StoryBible.ts`, `stage2BeatPlan.ts`, `stage3PromptWriter.ts`, `stage4VerifyRepair.ts`) and UI/documentation (`GeneratorForm.tsx`, `LegalViews.tsx`, `ApiKeyContext.tsx`, `README.md`), omitted deprecated `temperature` / `topP` parameters on `gemini-4-hydrogen`, added `extractGeminiResponseText` to filter out internal `thought` parts before JSON parsing, stopped `retryFetch.ts` from retrying user `AbortError` cancellations, and bumped project version from `3.6.0` (`v3.6`) to `3.7.0` (`v3.7`). Kept client-side BYOK architecture per user decision.
- **Context:** Resolves the root causes of Gemini storyboard breakdowns returning errors or server-busy failures (`gemini-3.8-flash` 404/unsupported model errors, thinking-model `parts[0]` JSON corruption, and Gemini 4 deprecated sampling rejections).
- **Date:** 2026-11-13
- **Status:** Active

## Removal of "Editing Note: Scene Transition Anchor" Clutter
- **Fact/Decision:** Removed the `Editing Note: Scene Transition Anchor` / `EDITING TRANSITION NOTE` UI blocks (`BeatBottomSheet.tsx`, `ResultsView.tsx`, `CustomBeatEditor.tsx`), removed the `Editing Note` column from Markdown and CSV exports (`ResultsView.tsx`), stopped requesting `transitionHint` in LLM prompt schemas (`geminiClient.ts`, `enhanceStoryArchitect.ts`), and updated `populateSceneTransitionHints` (`beatSplitting.ts`) and `normalizeStoryboardForDisplay` (`beatProgressionEngine.ts`) to clear `transitionHint` to `undefined`.
- **Context:** Synthetic transition anchor boilerplate cramped every boundary beat in the UI inspector, bottom sheet, and shot-list tables without adding actionable visual value.
- **Date:** 2026-11-13
- **Status:** Active

## Standard Mode Verbatim Script Lock & Prompt Quality Fixes
- **Fact/Decision:** Locked Standard Mode (`autoArchitectMode` OFF in `geminiClient.ts`) to keep user narration strictly verbatim without expanding short scripts (e.g., 20 input words remain 20 spoken words), leaving script expansion exclusively to Enhance Story mode (`enhanceStoryArchitect.ts`), with clarified input copy in `GeneratorForm.tsx`. Additionally fixed orphaned orientation prepositions (`in a from a`), prevented `isMonochromeStyle` from false-triggering on full-color palettes mentioning B&W props, blocked cartographic map overrides on fictional hyphenated cities (`Neo-Seoul`), added visible-surface / named-object fidelity rules, compacted repeated beat `Visual Style:` suffixes, and formatted generic sheet keys (`Photographer` -> `the photographer`) in CTA/Thumbnail prompts (`promptCompiler.ts`).
- **Context:** Prevents unexpected narration inflation in Standard Mode and fixes the phrasing, color, and map regressions spotted in test outputs.
- **Date:** 2026-11-14
- **Status:** Active

## Contextual Target Duration Visibility (Option 1)
- **Fact/Decision:** In `GeneratorForm.tsx`, hid `Target Duration` in `Text to Image` mode when `Enhance Story` (`autoArchitectMode`) is OFF (submitting `durationMode = 'automatic'` and `durationSeconds = undefined` without custom-duration validation), while keeping `Target Duration` visible when `Enhance Story` is ON and keeping `Clip Duration` always visible in `Text to Video` mode. Also removed `(Optional)` beside `Character & Visual Style` (`GeneratorForm.tsx`) and removed the icon on the `AI Assistant` header button (`Header.tsx`) per explicit user request.
- **Context:** Standard Image Mode preserves user narration verbatim, so showing a Target Duration picker when Enhance Story is OFF implied length control that did not occur.
- **Date:** 2026-11-14
- **Status:** Active

## Full Canonical First-Appearance Character Locks & Minimal Header/Results Toolbar
- **Fact/Decision:**
  1. Removed `Help & Guide` and `API Keys` navigation links from the top `Header.tsx` bar on desktop/laptop screens (`Footer.tsx` still provides both routes), and hid the `Style & Cast` toolbar button (`#open-style-cast-btn`) across all screen sizes in `ResultsView.tsx` while preserving underlying `styleProfile`, `characterSheet`, `locationSheet`, Thumbnail, CTA, and Markdown/JSON continuity exports.
  2. Implemented `synchronizeCharacterSheetWithFirstAppearances` (`beatProgressionEngine.ts`) paired with `CHARACTER_ANCHOR_MAX_WORDS = 40` and `STYLE_ANCHOR_MAX_WORDS = 28` so distinctive face/eyewear/wardrobe details (such as wire-rimmed spectacles, suits, sweaters, and ties) established in first appearances or continuity sheets persist verbatim across every character beat and Thumbnail without 18-word truncation or action leakage.
- **Context:** Resolves clipped character eyewear/clothing across beats, eliminates redundant top-bar chrome on laptops, and ensures every copied beat prompt is self-contained without needing the `Style & Cast` modal.
- **Date:** 2026-11-19
- **Status:** Active

## Text-to-Video Completeness, Thumbnail Schema, Font Routing & Prompt Sanitation
- **Fact/Decision:**
  1. Added the `"thumbnail"` schema object directly inside Text-to-Video JSON schemas (`geminiClient.ts`, `enhanceStoryArchitect.ts`) and replaced loose `.includes('future')` matching in `inferStoryAdaptiveFont` (`promptCompiler.ts`) with whole-word boundaries plus dedicated finance/mortgage and diorama/miniature branches so `"future income stream"` never triggers cyberpunk neon thumbnails.
  2. Implemented `findUncoveredTrailingScript` (`beatProgressionEngine.ts`) paired with 2-pass multi-batch auto-continuation (`geminiClient.ts`, `enhanceStoryArchitect.ts`) and a visible `#script-coverage-warning` alert in `ResultsView.tsx` so long Text-to-Video scripts never silently truncate at mid-story token limits.
  3. Added `sanitizeMasterVideoPrompt` and `enrichStartFramePrompt` (`beatProgressionEngine.ts`) to remove post-`Duration:` style/lighting dumps, double `Lighting:` blocks, and `..` double periods while guaranteeing locked eyewear/wardrobe anchors, consistent lighting Kelvin, and zero audio directives on start frames.
  4. Hardened `injectCompactCharacterLocks` against prop-only close-ups (`bodyHasPersonOrSingularPronoun`), formatted possessive fallbacks cleanly (`Featuring X (...)`), stripped inline duplicate `9:16 vertical` / `16:9 widescreen` tails, synced late Video framing directives to `shotType`/`cameraAngle`, scrubbed `"neutral facial features"` and stance boilerplate, and enforced currency fidelity (no unrequested `₱`), recurring cast sheets, and grounded VFX rules.
- **Context:** Eliminates the 55% script cutoff, fallback `"SURVIVE"` neon thumbnail, prop close-up character leakage, double periods, and expression/stance bloat surfaced in the 4-second Text-to-Video diorama export audit.
- **Date:** 2026-11-19
- **Status:** Active

## Google Flow Video Beat Streamlining (Option 2) & Video Export Hygiene
- **Fact/Decision:** Removed per-scene `videoPrompt` and `startFramePrompt` generation from AI Text-to-Video pipelines (`geminiClient.ts`, `enhanceStoryArchitect.ts`), Beat Inspector UI, and CSV/Markdown exports (`ResultsView.tsx`), preserving `scriptParser.ts` for pre-written manuscript ingestion. Made every Video Beat prompt (`Video Beat Prompt` / `Visual Video Prompt`) standalone for direct Google Flow usage, blocked material nouns (`brass`, `amber`, `resin`) from triggering character aliases, deduplicated `Whip-Pan` framing openers, prioritized explicit `-angle` tags over `overhead` prop nouns, stripped hero pronoun/wardrobe sentences from shared `styleProfile.artStyle` via `sanitizeSharedVisualStyle`, and expanded Finance CTA rules to capture banking deposit/structuring stories.
- **Context:** Eliminates redundant per-scene token bloat and generation latency for creators generating individual beats directly in Google Flow while resolving all 5 defects identified in the Text-to-Video Markdown audit.
- **Date:** 2026-11-19
- **Status:** Active

## Long-Form 16:9 Batch Speed Optimization & Per-Batch Checkpointing
- **Fact/Decision:** Added local checkpoint persistence (`src/services/groundedCheckpoint.ts`) saving Stage 1 Story Bible, Stage 2 Beat Plan, and completed scene batches in `localStorage`, surfaced a `Resume Breakdown` / `Start Fresh` banner in `ResultsErrorView.tsx` (`App.tsx`), batched Stage 3 writing to 4 scenes per LLM call (`stage3WriteScenePromptsBatch`), skipped redundant LLM critic passes when all 7 deterministic Stage 4 checks pass, and added story-specific `thumbnailHook` extraction in `stage1StoryBible.ts`.
- **Context:** Prevents 50-80 sequential API calls (~9 minute runs) from hitting Free Tier throttling on 500+ word Long-Form scripts and guarantees transient "model is busy" failures resume directly from the next incomplete scene instead of restarting from Scene 1.
- **Date:** 2026-11-19
- **Status:** Active

## Option B Image Phrase Cuts, Pipeline Speedup, Progressive Scenes & AI Usage Footer
- **Fact/Decision:**
  1. Implemented **Option B Always-On Phrase-Level Visual Segmentation (2 to 6 words per beat)** exclusively for **Text to Image** across Short Form (9:16) and Long Form (16:9) in `beatSplitting.ts`, `beatProgressionEngine.ts`, `stage2BeatPlan.ts`, `stage4VerifyRepair.ts`, `geminiClient.ts`, and `enhanceStoryArchitect.ts`, preventing bare stranded articles/prepositions (`"with a"`, `"of the"`) and fixing doubled framing openers (`eye-level of eye-level`, `Wide eye-level`). Kept **Text to Video** behavior untouched.
  2. Accelerated breakdown latency via `thinkingLevel: 'minimal'` on structured JSON calls (`'low'` on Stage 1 Story Bible) with automatic HTTP 400 fallback, 35-60 word Token Diet prompts, 2 concurrent Stage 3 batches per wave (`SCENE_BATCH_SIZE = 3`) in `groundedPipeline.ts`, and `0.45s` min dwell allowance in Image Phrase Cut verification so short phrases avoid unnecessary LLM repairs.
  3. Implemented Progressive Scene-by-Scene Results Display (`unifiedAiService.ts` SSE `streamJsonLlmWithSceneProgress` / `extractCompletedStoryboardFields`, `groundedPipeline.ts`, `App.tsx`, `ResultsView.tsx`), showing completed scenes immediately as they finish without rendering unfinished scenes, with a compact live banner and `Stop Generation` button while preserving active beat selection.
  4. Added persistent Real AI Token Usage tracking (`aiUsageStorage.ts`, wired across `geminiClient.ts`, `groqClient.ts`, `unifiedAiService.ts`, and `assistantChatService.ts`) surfaced via a clean `AI Usage` footer button (`Footer.tsx`, `#footer-ai-usage-btn`) navigating to a dedicated standalone `AiUsageView.tsx` page (`activePage === 'ai-usage'`) displaying Current Session, Today, All Time, token mix bar, per-model breakdown (`byModel`), and `Reset Usage` confirmation.
- **Context:** Eliminates multi-minute waiting before inspecting Scene 1, cuts `gemini-4-hydrogen` latency dramatically, achieves granular 2-6 word image storytelling with clean camera diversity, and gives creators transparent token usage telemetry without cluttering the footer.
- **Date:** 2026-11-20
- **Status:** Active

## Scene 2 Interactive Continue Confirmation Gate (Option B)
- **Fact/Decision:** Implemented an interactive Scene 2 confirmation gate across both Short Form and Long Form pipelines (`groundedPipeline.ts`, `enhanceStoryArchitect.ts`, `geminiClient.ts`, `App.tsx`, `ResultsView.tsx`, and `types.ts`).
- **Context:** Temporarily allowed early inspection after Scene 2, but caused UX friction when combined with streaming; superseded by removal since `Stop Generation` lets creators cancel anytime.
- **Date:** 2026-11-20
- **Status:** Outdated (Superseded by Removal & True Beat-by-Beat Sequential Streaming on 2026-11-20)

## SSE Scene-First Streaming, Hard Scene 2 Gate & Virelia Prompt Quality Fixes (Suite 35)
- **Fact/Decision:**
  1. **True Scene-by-Scene Streaming (`unifiedAiService.ts`, `groundedPipeline.ts`):** Removed the `styleProfile || characterSheet` blocking condition inside `emitProgressIfReady()` so Scene 1 renders immediately when completed in SSE chunks regardless of key ordering; added `thinkingLevel` step-down retry (`minimal -> low -> none`) on HTTP 400 and capped `gemini-3.1-pro-preview` thinking tokens (`'low'` default) to eliminate 2-minute stalls.
  2. **Virelia Prompt Hygiene (`beatProgressionEngine.ts`, `promptCompiler.ts`):** Pruned back-to-back appositive trait clones right after `Character (anchor)` while preserving action clauses; stripped plural `cheeks?`, `freckles?`, and `carrying a ...` clauses from tight hand close-ups; scrubbed plot/flashback transition clauses even from single-sentence shared `artStyle`; stripped continuity age prefixes (`Adult `, `Young `, `Elder `) from CTA intrigue questions while retaining visual lock keys.
- **Context:** Resolved SSE key-ordering blockers, thinking overhead, and Virelia prompt quality defects (`225/225` tests passing). Scene 2 gate portion was later removed on 2026-11-20.
- **Date:** 2026-11-20
- **Status:** Active (Prompt Hygiene Active; Scene 2 Gate Removed)

## Sequential Production Workflow: Story Bible First -> Beat-by-Beat Streaming -> Deferred Thumbnail & CTA (Suite 36)
- **Fact/Decision:**
  1. **Removed Scene 2 Continue Confirmation Gate:** Deleted `OnConfirmContinueCallback`, `awaitingContinueConfirmation`, Yes/No prompt banner, and Scene 2 pilot caps across `types.ts`, `App.tsx`, `ResultsView.tsx`, `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `groundedPipeline.ts`. Users can cancel anytime via `Stop Generation`.
  2. **Step 1 Story Bible First (~3-5s):** Both Standard (`geminiClient.ts`), Enhance Story (`enhanceStoryArchitect.ts`), and Long Form (`stage1StoryBible.ts` + `groundedPipeline.ts`) lock `styleProfile`, `characterSheet`, and `locationSheet` (plus `hookAnalysis` and `scriptOutline` in Enhance Mode) first with `thinkingLevel: 'minimal'`, immediately exiting `ResultsSkeleton` to display the locked Story Bible panel while waiting for Beat 1.
  3. **Step 2 True Beat-by-Beat SSE Streaming:** Upgraded `extractCompletedStoryboardFields` and `streamJsonLlmWithSceneProgress` (`unifiedAiService.ts`) to extract closed beats inside open unclosed scenes and Stage 3 `"prompts"` incrementally; removed 6-scene concurrent blocking waves in `groundedPipeline.ts` (using sequential 2-scene streaming batches via `stage3PromptWriter.ts`) and skipped blocking post-stream LLM repair calls (`skipLlmRepair = true`).
  4. **Step 3 Deferred Thumbnail & CTA:** Thumbnail generation runs as a lean final step only after all scenes complete, and Thumbnail Cover Card, CTA Outro Card, Jump buttons, Full Script, and bottom Export Bar stay hidden inside `ResultsView.tsx` until `!isGeneratingMore && normalizedScenes.length > 0`.
- **Context:** Eliminates 2-minute skeleton waits even on 50-word scripts, prevents premature Thumbnail/CTA generation before scenes finish, and ensures `Story Bible -> Scene 1 Beat 1 -> Beat 2 -> ... -> Thumbnail & CTA` renders sequentially in real time.
- **Date:** 2026-11-20
- **Status:** Active

