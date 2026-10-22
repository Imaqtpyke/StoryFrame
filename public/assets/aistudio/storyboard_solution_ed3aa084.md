perplexity verdict: 
## Diagnostic verdict

Your three observations are correct, but they share one root cause: **StoryFrame is generating each beat as an isolated “vibe prompt” rather than as a frame in a controlled visual sequence.** The system has narration segmentation, but it lacks a beat-level *information budget*, *continuity contract*, and *modality compiler*. The digest already distinguishes image prompts from dual-phase video prompts, so the failure is not a missing concept—it is that the image path is not enforcing image-only semantics or reveal sequencing. 

### 1. Why Beat 1 leaks Beat 2

Beat 1 says “tea streaming into dark water,” which visually completes the phrase “pour tea into a harbor” before the narration reaches “harbor.” That is a **premature reveal**: the audience sees the destination before the words name it.

The deeper issue is scale whiplash. A porcelain teapot implies a tabletop, intimate, domestic scale; Boston Harbor implies an extreme-wide maritime environment. Jumping directly from one to the other makes the viewer ask, “Is this a metaphor, a dream, or a historical scene?” A hook can use metaphor, but the visual grammar must make the transition intentional.

**Architectural rule: enforce a `visualInformationBudget` per beat.**

```ts
export interface VisualInformationBudget {
  mayIntroduce: string[];       // new visual facts allowed in this beat
  mustWithhold: string[];       // facts reserved for later beats
  mustPreserve: string[];       // facts inherited from previous beats
  revealStage: 'tease' | 'partial_reveal' | 'full_reveal' | 'consequence';
}
```

For this hook:

| Beat | Narration | May introduce | Must withhold |
|---|---|---|---|
| 1 | “If you pour tea” | Teapot, pouring tea, close-up liquid | Harbor, ships, historical context, consequence |
| 2 | “into a harbor” | Harbor, piers, ships, night water | Storm, supernatural terror, colonists |
| 3 | “something terrifying happens” | Storm response, ominous scale, dread | Exact historical event, people, explanation |

The generator must validate that Beat 1 contains no `harbor`, `ships`, `piers`, or `Boston`; Beat 2 contains no `lightning`, `storm clouds`, or `terrifying`; and Beat 3 introduces the consequence without explaining the historical cause.

### 2. Why the style contradicts itself

`1930s Rubber Hose Animation with exaggerated stretchy animal characters` is not a style—it is a **character-system instruction**. The prompt simultaneously says “no characters,” so the model receives two irreconcilable directives.

**Architectural rule: separate `visualStyle`, `characterSystem`, and `castingPolicy`.**

```ts
export interface VisualStyleContract {
  visualStyle: string;
  characterSystem?: string;
  castingPolicy: 'no_characters' | 'optional_characters' | 'required_characters';
  allowedCharacterTypes?: string[];
  forbiddenElements: string[];
}
```

Validation rule:

```text
if castingPolicy === 'no_characters':
  reject prompt if characterSystem mentions characters, animals, mascots, figures, or people
```

If the intended look is rubber-hose animation but the hook should remain empty of figures, use:

```text
Visual style: 1930s rubber-hose animation aesthetics; hand-inked line work, fluid curves,
bouncy design language, vintage cartoon texture. No characters, animals, mascots, or figures.
```

If anthropomorphic characters are intended, remove `no characters` and specify exactly who appears.

### 3. Why Gemini treated Beat 3 as video

Words such as `swirls`, `flickers`, `churns`, and `mist swirling` are process verbs. In a multimodal interface, they strongly imply temporal progression, so the model reasonably interprets the prompt as an animation request.

A still-image prompt should describe **one frozen instant**, not a process. Use present-tense visual states and photographic nouns: `storm clouds gather`, `lightning illuminates`, `water is churned`, `mist hangs`. Better still, make modality explicit.

**Architectural rule: compile prompts through a modality-aware template, never send the raw creative description directly to a multimodal chat model.**

```text
TASK: Generate one static image only.
OUTPUT: A single still frame. Do not create animation, video, motion, GIF, or sequence.
SUBJECT: ...
SETTING: ...
COMPOSITION: ...
LIGHTING: ...
STYLE: ...
FROZEN MOMENT: ...
NEGATIVE: motion, animation, video, timelapse, moving camera, frames, GIF
```

## Prompt compiler rules

Implement these deterministic post-processing rules before sending any `Beat.imagePrompt` to Gemini, ChatGPT, Midjourney, Flux, SDXL, or Imagen.

### Rule 1: image modality wrapper

For `mode === 'image'`, prepend and append fixed modality directives:

