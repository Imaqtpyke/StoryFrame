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

- [x] **Smart Script Auto-Detection & Uncluttered Textarea Ingestion:**
  - Removed "Ingest Manuscript" and "Upload File" buttons from `GeneratorForm.tsx` to eliminate UI cramping.
  - Removed obsolete `ManuscriptIngestModal.tsx`.
  - Built real-time smart auto-detection for structured scripts in the story textarea (`Script Detected: X clips`).
  - Added zero-token deterministic ingestion directly from the main Generate button for structured manuscripts, with standard generation preserved for normal prose.
  - Decoupled hardcoded demo story ("The One Who Doesn't Belong") in favor of dynamic title extraction from pasted scripts and results.
  - Verified with 121 automated system tests passing (100%), clean TypeScript check, and clean build.
- [x] **Modality Header, Kinetic Verb Sanitizer, Style Decoupling & Visual Information Budget:**
  - Added explicit modality declarations (`Generate a single still image of:` vs `Generate a continuous video clip of:`) and static frozen-frame negative prompts in `src/services/promptCompiler.ts`.
  - Implemented `sanitizeKineticMotionForImage` converting kinetic process verbs (`swirl above`, `flickers`, `churns`, `streaming`) into frozen visual moments to prevent Gemini/diffusion router modality confusion.
  - Implemented `resolveStyleAndCastingCompatibility` stripping animal/character clauses when a scene has no characters or is an empty environment.
  - Enforced Visual Information Budget & Reveal Discipline in `geminiClient.ts` and `enhanceStoryArchitect.ts` to ensure setup beats strictly withhold future destinations (e.g. harbor withheld until reveal beat).
  - Added linter rules L07 (Style vs Casting Contradiction) and L08 (Premature Information Leakage) to `lintStoryboard`.
  - Expanded test suite to 128 automated system tests in `src/tests/systemTestSuite.ts` (100% passing).
  - Verified clean `tsc --noEmit` and successful production build.
- [x] **Geographic Demonym Entity Isolation & Cartographic Visual Anchors:**
  - Implemented `extractGeographicAnchor`, `GEOGRAPHIC_DICTIONARY`, and `generateCartographicPrompt` in `src/services/beatSplitting.ts`.
  - Implemented `isolateAnchorsAndEntities` to ensure phrases like "In 1896 Swedish scientist Svante Arrhenius" reliably partition into 3 distinct beats: Beat 1 ("In 1896"), Beat 2 ("Swedish"), and Beat 3 ("scientist Svante Arrhenius").
  - Automated cartographic visual prompt generation in `enforceBeatCeilings` featuring tactile rotating globes, glowing boundary lines, dropped location pins, and national flags with characters strictly excluded.
  - Added Geographic Demonym & Cartographic Anchor schema rules to `geminiClient.ts` and `enhanceStoryArchitect.ts`.
  - Added Rule L09 (Geographic Cartographic Focus Check) to `lintStoryboard` in `src/services/promptCompiler.ts`.
  - Added Suite 14 test cases; verified with 137 automated system tests passing (100%).
  - Verified clean type check (`tsc --noEmit`) and successful build compilation.

- [x] **Assistant Response Versatility, Strict Question Discipline & Minimized Action Buttons:**
  - Upgraded `SYSTEM_INSTRUCTION` in `src/services/assistantChatService.ts` to accommodate every possible phrasing pattern for style and genre changes (documentary, cinema, horror, cyberpunk, anime, claymation, and viral shorts).
  - Enforced strict question-answering discipline: direct answers to the exact question asked without unsolicited extra information or background fluff.
  - Eliminated conversational filler to save free-tier tokens.
  - Excluded tool buttons (edit, copy, stars) from inside the message container so only message text resides within the bubble.
  - Reverted icon tool sizes back to touch-friendly dimensions (`w-3.5 h-3.5`, `p-1.5`) placed directly underneath each bubble for effortless tapping on mobile screens.
  - Retained clean icon-only display with the words "Edit" and "Copy" completely removed.
  - Verified clean applet compilation and all 137 tests passing in `src/tests/systemTestSuite.ts`.

- [x] **Production Cover & Thumbnail Blueprint Engine:**
  - Built `inferStoryAdaptiveFont` adapting font styling dynamically to story genre and character style (e.g. distressed weathered stencil for zombie/horror, futuristic neon for cyberpunk, archaic gothic serif for dark fantasy, editorial broadsheet for documentary, cartoon bubble for rubber hose).
  - Built `compileThumbnailPrompt` in `src/services/promptCompiler.ts` compiling high-CTR prompts with platform safe zones (16:9 YouTube timestamp clearance vs 9:16 Shorts UI overlay clearance) and character identity locks.
  - Generates both full production prompt with exact quoted headline (<= 4 words in ALL CAPS) and clean plate prompt for external graphic design (Canva/Photoshop).
  - Integrated into all generation pipelines (`geminiClient.ts`, `groundedPipeline.ts`, `enhanceStoryArchitect.ts`, `scriptParser.ts`).
  - Added dedicated `ThumbnailCard` in `src/components/ResultsView.tsx` situated between the final scene and the Complete Narrator Script, with top bar quick jump button.
  - Added Suite 15 automated test cases; verified with 150 automated system tests passing (100%) and clean compilation.

- [x] **Bugfix: Resolved ReferenceError for selectedTargetModel:**
  - Removed lingering references to `selectedTargetModel` in `ResultsView.tsx` (in `handleCopyAllPrompts`, the batch copy tooltip, and the `BeatBottomSheet` invocation).
  - Cleaned up obsolete target model selector dropdown and icon import in `ResultsView.tsx`.
  - Updated `BeatBottomSheet.tsx` to compile directly with the universal model and removed obsolete external model badges.
  - Verified clean TypeScript validation (`tsc --noEmit`) and successful applet compilation with zero errors.

