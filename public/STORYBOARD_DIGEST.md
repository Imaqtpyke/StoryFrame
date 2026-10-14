# StoryFrame: Comprehensive Storyboard, Text-to-Image & Text-to-Video Architecture Digest

> **Document Purpose:** This digest encapsulates the complete architecture, data models, prompt generation pipelines, video pacing algorithms, and product workflows of StoryFrame. Upload this file directly to ChatGPT or Claude for an in-depth architectural and product critique, feature comparison against leading AI video/storyboarding platforms, and strategic recommendations for commercial success.

---

## 1. Executive Summary & Product Vision

### What is StoryFrame?
StoryFrame is an intelligent pre-production and generation studio designed to convert raw text scripts or narrative story concepts into cinematic, production-ready storyboards and AI prompt blueprints for:
1. **Text-to-Image Generators:** Midjourney, Flux.1, Stable Diffusion XL, DALL-E 3, Imagen 3.
2. **Text-to-Video Generators:** Runway Gen-3 Alpha, Kling AI, Luma Dream Machine, OpenAI Sora, Pika 2.0, Minimax/Hailuo.

### The Problem It Solves
Creators, filmmakers, marketers, and video producers struggle with:
- **Visual Discontinuity:** Characters and locations change appearance between generated frames.
- **Vague Video Prompts:** Most video models fail when prompts lack explicit camera motion, optical framing, and temporal progression.
- **Narrative Pacing Mismatch:** Voiceover scripts either rush through too many visual beats or leave dead air.
- **Pre-Production Fragmentation:** Traditional storyboards (Boords, StudioBinder) don't speak the language of modern AI generative pipelines.

StoryFrame bridges the gap between raw narrative storytelling and machine-executable visual direction.

---

## 2. Core Functional Pillars

### 2.1 Story Breakdown & Pacing Engine
- **Dual Formats:**
  - *Short-Form (9:16 vertical):* Optimized for TikTok, Instagram Reels, and YouTube Shorts. Emphasizes instant 3-second hook retention, rapid visual cuts (every 2-4 seconds), and high-energy camera movements.
  - *Long-Form (16:9 widescreen):* Optimized for YouTube, cinematic short films, and documentaries. Emphasizes atmospheric scene setting, deliberate pacing, establishing shots, and emotional progression.
- **Hook Architect:** Evaluates and generates opening hooks (`headlineHook`, `hookType`, `hookRationale`) analyzing viewer psychological triggers (curiosity gap, pattern interrupt, high-stakes question).
- **Spoken Narration Suitability:** Real-time mathematical analysis of voiceover word density:
  $$\text{Words Per Second} = \frac{\text{Word Count}}{\text{Clip Duration (Seconds)}}$$
  - Evaluated against standard natural speech rate (~2.2 words/second, ~132 WPM).
  - Flags `dense` (spoken lines will sound rushed; recommends trimming words or splitting clips) and `sparse` (lines too brief; suggests descriptive expansion or visual pause cues).

### 2.2 Visual Continuity Engine
- **Style Profile:** Global visual aesthetic locking:
  - `artStyle`: Cinematic film, anime, retro 80s dark fantasy, oil painting, hyperrealistic CGI, etc.
  - `colorPalette`: Defined hex/tonal palettes (e.g., desaturated teal and warm amber).
  - `lighting`: Directional lighting specs (e.g., golden hour rim light, volumetric chiaroscuro).
  - `eraAndSetting`: Period accuracy and atmospheric rules.
  - `lensAndFilmStock`: Optical physics (e.g., 35mm anamorphic, f/1.8 shallow DOF, Kodak Vision3 500T grain).
- **Persistent Character Sheets:** Normalized dictionary of named characters containing locked physical attributes (age, facial structure, skin tone, signature garments, hair color/style, eye color) injected into every shot where the character appears.
- **Persistent Location Sheets:** Normalized environment definitions (architecture, key props, atmospheric conditions, weather) to prevent environment morphing across scenes.

### 2.3 Beat-Level Visual & Motion Direction
Every scene is decomposed into micro-beats featuring:
- **Image Prompt:** Prompt-engineered for high-fidelity text-to-image synthesis, front-loading subject and lighting while enforcing style profile constraints.
- **Video Motion Prompt:** Dual-phase motion prompting:
  - *Start Frame Prompt:* Exact visual state at $t=0$.
  - *Motion Dynamics:* Explicit physical actions, speed, trajectory, and natural elements (smoke, wind, water).
- **Camera Optics & Mechanics:**
  - `shotType`: Extreme close-up, close-up, medium shot, cowboy shot, wide shot, extreme wide establishing shot.
  - `cameraAngle`: Eye level, low angle (empowering), high angle (vulnerability), Dutch tilt, bird's eye, worm's eye.
  - `cameraMovement`: Static tripod, slow cinematic push-in (dolly in), pull-out, tracking pan left/right, crane jib boom, orbiting arc shot, handheld jitter.