```text
STATIC IMAGE ONLY. One single frozen frame. No animation, no video, no motion sequence,
no camera movement, no timelapse, no GIF, no frame-by-frame progression.
```

Then append:

```text
Render as a still illustration/photograph. Capture one exact moment in time.
```

### Rule 2: kinetic-verb sanitizer

Maintain a lexicon and transform process verbs into frozen-state descriptions:

| Forbidden in image mode | Replacement |
|---|---|
| `swirls`, `swirling` | `swirling patterns are frozen in the clouds` |
| `flickers`, `flickering` | `a lightning bolt illuminates the scene` |
| `churns`, `churning` | `churned water with turbulent frozen ripples` |
| `streams`, `pouring` | `a thin ribbon of tea is suspended mid-pour` |
| `hovering` | `low mist hangs motionless above the water` |
| `casting` | `lantern light pools on` |

Do not rely on the LLM to do this at generation time. Run a validator after generation:

```ts
const motionVerbs = ['swirl', 'flicker', 'churn', 'stream', 'pour', 'move', 'fly', 'fall', 'rise'];

export function validateImagePrompt(prompt: string) {
  const violations = motionVerbs.filter(v =>
    new RegExp(`\\b${v}\\w*\\b`, 'i').test(prompt)
  );

  return {
    valid: violations.length === 0,
    violations,
    repair: violations.length
      ? 'Convert each motion verb into a frozen visual state.'
      : null
  };
}
```

### Rule 3: continuity handoff fields

Add these to `Beat`:

```ts
export interface Beat {
  // existing fields...
  visualInformationBudget: VisualInformationBudget;
  continuityFromPreviousBeat?: string;
  continuityToNextBeat?: string;
  modality: 'image' | 'video';
  frozenMomentDescription?: string;
}
```

For a sequence, require:

```text
Beat N continuityToNextBeat === Beat N+1 continuityFromPreviousBeat
```

Example:

```text
Beat 1 continuityToNextBeat:
"Amber tea is falling from the tilted teapot toward unseen dark water below."

Beat 2 continuityFromPreviousBeat:
"Amber tea has just struck the dark harbor water, creating a small bright splash."
```

This creates a match cut: the falling tea in Beat 1 becomes the impact splash in Beat 2.

## Rewritten prompts

These preserve the rubber-hose aesthetic while removing the character contradiction and making each frame a distinct, image-only beat.

### Beat 1 — “If you pour tea”

```text
STATIC IMAGE ONLY. One frozen frame. No animation, video, motion sequence, GIF, or camera movement.

Extreme close-up still life: an antique porcelain teapot tilted at the left edge of frame, amber tea caught in a thin suspended ribbon as it pours downward toward unseen dark water below. A few droplets hang frozen in mid-air. The lower third of the frame remains dark and unresolved, concealing the destination.

1930s rubber-hose animation aesthetic: hand-inked rough outlines, fluid exaggerated curves, bouncy cartoon design language, vintage paper texture, subtle ink bleed, and fine grain. Warm 3200K tungsten keylight from upper left highlights rising steam and glossy liquid. 50mm lens, f/1.8, shallow depth of field, crisp focus on the teapot spout and tea ribbon.

No characters, no animals, no mascots, no figures, no harbor, no ships, no piers, no storm, no lightning. Do not show where the tea lands.

Negative: motion, animation, video, timelapse, moving camera, character, animal, mascot, realistic photography, 3D CGI, text, watermark.
```

### Beat 2 — “into a harbor”

```text
STATIC IMAGE ONLY. One frozen frame. No animation, video, motion sequence, GIF, or camera movement.

High-angle wide establishing shot of Boston Harbor at night: wooden piers, several anchored 18th-century sailing ships, lanterns casting warm amber pools across wet planks, and dark harbor water below. At the center of frame, a small bright amber splash marks the exact moment tea strikes the water, visually continuing the falling tea from the previous shot.

1930s rubber-hose animation aesthetic: hand-inked rough outlines, fluid exaggerated curves, bouncy cartoon design language, vintage paper texture, subtle ink bleed, and fine grain. Moonlight at 4500K rims the ship masts and rigging; lantern glow provides warm contrast. Low mist hangs motionless above the water. 24mm lens, f/8, deep focus, atmospheric maritime composition.

No characters, no animals, no mascots, no figures, no storm clouds, no lightning, no supernatural elements. The splash is small and mysterious, not catastrophic.

Negative: motion, animation, video, timelapse, moving camera, character, animal, mascot, realistic photography, 3D CGI, text, watermark.
```

### Beat 3 — “something terrifying happens”