- [x] **Collapsible Thumbnail & Story-Adaptive CTA Visual Prompt Engine:**
  - Made Production Cover & Hero Thumbnail collapsible in `ResultsView.tsx` with a compact 1-line hook badge when collapsed and an always-accessible "Copy Prompt" button.
  - Implemented story-adaptive Call-to-Action (CTA) Outro engine in `src/services/promptCompiler.ts` and `src/components/ResultsView.tsx`:
    - Generates compelling dilemma and curiosity questions directly grounded in the narrative conflict to maximize comments and viral retention.
    - Added 1-click alternate questions and custom question editing tools.
    - Implemented multi-platform safe-zone presets (TikTok, YouTube Shorts, General Multi-Platform).
    - Dual modality support: Text-to-Video (3-second kinetic ambient loop) and Text-to-Image (closing freeze frame).
    - Dual overlay support: Full prompt with typography and action badges vs clean plate prompt for external editors in CapCut/Premiere.
    - Integrated CTA and Thumbnail into JSON and Markdown production exports.
    - Verified clean TypeScript compilation (`npm run build` and `tsc --noEmit`) with 0 errors.

## Next Steps / Active Tasks
- Monitor user feedback on prompt generation pacing and model outputs.

- [x] **AI Assistant Top Nav Integration, Beat/Thumbnail/CTA Prompt Revision Engine & 403 Forbidden Page:**
  - Relocated floating assistant star icon into an "AI Assistant" text button in the top navigation bar beside "History" in `Header.tsx`, removing the floating button.
  - Added live context connection: displays `Context: Connected: [Story Title]` with scene and beat count when a story is active or loaded from history, and `Context: General Creative Co-Pilot` on the home page.
  - Implemented Rule 8 Beat, Thumbnail & CTA Prompt Revision Engine (Anti-Duplication Protocol) in `assistantChatService.ts` and `AssistantChatDrawer.tsx` supporting `[REVISE_BEAT scene=X beat=Y]`, `[REVISE_THUMBNAIL]`, and `[REVISE_CTA]` with interactive one-click "Apply to Storyboard", "Undo Change", and "Copy Prompt" actions.
  - Added `updateHistoryResult` in `historyStorage.ts` ensuring live updates to storyboard prompts persist into local history.
  - Removed detached "Recommended Negative Prompt" container from `BeatBottomSheet.tsx`.
  - Created `Forbidden403View.tsx` with self-service authorization checklist for Google Generative Language API permissions and referrer restrictions, wired to `ActivePage === 'error-403'` and 403 error detection.
  - Verified clean TypeScript compilation and production build.
- [x] **Kinematic Beat Progression, True Deduplication & Character Sheet Purity:**
  - Deleted legacy variation-prefix table ("The altered environment.", "Emphasizing grounded scale.", etc.) and blind camera label rotation from `enforceBeatToBeatProgression`.
  - Implemented true semantic deduplication in `geminiClient.ts` (`calculatePromptSimilarity`): consecutive beats >= 55% similarity merge if combined duration <= 2.8s; if > 2.8s, the second beat dynamically pivots to an interior POV, reverse reaction, or macro detail without fake prefixes.
  - Raised `MAX_BEAT_WORDS` from 5 to 10 and `MAX_BEAT_SECONDS` to 2.4s in `beatSplitting.ts`, and prevented subdivision of beats that already have rich AI prompts.
  - Added `sanitizeCharacterIdentitySheet` to strip frozen poses and props-in-hand from global character sheets so they do not contaminate unrelated scenes.
  - Added `assembleCleanPrompt` to guarantee clean orientation and exactly one `--ar` parameter, and guarded against degenerate prompts (e.g. "Extreme.").
  - Synchronized scene duration math to equal the sum of beat durations in state and Markdown export tables.
  - Verified clean compilation with `tsc --noEmit` and production build with `compile_applet`.
- [x] **Visual-Event Beat Pacing (Option A), 100% Narration Coverage, Clone Prevention & Metadata Synchronization:**
  - Created `src/services/beatProgressionEngine.ts` implementing Option A Visual-Event Pacing (~1.5s-3.0s per visual event), merging short connective filler fragments instead of generating duplicate stub beats.
  - Added `verifyAndRepairSceneNarrationCoverage` guaranteeing 100% word-for-word coverage of `scene.narratorLine` across `scene.beats[].textSpan` and recovering truncated trailing clauses.
  - Implemented scene-wide intra-scene clone detection (`deduplicateAndProgressSceneBeats`), eliminating adjacent and non-adjacent A-B-A-B clones as well as legacy placeholder templates.
  - Implemented Option A compact locked character identity injection (`injectCompactCharacterLocks`) across all character-present and pronoun beats while keeping character-free cartographic beats untouched.
  - Implemented `synchronizeBeatMetadataWithPrompt`, `formatFinalBeatPrompt`, and enhanced `assembleCleanPrompt` so orientation prefixes never double up regardless of punctuation and `shotType`/`cameraAngle` metadata match the prompt opening 1-for-1.
  - Added `sanitizeFakePrecisionMath` (removing robotic weight percentages and joint degree angles) and `sanitizeEraBleedAcrossScenes` (preventing modern/futuristic scenery from leaking into historical scenes).
  - Updated `ResultsView.tsx` to use `normalizeStoryboardForDisplay` instead of re-chopping merged beats into clones, and added Linter rules L10, L11, and L12 in `promptCompiler.ts`.
  - Expanded automated system test suite to 156 tests in `src/tests/systemTestSuite.ts` (all 156 passing).
- [x] **Monochrome Lock, Twist Preservation, Expression-Free Sheets, Entity Expansion & Mirror CTA:**
  - Eliminated spoken-text fallback interpolation (`"turning point of"`, `"escalating stakes of"`) and enforced chronological twist & negation discipline across `beatProgressionEngine.ts`, `geminiClient.ts`, and `enhanceStoryArchitect.ts`.
  - Added `stripTransientExpressionsAndPoses`, phrase-boundary compaction in `buildCompactCharacterAnchor`, `expandEntityKeysInPrompt` (`DarkRoom`, `Protagonist`), footwear harmonization (`barefoot`), and `sanitizeStillImageMotionAndOptics` (`35mm 35mm`, `..`, still-image `tracking left to reveal` & phantom audio cleanup).
  - Added `isMonochromeStyle` and `sanitizeMonochromeLighting` stripping chromatic Kelvin (`3200K warm`, `cold 5400K`) and hues (`cold cyan`, `amber`) from monochrome/B&W manga beats, Thumbnails, and CTAs.
  - Separated framing `shotType` (OTS/POV/Medium Close-Up/Close-Up) from vertical/tilt `cameraAngle` cleanly in `synchronizeBeatMetadataWithPrompt` and added L12/L13 checks in `lintStoryboard` (wired with `result.styleProfile` in `ResultsView.tsx`).
  - Upgraded `inferStoryAdaptiveCtaQuestion` to catch mirror/supernatural horror ahead of incidental `"lie"` words and cleaned universal `--ar` flags in `compileCtaPrompt` without legacy `--style raw --v 6.1`.
  - Expanded test suite with Suite 19 in `src/tests/systemTestSuite.ts` (162/162 passing).
