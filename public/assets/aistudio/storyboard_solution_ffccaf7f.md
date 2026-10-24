perplexity's verdict: StoryFrame’s biggest opportunity is to evolve the Assistant from a **stateless script advisor** into a **project-aware Director’s Co-Pilot** that can see, critique, and safely modify the active storyboard. Your differentiated assets—deterministic ingestion, locked identity sheets, beat-level prompt compilation, and editor exports—are stronger than a generic chat assistant; the assistant should operate on those structures, not around them. 

## A. Competitive benchmark

| Platform category | Relevant pattern | What StoryFrame should adopt |
|---|---|---|
| Boords | Script-to-frames, frame-level comments, approvals, animatic timeline, and a chat surface that can apply suggested edits to the board.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/6140192/613bd410-45bf-43a9-a067-244adf23e655/STORYBOARD_DIGEST.md?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYE4RSVYTL6%2F20261024%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261024T094723Z&X-Amz-Expires=2176&X-Amz-Security-Token=IQoJb3JpZ2luX2VjENr%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQDgfQW7%2F4eM9jutoJzzy2RMzrhGektCvHSuzslMqb8q7AIhALNj9kZpRTyIUCBxvuuarclabGCDYqt1yMR4C7ckpLh1KokFCKL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQARoMNjk5NzUzMzA5NzA1IgyGtw%2BmkQcjgzxQkecq3QQ0Ay1PttCV9mcHafs1ONdv9vN7dvgRgotnFQHqOj2EbZtuVF2tlZj5bv5N4yJdVLPApq6NmeXuooETSO3Q8tCx%2FtwolzjHkmqKkFkgig2kgePLIIp5z7YzXGZFPWOJ6QqLbwmXw%2F7t1lzNAbSVDyTEA1hhmiIjjML9wobXkcK0sv1777NJx4otethSl%2FalKuWBQNWzIvAk8ou8Qh9VK5SNC0pv8QID%2BMUl9MXhylK6i6PZVLR%2F8U4Zf17gaodwMHsxhpkKosPxeh6WM3npT77OiZ17O4m9htJEEqgmZpgnsRcp5c27EgC458wL0TxZTj9lbYivv%2Bpr1K3EZOlH6i%2F%2F2SJCA60J%2FPsIU6AlzJekKlTYzNgkJnC0OOgz3ywW2VCKgf9412%2BOiWDnjFH0z5fcXKCN56MlFqaU8yd6am12w9RcmZpT4HFnyNnpUxNoCixJOnTnkdJhZFm48agz8MY481TZDKo%2BlS%2BB6J2DKjOd46Avj2x3fWf7mX5WTCwNcYjErkMY%2FBJq0nFVGCSJokH2VZ6DVniOHCPB9HBKZ1bt5cK5iBgkVswnhmaVniX02wF4E%2BsLSgqiJxUMam%2FWSgy%2Fq%2FAJB62nQ1Kmxe%2FVt3KCtbIdk4yZNhMUFqyPscnwvs5BZYObtHa6B07iLpZbD0Z4aIdDkdmc8a0Xg516qg8NG5s9yGeoWdYXd0y0%2B9w6SBavk3FKc%2BWIfY6TWC%2BVdoRLS30bPMJWAip6R%2BlJxC4%2Bu0GhmZcOpp2HZWXfpaLBDhI7FgaGOGSkGG6cJlPG60y6MXs0AF2tZj8y2UyHhTDY8vHWBjqXAaLZZYoLFcGbQ0YOvrHbZuqCKmf6NvMnzqsY89PWraLYhyxY0SVWSe6U1D%2BZRzeL8PijG0VYLpg3arbA2c0z%2FvcLwXvtGwwO0wVUlGTPpgI%2BcmczM7qUcP9sJQZZB21TPDQIJBZtFif84g%2BYMPdvFKhh7BgOAfF%2Fkvpu09dS7GJFTUJ4Z53nHDZsijP6wXMRf0eyggdc43A%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=ac2e0feb193bc7a0d846235479607155e1ccf12b1eba80066f1f41f255f905b0) | Context-aware chat beside the storyboard, with explicit Apply/Discard controls for every proposed change. |
| StudioBinder | Production-oriented shot lists, camera direction, sharing, and PDF/export workflows.  [boords](https://boords.com/storyboard-software) | Make director notes, shot metadata, and export readiness first-class assistant outputs. |
| NolanAI / Milanote | Idea development, visual references, and flexible creative organization. | Add a lightweight “Director’s Notebook” per project for tone, references, constraints, and unresolved questions. |
| Runway / Kling / Luma / Pika / Hailuo | Generation-first workflows: model choice, duration, aspect ratio, reference images, camera controls, and rapid iteration.  [boords](https://boords.com/compare/boords-vs-studiobinder) | Assistant should recommend the best target engine and translate one canonical beat into that engine’s syntax. |
| InVideo AI | Script-to-video assembly with templates, voiceover, subtitles, and fast output. | Offer a “fast assemble” mode, but keep StoryFrame’s director-grade controls visible. |
| Krea Realtime | Split canvas/output interface where drawing, prompts, and parameters immediately update the result; supports image and video, model switching, and direct handoff between creation and editing.  [krea](https://www.krea.ai/llms.txt) | Add a live Beat Inspector: selecting a beat shows its prompt, continuity links, and suggested variants without leaving the timeline. |
| ChatGPT Canvas / Claude Artifacts | Side-by-side artifact editing, inline selection, and reversible suggested edits. | Treat the storyboard as an editable artifact; never force users to copy JSON manually. |

### What makes these assistants effective

- **Selection-first interaction:** Users select a scene, character, location, or beat, then ask, “Make this more ominous,” rather than describing the whole project in chat.
- **Visible context:** The assistant displays what it can see: active project, format, target engine, selected beat, continuity chain, and character/location locks.
- **Proposal, not silent mutation:** Every AI edit appears as a reviewable diff with Apply, Discard, and Regenerate.
- **Model-aware output:** The same narrative intent compiles differently for Midjourney, Flux, Kling, Runway, Veo, or Sora.
- **Fast feedback loop:** Krea’s realtime canvas demonstrates the value of immediate visual response to prompt and canvas changes; StoryFrame can approximate this with instant prompt previews and low-cost thumbnail drafts before expensive video generation. [boords](https://boords.com/compare/boords-vs-studiobinder)

## B. Architectural critique

### Current flaws

1. **Context blindness.** A six-turn `sessionStorage` window cannot understand a 12-clip series, character continuity, prior director notes, or why Beat 7 exists. It also risks losing project state on refresh or tab closure.
2. **No object identity.** The assistant can discuss “the hook” in prose, but it cannot reliably address `scene_3.beat_2`, `character.mara`, or `location.boston_harbor`.
3. **Hard-coded retention bias.** The Zack D. Films hook-to-payoff structure is excellent for short-form thriller/history content but can make documentaries sound sensational, corporate explainers feel manipulative, and literary drama feel rushed.
4. **No safe write path.** “Use in Generator” pastes text, but the assistant cannot propose a structured, reversible edit to a specific field.
5. **No engine-specific compiler in chat.** The assistant may write a good creative prompt but cannot guarantee valid Kling, Runway, Midjourney, or Flux syntax.
6. **No quality gates.** It does not systematically detect narration-density violations, continuity drift, contradictory style constraints, image/video modality leakage, or missing payoff beats.

### Solving context blindness

Use a **three-layer context architecture**:

```text
Layer 1: Project Manifest
  title, format, aspect ratio, duration, genre, tone, target engines, active version

Layer 2: Structured Story State
  characters, locations, style profile, scenes, beats, continuity links, hook analysis

Layer 3: Active Working Set
  selected scene, selected beat, visible timeline range, recent user edits, unresolved warnings
```

Do not send the entire project to every request. Build a compact `AssistantContext` object:

```ts
export interface AssistantContext {
  project: {
    id: string;
    title: string;
    format: 'short' | 'long';
    aspectRatio: '9:16' | '16:9';
    genre: string;
    tone: string;
    targetEngine: PromptTarget;
    totalDurationSeconds: number;
  };
  selection?: {
    type: 'project' | 'scene' | 'beat' | 'character' | 'location';
    id: string;
    label: string;
  };
  activeWindow: {
    sceneIds: string[];
    beatIds: string[];
  };
  includedObjects: {
    scenes: Scene[];
    beats: Beat[];
    characters: CharacterIdentity[];
    locations: LocationIdentity[];
    styleProfile: StyleProfile;
  };
  diagnostics: DiagnosticIssue[];
  recentEdits: EditOperation[];
}
```

### Context-window policy

| User action | Context sent |
|---|---|
| “Improve this beat” | Selected beat, adjacent beats, scene, relevant character/location, style profile |
| “Check continuity” | Full beat chain for affected scene plus character/location locks |
| “Why is my pacing off?” | Scene timings, narration word counts, beat durations, neighboring scenes |
| “Rewrite the hook” | Scene 1, project genre/tone, format, target duration, hook analysis |
| “Make Episode 3 consistent” | Series bible, recurring characters, prior episode summaries, current episode outline |

Persist the full project in IndexedDB or server-side storage; use `sessionStorage` only for ephemeral UI state such as drawer position and unsent drafts.

### Balancing narrative frameworks

Replace one universal retention formula with a **genre-aware narrative contract**:

```ts
export type NarrativeFramework =
  | 'shortform_retention'
  | 'historical_documentary'
  | 'corporate_explainer'
  | 'horror_short'
  | 'cinematic_drama'
  | 'sci_fi_series'
  | 'educational_series';

export interface NarrativeContract {
  framework: NarrativeFramework;
  openingStrategy: string;
  pacingRule: string;
  escalationModel: string;
  resolutionModel: string;
  forbiddenTactics: string[];
}
```

Examples:

| Genre | Opening | Pacing | Resolution |
|---|---|---|---|
| Short-form retention | Curiosity gap or pattern interrupt in first 3 seconds | Beat every 1.2–2.5 seconds | Payoff or reversal near the end |
| Historical documentary | Concrete human moment or unresolved historical question | Establish context, evidence, consequence | Clear historical significance |
| Corporate explainer | User problem or surprising statistic | One idea per beat, visual proof | Practical outcome or next step |
| Horror short | Ordinary routine disrupted | Withhold threat, escalate sensory dread | Revelation, escape, or ambiguous ending |
| Cinematic drama | Emotional imbalance or character desire | Let scenes breathe; use visual metaphor | Emotional or moral change |
| Sci-fi series | Rule of the world is broken | Build internal logic and stakes | Consequence that expands the world |

The assistant should choose `shortform_retention` only when format is `short`, duration is under about 90 seconds, and the user has not selected another genre.

## C. Action plan

### Feature 1: Beat Inspector with scoped chat

When a user selects a beat, open a right-side inspector showing:

- Narration and estimated duration.
- Image/video mode.
- Canonical prompt.
- Target-engine compiled prompt.
- Character and location locks.
- Continuity from previous and to next beat.
- Diagnostic warnings.
- Assistant chat scoped to that beat.

Example user request:

```text
Make this beat more ominous without revealing the harbor.
```

The assistant returns a proposed `BeatPatch`, not a loose paragraph.

### Feature 2: Structured edit proposals

Define a strict patch schema:

```ts
export type AssistantEditOperation =
  | 'replace_field'
  | 'append_field'
  | 'split_beat'
  | 'merge_beats'
  | 'reorder_beats'
  | 'update_character'
  | 'update_location'
  | 'update_style'
  | 'insert_beat'
  | 'delete_beat';

export interface AssistantProposal {
  proposalId: string;
  summary: string;
  rationale: string;
  confidence: number;
  operations: AssistantEditOperation[];
  patches: {
    targetId: string;
    targetType: 'beat' | 'scene' | 'character' | 'location' | 'style';
    field: string;
    currentValue?: unknown;
    proposedValue: unknown;
  }[];
  validation: {
    passes: boolean;
    issues: string[];
  };
}
```

UI rule: the assistant never applies a patch automatically. Show a card with:

```text
Proposed change
Beat 2, Image Prompt
Current: High-angle view of Boston Harbor...
Proposed: High-angle wide establishing shot...

Why: Preserves the “into a harbor” reveal while matching the previous tea-pour beat.

[Preview] [Apply] [Discard] [Regenerate]
```

### Feature 3: Engine-specific prompt compiler

Add a compiler selector in the Assistant:

```text
Target: Kling | Runway Gen-3 | Veo | Luma | Sora | Midjourney | Flux
```

The assistant first produces canonical structured fields, then deterministic code compiles them:

```ts
export interface CanonicalVideoPrompt {
  subject: string;
  lockedWardrobe: string;
  action: string;
  camera: {
    shotType: string;
    angle: string;
    movement: string;
    motionIntensity: 1 | 2 | 3 | 4 | 5;
  };
  lighting: string;
  style: string;
  physics: string;
  audio: string;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9';
}
```

The chat explains the creative change; the compiler owns syntax. For example, it can convert `slow push-in, moderate intensity` into engine-appropriate camera language while preventing unsupported fields from silently disappearing.

### Feature 4: Storyboard diagnostics panel

Run continuous, deterministic checks:

| Diagnostic | Rule |
|---|---|
| Narration density | Flag if `wordCount / durationSeconds` is above 2.5 or below 1.5 words per second. |
| Reveal leakage | Flag if a beat introduces a fact reserved for a later beat. |
| Continuity break | Flag missing or mismatched `continuityToNextBeat` / `continuityFromPreviousBeat`. |
| Style contradiction | Flag character-system language alongside `no characters`. |
| Modality leakage | Flag motion verbs in image-mode prompts. |
| Missing payoff | Flag if the final beat does not resolve the hook’s central question. |
| Identity drift risk | Flag a character appearing without its locked wardrobe or reference strategy. |

Each issue should link directly to the affected beat and offer an assistant-generated fix.

### Feature 5: Director’s Notes layer

Let the assistant attach non-destructive notes to any scene or beat:

```ts
export interface DirectorNote {
  noteId: string;
  targetId: string;
  noteType: 'pacing' | 'camera' | 'performance' | 'continuity' | 'style' | 'safety';
  note: string;
  suggestedAction?: string;
  status: 'open' | 'accepted' | 'dismissed';
}
```

This keeps creative reasoning visible without polluting prompts. A note such as “Hold on the tea splash one beat longer to let the harbor reveal land” remains editorial guidance, while the prompt itself stays clean.

## Production-ready system instruction

```text
You are StoryFrame Director, the in-app Director’s Co-Pilot for StoryFrame, an AI storyboarding and prompt-compilation studio created by Imaqtpyke.

Your job is to help the user plan, critique, revise, and productionize visual stories. You are a collaborative film director, storyboard supervisor, prompt engineer, and narrative editor. You do not replace the user’s creative intent; you strengthen it.

PROJECT AWARENESS
You receive a structured AssistantContext containing the active project, selected object, visible storyboard window, relevant characters, locations, style profile, diagnostics, and recent edits. Always reason from that context. If a required object is absent, say exactly what you need instead of inventing details.

CORE RESPONSIBILITIES
1. Analyze the selected script, scene, beat, character, location, or full storyboard.
2. Identify narrative, pacing, continuity, visual, modality, and prompt-quality issues.
3. Propose specific, reversible edits using the AssistantProposal schema.
4. Explain every recommendation in concise director language.
5. Compile prompts only through StoryFrame’s canonical fields and target-engine rules.
6. Preserve locked character attributes, wardrobes, locations, visual style, and established continuity.

NARRATIVE FRAMEWORKS
Select the appropriate framework from the project context:
- Short-form retention: strong curiosity gap, rapid escalation, clear payoff.
- Historical documentary: accurate context, human perspective, evidence, consequence, and significance.
- Corporate explainer: problem, mechanism, proof, outcome, and next step.
- Horror short: normality disrupted, withheld threat, sensory escalation, restrained revelation.
- Cinematic drama: character desire, obstacle, emotional escalation, meaningful change.
- Sci-fi series: broken world rule, internal logic, escalating stakes, world-expanding consequence.
Do not force short-form retention tactics onto documentary, corporate, literary, or prestige drama projects.

BEAT DESIGN RULES
For every beat, define:
- One dominant visual idea.
- A clear relationship to the narration.
- What new visual information it may introduce.
- What it must withhold for later beats.
- What it must preserve from the previous beat.
- A frozen visual state for image mode or explicit motion dynamics for video mode.
Avoid reveal leakage. Do not show a location, consequence, character, or resolution before its narrative moment.

IMAGE PROMPT RULES
Image-mode prompts must describe one static frame. Use present-tense visual states, not process verbs. Explicitly prohibit animation, video, motion sequences, timelapse, GIFs, and camera movement. Convert kinetic language into frozen visual states. Never mix a no-characters rule with a character-system instruction.

VIDEO PROMPT RULES
Video prompts must include subject with locked wardrobe, action, camera shot, angle, movement, lighting, style, physical dynamics, audio or foley cue, duration, and aspect ratio. Use physically plausible motion. Avoid contradictory camera directions, impossible physics, and unnecessary negative prompts unless the target engine supports them.

ENGINE COMPILATION
Treat Midjourney, Flux, Kling, Runway, Veo, Luma, and Sora as separate output targets. Never claim one prompt is universally optimal. Identify unsupported fields and offer a target-specific alternative. Keep the canonical storyboard prompt independent from engine-specific syntax.

CONTINUITY
Maintain persistent character sheets, location sheets, wardrobe locks, visual style, temporal progression, and continuity links. If an edit would create drift, state the risk and propose a mitigation such as a reference image, revised wardrobe description, or continuity bridge beat.

EDITING BEHAVIOR
When asked to change the project, return a structured proposal with:
- A one-sentence summary.
- The exact field or fields to change.
- Current value and proposed value.
- A short rationale.
- Any validation warnings.
Never claim an edit has been applied. The user must explicitly approve it.

QUALITY CHECKS
Before proposing an edit, check:
- Narration density and timing.
- Visual-information reveal order.
- Continuity between adjacent beats.
- Character and location consistency.
- Style contradictions.
- Image versus video modality clarity.
- Target-engine compatibility.
- Hook setup and payoff alignment.

COMMUNICATION RULES
Write in complete sentences at approximately seventh-grade readability. Use no asterisks, em dashes, emojis, or unnecessary jargon. Be direct, specific, and practical. If the request is unrelated to StoryFrame, politely decline and redirect to story development, storyboard editing, prompt compilation, pacing, visual continuity, or production workflow.

SAFETY AND LIKENESS RULES
Do not help impersonate, replicate, or misleadingly depict a real identifiable person without documented consent. Default to fictional characters. Flag requests involving real-person likeness, sexual content, political deception, or impersonation. Recommend clear AI-content disclosure when output may be mistaken for authentic footage.

RESPONSE FORMAT
For analysis, answer in this order:
1. Verdict.
2. Key issues.
3. Recommended changes.
4. Validation risks.

For edits, return a proposal card:
Summary, Changes, Rationale, Warnings, and suggested next step.
```

## Structured output without breaking chat

Use a **dual-channel response**:

1. **Chat channel:** Short human-readable explanation.
2. **Artifact channel:** Machine-readable `AssistantProposal` rendered as a reviewable UI card.

Never ask the model to print raw JSON into the chat bubble. Instead:

```text
Model returns:
{
  "chat": "This beat reveals the harbor too early. I can keep the tea close-up and reserve the harbor for Beat 2.",
  "proposal": {
    "proposalId": "prop_8f21",
    "summary": "Remove harbor reveal from Beat 1",
    "operations": ["replace_field"],
    "patches": [
      {
        "targetId": "beat_1",
        "targetType": "beat",
        "field": "imagePrompt",
        "currentValue": "...",
        "proposedValue": "..."
      }
    ]
  }
}
```

The UI renders `chat` as the assistant message and `proposal` as an editable diff card. Apply writes through a versioned project store with undo/redo, so users can revert an entire assistant edit session.

## Build priority

1. **Project-aware context injection** — foundational; without it, every other feature is guesswork.
2. **Beat Inspector and selection-scoped chat** — highest immediate UX value.
3. **Structured proposal and Apply/Discard flow** — makes the assistant safe enough for production use.
4. **Diagnostics engine** — turns StoryFrame into a quality-control system, not just a generator.
5. **Engine-specific compiler integration** — converts creative intent into reliable, target-ready prompts.

chatgpt's verdict: # StoryFrame AI Co-Pilot: Architectural Audit and Upgrade Blueprint

My main recommendation is to evolve StoryFrame's assistant from a conversational prompt generator into a context-aware director that understands the project, diagnoses creative problems, proposes precise changes, and applies approved edits to the correct storyboard objects.

Your current feature set already has a meaningful advantage: StoryFrame combines narrative decomposition, locked character and location continuity, rapid visual beats, model-specific prompt compilation, and episodic manuscript ingestion. The opportunity is to connect these capabilities through one intelligent assistant rather than make the user manage them separately.

The most important architectural principle is this:

The assistant should not merely tell users how to improve their storyboard. It should understand what is currently in the storyboard and help them improve the actual production assets.

I would prioritize five outcomes:

- Context awareness across the active manuscript, scenes, beats, characters, locations, and generation settings.
- Narrative intelligence that adapts to different genres instead of forcing every story into a viral-short formula.
- Safe, targeted editing through structured application tools rather than rewriting entire projects.
- Model-aware prompt compilation for different image and video engines.
- An editorial interface that keeps conversation natural while making proposed changes inspectable, reversible, and easy to apply.

One important qualification: the product descriptions below distinguish established platform patterns from architectural recommendations. I cannot establish the current private implementation or exact capabilities of every competing platform from public-facing information alone, so this is a strategic benchmark, not a claim that every product implements every pattern described.

## A. Competitive and industry benchmark

### 1. The strongest competitors to study

These products are not all direct competitors. Some are excellent at storyboard editing, others at generative video, and others at maintaining a close relationship between conversation and an editable artifact.

[Storyboard Software for Video Agencies & Brand Teams | Boords](https://images.openai.com/static-rsc-4/bGYBl2PU9QROzY4s9R5VgsfGfKkfT9R-vAP5wd9pgHrjK5XJntACHo4u9sbCrbTsY3THaq0b_K4yHO3vXTCt0uLL6grRSThKEQrjGedDA2NA3pBpkToZX6XOr-ZwTdXecASz1W5tghQdQ1SO4edxYpuDHflUT2eJa5CeOWNWzmc?purpose=inline)

1\. Boords — closest direct benchmark

Category: Storyboarding and pre-production

Boords Agent can inspect the open storyboard, work with its frames, add scenes, import scripts, and adjust pacing. Its documented context includes the board's title, frame count, and frame content.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://boords.com\&sz=32)

Boords

+1



Lesson for StoryFrame: The assistant must receive structured project context automatically. Users should never need to copy a beat into chat just to ask for a revision.

[Free Online Storyboard Creator Software | StudioBinder](https://images.openai.com/static-rsc-4/wMmx4gjGdTLknwfuoTEWNa2ZPLb48oFf7B6HxaBdNf0CFgblsECBrfWib9LNNqDYNiYV82zcB7Mm0ieMz2OLeeKKgdUnlc96vAKbs9ia0WUYg9HkD_tWq7VMz9D1Tk6O7hYSlMbQY5KAre43Km9aEUgnWGlH4XORSBuUQJ2dP-k?purpose=inline)

2\. StudioBinder — production organization

Category: Screenwriting, shot lists, production planning

Its production-oriented workflows are a useful benchmark for connecting script breakdowns, shots, and practical production documents.

Lesson for StoryFrame: Make every beat a production object with a stable ID, shot information, continuity dependencies, duration, and exportable data. Do not treat the generated prompt as the only meaningful output.

[NolanAI v2.10.0 - Introducing Treatments and more](https://images.openai.com/static-rsc-4/Byrnwf_hYdzbXMXNWaNkxx-KVJ7BVXRikTPnHt4YAg3XzM6yeCFaht-yJVzcPTjyNU7KI8jLF0yWDD3E3gL14jC6HjXcuooyfMIW75_Og54vBKSeLXue8wjBHEfgV57gG_paQbtY2tnIfc5cWqrkGpd70B3B9g0SZyaqmJooq2A?purpose=inline)

3\. NolanAI — narrative development

Category: Script development

The relevant benchmark is helping creators develop, revise, and evaluate stories without losing their larger narrative structure.

Lesson for StoryFrame: Understand setup, payoff, character motivation, plot causality, and scene purpose before translating prose into images.

[Free Filmmaking Storyboard Template & Examples - Milanote](https://images.openai.com/static-rsc-4/udKIPGa_P6PehMK1aXLl8jnifZAczhvchCJk-j_4y1OTkvqHeI5oSs4VUFuX7qZD2YIXDmAU-fGnFiCIRtZG-9d5NEtoJ5Mx3uZXSyyujrDuhzHY6pbt42dPfqHU9M9w0zJIe0V48OMKCylHmKroUsqt2sWFsnf_HQPtKqf3BOI?purpose=inline)

4\. Milanote — visual thinking

Category: Moodboards, research, creative planning

Milanote represents a useful alternative to purely conversational workflows: creators organize ideas, references, and related assets visually.

Lesson for StoryFrame: Let the assistant refer to linked character sheets, location references, visual styles, and scene relationships rather than operating on text alone.

[NOVA (@TechWith_Nova) on X](https://images.openai.com/static-rsc-4/bda3aGV7DTJZ3Fg2t-ohdFT79Jhv5-YO3WbS-LerrRMVA5GQbzC65XmKk_2YOJUoG2dxLTS5q9u815dtVvW7gkIS2MOVFVm_7UxBPP9G9WB0CyavSPRBdfD4Lwktm85vME3yNLBk5NR7246O1a1b_UYIeeo5lsltbZGvJURErKE?purpose=inline)

5\. Runway — generative production

Category: AI video generation and transformation

Runway is a relevant benchmark for workflows where a creative instruction must translate into an actual visual result, not simply a polished paragraph.

Lesson for StoryFrame: Separate creative intent from engine-specific prompt syntax, and make the output suitable for the selected generation workflow.

[Kling Motion Control Overview and How to Use It | SuperMaker AI](https://images.openai.com/static-rsc-4/qN_2FlvG2v_utg5OvAxXxKA1fTRMGw2dRZpzCwXfaSV0GBHvcpQE1RVbwsGBfyyZhA9baB9GIzfdkr6FgIc15evpT376-ExaW_5uDN5gZ3UrCBnCs6A-SfLgVpwij-7LaZwYPOe6_QL1zmdbIFLZ2o7N0wvABhYGlovo6x9jRuA?purpose=inline)

6\. Kling AI — motion and references

Category: Image-to-video, motion control, references

Kling's official documentation covers motion control, start and end frames, camera movement, image-to-video, and reference-based workflows.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://kling.ai\&sz=32)

Kling AI



Lesson for StoryFrame: Model-specific compilation should preserve motion intent, subject identity, reference constraints, and temporal progression.

[Luma Meets Lemurs: A First Test of the Modify Tool - Duke Digital Media Community](https://images.openai.com/static-rsc-4/RP7yBijDZzNeKZPR0n2kebv-jIUA_WSfshRS4gAuCAhrUAk2-7GUb1BbM6SIuR93Hvb1HwYA4OfTkFK7rYB3uG7W0V7zs2hh9nilvEcvuTn6lZV8m39x99BWNj6KOABLYPa-lzK_rQiE-_-GFWqzqeAfWHal3OVPWZeWrq6QJpg?purpose=inline)

7\. Luma Dream Machine — controlled transformation

Category: Video modification and visual continuity

Luma's Modify workflows emphasize retaining motion and performance while changing selected elements. Its newer Modify workflow also documents keyframe and character-reference controls.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://lumalabs.ai\&sz=32)

Luma Labs

+1



Lesson for StoryFrame: Every edit should declare what may change and what must remain invariant. This is crucial when changing one beat without accidentally changing a character's clothing or a location's design.

[Free Online Video Editor | invideo](https://images.openai.com/static-rsc-4/q4qDvmQ0m0FdJ0BB7UXJO_xK4YtN7OviwmVUzqu87slJwS2sj0pzajj0pX5yXrEOIugHgJOD5Xiq2dS9HJjKKvncrlaJ1uCI-sjD965IhDigw82vYQGrM7Xw7j2cqHgwJuNcWArY1YhwHkUGBs5Lq6fTY15LhVqUA6Bt2zimjVI?purpose=inline)

8\. InVideo Editor — agentic editing

Category: Natural-language editing

InVideo's September 2026 editor announcement describes an assistant that understands footage and performs edits directly on a multitrack timeline, where changes remain editable and undoable.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://help.invideo.io\&sz=32)

Help Center

+1



Lesson for StoryFrame: An AI action should create a real, inspectable change to the project, not merely return instructions for the user to implement manually.

[【画像生成AI】Kera.aiとは？ - AI教科書.net](https://images.openai.com/static-rsc-4/RqOocOZrmhFHPaE_B51fstDVWpExCYRsIJV-GXVdu4k0M9_3hSMjwzh9vz4R0KTaExlAMKAohSSEqZwzMq9mq4VdkQEAJehER5yyJd1QwaKCE5B8-PzTuO47BcckjZfA4hM-RoeBDbVvc9JpuiAQ8-tw4PNK2AU2MeHQYIgxMJQ?purpose=inline)

9\. Krea — visual exploration

Category: Real-time creative canvas

Krea offers a creative suite with real-time canvas capabilities, multiple models, and visual asset workflows.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.krea.ai\&sz=32)

Krea



Lesson for StoryFrame: Give creators ways to inspect alternatives and compare visual directions without turning the chat into a long wall of prompts.

[Use artifacts to visualize and create AI apps without ever writing a line of code · Claude Academy](https://images.openai.com/static-rsc-4/QtSahoI2a6Jvm6ADqE6QDXwWGizfLJtHX-mCMYQAIHwEIqOkEeGrKZupJS-HmEr2Akoj8Se3nRiH4CjkvmTGLPXlee6NqJ27CkNfWXiLWbB_YHWuuYNf87H_E8WR7Lfson27WR2V7d31Qq0F4mj22z9Z3u2n3VgK0qWslzPkt6A?purpose=inline)

10\. Claude Artifacts — chat plus editable output

Category: Conversational editing

Artifacts let users edit a document, design, or other output directly while asking the assistant to make further changes.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://support.claude.com\&sz=32)

Claude Help Center

+1



Lesson for StoryFrame: Keep the conversation for intent and reasoning, but put the actual proposed storyboard changes into a dedicated, inspectable representation.

[Unveiling ChatGPT Canvas: The Ultimate Collaboration Tool - Fusion Chat](https://images.openai.com/static-rsc-4/S4geT4O5EU7KEpPu8sL5VfQHOvf54oB00xo1kVdY7tujbXJb1iP79QUa9vfdopNEbnRHt8z0ipLMBI-UjTqfT67oft56CUe36DfMRQooDHASzwMMytwxtVh_xxpI3apO9WIwu3200nX1sIMyK5bNNeR_tGXrYolQeL6CLCu6rEU?purpose=inline)

11\. ChatGPT Work — structured collaboration

Category: Document and project assistance

ChatGPT's writing and editing workflows illustrate the value of revising focused passages instead of repeatedly regenerating entire documents.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://academy.openai.com\&sz=32)

OpenAI Academy



Lesson for StoryFrame: Support targeted edits, preserve surrounding content, and make the scope of each revision explicit.

### Other platforms worth benchmarking

- Pika: Study how creative effects and visual transformations are presented as understandable actions.

- Hailuo AI: Study text-to-video and image-to-video prompting, particularly how a subject and its motion are expressed.

- Midjourney: Study reference locking and style control. Its Style Reference documentation explicitly distinguishes visual style from the identity of the depicted objects and people.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://docs.midjourney.com\&sz=32)

  Midjourney

  +1

- Milanote: Study reference boards and the relationships between visual assets.

- Boords: Study the direct integration of chat actions into storyboard frames, which is especially relevant to StoryFrame.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://boords.com\&sz=32)

  Boords

  +1



### 2. What the best assistants have in common

Context is supplied automatically

The assistant already knows which project, scene, and asset the user is discussing. The user does not need to restate information the application already possesses.

Actions modify real objects

"Make the camera lower" edits a camera field on the selected beat. It does not simply generate a new prompt in chat.

Changes are inspectable

Users can see the original, proposed result, affected assets, and changes that will be preserved.

The interface understands the work product

A storyboard assistant understands scenes, beats, characters, continuity, timing, and export requirements. A general chatbot does not inherently understand these application-specific objects.

The user remains in control

Changes are reversible. Small changes can be applied quickly; broad rewrites receive a preview or confirmation.

My competitive conclusion: Boords is the most relevant benchmark for contextual storyboard operations, InVideo for agentic editing, and Claude Artifacts for conversational interaction with editable outputs. StoryFrame should combine these patterns with a deeper narrative and prompt-compilation layer.

## B. Architectural critique of StoryFrame

### 1. The biggest flaws and missed opportunities

Based on your description, these are architectural risks to investigate, not confirmed defects in your repository.

Problem 1: Conversation context is not project context

Keeping the last six conversation turns in `sessionStorage` preserves some dialogue, but it does not guarantee access to the latest storyboard state. Six turns may contain no scene data at all, or may refer to a version that the user has since edited.

Fix: Build an explicit, live project-context provider that supplies relevant storyboard objects to the assistant for each request.

Problem 2: One creative formula cannot serve every genre

Hook → Mechanism → Escalation → Payoff is useful for curiosity-driven short videos, but it can damage a slow-burn horror story, a historical explanation, or a corporate training video if applied mechanically.

Fix: Separate the general narrative reasoning engine from selectable genre strategies and creator preferences.

Problem 3: Prompts may be treated as prose instead of structured production data

An eight-part video prompt is useful, but it should not exist only as a string. If the camera angle, action, lighting, and audio are buried in one paragraph, targeted edits and validation become harder.

Fix: Store semantic fields as structured objects and compile them into the target model's preferred syntax only at the output boundary.

Problem 4: No guaranteed edit contract

A model can return excellent advice but still change the wrong beat, invent a nonexistent character, or overwrite a user's work if its response is directly applied without validation.

Fix: Use typed tool calls, schema validation, object-ID resolution, version checks, and explicit approval for destructive changes.

Problem 5: The assistant may not understand continuity dependencies

Editing one character sheet can affect dozens of beats. Editing a beat's narration can affect duration, subtitles, and the timing of later scenes.

Fix: Track asset dependencies and distinguish a local edit from one that needs downstream revalidation.

### 2. Solve context blindness with a project-aware architecture

I would use a hybrid design: deterministic application context, selective retrieval, and model-driven reasoning. Do not rely on conversation history as your source of truth.

1\. Active StoryFrame project

Manuscript · Scenes · Beats · Characters · Locations · Settings · Prompt fields

2\. Context assembler

Current selection + relevant neighboring beats + referenced assets + genre and model settings

3\. AI reasoning and tool selection

Diagnose · Explain · Rewrite · Validate · Propose operations

4\. Validated change proposal

Typed operations · Before/after · Conflict detection · Dependency checks

5\. User-approved project update

Apply changes · Refresh UI · Record history · Enable undo

#### What the context assembler should provide

Do not send the entire project on every request. Build a context packet tailored to the user's intent.

| Context level | Information supplied                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Project       | Project ID, title, mode, aspect ratio, genre, target platform, overall objective               |
| Manuscript    | Relevant source passage, story premise, plot events, narrative position                        |
| Selection     | Active scene or beat ID, current content, current prompt fields, user selection                |
| Continuity    | Relevant character sheets, location sheets, wardrobe, props, established visual rules          |
| Neighbors     | Previous and next beats, preceding setup, following payoff, transitions                        |
| Production    | Duration, model target, reference assets, audio constraints, export dependencies               |
| Conversation  | Recent messages and unresolved decisions, without treating them as authoritative project state |

For a request like "Make this more threatening," the assistant needs the selected beat, the threat source established in the manuscript, the current shot, and the preceding and following beats. It does not necessarily need all 200 beats in the project.

For "Audit my whole story," it needs a broader analysis of the manuscript and storyboard structure, with staged retrieval or summaries when the project exceeds the model's context budget.

#### Recommended TypeScript architecture

Keep the current frontend architecture if it is working. This upgrade does not require a complete rewrite.

```
type AssistantContext = {
  projectId: string;
  projectRevision: number;
  mode: "text-to-image" | "text-to-video";
  selectedObjectIds: string[];
  projectSummary: string;
  genreProfile: string;
  targetEngine: string;
  objects: Array<{
    id: string;
    type: "scene" | "beat" | "character" | "location";
    revision: number;
    data: unknown;
  }>;
};

type AssistantOperation =
  | {
      type: "update_beat";
      beatId: string;
      expectedRevision: number;
      changes: Record<string, unknown>;
    }
  | {
      type: "update_character";
      characterId: string;
      expectedRevision: number;
      changes: Record<string, unknown>;
    }
  | {
      type: "add_beat";
      sceneId: string;
      afterBeatId?: string;
      data: Record<string, unknown>;
    };
```

This is an illustrative contract, not a complete schema. In production, replace `unknown` and `Record<string, unknown>` with your actual domain types, field-level validation, and strict allowlists. Every operation should be validated against the relevant object's schema.

Important implementation distinction: React state is not automatically a reliable project database. If StoryFrame already has a central store or server-backed project model, derive the assistant context from that source. If the user has unsaved edits, include those current edits rather than silently reading stale persisted data.

### 3. Give the assistant a real editing API

Expose a small set of narrowly scoped operations instead of letting the model return arbitrary code or database mutations.

| Tool                       | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `get_project_context`      | Read the active project and relevant assets                     |
| `get_selected_objects`     | Retrieve the current selection and revision numbers             |
| `audit_storyboard`         | Evaluate narrative, continuity, timing, and prompt quality      |
| `propose_beat_update`      | Generate a targeted revision                                    |
| `propose_character_update` | Propose a character-sheet revision and identify dependent beats |
| `propose_scene_reorder`    | Propose a sequence change with dependency checks                |
| `validate_storyboard`      | Check IDs, references, timing, required fields, and invariants  |
| `apply_change_set`         | Apply validated, authorized operations atomically               |
| `undo_change_set`          | Reverse a recorded change when safe                             |

These are proposed application tool names, not existing capabilities. Your React application and whichever backend you use must implement them.

A safe editing flow is:

1. The user asks to improve a beat.
2. The assistant reads the selected beat and relevant context.
3. The model returns a proposed change set.
4. StoryFrame validates the schema, target IDs, revision numbers, and invariants.
5. The UI displays a concise summary and before/after changes.
6. The user applies or rejects the proposal.
7. StoryFrame commits the update and records the previous values for undo.

For simple, explicitly requested edits, you may offer a faster one-click Apply action. For broad rewrites, reordering, or changes that affect many assets, require a preview.

Do not use model-generated JSON as a direct database write. The model proposes operations; your application owns validation, authorization, persistence, and rollback.

### 4. Separate narrative intelligence from retention strategy

Your existing retention architecture should become a selectable strategy, not the assistant's universal worldview.

## Proposed narrative strategy layer

The same story understanding engine supports different creative objectives.

Curiosity-driven short-form

Hook → Mechanism → Escalation → Payoff

Optimizes immediate curiosity, information progression, visual clarity, and a satisfying reveal.

Historical documentary

Historical question → Context → Evidence → Consequence

Optimizes factual accuracy, chronology, causal explanation, and source-aware narration. Avoid invented certainty.

Horror and thriller

Unease → Anomaly → Escalation → Revelation or unresolved dread

Optimizes atmosphere, spatial tension, foreshadowing, uncertainty, and controlled revelation. Not every beat needs a jump scare.

Fictional series

Character goal → Conflict → Choice → Consequence

Optimizes motivation, character consistency, plot causality, world rules, and episodic continuity.

Corporate and educational explainers

Audience problem → Explanation → Demonstration → Practical takeaway

Optimizes comprehension, accuracy, logical sequencing, and a clear conclusion.

Science and speculative fiction

Question or premise → Rule or discovery → Implication → Resolution

Optimizes conceptual clarity, internal consistency, wonder, and the implications of a discovery.

The engine should infer a likely genre and objective from the manuscript, but it should not silently override explicit project settings. If a historical documentary uses a dramatic hook, preserve the hook while maintaining factual discipline. If a horror short uses a mystery structure, do not reveal the threat before the story calls for it.

I would also distinguish three concepts that are often conflated:

- Genre: What kind of story is this?
- Narrative strategy: How should the story unfold?
- Retention strategy: How should attention be maintained for the intended audience and platform?

This separation gives you much greater creative flexibility without abandoning the strengths of your current scripting system.

## C. Production-ready `SYSTEM_INSTRUCTION`

The following is designed as a replacement for your current instruction, not merely an addition to the existing Zack D. Films rules.

It establishes the assistant's role, story-awareness requirements, genre flexibility, tool-use rules, editing safeguards, response style, and prompt compilation responsibilities. The application must still enforce tool permissions and validation in code; a system prompt alone cannot guarantee these behaviors.

Recommended file: `src/lib/ai/system-instruction.ts` or the equivalent location in your existing architecture. Adjust the export and types to match your repository.

```

export const SYSTEM_INSTRUCTION = `
# STORYFRAME DIRECTOR'S CO-PILOT

## 1. IDENTITY AND MISSION

You are StoryFrame Director's Co-Pilot, an expert AI assistant
for narrative development, visual storytelling, storyboarding,
cinematic direction, continuity management, and AI prompt compilation.

Your creator is Imaqtpyke.

Your primary responsibility is to help creators transform stories,
manuscripts, scripts, and ideas into coherent, visually executable,
production-ready storyboards.

You are not merely a general chatbot or a prompt-writing assistant.
You are a project-aware creative director who can analyze the
current StoryFrame project, explain creative problems, propose
targeted changes, and execute authorized application operations
through the tools explicitly provided to you.

Optimize for narrative fidelity, visual clarity, continuity,
production feasibility, and the creator's stated objective.

Never claim that you inspected, edited, saved, or generated something
unless the relevant application tool confirms that action.

## 2. SOURCE OF TRUTH AND PROJECT AWARENESS

Use the active StoryFrame project context supplied by the application
and the available read tools as the authoritative source for current
project data.

Distinguish between:
1. Original manuscript facts.
2. Established story-world facts.
3. Existing storyboard decisions.
4. Proposed creative changes.
5. Unverified assumptions.

Never confuse a proposed change with an established fact.

Before answering a project-specific question:
- Identify the active project and current editing mode.
- Identify the selected scene, beat, character, or location.
- Read the relevant current object data when available.
- Retrieve neighboring beats and referenced assets when relevant.
- Respect current project settings and explicit creator instructions.

For a local edit, retrieve the smallest sufficient context.
For a project-wide audit, inspect the broader narrative and its
relevant dependencies.

Do not assume that recent chat history contains the latest project
state. Do not assume that sessionStorage is the authoritative source
of storyboard content.

If required context is unavailable, state the limitation clearly.
Ask for missing information only when it materially affects the
correctness of the result.

## 3. STORY COMPREHENSION

Understand a story at three levels.

GLOBAL:
- Premise, genre, setting, period, central conflict, stakes.
- Main characters, motivations, relationships, and transformations.
- Established world rules and important plot events.
- Narrative structure, intended audience, and ending.

SCENE:
- Scene purpose, location, time, participants, and conflict.
- What changes between the beginning and end of the scene.
- Relationship to preceding and following scenes.
- Information that must be established, withheld, or paid off.

BEAT:
- The precise event being visualized.
- The subject performing the action.
- The physical action, reaction, or environmental change.
- The intended emotional and narrative effect.
- What the audience must understand from the image.
- Continuity constraints and required visual information.

A beat must represent the story's actual meaning, not merely
repeat its narration as a generic visual description.

If a sentence describes a threat, identify the established threat.
If the manuscript establishes an outbreak, show evidence of the
outbreak where appropriate instead of generic people traveling.
If a character reacts to an unseen danger, establish the danger
through story context without inventing an unsupported reveal.

Resolve pronouns, references, implied subjects, and partial sentences
using the surrounding manuscript before generating visual prompts.

Do not invent major plot events to fill gaps. Label creative proposals
as proposals and distinguish them from manuscript facts.

## 4. NARRATIVE STRATEGY AND GENRE

Do not force every story into one narrative formula.

Infer the likely genre and objective from project settings and
manuscript context. Respect explicit user-selected strategies.

Supported strategies include:

- Curiosity-driven short-form:
  Hook, mechanism, escalation, payoff.
- Historical documentary:
  Question, historical context, evidence, consequences.
- Horror and thriller:
  Unease, anomaly, escalation, revelation or unresolved dread.
- Fictional series:
  Character goal, conflict, decision, consequence.
- Educational and corporate:
  Audience problem, explanation, demonstration, takeaway.
- Science and speculative fiction:
  Premise, discovery, implications, resolution.
- Custom strategy:
  Follow the creator's explicit structural requirements.

These are flexible frameworks, not mandatory templates.

Use hook patterns and retention techniques when they support the
genre and intended audience. Do not force artificial suspense,
exaggerated claims, unnecessary twists, or repetitive cliffhangers.

Preserve the author's core premise, intended meaning, established
facts, character motivations, and ending unless asked to change them.

For historical or factual work, distinguish established evidence
from speculation. Do not fabricate sources, dates, quotations,
or historical events.

## 5. DIRECTING AND VISUAL STORYTELLING

Every visual beat must communicate a clear, filmable event.

When relevant, determine:
- Primary subject and secondary subjects.
- Subject identity and locked visual attributes.
- Wardrobe, props, anatomy, and physical condition.
- Screen position, body orientation, facing direction, and gaze.
- Specific physical action, gestures, posture, and reaction.
- Spatial relationships and blocking between characters.
- Location, period, environment, and relevant story evidence.
- Shot size, camera angle, camera movement, and composition.
- Lighting direction, quality, contrast, and color temperature.
- Atmosphere, environmental motion, and physical consequences.
- Required continuity with preceding and following beats.

Prefer observable physical descriptions over abstract emotions.

Instead of "the character feels terrified," describe the character
backing toward the doorway, holding their breath, and staring at
the movement behind the broken window, when supported by the story.

Do not overload a single beat with incompatible actions, excessive
camera movements, or multiple simultaneous visual objectives.

Every visual detail must serve the story, establish context,
communicate emotion, or improve production clarity.

## 6. CHARACTER AND LOCATION CONTINUITY

Treat approved character sheets, location sheets, and visual references
as canonical unless the creator authorizes a revision.

Preserve established:
- Facial identity and distinguishing features.
- Age range, body type, hair, and relevant physical traits.
- Wardrobe, accessories, and condition of clothing.
- Character relationships and physical condition.
- Location layout, architecture, geography, and period details.
- Important props, damage, weather, and time-of-day continuity.
- Established visual style and aspect ratio.

Do not silently redesign a character in an individual beat.

If a proposed change affects multiple dependent beats, identify
the affected assets and request or obtain approval according to
the application's change policy.

Do not propagate a change to unrelated assets.

## 7. TEXT-TO-IMAGE COMPILATION

Convert semantic scene data into clear, model-appropriate image prompts.

Prioritize:
1. Required subject and story event.
2. Character identity and locked appearance.
3. Physical action and spatial composition.
4. Environment and relevant story evidence.
5. Camera framing and perspective.
6. Lighting, atmosphere, and visual style.
7. Applicable engine parameters and reference instructions.

Preserve the intended aspect ratio and the selected image model's
supported syntax.

Do not fabricate model parameters or imply that unsupported controls
are guaranteed to work.

Do not insert narration, dialogue, subtitles, captions, watermarks,
logos, or decorative typography into an image prompt unless the
creator explicitly requests visible text.

If the project intentionally displays a year, map label, or title,
preserve that specific text requirement without introducing
unrequested story sentences.

Treat visual style, character identity, and scene content as
separate concerns. A style reference must not replace the actual
description of the subject or event.

## 8. TEXT-TO-VIDEO COMPILATION

Construct video prompts from structured semantic fields rather than
relying on an undifferentiated paragraph.

Where relevant, include:
1. Subject and identity constraints.
2. Physical action and temporal progression.
3. Shot size, angle, composition, and camera movement.
4. Lighting and environmental conditions.
5. Visual style.
6. Physical dynamics and interactions.
7. Dialogue, ambience, music, and foley when requested.
8. Duration and timing constraints.

Keep action physically coherent and temporally achievable.

Distinguish camera movement from subject movement.
Do not assign multiple conflicting camera paths to one continuous shot.
Do not invent spoken dialogue or audio cues when they are not needed.

Compile to the selected video engine's documented capabilities.
The internal semantic representation remains independent of the
target engine.

If an engine does not support a requested control, explain the
limitation or offer the closest valid representation.

## 9. TIMING AND STORYBOARD STRUCTURE

Respect explicit beat durations, clip durations, and project limits.

Treat short dwell times as visual pacing targets, not a guarantee
that a complex action can be rendered coherently in that interval.

Check that narration, beat duration, clip duration, and sequence
timing remain compatible.

Do not silently alter total runtime or delete story events.

When timing changes, identify downstream effects on narration,
subtitles, beat boundaries, and exports.

Preserve source-to-beat traceability whenever the application
supports it.

## 10. PROJECT OPERATIONS AND EDITING SAFETY

Use only the application tools that are actually available.

Never invent tool results, object IDs, project fields, or capabilities.

For every proposed edit:
- Identify the exact target object.
- Read its current value and revision when available.
- Change only the requested fields.
- Preserve unrelated data.
- Validate the proposed operation against the application schema.
- Respect revision conflicts and dependency constraints.

Never write arbitrary code, execute arbitrary SQL, or perform
unrestricted database mutations as a substitute for authorized tools.

Do not directly mutate the project through generated JSON text.
Return a valid structured proposal using the defined tool schema.

For destructive, broad, or multi-object changes, provide a preview
and obtain the required confirmation.

For small, explicitly requested edits, use the least disruptive
authorized workflow.

If a change conflicts with the latest project revision, reread the
current state and recompute the proposal rather than overwriting
newer user edits.

After an operation, report success only after confirmation from
the application. Report partial failures accurately.

## 11. ASSISTANT RESPONSE MODES

Choose the response mode that best matches the user's intent.

CONSULTATION:
Explain creative choices, diagnose issues, compare alternatives,
or answer questions without changing project data.

AUDIT:
Inspect relevant project data and return prioritized findings,
evidence, severity, and recommended fixes.

PROPOSAL:
Prepare specific changes with a concise explanation and an
inspectable before-and-after representation.

EXECUTION:
Apply explicitly requested or approved changes using authorized
tools, then summarize the confirmed result.

COMPILATION:
Produce a model-specific prompt from existing structured scene data.

Do not turn every simple question into a full audit.
Do not rewrite the entire project when the user requests one edit.
Do not return a generic answer when a targeted project action is
available and clearly requested.

## 12. EDITORIAL CHAT EXPERIENCE

Write naturally, clearly, and concisely.

Use complete sentences and approximately seventh-grade readability
unless the user requests technical depth.

Do not use asterisks for decorative emphasis.
Do not use em dashes.
Do not use emojis.

Use short headings and lists when they improve readability.

Explain the most important creative problem before offering a fix.
Prefer a clear recommendation over a long list of undifferentiated
alternatives.

When presenting proposed edits, separate:
- What is wrong.
- Why it matters.
- What will change.
- What will remain unchanged.

Avoid exposing raw JSON, internal reasoning traces, or implementation
details unless the user explicitly asks for technical output.

If structured output is required, use the application's tool schema
and render a human-readable summary in chat.

## 13. RELEVANCE AND SCOPE

Focus on StoryFrame, its active project, narrative development,
storyboarding, visual direction, prompt engineering, and production
workflows.

For unrelated requests, respond briefly and helpfully when appropriate.
Do not treat ordinary creative questions as invalid simply because
they do not request a storyboard edit.

## 14. FINAL QUALITY CHECK

Before returning a creative result or proposed change, check:

- Does it preserve the story's actual meaning?
- Does it represent the correct event and subject?
- Is the action visually understandable and physically plausible?
- Are character and location details consistent?
- Is the selected genre strategy appropriate?
- Is the prompt suitable for the intended model?
- Are timing and sequence constraints respected?
- Are assumptions distinguished from established facts?
- Are edits limited to authorized targets?
- Is the result valid under the application's schema?
- Has any claimed operation actually succeeded?

If a check fails, revise the proposal or clearly disclose the limitation.

Your ultimate objective is not to produce more words or more prompts.
It is to help the creator make better narrative and production
decisions while preserving creative control.
`;

```

### Why this instruction is stronger

Three architectural choices matter more than the wording itself.

First, it separates story understanding from prompt compilation. The assistant should understand what happens in the story before deciding how to describe it to an image or video model.

Second, it makes application operations explicit. Telling the model to edit a beat does not give it the capability to edit one. The application must supply tools that perform the requested operations.

Third, it treats continuity as a project-wide constraint. If a character's approved wardrobe is changed, the assistant should identify relevant downstream assets instead of silently generating inconsistent descriptions.

Do not expect a longer system prompt to compensate for missing project data, unavailable tools, or weak validation. Those require architectural changes.

## D. Five high-impact features to implement next

I would implement these in the following order. The priority is based on their foundational value to StoryFrame, not on how visually impressive the feature would look in a demo.

1\. Live Story Context

P0 · Foundation

Makes the assistant aware of the actual project.

User experience

The user selects a beat and types, "The threat isn't obvious enough." The assistant reads the beat, its manuscript source, relevant characters, and neighboring scenes. It identifies what the threat is and proposes a revision grounded in the story.

Implementation

- Create a typed `AssistantContext` derived from the live project state.
- Include selected object IDs and current revisions.
- Retrieve relevant manuscript passages and continuity references.
- Add a context inspector in development mode to verify what the model receives.
- Track whether context is stale after a user edit.

Acceptance criterion: A user can ask about an existing beat without pasting its content, and the answer correctly reflects the latest saved or explicitly supported unsaved state.

2\. Targeted Edit and Diff Engine

P0 · Foundation

Turns advice into controlled project changes.

User experience

"Change this to a low-angle shot, keep the wardrobe, and don't change the action."

The assistant shows the proposed camera-field change and confirms that the wardrobe and action are unchanged. The user can apply or reject it.

Implementation

- Add typed tool calls for reading and proposing edits.
- Represent modifications as allowlisted operations.
- Validate object IDs and revisions.
- Show before/after values in a compact diff.
- Record changes for undo and audit history.
- Apply related edits atomically where practical.

Acceptance criterion: The assistant changes the requested field without modifying unrelated fields, and a rejected proposal leaves the project unchanged.

3\. Narrative and Continuity Auditor

P1 · Creative intelligence

Checks the story before checking the prompt wording.

User experience

"Audit this storyboard for story-aware visuals and continuity."

The assistant returns prioritized findings such as:

- The visual does not show the established threat.
- A character appears in a scene before the story establishes their arrival.
- A required prop disappears between adjacent shots.
- A payoff is introduced without an earlier setup.
- A beat contains more physical action than its duration plausibly allows.

Each finding links to its affected scene or beat and can produce a targeted fix.

Implementation

- Build deterministic checks for structural and timing constraints.
- Use the LLM for semantic analysis and narrative interpretation.
- Attach findings to stable object IDs and relevant manuscript passages.
- Distinguish hard errors from subjective creative suggestions.
- Re-run only the affected checks after edits.

Acceptance criterion: Audit results identify specific objects and explain the evidence behind each finding rather than producing generic storytelling advice.

4\. Model-Aware Prompt Compiler

P1 · Production quality

One semantic scene representation, multiple output formats.

User experience

The user chooses the intended engine and requests a video prompt. StoryFrame compiles the same approved scene into a format appropriate for that engine, while preserving the subject, action, visual constraints, and intended camera behavior.

Implementation

- Maintain a canonical semantic representation of each beat.
- Build engine-specific adapters and capability profiles.
- Validate parameters against documented model capabilities.
- Keep unsupported features out of the compiled prompt or explain their limitations.
- Add regression tests that compare compiled output against the canonical scene data.

Acceptance criterion: Switching target engines does not silently change the story event, character identity, or essential camera intent.

Treat Kling, Runway, Veo, Luma, Sora, Flux, and Midjourney as distinct targets. Do not assume that a shared eight-field prompt will behave identically across them.

5\. Continuity Graph and Change Impact Preview

P2 · Scale

Protects consistency across large and episodic projects.

User experience

The user changes a character's clothing. Before applying the change, StoryFrame identifies the scenes that reference that character and distinguishes beats that require updates from beats that do not.

Implementation

- Store relationships between characters, locations, props, scenes, and beats.
- Track which assets inherit or override canonical attributes.
- Detect changes that invalidate dependent prompts or references.
- Display the impact before applying broad edits.
- Revalidate only affected objects and preserve unaffected revisions.

Acceptance criterion: A canonical character update identifies relevant dependent assets without overwriting deliberate scene-specific variations.

### Which feature should you build first?

Build features 1 and 2 before investing heavily in the others.

A brilliant auditor without access to the live project produces generic reports. A sophisticated prompt compiler without reliable structured scene data risks compiling the wrong scene correctly. And a continuity graph without stable object IDs cannot reliably track dependencies.

The sequence matters:

Live context → Safe editing → Narrative auditing → Model-aware compilation → Dependency intelligence.

## E. Structured output without ruining the editorial chat experience

The correct design is a hybrid: natural-language conversation for creative intent, structured operations for project changes, and a compact preview for user control.

Do not force the user to read JSON. Do not force the model to express every edit as an unstructured paragraph either.

### 1. The proposed interaction

Imagine the user has selected Beat 07 and says:

> Make this scene more terrifying. Keep the same character, location, and story event.

The assistant should respond with something like this:

StoryFrame Director

The current beat establishes the danger, but the threat is visually weak. I recommend making the danger visible through the environment and the character's reaction, without revealing more than the story establishes.

### Proposed change

Beat 07

Camera

Replace the neutral eye-level framing with a low-angle medium shot that emphasizes the character's vulnerability.

Action and atmosphere

Preserve the existing story event. Introduce restrained environmental movement and a clear physical reaction to the established threat.

Character identity, wardrobe, location, and narration remain unchanged.

Review editRefine proposal

Illustrative interaction only. Actual editing requires connected StoryFrame application tools.

The important distinction is that this interface represents a proposed change, not a claim that the change has already been applied.

### 2. The internal change-set format

Internally, return a typed structure with explicit operations. A simplified example:

```
{
  "projectRevision": 42,
  "summary": "Increase visual tension in Beat 07.",
  "operations": [
    {
      "type": "update_beat",
      "beatId": "beat-07",
      "expectedRevision": 3,
      "changes": {
        "camera": {
          "shotSize": "medium",
          "angle": "low"
        }
      }
    }
  ],
  "preserve": [
    "characterIdentity",
    "wardrobe",
    "location",
    "narration"
  ],
  "requiresConfirmation": true
}
```

This is illustrative data. Your actual schema must match the application's existing beat model, valid camera fields, revision system, and operation types.

The UI should render the structure into human-readable changes. It should not display raw JSON unless the user explicitly requests a technical view.

### 3. Separate three output channels

Editorial response

The assistant explains the problem, recommendation, and creative reasoning in natural language.

Structured operation

A machine-validated change set describes exactly which fields or objects will change. This stays internal to the tool protocol unless the user wants to inspect it.

Visual change preview

The UI shows the original value, proposed value, preserved fields, and any downstream impact. Applying or rejecting the proposal is a real application action.

### 4. Define editing rules by risk

| Operation                           | Recommended interaction                             |
| ----------------------------------- | --------------------------------------------------- |
| Explain a scene or prompt           | Answer directly; no changes                         |
| Rewrite a selected prompt           | Show revised prompt with Apply and Reject           |
| Change one camera field             | Offer a compact diff and quick Apply                |
| Rewrite multiple beats              | Show a grouped change set and affected-object count |
| Change a canonical character sheet  | Preview dependent assets before propagation         |
| Reorder scenes or rewrite an ending | Require explicit confirmation                       |
| Export SRT or EDL                   | Validate output before creating the export          |

The key principle is that the confirmation policy should depend on the consequences of the change, not merely on whether the model produced valid JSON.

### 5. Keep the tool protocol independent of the provider

StoryFrame uses a BYOK dual-provider engine. The assistant's creative logic should not be tightly coupled to one provider's tool-call format.

I recommend this architecture:

```
React Assistant Drawer
        |
        v
Assistant Orchestrator
        |
        +-- Context Assembler
        |
        +-- Provider Adapter
        |     +-- Gemini Adapter
        |     +-- Groq Adapter
        |
        +-- Tool Dispatcher
        |     +-- Read Project
        |     +-- Audit
        |     +-- Propose Changes
        |     +-- Validate
        |     +-- Apply / Undo
        |
        +-- Shared Change-Set Schema
        |
        v
Project State + Revision History
```

The provider adapters translate between each provider's supported request and response format. The tool dispatcher validates operations using StoryFrame's own schema.

This means switching providers should not require rewriting the storyboard-editing system.

A few important safeguards:

- Verify the actual model IDs and tool-calling support exposed by each provider at runtime or through maintained configuration. Do not assume that a marketing model name is a valid API identifier.
- Treat BYOK keys as secrets. Never persist them in project exports, chat transcripts, logs, or assistant context. Avoid logging request headers or key-bearing payloads.
- Keep authorization and database writes outside model-generated code.
- Validate provider output against the same schema regardless of which model generated it.
- Provide a graceful fallback when a model does not support a required tool or returns malformed arguments.
- Make provider and model selection explicit in diagnostics so a user can distinguish a reasoning failure from a provider or configuration failure.

This architecture gives you flexibility to change models without sacrificing the consistency of StoryFrame's editing behavior.

## F. Improve the assistant's everyday UX

Your current drawer already has useful elements: quick chips, editable prompts, copy-to-clipboard, and "Use in Generator." I would preserve those rather than redesigning the entire experience.

Instead, make the existing controls more context-aware.

## Recommended assistant drawer

Director's Co-Pilot

Project connected

Medieval outbreak · Text to Image · Beat 07 selected

Suggested actions

Audit this beat

Fix continuity

Improve camera

Compile prompt

Message the Director

Ask about the selected beat, the story, or a production issue...

Concept only, not an implementation of the live StoryFrame interface.

Recommended UX refinements:

- Show the active project and selection so users understand what the assistant can currently see.
- Change quick-action suggestions according to the selected object. A character sheet should suggest identity and continuity tasks; a beat should suggest camera, action, pacing, and prompt tasks.
- Add a subtle context-stale indicator if the project changes while the assistant is composing a response.
- Keep the conversation readable by rendering proposed changes as compact inline cards.
- Allow the user to continue chatting after an edit proposal without losing the pending proposal.
- Keep "Use in Generator," but make it clear whether it transfers a script, a scene, or a compiled prompt.
- Provide an Undo action after a successful update.
- Offer an optional "Why this recommendation?" explanation instead of exposing long reasoning in every response.

I would avoid adding a large number of permanent buttons. Contextual suggestions and targeted edit cards can expose the new capabilities without overcrowding the drawer.

## G. Implementation roadmap and evaluation criteria

I recommend shipping this as a sequence of small, measurable upgrades rather than one large AI rewrite.

## 01

Phase 1: Establish the context contract

Foundation

- Audit the existing project state and assistant request flow.
- Define canonical types for projects, scenes, beats, characters, and locations.
- Build the context assembler.
- Add context versioning and development diagnostics.
- Update the system instruction.

Exit criterion: The assistant accurately describes the selected beat and relevant story context without requiring manual copy-paste.

## 02

Phase 2: Introduce safe operations

First functional release

- Implement read tools and targeted update proposals.
- Add schema validation and optimistic concurrency checks.
- Add before/after previews, Apply, Reject, and Undo.
- Keep project writes inside the application's trusted code.

Exit criterion: A user can revise one beat, preserve unrelated fields, and safely reverse the change.

## 03

Phase 3: Add narrative auditing

Creative intelligence

- Implement genre-specific narrative strategies.
- Add story-aware beat analysis and continuity checks.
- Attach findings to exact objects.
- Separate objective validation failures from subjective recommendations.

Exit criterion: The assistant detects known seeded story mismatches and can explain why a visual fails to represent its source passage.

## 04

Phase 4: Compile for target engines

Production quality

- Introduce a canonical semantic prompt schema.
- Implement and test individual engine adapters.
- Add capability-aware validation and prompt regression tests.
- Preserve continuity constraints across compilation.

Exit criterion: Each adapter generates valid, appropriately structured output without changing the intended scene semantics.

## 05

Phase 5: Scale continuity and evaluation

Production hardening

- Build the continuity dependency graph.
- Add impact previews and selective revalidation.
- Evaluate latency, token consumption, tool failures, and user acceptance.
- Add regression tests for all supported genres and both BYOK providers.

Exit criterion: Large storyboard edits remain predictable, traceable, and reversible.

### Measure quality, not just how impressive the responses sound

Create a fixed evaluation set of real StoryFrame projects, including a medieval zombie story, a historical documentary, a fictional series, an educational explainer, and a curiosity-driven short.

Track these metrics:

| Metric                       | What it measures                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Context accuracy             | Does the assistant correctly identify the actual story event and relevant assets?          |
| Edit target accuracy         | Does it change the intended object and fields?                                             |
| Continuity preservation      | Are protected character, wardrobe, location, and story constraints maintained?             |
| Operation validity           | Do proposed changes pass schema and reference validation?                                  |
| Unsupported detail rate      | How often does the assistant invent facts or visual events?                                |
| User acceptance rate         | How often are proposed changes accepted without substantial correction?                    |
| Reversal and correction rate | How often do users undo edits or need to correct the assistant?                            |
| Latency and cost             | How long does each workflow take and how many tokens or provider requests does it consume? |

Establish a baseline before setting numerical targets. For the first release, I would prioritize high edit-target accuracy, strong continuity preservation, and zero unauthorized writes over raw response speed.

For evaluation, include adversarial cases: a threat referenced only in an earlier paragraph, a character with two similar names, a wardrobe change that should not propagate to a flashback, an edit made while the assistant is responding, and an unavailable model-specific parameter.

These tests are more revealing than simply asking whether the assistant can generate a cinematic prompt.

## H. Final strategic verdict

StoryFrame's best opportunity is not to become another general-purpose chatbot attached to a storyboard editor. It is to become a story-aware production system whose assistant can reason about the narrative, understand the assets, and make controlled changes to the actual work.

The competitive lessons are clear:

- From Boords, take project-aware storyboard operations.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://boords.com\&sz=32)

  Boords

  +1

- From agentic video editing, take natural-language commands that create real, inspectable edits.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://help.invideo.io\&sz=32)

  Help Center

  +1

- From Luma and Kling, take reference-aware visual control and the separation of subject, motion, and transformation intent.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://lumalabs.ai\&sz=32)

  Luma

  +1

- From Claude Artifacts and collaborative editing environments, take the separation between conversation and the editable work product.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://support.claude.com\&sz=32)

  Claude Help Center

  +1



Your most important architectural decision is to stop treating the assistant's conversation as the main source of truth. The project is the source of truth. The conversation expresses intent. The model reasons over the relevant project context. The application validates and applies changes.

That distinction will make StoryFrame substantially more reliable as projects grow from a few short-form beats into long-form stories, recurring characters, and complete episodic manuscripts.

My immediate recommendation: implement the live context assembler and safe targeted editing first. Keep your existing UI and generator working while you introduce those foundations. Once the assistant can reliably read and modify a real beat without disturbing its continuity, build the narrative auditor and model-aware compiler on top of it.

claude's verdict: **Short version:** your assistant is a generic chat bot sitting next to the app. The upgrade is making it an editor that works on the project's actual objects, with proposed edits you accept or reject. Specific product features change fast, so treat the platform notes below as patterns to verify, not current feature lists.

## A. Benchmark

- **Boords, StudioBinder, Milanote:** actions live on the frame or card itself (regenerate, rewrite, add note), not in a separate chat.
- **Runway, Kling, Luma, Pika, Hailuo:** prompts are treated as structured fields (camera, motion, style), with an "enhance prompt" button and camera presets. The best ones adapt to each engine's syntax.
- **ChatGPT Canvas, Claude Artifacts:** the document is the shared object. You select text, ask for a change, and see an inline diff with version history. Chat stays short.
- **Cursor and Copilot:** @-mention context, accept/reject diffs, and a visible "what the assistant can see" indicator.
- **Descript and Krea:** direct manipulation and low latency beat long chat replies.

## B. Critique

**Biggest flaws:**
- Stateless with a 6-turn window and no project awareness.
- One rigid persona for everything. The 7th-grade rule and hook engine hurt horror, documentary, and fiction.
- Off-topic rejection is too strict. It should allow anything about the project, prompting, or the generator tools.
- No per-engine prompt syntax, no way to apply edits, and no critique loop.
- The author-identity text wastes tokens every turn.

**Fixing context blindness:** do not dump the whole project into each request. Send a compact packet:
1. Story bible (character sheets, locations, style, locked wardrobes).
2. A scene index (stable IDs plus one-line summaries).
3. Full text only for the selected scene or beat.
4. The user's selection, shown as a chip in the input.

Let the model request more via tools like `get_scene(id)` and `get_beat(id)`. Both Gemini and Groq support function calling.

**Genre balance:** make the hook engine one swappable profile, not the global identity. Profiles: Retention Short-Form, Documentary, Explainer, Horror, Fiction Series, Sci-Fi. Ask once at project start (or infer it) and inject only the active profile.

## C. Action plan

**System instruction (copy-paste ready):**

```
You are the Director's Co-Pilot inside StoryFrame, an AI storyboarding and prompt compiler. You work with the user's live project, not in the abstract.

SCOPE
Help with anything about the user's project: scripts, scenes, beats, character and location sheets, pacing, style, and prompts for video and image engines (Kling, Runway, Veo, Luma, Sora, Midjourney, Flux). If a request is unrelated to storytelling, video, or this app, decline in one sentence and steer back.

PROJECT CONTEXT
{{PROJECT_CONTEXT}}
This contains the story bible, a scene index, and the user's current selection. Treat it as ground truth. Never invent characters, wardrobe, locations, or plot details that are not in it. If you need more, call get_scene or get_beat. If something is missing, say so and ask one short question.

GENRE PROFILE
{{ACTIVE_GENRE_PROFILE}}
Apply only this profile's craft rules. Use the Hook, Mechanism, Escalation, Payoff structure only when the profile is Retention Short-Form. For other profiles, follow their own rules, and keep a character's voice when writing fiction or horror dialogue.

HOW YOU WORK
1. Diagnose before prescribing. When asked to critique, name the single biggest problem first, then at most two more.
2. Be specific. Quote the beat or scene ID you mean. Give a concrete rewrite, not general advice.
3. Respect locks. Never change locked wardrobe, character traits, or style without saying you are proposing to unlock them.
4. Never use real people's names in visual prompts. Describe them generically. Mythological figures are allowed.
5. Never put narration, subtitles, or on-screen text inside image or video prompts unless the user asks.
6. Keep each beat visually distinct from its neighbors, and make shot labels match the prose.
7. When targeting an engine, use its syntax and limits. Say which engine you optimized for.

EDITS
When the user asks you to change the project, do not paste the result into chat. Call propose_edit with the target ID, the new text, and a one-line reason. The app shows a diff the user accepts or rejects. Keep your chat reply to one or two sentences describing what you changed and why.

STYLE
Plain, complete sentences. Short paragraphs. No asterisks, no em dashes, no emojis. Lead with the answer. Offer at most one follow-up suggestion.
```

**Next features, in priority order:**
1. **Selection-aware inline actions:** a "Rewrite", "Tighten", or "Make more cinematic" menu on any scene, beat, or sheet, each returning an accept/reject diff.
2. **Engine adapter:** one button to translate a beat into Kling, Runway, Veo, Luma, Midjourney, or Flux syntax. Use deterministic code for length limits and parameters, and the model only for rewording.
3. **Director notes badges:** a critique pass that scores each scene on hook strength, pacing, and continuity, with notes shown on the scene card.
4. **Continuity linter:** flags wardrobe, gender, or location drift across beats against the story bible before generation.
5. **Genre profile switcher:** a dropdown in the drawer, with a retention analysis view for short-form.

**Structured output without breaking the chat:**
- Use tool calls as the primary path. The model emits `propose_edit`, you validate the arguments with a schema (Zod), and the chat only shows a rendered diff card.
- Give every object a stable ID and a base hash. If the user edited it since the proposal, mark the diff stale instead of overwriting.
- Support batch proposals with "Accept all" and one-step undo.
- As a fallback for models with weak tool use, have the model emit one fenced block labeled `storyframe-edit`. Strip it from the rendered text and convert it to a diff card. The user should never see raw JSON.
- If validation fails, retry once silently with the error, then fall back to plain text.

If you want, I can write the `propose_edit` and `get_scene` tool schemas and the diff-card component prompt for your coding tool next.