```text
STATIC IMAGE ONLY. One frozen frame. No animation, video, motion sequence, GIF, or camera movement.

Dramatic bird’s-eye view of the same Boston Harbor at night. The tea splash has expanded into an unnatural, ink-black stain spreading across the harbor water, its edges curling like living calligraphy. Dark storm clouds gather overhead, and a single lightning bolt illuminates the ships, masts, piers, and turbulent water in stark silhouette. The harbor feels vast, watchful, and threatening.

1930s rubber-hose animation aesthetic: hand-inked rough outlines, dense crosshatching, harsh black shadows, distorted ship silhouettes, vintage paper texture, ink bleeds, and fine grain. Cool 6000K storm lighting contrasts with the remaining warm lantern glow. 35mm lens, f/11, deep focus, ominous high-contrast composition.

No characters, no animals, no mascots, no figures, no explanation of the historical event, no colonists, no text overlays.

Negative: motion, animation, video, timelapse, moving camera, character, animal, mascot, realistic photography, 3D CGI, text, watermark.
```

## Why this version works

- **Beat 1** teases the action but withholds the harbor, preserving the narration’s reveal.
- **Beat 2** resolves “into a harbor” with a direct visual match: falling tea becomes impact splash.
- **Beat 3** delivers the promised terror through scale, storm light, and an unnatural spreading stain—without prematurely explaining the Boston Tea Party.
- Every prompt explicitly demands one frozen frame and bans motion vocabulary, preventing Gemini or another multimodal model from routing the request to video.
- The style contract is internally consistent: rubber-hose aesthetics remain, while `no characters` is now compatible because no character system is requested.

claude verdict:
## 1. Diagnosis: why the beats misalign

**Root cause:** each beat is compiled as a standalone scene from its text fragment, with no record of what the viewer has already seen. The compiler fills gaps by inventing context. Beat 1 needed something for the tea to land in, so it added "dark water." Beat 3 had an abstract phrase ("terrifying"), so it invented a storm that isn't in the story.

Other issues:
- **Lens drift:** 50mm f/1.8 → 24mm f/8 → 35mm f/11, and 3200K → 4500K → 6000K. There's no shared look across the sequence.
- **Photographic specs in an animation style:** f-stops and Kelvin values fight "1930s rubber hose."
- **Typo:** "BostonHarbor."

**Architectural rules**
1. **Reveal ledger:** each beat may introduce only the new element in its spoken text. Earlier elements may persist, and later ones go on a per-beat forbidden list (Beat 1 forbids harbor, water surface, ships).
2. **One new noun per beat:** the visual delta must come from the spoken words, not from the compiler's imagination.
3. **Continuity anchor:** carry one element across beats. Here it's the amber tea stream, kept in the same screen position, so the cut reads as a pull-back instead of a scale jump.
4. **Style bible injected once:** palette, lighting direction, and rendering style are defined once per project and pasted in verbatim, never re-derived per beat.
5. **Abstract phrases map to mood, not invented events:** "terrifying" becomes stillness and dread, not lightning.

## 2. Keeping image prompts from becoming video

The style suffix itself contains "fluid motion," and Beat 1 says "focus on liquid motion." Those cues leak into every beat.

1. **Route by endpoint, not prompt text.** Call the image model or API directly. Chat UIs infer modality from wording, so don't rely on them.
2. **Fixed modality header and footer:** start with "Generate a single still image" and end with "Static frame. No animation, no camera movement, no video."
3. **Frozen-state grammar:** use participles and states ("frozen mid-fall," "glassy water") instead of verbs of action.
4. **Banned-word linter** that runs before dispatch: swirl, flicker, churn, flow, drift, rise, pan, zoom, motion, moving, animate, fluid.
5. **Split fields** (modality, subject, style, constraints) and compile them into prose with the header and footer.
6. **Positive framing instead of "no characters":** write "empty, uninhabited harbor." Negations prime the very thing you're excluding.

The "no characters" vs. "animal characters" clash is a style-library bug. Split the style into a rendering technique (always applied) and a cast clause (applied only when characters exist).

## 3. Rewritten prompts (copy-paste ready)

**Beat 1: "If you pour tea"**
```
Generate a single still image, 16:9. A large porcelain teapot, tilted forward, with one thin vertical ribbon of amber tea frozen mid-fall on the right third of the frame, exiting the bottom edge. Plain deep-navy background, no horizon, no water, no setting details. Warm amber glow from the tea against cool navy shadow. Style: 1930s rubber hose cartoon, thick black ink outlines, noodle-curved rounded forms, flat cel colors, soft film grain, limited palette of deep navy, teal, cream and amber. Static frame. No animation, no camera movement, no video.
```

