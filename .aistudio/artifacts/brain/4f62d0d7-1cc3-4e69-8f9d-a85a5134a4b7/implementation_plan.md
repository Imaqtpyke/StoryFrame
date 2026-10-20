# Ingesting Episode 1 Manuscript & 11-Episode Series Continuity

Directly ingest and execute the pre-structured Episode 1 manuscript ("The One Who Doesn't Belong") into StoryFrame as a 12-clip vertical (9:16) video storyboard with camera motion tags, while establishing an 11-episode persistent continuity tracker for the entire series.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed in Phase 1:
> - **Manuscript Ingestion Flow:** Directly ingest the 12 clips into StoryFrame's production storyboard pipeline as a native 12-scene sequence (4 seconds per clip, 48 seconds total duration), bypassing redundant re-generation while enabling prompt compilation and video motion tags.
> - **Generation Target:** Configured for Vertical 9:16 video generation with explicit camera motion, kinetic velocity, and audio/foley cues (compatible with Kling, Runway Gen-3, Luma Dream Machine, Sora, and Veo).
> - **Series Continuity:** Persistent multi-episode Story Bible tracking character visual identity, mansion environments, the secret premise, and the language rule ("no gay/straight labels") across all 11 episodes.

---

## 1. Overview & Core Concept

- **What It Does:** Enables creators to take formatted production manuscripts (like `storyframe_episode_1_twelve_suspects_d92e002c.md`) and instantly ingest them into StoryFrame's vertical video storyboard matrix. It parses the 12 clips into 12 discrete 4-second scenes, compiles cinematic video prompts with camera movements, and anchors the 11-episode roadmap in the persistent Story Bible.
- **Target Audience:** Short-form video creators, episodic web series directors, and fiction writers producing vertical mystery/drama series for TikTok, YouTube Shorts, and Instagram Reels.
- **Key Value:** Eliminates the frustration of copying and pasting or having an AI re-write a finished script. Delivers instant, consistent 9:16 shot lists, prompt compilation for video AI models, and CMX 3600 EDL / SRT subtitle exports ready for video editing software (Premiere Pro, DaVinci Resolve, CapCut).

---

## 2. User Experience & Visual Design

- **Ingestion Access Point:**
  - A clean, unboxed **Ingest Manuscript** button in `GeneratorForm.tsx` alongside the story input box.
  - Allows either clicking **Load Attached Episode 1** (instantly loading the attached markdown file) or uploading/pasting any structured script file.
  - Automatically detects format settings: **Vertical (9:16)**, **Text to Video**, **48s Target Runtime**, and **4s Clip Duration**.
- **Results View Matrix (12 Clips):**
  - Displays the 12 sequential clips in StoryFrame's compact matrix view (Scenes I through XII).
  - Each clip card displays the voice-over narration, timecode range (`0:00–0:04`, `0:04–0:08`, etc.), camera motion tag (Glide, Spotlight Track, Dutch Angle, Macro Close-Up, Reveal Dolly), and compiled video prompt.
  - Tapping any clip opens the `BeatBottomSheet` inspector with the 8-part video prompt, audio foley cues, and start-frame keyframe prompts.
- **Series Roadmap & Continuity Modal:**
  - In `ResultsView.tsx` and the Story Bible modal, a dedicated **Series Continuity: 11 Episodes** tab displays the full episodic arc (from Episode 1 "Twelve Suspects" to Episode 11 "The Real Twist").
  - Highlights active contestants, eliminated contestants per episode, and locked premise rules (e.g., the language restriction).
- **Design Conventions:**
  - Dark-editorial theme (`#121211`, `#1C1C1A`), 8px rounded corners, Title Case buttons, Lucide SVG icons, zero purple gradients, zero emojis, and zero pill-shaped metadata enclosures.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Ingestion vs. Prompt Re-Generation**
  - *Chosen Approach:* Direct deterministic parsing of the markdown manuscript into `StoryGenerationResult` scenes and beats, with prompt compilation for the target AI video model.
  - *Why:* The user already wrote precise 4-second voice-overs and visual directions. Passing it through an LLM text generator risks truncating, altering the lines, or hallucinating unrequested plot changes.
  - *Alternatives Considered:* Re-prompting Groq/Gemini to "analyze and storyboard" the text. Rejected because it wastes tokens and may violate the user's specific 4-second pacing.