- [x] **Action-Triplet Montage, Semantic Crib Flashback Decomposition & Dense 8-Word Auditor:**
  - Implemented `isInfancyOrChildhoodFlashback`, `extractMontageFocalCategory`, `isIntentionalMontageOrSemanticBeat`, `hasDistinctMontageFocalSubject`, and `detectUnsplitDenseBeatPattern` in `src/services/beatProgressionEngine.ts` with a `0.7s` montage duration floor (`MONTAGE_MIN_SECONDS`).
  - Updated `deduplicateAndProgressSceneBeats` (Pass 2 & Pass 3) and `lintStoryboard` Rule L10 (`promptCompiler.ts`) to preserve distinct montage triplets (`every blink / every breath / every move`), semantic flashbacks (`It's an entity / that has studied / you since birth`), repeated negations (`You never reach out. / You never cross.`), and separated climax turns (`half-second late / Now it's smiling / And you never smiled`) while continuing to merge plain grammar stubs.
  - Added infancy flashback shield in `injectCompactCharacterLocks`, `geminiClient.ts` continuity appenders, `buildContextPreservingProgressionBeat`, and `verifyAndRepairSceneNarrationCoverage` so adult clothes (`turtleneck`, `dark jeans`) and present-day `locationSheet` rooms (`DarkRoom`) never bleed into baby-in-crib shots.
  - Updated Image/Video prompts in `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `runTwoPhaseProgressionAndRepair` to lock recurring entities in `characterSheet`, keep stalking protagonists facing forward unaware, freeze montage states in Image Mode, and withhold late lag/smile reveals.
  - Added Test Suite 20 in `src/tests/systemTestSuite.ts` (165 total tests).
- [x] **Text-to-Video 4s Clip Duration Alignment & Multi-Clip Spill (Video Mode Only):**
  - Added `scaleBeatsToTargetDuration` and passed `targetVideoDuration` through `runTwoPhaseProgressionAndRepair` (`src/services/beatProgressionEngine.ts`) so Video Mode sub-beats sum cleanly to `targetVideoDuration` (`4.0s`), `scene.estimatedSeconds` stays locked, `videoPrompt` duration syncs post-repair, and `normalizeStoryboardForDisplay` preserves exact clip-sum alignment.
  - Updated Video Mode prompts in `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `runTwoPhaseProgressionAndRepair` to enforce spoken word budgets per clip and spill combined flashback + montage sentences across sequential clips while keeping Text-to-Image mode completely isolated.
  - Added Test Suite 21 in `src/tests/systemTestSuite.ts` (168 / 168 tests passing).
- [x] **Full UI/UX Overhaul & Wide-Screen Desktop Architecture:**
  - Replaced animated rising particles and canvas film grain in `BackgroundEffect.tsx` with a static radial gradient backdrop.
  - Widened containers to `max-w-7xl` and implemented 2-column desktop layouts across Home (`GeneratorForm.tsx`), Results (`ResultsView.tsx` with sticky Beat Inspector + mobile `BeatBottomSheet`), and Guide/BYOK/Legal pages (`LegalViews.tsx`).
  - Removed dead `HelpGuideModal.tsx`, added direct `Help & Guide` and `API Keys` links in `Header.tsx`, wired `StyleAndCharactersSection` to `Style & Cast`, and decluttered toolbars.
  - Added dual-provider BYOK management (Google Gemini + Groq Cloud with eye toggle), updated Guide/Privacy/Terms copy, and added live search + `All | Image | Video` filtering to `HistoryModal.tsx`.
  - Unified obsidian + subtle amber/emerald palette, Title Case buttons, zero `rounded-full` pills, zero `purple-*` accents, and zero em/en dashes across all components (`168/168` tests, `tsc --noEmit`, and `npm run build` passing).
- [x] **Gemini 4 Hydrogen Upgrade & Project Version v3.7:**
  - Replaced `gemini-3.8-flash` with `gemini-4-hydrogen` across all generation, grounded pipeline stages, assistant chat, UI selectors, and Help & Guide copy.
  - Omitted deprecated `temperature`/`topP` on `gemini-4-hydrogen`, added `extractGeminiResponseText` to skip `thought` parts when parsing JSON, fixed `AbortError` handling in `retryFetch.ts`, and added clearer 400/404 diagnostics.
  - Updated project version from `3.6.0` (`v3.6`) to `3.7.0` (`v3.7`) in `package.json`, `Footer.tsx`, and `LegalViews.tsx`.
- [x] **Remove "Editing Note: Scene Transition Anchor" Cramping Beats:**
  - Removed the `Editing Note` pill badge and `Editing Note: Scene Transition Anchor` panel from `BeatBottomSheet.tsx`, the `EDITING TRANSITION NOTE` card from `ResultsView.tsx`, and the optional field from `CustomBeatEditor.tsx`.
  - Removed the `Editing Note` column from CSV and Markdown shot-list exports in `ResultsView.tsx`.
  - Stopped generating or requesting `transitionHint` boilerplate in `beatSplitting.ts` (`populateSceneTransitionHints`), `beatProgressionEngine.ts`, `geminiClient.ts`, and `enhanceStoryArchitect.ts`.
- [x] **Standard Mode Verbatim Script Lock & Neo-Noir Prompt Hygiene Fixes:**
  - Locked Standard Mode (`geminiClient.ts` + `beatProgressionEngine.ts` + `GeneratorForm.tsx`) to preserve exact user narration words with zero expansion, reserving expansion exclusively for Enhance Story Mode.
  - Cleaned dangling prepositions around stripped orientation strings (`in a from a`), refined `isMonochromeStyle` against full-color palettes with B&W props, guarded `extractGeographicAnchor` against fictional hyphenated settings (`Neo-Seoul`), added visible-surface fidelity rules, trimmed repeated `Visual Style:` suffixes, and formatted generic CTA/Thumbnail character keys cleanly (`the photographer`).
  - Added Test Suite 22 in `src/tests/systemTestSuite.ts` covering all regression guards.