**Beat 2: "into a harbor,"**
```
Generate a single still image, 16:9. Wide view of Boston Harbor at night, empty and uninhabited: wooden piers, three tall-masted ship silhouettes, lanterns casting amber pools. The spout of the giant teapot is cropped at the top edge, with the same amber tea ribbon frozen mid-fall on the right third of the frame, ending in one bright ring-shaped ripple on dark water. Pale moonlight on navy sky, light low mist. Style: 1930s rubber hose cartoon, thick black ink outlines, noodle-curved rounded forms, flat cel colors, soft film grain, limited palette of deep navy, teal, cream and amber. Static frame. No animation, no camera movement, no video.
```

**Beat 3: "something terrifying happens."**
```
Generate a single still image, 16:9. Same wide view of Boston Harbor at night, empty and uninhabited. The amber ripple is now an enormous glowing ring across the whole harbor on dead-still, glassy water. Black ship silhouettes with long jagged mast-shadows lying across the ring, a thin band of dark crimson at the horizon, a pale moon, heavy ominous silence. The teapot is gone from the frame. Style: 1930s rubber hose cartoon, thick black ink outlines, noodle-curved rounded forms, flat cel colors, soft film grain, limited palette of deep navy, teal, cream and amber with a touch of crimson. Static frame. No animation, no camera movement, no video.
```

The sequence reads as macro → wide → wide with dread, with the amber stream and ring as the thread. Beat 3 delivers "terrifying" through stillness and shadow, which is also truer to how the Boston Tea Party happened than a storm would be. If your tool outputs 9:16 for short-form, swap the aspect ratio and keep the stream on the right third.

chat gpt verdict: # StoryFrame Audit: Narrative Alignment, Modality Routing, and Prompt Compilation

## Executive verdict

StoryFrame's main problem is not prompt quality. It is the absence of sufficiently strict boundaries between narrative beats, visual information, style constraints, and generation modality.

The generated prompts contain strong cinematographic vocabulary, detailed lighting, and camera specifications. However, they appear to optimize each beat as an independent image rather than treating all beats as a coordinated visual sequence.

That distinction is critical. A storyboard is not merely a collection of attractive images. Each image must communicate the right information at the right moment while preserving continuity with the images before and after it.

I would classify the three failures as follows:

1\. Narrative leakage

High priority

Beat 1 reveals water interaction before Beat 2 establishes the harbor. The compiler does not adequately protect the information boundary between consecutive beats.

2\. Style contradiction

High priority

The style requires exaggerated, stretchy characters, while the scene explicitly forbids characters. The compiler treats style and scene requirements as independent text fragments rather than resolving their compatibility.

3\. Modality ambiguity

High priority

The image prompt contains descriptions of ongoing physical changes. A downstream model may interpret those descriptions as a request for motion, particularly when used in a video-capable interface.

The architectural correction is to stop treating a prompt as a single string generated from narration. StoryFrame should compile a structured visual specification first, validate it, and only then render it into a provider-specific prompt.

One important qualification: no wording can guarantee that every generative model will always select the requested modality. Modality must be enforced by the application's generation request and API parameters, not just by the prompt's wording.

## 1. Why the beats feel misaligned

### A. StoryFrame is confusing narration order with visual information order

The narration is deliberately fragmented:

| Beat | Narration                       | Intended visual purpose              |
| ---- | ------------------------------- | ------------------------------------ |
| 1    | “If you pour tea”               | Introduce tea and create curiosity.  |
| 2    | “into a harbor,”                | Reveal where the tea is going.       |
| 3    | “something terrifying happens.” | Deliver an unsettling visual payoff. |

These are three different narrative functions: setup, reveal, and escalation.

The current compiler appears to have interpreted each fragment as a general scene description, rather than determining what information the audience should learn from each image.

For example, Beat 1 includes the phrase “into dark water.” That phrase completes part of the next beat's visual action. Beat 2 then repeats the same concept at a larger scale.

This causes two problems:

- Information leakage: the audience receives part of the reveal before the intended reveal.
- Visual discontinuity: the first image establishes a delicate tabletop object, while the second jumps to a large harbor without a deliberate transition.

The solution is to give every beat a defined visual information budget.

### B. Architectural rule: every beat needs an information boundary

Before writing a prompt, StoryFrame should classify the information into four groups.

Required information

What the audience must understand from this exact beat.

Example: a stream of amber tea beginning to pour.

Forbidden future information

What belongs to a later beat and must not be revealed prematurely.