- **Decision 2: 1-Beat-Per-Clip Video Mapping**
  - *Chosen Approach:* Map each 4-second clip directly as 1 scene with 1 video beat (or start/end keyframe transition) conforming to short-form video model constraints (4s–5s duration).
  - *Why:* Short-form video generators (Veo, Runway Gen-3, Kling) generate 4 to 5 seconds per generation call. Aligning each clip to 1 generation prompt provides a 1:1 timeline match for video editors.
- **Decision 3: Persistent Series Continuity Storage**
  - *Chosen Approach:* Store the 11-episode roadmap and character profiles in `bibleCache.ts` and `sessionStorage`, allowing the user to progress from Episode 1 to Episode 2 while preserving identical cast descriptions.
  - *Why:* Reality show mystery formats rely heavily on facial, hairstyle, and wardrobe consistency across voting rounds and elimination ceremonies.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   StoryFrame Engine                    │
└───────────────────────────────────┬────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌─────────────────────────────────┐          ┌───────────────────────────────────┐
│  Manuscript Ingestion Parser    │          │     Series Continuity Manager     │
│  (src/services/scriptParser.ts) │          │     (src/services/bibleCache.ts)  │
├─────────────────────────────────┤          ├───────────────────────────────────┤
│ • Parses Markdown Headings      │          │ • Tracks 11 Episodes Arc         │
│ • Extracts 12 Clips & Times     │          │ • Biometric Contestant Profiles   │
│ • Extracts VO & Visual Cues     │          │ • Enforces Language Constraints   │
│ • Assembles Normalized Scenes   │          │ • Retains Visual Style & Setting  │
└────────────────┬────────────────┘          └─────────────────┬─────────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ResultsView Matrix (9:16)                           │
│  - 12 Sequential Clip Cards with Timecodes & Camera Motion                     │
│  - Model Compiler (Universal, Runway Gen-3, Kling, Luma, Veo)                 │
│  - Multi-Episode Roadmap Inspector Modal                                       │
│  - Export Engine: CMX 3600 EDL, SRT Subtitles, CSV Shotlist, Markdown          │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Key Modules & State Flow:
1. `src/services/scriptParser.ts`:
   - Pure parser that detects `### Clip N — Title (0:XX–0:YY)` blocks, extracting `voiceOver` and `visual` text.
   - Converts visual descriptions into rich 8-part video prompts using StoryFrame's cinematography standards (lighting, framing, camera motion, tactile atmosphere, audio foley).
   - Generates character entries for the 12 contestants and the host based on the production notes.
2. `src/components/GeneratorForm.tsx`:
   - Adds an **Ingest Script** button with instant preview for the attached Episode 1 markdown or custom file uploads.
   - Sets video mode and 9:16 vertical orientation upon ingestion.
3. `src/components/SeriesRoadmapModal.tsx`:
   - Modal accessible from ResultsView showing the 11-episode arc, eliminated contestants tracker, and button to prep Episode 2.
4. `src/components/ResultsView.tsx`:
   - Renders the 12-clip sequence with timecodes and full export options (.edl, .srt, .csv, .md, .json).

---

## 5. Verification & Testing Plan

1. **Parser Unit Verification:** Test markdown parsing of all 12 clips, timecodes, voice-over text, and visual descriptions.
2. **Video Prompt Quality:** Verify that each generated video prompt includes camera motion tags, 9:16 vertical aspect framing, Kelvin lighting, and audio foley cues without text leakage.
3. **Export Integrity:** Verify that CMX 3600 EDL and SRT exports accurately reflect the 48-second timeline with 12 distinct 4-second events.
4. **Build & Type Check:** Run `compile_applet` and `lint_applet` to guarantee error-free compilation.