- [x] **Contextual Target Duration & UI Header Cleanup:**
  - Removed `(Optional)` beside `Character & Visual Style` (`GeneratorForm.tsx`) and removed the icon from the `AI Assistant` header button (`Header.tsx`).
  - Applied Option 1 for duration visibility (`GeneratorForm.tsx`): hid `Target Duration` in `Text to Image` when `Enhance Story` is OFF (defaulting cleanly to automatic word-count pacing), kept `Target Duration` when `Enhance Story` is ON, and kept `Clip Duration` always visible in `Text to Video`.

- [x] **Sci-Fi Stress Test Fixes (Suite 23, 175/175 passing):**
  - Scoped `injectCompactCharacterLocks` (`beatProgressionEngine.ts`) to support unambiguous first-name aliases (`Mira` -> `Mira Vale`), pronoun/plurality compatibility, and beat-level visual trait overlap so secondary antagonists (`Chrome-Faced Enforcers`) are never stamped onto solo protagonist beats.
  - Cleaned `compileThumbnailPrompt` (`promptCompiler.ts`) duplicate `"intense"`, `"rim light rim lighting"`, `"dark simplified background: Dark, simplified"`, and capitalized `Subject centered/positioned`.
  - Prioritized explicit binary dilemma extraction (`"Would you sell the truth or broadcast it?"`) and expanded Sci-Fi cues in `inferStoryAdaptiveCtaQuestion`, and stripped `"transitioning to..."` temporal wording from static CTA image lighting.
- [x] **Documentary Stress Test Fixes & Results Toolbar Cleanup (Suite 24, 177/177 passing):**
  - Updated `formatSheetSubjectName` & `formatCtaRoleName` (`promptCompiler.ts`) to split CamelCase/PascalCase continuity keys (`LeadSoftwareEngineer` -> `the lead software engineer`), and replaced PascalCase placeholder examples in `geminiClient.ts` & `enhanceStoryArchitect.ts` with spaced readable labels.
  - Added a dedicated Documentary / History / Real-Event CTA branch in `inferStoryAdaptiveCtaQuestion` (`promptCompiler.ts`) evaluated ahead of generic Sci-Fi/default fallbacks.
  - Hid the top-bar `Character Packets` button (`#open-ref-packets-header-btn` in `ResultsView.tsx`) while keeping `Style & Cast`, `CharacterReferenceModal`, `characterSheet` persistence, History, Thumbnail, CTA, and exports completely intact.

- [x] **Horror Stress Test Fixes (Suite 25, 179/179 passing):**
  - Added `normalizeContinuitySheetKeys` (`beatProgressionEngine.ts`, wired into `geminiClient.ts` and `enhanceStoryArchitect.ts` after prompt expansion) so smashed PascalCase sheet keys (`TheWomanBehindHer`, `LateMothersHouseParlor`) display cleanly as spaced human titles.
  - Added explicit foreground age-mismatch and Close-Up/ECU runner-up subject guards in `injectCompactCharacterLocks` (`beatProgressionEngine.ts`) so a background/younger protagonist (`Elara`) is never stamped onto a Close-Up of an older character (`The Woman Behind Her`).
  - Stripped trailing `[.!?]+` punctuation from `heroMoment` and `bgDescription` in `compileThumbnailPrompt` (`promptCompiler.ts`) to prevent `..` double periods.

- [x] **Stylized Art Stress Test Fixes (Suite 26):**
  - Preserved head noun when stripping `"crisp static frame of"` -> `"crisp view of"` in `sanitizeStillImageMotionAndOptics` (`beatProgressionEngine.ts`).
  - Made `COMMON_NOUN_CHARACTER_NAMES` matching case-sensitive in `injectCompactCharacterLocks` so lowercase visual words like `"scrambling ink limbs"` never expand into `"scrambling ink (...)"`.
  - Stripped `Visual Style:` and `--ar` before scanning visual trait tokens, required character/entity body subjects plus >=2 distinctive non-generic tokens (`GENERIC_VISUAL_TRAIT_WORDS`), and split hyphenated traits (`spiky-haired`) with a `0.5` coverage threshold to stop phantom style casts and redundant mid-sentence parentheses.

- [x] **Multi-Character + Flashbacks Stress Test Fixes (Suite 27):**
  - Added child vs. adult mutual exclusion, visual body gender compatibility, framing-pronoun plural bypass (`"As she reads, ... their shared summers"`), empty-headland/pier establishing detection, and broader generic scenery word filtering in `injectCompactCharacterLocks` (`beatProgressionEngine.ts`).
  - Added `sanitizeStyleForEra` (`beatProgressionEngine.ts`) and wired it into `formatFinalBeatPrompt`, `compileThumbnailPrompt`, and `compileCtaPrompt` (`promptCompiler.ts`) so dual-era art styles and lighting clauses stay scoped to present-day vs. flashback frames, and ensured consistent `Visual Style:` tags across all beats.
  - Expanded secondary character mentions (`Rowan` -> `Adult Rowan (...)`) inside Thumbnail `Visual Conflict` (`compileThumbnailPrompt`).
  - Prioritized emotional reunion / `"must decide whether"` dilemma detection ahead of loose `"truth"` mystery questions in `inferStoryAdaptiveCtaQuestion`.

- [x] **130-Word Mortgage Diorama Stress Test & Latency Hardening (Suite 28):**
  - Added `thinkingLevel` (`'low'` default / `'minimal'` for Phase-2 repair) in `unifiedAiService.ts` (`gemini-4-hydrogen`) with automatic 1-shot retry fallback if `thinkingConfig` is rejected, cutting multi-minute reasoning overhead on longer scripts.
  - Added `buildSharedContextIgnoreTokens` (`beatProgressionEngine.ts`) and wired it into `deduplicateAndProgressSceneBeats` and `auditScenesForRepair` so shared diorama/medium/location/cast tokens no longer cause false-positive duplicate flags or template overwrites.
  - Added cross-cast shared-medium token filtering (`sharedCastTokens`) and 50% `anchorTokens` inline coverage deduplication in `injectCompactCharacterLocks` to prevent secondary character leakage and redundant `Featuring ... (...)` parentheticals.
  - Fixed comma-before-lens punctuation, restricted connector auto-merges (`<= 2` words / `<= 1.8s`), cleaned duplicate fallback grammar (`inside A`, `of tight portrait study`, `. palette`), and stripped double periods (`..`) in `compileThumbnailPrompt` / `compileCtaPrompt`.
  - Scoped `isSciFiPremise` away from standalone `"future"` phrases like `"future income stream"` and added a dedicated Finance / Mortgage / Contract Trap CTA branch in `inferStoryAdaptiveCtaQuestion` (`promptCompiler.ts`).