Example: the harbor, ships, water impact, or a wide coastal setting in Beat 1.

Continuity requirements

Details that should remain stable across neighboring beats.

Example: amber tea, the same visual style, consistent lighting logic, and a believable change of scale.

Optional atmosphere

Details that improve composition without introducing new story information.

Example: steam, shadow, texture, or restrained atmospheric haze.

The crucial rule is that a prompt generator must not simply extract everything semantically related to the narration. It must also know what is not allowed to appear yet.

### C. Preventing narrative leakage in the architecture

I recommend introducing a `BeatVisualContract` or equivalent structured object before prompt generation.

The following is a conceptual schema, not a claim about StoryFrame's existing implementation.

```

type BeatVisualContract = {
  beatId: string;
  narrativeFunction: "setup" | "reveal" | "escalation" | "resolution";
  narrationSpan: string;

  requiredVisuals: string[];
  forbiddenVisuals: string[];
  allowedContext: string[];

  continuityInvariants: string[];
  newInformation: string[];
  visualScale: "macro" | "close" | "medium" | "wide" | "aerial";

  modality: "image" | "video";
  styleProfileId: string;
};

```

For the three test beats, the contract should behave like this:

| Rule                 | Beat 1         | Beat 2                 | Beat 3                         |
| -------------------- | -------------- | ---------------------- | ------------------------------ |
| Visual scale         | Macro close-up | Wide establishing shot | Elevated wide shot             |
| Primary subject      | Teapot and tea | Boston Harbor          | Harbor and ominous disturbance |
| Harbor visible       | Forbidden      | Required               | Required                       |
| Tea contacting water | Forbidden      | First reveal           | Established context            |
| New information      | Pouring begins | Destination revealed   | Threat implied                 |
| Modality             | Image          | Image                  | Image                          |

These constraints should be created before the final prompt is written.

#### Required validation rules

1. Future-reveal protection: reject visual elements explicitly reserved for later beats.
2. Narrative coverage: every required visual element must be represented in the prompt.
3. Style compatibility: reject or resolve conflicting style and subject requirements.
4. Continuity validation: check that recurring objects, colors, settings, and characters remain consistent.
5. Scale-transition validation: permit a close-up-to-wide-shot transition when it serves the narrative, but ensure the change is intentional.
6. Modality validation: reject image requests that are accidentally compiled as video requests.
7. Fallback handling: when requirements conflict, resolve the conflict or flag it instead of silently combining incompatible instructions.

One subtle point: a macro close-up followed by a wide shot is not inherently a scale-continuity error. It can be excellent cinematic editing. The error occurs when the change has no visual or narrative logic.

## 2. How a prompt compiler should enforce image versus video generation

The compiler should separate three things that are currently easy to conflate:

- What is depicted: the visual content.
- How it is depicted: composition, lighting, style, and camera properties.
- What the model must produce: a still image or a moving sequence.

These should be represented independently.

### A. Use an explicit modality contract

The application should determine the generation mode before prompt construction.

Structured beat

Narration, story context, visual requirements, continuity

Modality router

Explicit IMAGE or VIDEO enum, never inferred from descriptive prose

Image compiler

One frozen frame, composition, visible state, no temporal sequence.

Video compiler

Duration, motion, temporal progression, camera movement, start and end states.

Validation and provider adapter

Validate constraints and send the request to the correct image or video generation endpoint.

The modality router must not inspect words like “swirling” or “flickering” and automatically switch to video. Those words describe content, not the user's requested output format.

Likewise, a video-capable model must not receive a request through a generic generation path when StoryFrame intends to produce a still image.

### B. Still-image prompts should describe a state, not a sequence

Your Beat 3 illustrates the problem well:

- “Dark clouds swirl above” describes ongoing motion.
- “Lightning flickers” describes repeated temporal change.
- “Water churns” describes dynamic physical activity.

These phrases are not inherently forbidden in image prompts. An image model can depict a frozen moment of a storm. However, when several motion-oriented descriptions appear together, a multimodal model or application interface may interpret the request as video generation.

For image mode, StoryFrame should compile them into descriptions of visible, frozen evidence.

| Motion-oriented wording          | Still-image alternative                                       |
| -------------------------------- | ------------------------------------------------------------- |
| Clouds swirl above the harbor    | Dense, curved storm-cloud formations hang over the harbor     |
| Lightning flickers               | A single jagged lightning bolt is frozen in the distant sky   |
| Water churns                     | The water surface displays sharply defined, irregular ripples |
| Tea splashes into the water      | Amber droplets are suspended at the instant of impact         |
| The camera moves over the harbor | Elevated wide-angle composition overlooking the harbor        |