- **Cinematic Hooks & Anchors:**
  - `visualSoundEffect` & `soundCue`: Foley and score synchronization cues.
  - `temporalAnchor`: Time-of-day progression or elapsed narrative time.
  - `transitionHint`: Cut, cross-dissolve, match cut, whip pan, fade to black.

---

## 3. Data Schema & Core TypeScript Contracts

```typescript
export type StoryFormat = 'short' | 'long';
export type GenerationMode = 'image' | 'video';

export interface StyleProfile {
  artStyle: string;
  colorPalette: string;
  lighting: string;
  eraAndSetting: string;
  lensAndFilmStock?: string;
}

export interface Beat {
  beatIndex: number;
  textSpan: string;
  imagePrompt: string;
  estimatedSeconds: number;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  visualSoundEffect?: string;
  temporalAnchor?: string;
  transitionHint?: string;
  soundCue?: string;
  optics?: string;
}

export interface Scene {
  index: number;
  narratorLine: string;
  estimatedSeconds: number;
  beats: Beat[];
  videoPrompt?: string;
  startFramePrompt?: string;
  establishedCharacters?: string[];
  establishedSettings?: string[];
  isAnchorScene?: boolean;
}

export interface StoryGenerationResult {
  totalDurationSeconds: number;
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
  scenes: Scene[];
  generationMode?: GenerationMode;
  targetVideoDuration?: number;
  autoArchitectMode?: boolean;
  hookAnalysis?: {
    headlineHook?: string;
    hookType?: string;
    hookRationale?: string;
  };
}

export interface VideoSuitability {
  status: 'optimal' | 'dense' | 'sparse';
  wordsPerSecond: number;
  wordCount: number;
  naturalSeconds: number;
  targetDuration: number;
  message: string;
  suggestion: string;
}
```

---

## 4. Current AI Processing Pipelines

### Model Layer
- **Engine:** Google Gemini API (Gemini 3.8 Flash for high-speed drafting, Gemini 3.1 Pro for high-reasoning cinematic director passes).
- **Format Enforcement:** Strict JSON schema extraction with markdown codeblock stripping and sanitization.
- **Fail-Safe Processing:** Zero-warning direct single-pass execution, with client-side `AbortController` cancellation so users retain complete control without intrusive blocking dialogs.

### Prompt Engineering Architecture
1. **System Persona:** Expert Film Director, Director of Photography (ASC), and Visual Storyboard Artist.
2. **Character & Environment Isolation:** Prompts separate character identity tags from dynamic action verbs to maintain consistency.
3. **Motion Syntax:** Formatted specifically to avoid negative model artifacts (morphing, extra limbs, impossible camera physics) by focusing on camera translate/rotate commands combined with single-subject kinetic verbs.

---

## 5. Benchmarking & Comparative Industry Landscape

| Feature / Dimension | StoryFrame (Current) | Runway Gen-3 / Director Mode | Midjourney / Niji | InVideo AI / Fliki | Boords / StudioBinder |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Focus** | Script-to-Storyboard & Prompt Blueprinting | Direct AI Video Generation | Static Image Generation | Script-to-Video Assembly (B-roll + TTS) | Traditional Film Pre-production |
| **Character Consistency** | Centralized character sheet injected into prompts | Seed & motion brush | `--cref` reference images | Stock library tagging | Manual sketch / upload |
| **Camera & Optics Control** | Full ASC camera metadata (lens, angle, movement, shot type) | Pan/tilt/zoom sliders | Aspect ratio `--ar`, stylize `--s` | Pre-rendered transitions | Framing notes |
| **Pacing / Narration Analysis**| Mathematical WPM suitability check per clip | Fixed clip length (5s/10s) | N/A | Automated subtitle pacing | Manual frame timing |
| **Output Format** | Structured JSON, visual card timeline, prompt copying | Video MP4 | Single image JPG/PNG | Full rendered MP4 with audio | PDF pitch deck, animatic export |

---

## 6. High-Priority Questions for External AI Critique

1. **Prompt Translation Layer:** How can we best map our universal camera and lighting schema into engine-specific prompt syntaxes (e.g., Runway Gen-3 camera brackets vs Midjourney v6 parameters vs Kling motion weights)?
2. **Consistency Enforcement:** What architectural approaches (e.g., character seed persistence, LoRA references, multi-view face generation, or image-to-image chaining) would most effectively eliminate visual drift?
3. **Audio-Visual Alignment:** How should we structure the timeline export so users can seamlessly feed this into video editors (Premiere, DaVinci Resolve, CapCut) or automated rendering pipelines?
4. **Commercial Moat:** What are the highest-leverage features that transform this from an AI prompt generator into an indispensable commercial studio tool?