- [x] **Canonical First-Appearance Eyewear/Outfit Locks, Persistent Style & Header/Results Declutter (Suite 29):**
  - Added `synchronizeCharacterSheetWithFirstAppearances` (`beatProgressionEngine.ts`, wired into `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `runTwoPhaseProgressionAndRepair`) to pull fixed facial/eyewear/wardrobe details established on a character's first appearance cleanly into their canonical lock without carrying over Scene 1 actions or leaking onto prop-only beats.
  - Raised character identity anchor limits from `18` (`16` in Thumbnail / `22` in Repair) to `40` words (`CHARACTER_ANCHOR_MAX_WORDS`) and required signature eyewear/garment matching (`spectacles`/`glasses`, `suit`, `sweater`, `tie`, etc.) before skipping locks, plus raised per-beat `Visual Style:` limit from `14` to `28`/`34` words (`STYLE_ANCHOR_MAX_WORDS`) and filtered full characterSheet wardrobe tokens in `lintStoryboard` L10 and `buildSharedContextIgnoreTokens`.
  - Removed `Help & Guide` and `API Keys` from the desktop/laptop `Header.tsx` navigation bar (both remain in `Footer.tsx`) and hid `#open-style-cast-btn` (`Style & Cast`) across all screen sizes in `ResultsView.tsx`.
- [x] **Text-to-Video Completeness, Thumbnail Schema, Font Fix & Prompt Sanitizers (Suite 30):**
  - Added `"thumbnail"` directly to the Text-to-Video JSON schemas (`geminiClient.ts` and `enhanceStoryArchitect.ts`) and fixed `inferStoryAdaptiveFont` (`promptCompiler.ts`) whole-word regex so `"future income stream"` routes to finance/diorama typography instead of cyberpunk neon.
  - Implemented `findUncoveredTrailingScript` (`beatProgressionEngine.ts`), 2-pass multi-batch auto-continuation (`geminiClient.ts`, `enhanceStoryArchitect.ts`), and `#script-coverage-warning` (`ResultsView.tsx`) to prevent mid-script Video JSON truncation.
  - Added `sanitizeMasterVideoPrompt` and `enrichStartFramePrompt` (`beatProgressionEngine.ts`) to eliminate post-`Duration:` style dumps, double `Lighting:` blocks, and `..` double periods, while scrubbing `"neutral facial features"` and stance boilerplate in `stripTransientExpressionsAndPoses`.
  - Fixed `injectCompactCharacterLocks` prop-only close-up leakage (`bodyHasPersonOrSingularPronoun`), possessive character fallback formatting, duplicate `9:16 vertical` / `16:9 widescreen` tails, late Video framing directive syncing, and contradictory mid-sentence shot-size tags.
  - Enforced currency fidelity (no unrequested `₱`), recurring cast inclusion, grounded physical VFX, and zero split-word text artifacts across Video prompts; verified with 203/203 passing tests in `src/tests/systemTestSuite.ts`.
- [x] **Detail Close-Up Lock Scoping, Image Motion Freeze & Thumbnail/CTA Grammar Polish (Suite 31):**
  - Scoped `injectCompactCharacterLocks` (`beatProgressionEngine.ts`) for tight hand/foot `Close-Up` and `Extreme Close-Up` shots so already-styled extremities do not receive unrelated hair/trousers/shoes injections, and sparse possessive close-ups receive extremity-filtered anchors.
  - Added frozen peak-action phrasing for fast motion adverbs (`unfurl dramatically`, `slide rapidly`, `compress shut`, `swing abruptly inward`) in `sanitizeStillImageMotionAndOptics` (`beatProgressionEngine.ts`) strictly when `!isVideoMode`.
  - Updated `compileThumbnailPrompt` and `compileCtaPrompt` (`promptCompiler.ts`) to remove unrequested `"Part 2 coming soon"` CTA hype, eliminate `"separation separating"` stutters, fix inline comma capitalization, and deduplicate redundant rim-light clauses; verified with 206/206 passing tests.
- [x] **Option 2 Text-to-Video Streamlining (Google Flow) & 5 Video Export Bug Fixes (Suite 32):**
  - Removed per-scene `videoPrompt` (`Scene Video Prompt`) and `startFramePrompt` (`Start Frame Keyframe (I2V Anchor)`) from Text-to-Video LLM schemas, post-processing (`geminiClient.ts`, `enhanceStoryArchitect.ts`), Beat Inspector UI, and CSV/Markdown exports (`ResultsView.tsx`), turning every Video Beat into a self-contained Google Flow prompt (`Video Beat Prompt` / `Visual Video Prompt`).
  - Added material/medium nouns (`brass`, `amber`, `resin`, `clay`, `porcelain`, `wool`, etc.) to `GENERIC_ALIAS_WORDS` and `GENERIC_VISUAL_TRAIT_WORDS` (`beatProgressionEngine.ts`) to prevent cast locks (`Brass Bank Clerk`, `Amber Resin Depositor`) from leaking onto brass scales or capsules.
  - Updated `synchronizeBeatMetadataWithPrompt` and `formatFinalBeatPrompt` (`beatProgressionEngine.ts`) to detect and deduplicate `Whip-Pan` framing prefixes and prioritize explicit `-angle` tags (`low-angle`, `high-angle`) over prop nouns (`overhead glass tube`).
  - Added `sanitizeSharedVisualStyle` (`beatProgressionEngine.ts`, wired across `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `promptCompiler.ts`) to strip hero pronoun/wardrobe sentences from shared `Visual Style:` blocks.
  - Expanded Finance CTA branch in `inferStoryAdaptiveCtaQuestion` (`promptCompiler.ts`) to route cash deposit & structuring scripts (`$9,900`, `structuring`, `frozen accounts`) to banking compliance questions ahead of Mystery (`secretly`).
- [x] **Long-Form 16:9 Checkpoint-Resume & Batched Stage 3/4 Speed Upgrade (Suite 33):**
  - Created `src/services/groundedCheckpoint.ts` persisting Stage 1 (`bible`), Stage 2 (`plannedScenes`), and completed `Stage 3/4` scene batches to `localStorage` (with Node.js test fallback and 24-hour TTL).
  - Added batched Stage 3 writing (`stage3WriteScenePromptsBatch`, 4 scenes per LLM call) in `src/services/stage3PromptWriter.ts` and skipped redundant LLM critic calls when all 7 deterministic Stage 4 checks pass (`src/services/stage4VerifyRepair.ts`), cutting ~50-80 sequential calls on 577-word scripts down to ~8-12 calls.
  - Added story-specific `thumbnailHook` output to Stage 1 (`stage1StoryBible.ts`) replacing the hardcoded `"THE UNTOLD STORY"` fallback in `groundedPipeline.ts`.
  - Updated `ResultsErrorView.tsx` and `App.tsx` to display saved scene progress (`X of Y scenes completed`) with `Resume Breakdown` and `Start Fresh` actions.
- [x] **Option B Image Phrase Cuts (2-6w), Speedup, Progressive Scene Results & AI Usage Footer (Suite 34, 219/219 passing):**
  - Applied Option B Phrase-Level Visual Segmentation (2 to 6 words per beat along natural grammar boundaries, zero stranded hanging articles/prepositions) for Text to Image across Short Form and Long Form while keeping Text to Video untouched (`beatSplitting.ts`, `beatProgressionEngine.ts`, `stage2BeatPlan.ts`, `stage4VerifyRepair.ts`, `geminiClient.ts`, `enhanceStoryArchitect.ts`).
  - Fixed `eye-level of eye-level` and `Wide eye-level` doubled framing openers in `formatFinalBeatPrompt` (`beatProgressionEngine.ts`).
  - Applied latency optimizations: `thinkingLevel: 'minimal'` (`'low'` Stage 1 Story Bible) with HTTP 400 fallback (`unifiedAiService.ts`), 35-60 word Token Diet prompts, 2 concurrent Stage 3 batches per wave (`SCENE_BATCH_SIZE = 3`) in `groundedPipeline.ts`, and `0.45s` min dwell for Image Phrase Cuts.
  - Wired Progressive Scene-by-Scene Results Display via SSE `streamJsonLlmWithSceneProgress` (`unifiedAiService.ts`), wave emissions (`groundedPipeline.ts`), and `ResultsView.tsx` live generation banner (`Stop Generation`, selection preservation, zero unfinished scene placeholders).
  - Created `src/services/aiUsageStorage.ts` (with per-model `byModel` breakdown) and converted the footer widget into a dedicated `AI Usage` button (`Footer.tsx`, `#footer-ai-usage-btn`) navigating to the standalone `AiUsageView.tsx` page (`Session`, `Today`, `All Time`, token mix bar, model breakdown table, and `Reset Usage`).
  - Added Suite 34 automated verification tests (`219 / 219` passing).
- [x] **Scene 2 Interactive Continue Confirmation Gate (Superseded & Removed 2026-11-20):**
  - Replaced by continuous streaming with `Stop Generation` cancellation at any time.
- [x] **SSE Scene-First Streaming & Virelia Prompt Quality Fixes (Suite 35, 225/225 passing):**
  - Removed the `styleProfile || characterSheet` blocking condition inside `emitProgressIfReady()` (`unifiedAiService.ts`), added `minimal -> low -> none` thinking-level step-down retry on HTTP 400 + `'low'` `thinkingLevel` cap on `gemini-3.1-pro-preview`, and moved Long-Form Stage 4 `onPartialResult` emission inside the per-scene loop (`groundedPipeline.ts`).
  - Pruned back-to-back appositive trait clones right after `Character (anchor)`, stripped `cheeks?`/`freckles?`/`carrying a ...` clauses on tight hand close-ups (`beatProgressionEngine.ts`), scrubbed flashback transition clauses from single-sentence shared `artStyle`, and stripped `Adult `/`Young ` continuity prefixes from CTA intrigue questions (`promptCompiler.ts`).
- [x] **Sequential Story Bible -> Beat-by-Beat Streaming -> Deferred Thumbnail & CTA (Suite 36):**
  - Completely removed `OnConfirmContinueCallback`, `awaitingContinueConfirmation`, `"Would you like to continue?"` banner, Yes/No buttons, and Scene 2 pilot limits across all pipelines and UI components.
  - Implemented 3-step sequential flow across Standard (`geminiClient.ts`), Enhance Story (`enhanceStoryArchitect.ts`), and Long Form (`stage1StoryBible.ts`, `stage3PromptWriter.ts`, `groundedPipeline.ts`): Step 1 locks Story Bible (`scenes: []`) and immediately opens `ResultsView` (`#story-bible-lock-card` + `#streaming-first-beat-placeholder`); Step 2 streams `{ "scenes": [...] }` beat-by-beat inside open scenes (`unifiedAiService.ts`) with `skipLlmRepair = true` and sequential 2-scene Long-Form streaming batches; Step 3 compiles Thumbnail and CTA outro only after all scenes complete.
  - Added Suite 36 automated verification tests covering Beat 1 extraction inside open Scene 1, Stage 3 prompt streaming, Story Bible partial emission, and deferred Thumbnail behavior.
- [x] **Groq Beat-by-Beat SSE Streaming, Multi-Character Continuity & Thumbnail Grounding (Suite 37, 234/234 passing):**
  - Configured Groq `reasoning_effort` / `reasoning_format: 'hidden'`, stripped `<think>...</think>` wrappers before JSON stream extraction, preserved `stream: true` on HTTP 400 retry in `runGroqStreamAttempt` (`unifiedAiService.ts` / `groqClient.ts`), flushed trailing SSE buffers, and yielded macrotask ticks so scenes and beats paint progressively in React.
  - Added `normalizeStoryBibleResponse` and Step 1 Story Bible validation retries (`geminiClient.ts`, `enhanceStoryArchitect.ts`, `stage1StoryBible.ts`) to lock every recurring character, creature/spirit, family member, and age variant.
  - Upgraded `beatProgressionEngine.ts` to maintain trait locks across possessive subjects, creature pronouns (`it`/`its`), unique role aliases, and childhood/family flashbacks while shielding infant/child shots from adult wardrobe bleed, and scrubbed hallucinated wings (`"injured wing drooping"`) on pawed creatures when wings are absent from `characterSheet`.
  - Replaced hardcoded `"SURVIVE"` and generic Thumbnail fallbacks in `promptCompiler.ts` (`buildStoryDerivedHookFallback` shared with `groundedPipeline.ts`), added 2-attempt Step 3 thumbnail retries, and updated Step 1 / Step 2 / Step 3 banner and checkpoint labels in `ResultsView.tsx` and `ResultsErrorView.tsx`.
  - Left `Character & Visual Style` input handling and `sanitizeSharedVisualStyle` unchanged per explicit user exclusion; verified with `234 / 234` passing tests in `src/tests/systemTestSuite.ts`, `compile_applet`, and `lint_applet`.
- [x] **Gemini 429 Quota Diagnostics, Streaming Storm Fix, Pacing & Flash Lite Tier (Suite 38, 239/239 passing):**
  - Updated `src/utils/retryFetch.ts` (`parseRetryAfterMs`, `isNonRetryableQuotaExhaustion`, `abortableSleep`) to stop retrying `limit: 0` and daily RPD quota exhaustion, honor Google's `retryDelay` / `Retry-After`, cap transient 429 attempts at 3, and abort backoff delays immediately on user cancel.
  - Stopped `streamJsonLlmWithSceneProgress` (`src/services/unifiedAiService.ts`) from falling back to `executeJsonLlmCall` on HTTP 429/400/401/403/404, added `formatGemini429Error` distinguishing `limit: 0`, daily RPD, TPM, and timed RPM errors across all pipelines (`geminiClient.ts`, `enhanceStoryArchitect.ts`, `assistantChatService.ts`, `GeneratorForm.tsx`).
  - Added `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite` via `GeminiModelQuality = 'lite' | 'standard' | 'high'`) in `types.ts`, `ApiKeyContext.tsx`, `GeneratorForm.tsx`, and `unifiedAiService.ts`, plus `paceGeminiStep` 1.5s inter-step cooldowns in `geminiClient.ts`, `enhanceStoryArchitect.ts`, and `groundedPipeline.ts`.
  - Added Suite 38 tests verifying Flash Lite routing, `limit: 0` / daily RPD / `RetryInfo` diagnostics, and single-call stop on streaming 429s; verified `239 / 239` tests passing, clean build, and clean `tsc --noEmit`.
- [x] **Gemini 3.1 Audit: Alias Isolation, Motion Freeze, Optics, Prop Consistency & Thumbnail/CTA Polish (Suite 39, 244/244 passing):**
  - Expanded `GENERIC_ALIAS_WORDS` / `ROLE_SUFFIX_NOUNS`, added `isPropOrFoodOnlyMacro` (excluding `Medium Close-Up` & personal pronouns), and extended tight hand close-up headwear stripping (`beatProgressionEngine.ts`) to stop `Featuring Ramen Chef` leakage on stall exteriors, spirit beats, hand close-ups, and ramen bowl macros.
  - Unified still-image frozen-verb conversions (`pouring`, `swirling vortex`, `particles rising`, `fluttering in the breeze`), `Close-Up`/`Extreme Close-Up` `24mm` lens upgrades (`85mm` / `100mm`), `harmonizeScenePropMaterials` (`ceramic bowl` consistency), `sanitizePromptGrammarAndTypos` (`curtain curtain`, `a indigo`) across prompts and `ResultsView.tsx` continuity sheets, `"of a ... stands"` participial flow, comma-less duplicate appositives, and duplicate mid-prompt chibi style tags.
  - Fixed Thumbnail font splicing (`shadow.,`), accent casing (`Neon` -> `neon`), exact cast naming in `geminiClient.ts` / `enhanceStoryArchitect.ts`, spaced role prefixes in `formatCtaRoleName` (`the ramen chef`), Nostalgic / Memory / Spirit Folklore CTA questions, and tone-adaptive CTA expressions in `promptCompiler.ts`.
  - Added Test Suite 39 (`39.1` through `39.5`) in `src/tests/systemTestSuite.ts` and verified all `244 / 244` tests passing (`npx tsx src/tests/systemTestSuite.ts`).
- [x] **Mariana Trench Stickman Audit: Optics Sync, Shared Token Filter, Noun-Adjunct Locks, Still Waves & Deep-Sea CTA (Suite 40, 248/248 passing):**
  - Updated `sanitizeStillImageMotionAndOptics` (`beatProgressionEngine.ts`) to recognize `8mm` 1-digit focal lengths and `fisheye`/`wide-angle`/`macro` lens phrases, infer opening shot scale before selecting default lenses, collapse conflicting fisheye + `Shot on ...` doubles, and sync `shotType` pre-optics in `geminiClient.ts` & `enhanceStoryArchitect.ts`.
  - Extended `buildSharedContextIgnoreTokens` with `lensAndFilmStock` and camera/framing boilerplate, protected lowercase compound noun modifiers (`submersible searchlights`) in `injectCompactCharacterLocks`, and fixed `buildContextPreservingProgressionBeat` vessel interior preservation, missing `"a "`/`"an "` articles, and helmeted/stickman fallback phrasing.
  - Froze `vibrating with pulsating`, `outward-expanding`, and `as it emits musical harmonic pulses` in still-image mode & thumbnails (`beatProgressionEngine.ts`, `promptCompiler.ts`), normalized plural `"glass helmets"` -> `"the helmet visor"`, added missing comma in Thumbnail Clean Plate, added Deep-Sea / Sonar Discovery CTA question branch, and adapted CTA framing for helmeted/stickman & discovery stories.
  - Added Test Suite 40 (`40.1` through `40.4`) in `src/tests/systemTestSuite.ts` and verified `248 / 248` tests passing.
- [x] **Neo-Seoul Photographer Audit: Monochrome Grammar, Flicker Freeze, Naming, Temporal Text & Premonition CTA (Suite 41, 252/252 passing):**
  - Updated `sanitizeMonochromeLighting`, `sanitizePromptGrammarAndTypos` (`beatProgressionEngine.ts`), and `compileThumbnailPrompt` / `compileCtaPrompt` (`promptCompiler.ts`) so `glowing cyan terminal font` becomes `glowing white terminal font`, `hard noir film noir` collapses to `hard film noir`, `neo-Seoul` capitalizes to `Neo-Seoul`, and secondary sheet expansions re-pass monochrome scrubbing.
  - Updated `sanitizeStillImageMotionAndOptics` and `sanitizeKineticMotionForImage` so `flickering` before a light source with up to two modifiers (`flickering overhead bulb`) freezes cleanly to `still-lit overhead bulb`, and excluded inanimate typography overlay entries (`The Headlines`) from `injectCompactCharacterLocks` and Step 1 `characterSheet` prompts (`geminiClient.ts`, `enhanceStoryArchitect.ts`).
  - Preserved `Joon the Photographer` capitalization (no `The joon the photographer`) in `formatSheetSubjectName` / `formatCtaRoleName`, fixed `1980S` -> `1980s` temporal overlay casing and duplicate `artStyle` strings in `geminiClient.ts`, and added a Premonition / Future-Prediction CTA branch in `inferStoryAdaptiveCtaQuestion`.
  - Added Test Suite 41 (`41.1` through `41.4`) in `src/tests/systemTestSuite.ts` and verified `252 / 252` tests passing.
- [x] **Desert Nomad Chibi Fixes & Fast Workflow Preference (Suite 42, 255/255 passing):** Fixed Fantasy CTA substring false-positives (`seeking`/`solar-powered`), added Desert/Oasis CTA branch, normalized `Nomad` role naming, decoupled `chibi` art style from bittersweet CTA tone, cleaned contradictory midday shadows & location reveal/`of extreme detail of` grammar, and updated `MEMORY.md` for direct bug-fix execution with minimal memory logs.

- [x] **Paper-Cut Stickman Option B Segmentation, Grammar & Storybook CTA (Suite 43, 258/258 passing):** Enforced Option B 2-6 word phrase cuts in Gemini prompt + deterministic `enforceOptionBPhraseBeatsInScene` (honoring `skipOptionBPhraseSplit` for custom beats & preserving tiny connector merges), guarded non-crib childhood flashbacks, protected proper names after `of ` and converted parenthetical/`with` finite verbs to participles without backtracking, removed `of a macro view of`, routed storybook fables out of Horror CTA, and replaced helmeted silhouette with bare stickman CTA framing.

- [x] **Submerged Library & Lighthouse Keeper Fixes (Suite 44, 261/261 passing):** Preserved prop context and fixed lenses in Option B sub-beat splits without Pass 3 overwrites, fixed pre-noun `swirling` / `lashing` / `sweeping` still-motion grammar, shielded `glass lantern room` from `brass lantern` material swaps, expanded participle verbs (`ascends`/`strikes`/`ignites`/`amidst`) + angle syncing + multi-word sheet casing (`The Keeper`), added plural location article guard, lowercased Thumbnail post-colon background text, and added Final Watch / Lighthouse & Lost Archive CTA branches.

- [x] **AI Assistant Reference Image Upload for Character & Visual Style (Suite 45, 264/264 passing):** Added client-side EXIF-aware resizing/compression up to 5 reference images (`src/utils/imageAttachment.ts`), defaulted all images to combined Character & Visual Style with no role picker clutter, enforced Gemini 5-image / Groq Qwen 3-image limits and quota-safe `sessionStorage` trimming (`assistantChatService.ts`), composer file picker + clipboard paste + error banner (`AssistantChatDrawer.tsx`), and one-click `Use Character & Style` redirect to the Home generator with `#character-prompt-input` pre-filled and focused (`App.tsx`).

- [x] **Core Upgrade: Universal Grounded Pipeline, Style-Native Prompts & 4s Clip Cohesion (Suite 46, 268/268 passing):** Classified 5 visual style families (`photoreal`, `stylized_3d`, `stop_motion`, `illustration_2d`, `minimalist_flat`) to replace live-action 35mm boilerplate with medium-native craft, expanded Story Bible continuity (`permanentAnatomy`, `eraWardrobe`, `spatialMap`, `lightingArc`, `parallelCast`), routed all `generateOriginalStory` requests (including Custom Beat Mode and Short/Video) through `executeGroundedPipeline()` with style-and-duration-keyed checkpoints, kept Option B 2-to-6 word T2I beat segmentation untouched, enforced 4s clip cohesion (`<= 2` beats / `<= 4s`) plus universal `SCENE CLIP PROMPT` copy cards in `ResultsView.tsx` with zero external tool names, and added Stage 4 dynamic threat, video camera-vector conflict, and `parallelCast` checks.

## Active Testing & Planned Future Roadmap (Post-Testing)
- [ ] **Deferred Optional Extras (Core Upgrade Follow-Ups):**
  1. Cross-scene Copy & Next navigation + Copied state checkmarks for rapid phone copy-pasting.
  2. Saveable Channel Style DNA Presets (1-tap reusable character, palette, and art-style profiles).
  3. Paste `.SRT` / Audio Runtime Timing Sync for locking beat lengths directly to external voiceover timings.
  4. Copy Clean Voiceover Script button (plain TTS-ready narration without beat markers or camera notes).
  5. Single-beat Quick Rewrite (re-roll one weak beat prompt in place without regenerating the storyboard).
  6. Opening 3s Visual Hook Priority toggle for aggressive scroll-stopping cold opens.
- [ ] **Genre Stress-Testing Loop (In Progress):**
  - Completed: **Sci-Fi**, **Documentary / History**, **Horror / Psychological Thriller**, **Stylized Art**, **Multi-Character + Flashbacks**, **130-Word Finance/Diorama (Text-to-Image)**, and **Text-to-Video (4s Clip Mode)**.
  - Remaining stress categories:
    1. **No-Character / Object / Nature** (zero invented humans)
    2. **Long-Form 16:9**
- [ ] **Post-Testing Feature & Product Recommendations (Saved for Later):**
  - **Silent / Visual-Only (No Narration) Mode:** Dedicated toggle so movement-only videos, silent FPS/GoPro POV, ASMR, ambient nature, action choreography, and product B-roll generate pure visual beats and camera motion without forcing text into `narratorLine`.
  - **Additional Format Support:** Multi-speaker screenplay dialogue and music/BPM-synced montages.
  - **Commercial SaaS Layer (If/When moving beyond BYOK):** User authentication, cloud-saved projects and character libraries, Stripe credit/subscription billing, server-side API proxy, and one-click in-app image/voiceover/video generation.