The goal is not to ban verbs. It is to avoid presenting a temporal progression as the primary task.

### C. Use a modality-specific compiler, not a shared prompt template

```

type GenerationRequest = {
  modality: "image" | "video";
  prompt: string;
  provider: string;
};

function compilePrompt(
  beat: BeatVisualContract,
  context: StoryContext
): GenerationRequest {
  const modality = beat.modality;

  const prompt =
    modality === "image"
      ? compileStillFramePrompt(beat, context)
      : compileVideoSequencePrompt(beat, context);

  return {
    modality,
    prompt,
    provider: selectCompatibleProvider(modality)
  };
}

```

The function names above illustrate the architecture; they are not existing StoryFrame functions.

The critical design decision is that `compileStillFramePrompt` and `compileVideoSequencePrompt` have separate responsibilities and validation rules. They can share the same narrative context and visual style, but they should not share an unrestricted final prompt template.

### D. Provider-specific rules matter

Different tools expose different controls. Some use separate image and video endpoints, some use explicit task parameters, and some user interfaces can accept multiple kinds of media requests.

StoryFrame should therefore use provider adapters:

- Gemini: use the supported image-generation task or image-only workflow when available, and avoid routing the request through video-generation functionality.
- ChatGPT: explicitly request image generation through the image-generation capability when the intended output is a still image, rather than treating descriptive text as a guarantee of modality.
- Midjourney: use its image-generation workflow and supported parameters, not video-generation functionality.

The provider adapter should enforce the task using the actual interface or API. Prompt text alone is a secondary safeguard.

## 3. Rewritten prompts for Beats 1, 2, and 3

For this test, I would preserve the 1930s rubber-hose animation aesthetic, but apply it consistently to the objects, environments, outlines, and shading. Since these three beats do not require characters, the style should not force animal characters into the images.

I would also use a consistent visual identity: amber tea, muted sepia wood, deep blue-black water, hand-drawn contours, and vintage theatrical lighting.

[Vriendschap](https://images.openai.com/static-rsc-4/Ce1_jJZPpMJorFZFFfx-MUNIsW1qLGB1Eso-UqoZAIWt07iRkU0kNy8punmq4CooyZp6urTz3CG4oHhP7sLNjuVhi2FDu5Wx8YlTofmMkIuo_p_OK812QfTb2A85s3MVGeRckHtboLy-_okfH_ZTEvZl4Um5xfq-MT1fq3Ds0FM?purpose=inline)

## Beat 1 — The setup

IMAGE · Macro close-up

Spoken: “If you pour tea”

Create exactly ONE STILL IMAGE, a single frozen cinematic frame, for a sequential historical story storyboard.

**NARRATIVE PURPOSE:** Introduce the act of pouring tea while withholding the destination. The viewer should wonder where the tea is going.

**SUBJECT AND COMPOSITION:** Extreme macro close-up of a small, antique cream-colored ceramic teapot tilted at an angle, occupying most of the composition. A narrow, continuous-looking ribbon of amber tea extends from its curved spout and descends beyond the bottom edge of the frame. Several tiny droplets are suspended in the air. The destination of the tea is completely outside the frame.

**INFORMATION BOUNDARY:** Show no water, harbor, ships, shoreline, docks, landscape, or visible destination. Do not reveal what the tea is being poured into. No people or characters.

**VISUAL STYLE:** 1930s rubber-hose-era hand-drawn animation aesthetic, bold ink contours, subtle cel-animation shading, vintage theatrical illustration, slightly exaggerated object proportions, expressive curves in the teapot design, and restrained film-grain texture. Apply the style to the objects and rendering, not to nonexistent characters.

**LIGHTING AND COLOR:** Warm amber key light illuminates the tea and the ceramic spout. Deep brown shadows and a muted cream background create strong separation. Steam is visible as a delicate, static curl. Preserve the same amber tea color for subsequent beats.

**CAMERA:** Extreme macro framing, 50mm-equivalent close-up aesthetic, shallow depth of field, sharp focus on the spout and descending tea, softly blurred background.

**STILL-IMAGE CONSTRAINT:** Depict one frozen instant. No animation sequence, motion trajectory, camera movement, multiple frames, or implied transition. The descending tea is a static visual element within one composition.

**OUTPUT RESTRICTIONS:** No text, letters, captions, subtitles, logos, watermarks, borders, or typography. Return one image only.

[The Boston Tea Party](https://images.openai.com/static-rsc-4/8xIXaUY-wOdThYmcoJLM7gtQPg3dRB-FLWa46ZYrl2EC4ZxORN30wLAa4LWVq14NrsiFXpZ6dCNT0PZcIZ0pIvQVns4ZVePRDbJHFqDS6APR4nVESO7AUSmSSOnybuR-zcjvh491TbESbGJCPFZhd8gHYAxMUXUECXRUb31iW28?purpose=inline)

## Beat 2 — The reveal

IMAGE · Wide establishing shot

Spoken: “into a harbor,”

Create exactly ONE STILL IMAGE, a single frozen cinematic frame, for the next beat of the same historical story.

**NARRATIVE PURPOSE:** Reveal that the tea is being poured into a harbor. This is the first frame in which the audience sees the destination.

**SCENE:** Boston Harbor, Massachusetts, in December 1773, at night. A broad expanse of dark seawater fills the foreground and middle distance. Period-accurate wooden sailing vessels with tall masts and rigging are anchored beside timber wharves. A few warm lanterns illuminate sections of the docks, with colonial-era buildings faintly visible in the distance.

**PRIMARY VISUAL:** In the near foreground, a narrow stream of amber tea meets the harbor water. A small cluster of amber droplets is frozen at the instant of impact, with clearly defined concentric ripples spreading across the otherwise dark surface. The tea is visibly small in relation to the harbor, emphasizing the contrast between an ordinary substance and a vast destination.

**COMPOSITION:** Elevated wide-angle establishing shot. The tea impact is a small but readable foreground detail; the harbor, anchored ships, and wooden piers establish the location. Maintain a clear visual hierarchy so the setting is immediately recognizable.

**CONTINUITY:** Preserve the same amber tea color, vintage hand-drawn rendering, dark tonal palette, and warm highlights from Beat 1. This beat intentionally changes from extreme macro scale to a wide establishing view. Do not carry the oversized teapot into the harbor composition.

**VISUAL STYLE:** Consistent 1930s rubber-hose-era animation aesthetic, hand-drawn ink outlines, stylized but historically recognizable sailing ships, simplified curved contours, vintage cel shading, restrained film grain, and illustrated environmental details. Apply the style to the environment and objects. No animal characters or anthropomorphic objects.

**LIGHTING:** Warm amber lanterns against cool midnight-blue and blue-black water. A restrained moonlit rim defines the ship silhouettes. Subtle atmospheric haze in the background without obscuring the harbor.

**STILL-IMAGE CONSTRAINT:** One frozen moment at the instant the tea touches the water. Ripples and droplets are already visibly defined in a static composition. No animation sequence, time progression, camera movement, or multiple frames.

**OUTPUT RESTRICTIONS:** No text, labels, subtitles, lettering, logos, watermarks, borders, or typography. Return one image only.

[A mid-century painting Boston tea - Free AI Photo Generator - starryai](https://images.openai.com/static-rsc-4/esZMU7x_aDSrcFnLoBjZ-mktKg9ooa8xp2Ty9vGUSw6do_50eTn2cUK7quy_GlP7Pnc_luKPMHvFsa41Vm2ZuTwajcXxPW4n1im92t4PGSDr4FqnsOyZ_O1-hiL2ooyU7U7eTXURlS6LParRPir_f_N1_RdKWusxmPtBmBdtmuc?purpose=inline)

## Beat 3 — The unsettling payoff

IMAGE · Elevated wide shot

Spoken: “something terrifying happens.”

Create exactly ONE STILL IMAGE, a single frozen cinematic frame, continuing directly from the previous Boston Harbor image.

**NARRATIVE PURPOSE:** Transform the previously ordinary tea-pouring event into an ominous visual moment. Convey that the act will have consequences without prematurely depicting the later rebellion or independence.

**SCENE CONTINUITY:** The same Boston Harbor in December 1773, at night. Preserve the established wooden sailing ships, tall masts, period-accurate rigging, timber wharves, dark blue-black water, and distant amber lanterns. The setting must clearly match Beat 2 rather than becoming a different harbor.

**PRIMARY VISUAL:** The harbor occupies most of the frame. At the location where the amber tea entered the water, an unusually distinct pattern of concentric ripples and scattered amber reflections forms a small, unsettling visual focal point. The water surrounding it appears almost black. Large, sharply outlined storm-cloud formations hang over the ships, and a distant jagged lightning bolt illuminates a narrow section of the cloud bank. The ships remain intact and stationary, their silhouettes unusually stark against the sky.

**EMOTIONAL EFFECT:** Create tension through contrast, scale, negative space, and ominous composition rather than through supernatural destruction. The tea itself remains physically ordinary. The terror comes from the dramatic framing and the sense that a seemingly insignificant act is about to have enormous consequences.

**COMPOSITION:** Elevated wide-angle view, with the tea-disturbed water in the lower foreground, the anchored ships in the middle distance, and the cloud-heavy sky above. Maintain recognizable spatial relationships between the water, ships, and wharves.

**VISUAL STYLE:** Match the previous beats' 1930s rubber-hose-era hand-drawn aesthetic, bold ink contours, stylized environmental shapes, vintage cel-animation shading, and restrained film grain. Use expressive illustrated silhouettes and dramatic graphic shadows. No characters, anthropomorphic objects, or cartoon animals.

**LIGHTING AND COLOR:** Deep blue-black shadows, desaturated midnight-blue water, subdued amber lanterns, and one cold lightning highlight. The amber tea remains the only prominent warm reflection on the water.

**STILL-IMAGE CONSTRAINT:** Depict one frozen instant. Clouds are static illustrated formations, the lightning is a single fixed bolt, and the ripples are sharply defined shapes within the composition. No swirling clouds, flickering lights, churning water, sequential events, camera movement, or animation instructions.

**OUTPUT RESTRICTIONS:** No text, dates, lettering, subtitles, logos, watermarks, borders, or typography. Return one image only.

The image references above are illustrative style references, not verified reconstructions of the historical event.

### Why these rewrites work better

- Beat 1 protects the reveal: the tea disappears beyond the frame, so the audience has not yet seen its destination.
- Beat 2 introduces new information: the harbor is revealed, and the tea's contact with the water becomes the focal event.
- Beat 3 escalates without inventing a new plot: the same harbor becomes ominous through lighting, composition, and the water's appearance.
- All three share a style identity: the style describes the rendering of objects and environments without demanding absent characters.
- All three specify a single still image: they describe frozen visual states rather than sequences of actions.

The most important continuity decision is that Beat 3 intensifies the atmosphere without suddenly adding a supernatural catastrophe. The historical story should carry the actual consequences into the next beats.

## 4. Additional architectural safeguards I would implement in StoryFrame

I would prioritize these safeguards in the order below.

Priority 1 — Narrative contract validation

Every beat must have a purpose, required visuals, forbidden reveals, and continuity constraints. The compiler must not invent new story events simply to make an image more dramatic.

Priority 2 — Style compatibility resolver

Separate style properties into rendering technique, shape language, subject requirements, color palette, and character design. If the scene has no characters, do not inject character-specific requirements into the prompt.

Priority 3 — Dedicated modality compilers

Image and video prompts should share story data, not unrestricted output templates. Image mode describes a single composition; video mode describes temporal progression.

Priority 4 — Cross-beat continuity audit

Compare neighboring beats for repeated reveals, missing transitions, inconsistent objects, conflicting lighting, and unintentional scale changes. Use the full story context to evaluate what each image should communicate.

Priority 5 — Automated prompt tests

Test for future-scene leakage, contradictory constraints, modality mismatches, and missing visual requirements before the prompt reaches a generation provider. For high-risk failures, reject or recompile instead of silently passing.

One further safeguard is essential: distinguish hard constraints from soft preferences. “Do not reveal the harbor in Beat 1” is a hard constraint. “Use dramatic lighting” is a soft preference. When they conflict, the hard constraint must win.

## 5. How to test whether the fix actually works

Do not validate the new architecture using only these three prompts. Use a regression suite of different narrative patterns:

- A close-up followed by a wide reveal.
- A mystery where the cause must remain hidden.
- A historical sequence with recurring locations and objects.
- A story in which a character appears in one beat but not the next.
- A static image prompt containing storm, fire, water, or other dynamic phenomena.
- A video prompt requiring explicit movement and temporal progression.
- A deliberately contradictory style instruction.

For each test, evaluate four independent dimensions:

| Metric               | What it measures                                                         |
| -------------------- | ------------------------------------------------------------------------ |
| Narrative alignment  | Does the image communicate the intended beat?                            |
| Reveal discipline    | Does it avoid showing information reserved for later?                    |
| Style compliance     | Are the style and scene requirements compatible and consistent?          |
| Modality correctness | Did the application invoke the requested image or video generation path? |

The last metric must be checked at the application/provider level, not merely by asking a language model whether a prompt sounds like an image prompt.

My final verdict: StoryFrame already demonstrates a useful level of cinematic prompt detail. The next improvement should be architectural rather than cosmetic. Build a narrative-aware compiler that understands what each beat must reveal, what it must conceal, what it must preserve, and which output modality it must produce. That will improve the reliability of the entire storyboard pipeline rather than just fixing the Boston Tea Party example.