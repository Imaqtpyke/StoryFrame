/**
 * Stage 3: Prompt Writing (Per-Scene LLM Calls)
 * Transforms each planned beat into a self-contained, 50-to-100-word image prompt paragraph.
 * Formatted strictly for stateless diffusion models in 16:9 widescreen landscape.
 */

import { StoryBible, StoryFormat, GenerationMode, AiProvider, GeminiModelQuality, VisualStyleFamily } from '../types';
import { PlannedBeat } from './stage2BeatPlan';
import { classifyVisualStyleFamily, getStyleNativeRenderCue } from './promptCompiler';
import { executeGeminiSchemaCall, executeJsonLlmCall, streamJsonLlmWithSceneProgress } from './unifiedAiService';

export interface WrittenPromptBeat extends PlannedBeat {
  imagePrompt: string;
  flaggedIssue?: string;
}

export interface WrittenScenePrompts {
  sceneIndex: number;
  beats: WrittenPromptBeat[];
}

export interface SceneStage3Meta {
  narratorLine?: string;
  estimatedSeconds?: number;
  timeOfDay?: string;
  lightingState?: string;
  beatToClipMap?: Record<number, number>;
}

export const SCENE_PROMPTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sceneIndex: { type: 'INTEGER' },
    sceneVideoPrompt: {
      type: 'STRING',
      description:
        'For Text to Video mode only: cohesive 45 to 85 word linear T2V clip prompt covering the full scene clip duration without narration text or tool names.',
    },
    prompts: {
      type: 'ARRAY',
      description: 'Array of self-contained visual prompts matching beatIndex',
      items: {
        type: 'OBJECT',
        properties: {
          beatIndex: { type: 'INTEGER' },
          imagePrompt: {
            type: 'STRING',
            description:
              'Crisp self-contained prompt of 35 to 60 words in exact order: framing/angle, subject visual lock, action/gaze, setting, light, style-native craft, world style',
          },
        },
        required: ['beatIndex', 'imagePrompt'],
      },
    },
  },
  required: ['sceneIndex', 'prompts'],
};

export const BATCH_PROMPTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scenes: {
      type: 'ARRAY',
      description: 'Ordered list of scenes with self-contained visual prompts matching each beatIndex',
      items: SCENE_PROMPTS_SCHEMA,
    },
  },
  required: ['scenes'],
};

function formatBibleContextForStage3(bible: StoryBible, format: StoryFormat, isVideoMode: boolean): {
  castDescriptions: string;
  parallelDescriptions: string;
  locationDescriptions: string;
  referentsSummary: string;
  lightingSummary: string;
  styleFamily: VisualStyleFamily;
  renderCue: string;
} {
  const styleFamily: VisualStyleFamily = bible.styleFamily || classifyVisualStyleFamily(bible.worldStyle);
  const renderCue = getStyleNativeRenderCue(styleFamily, isVideoMode);

  const castDescriptions = (bible.cast || [])
    .map((c) => {
      const parts = [c.visualLock];
      if (c.permanentAnatomy) parts.push(`Anatomy: ${c.permanentAnatomy}`);
      if (c.eraWardrobe) parts.push(`Wardrobe: ${c.eraWardrobe}`);
      return `ID "${c.id}": ${parts.join(' | ')}`;
    })
    .join('\n');

  const parallelDescriptions = (bible.parallelCast || [])
    .map((pc) => `${pc.sourceId} <-> ${pc.parallelId}: bridge -> ${pc.continuityBridge}`)
    .join('\n');

  const locationDescriptions = (bible.locations || [])
    .map((l) => {
      const extras: string[] = [];
      if (l.spatialPlacement) extras.push(`Layout: ${l.spatialPlacement}`);
      if (Array.isArray(l.stateTimeline) && l.stateTimeline.length > 0) {
        extras.push(`States: ${l.stateTimeline.map((st) => `${st.phase}=${st.stateDescription}`).join('; ')}`);
      }
      return `Location "${l.id}": ${l.visualLock}${extras.length > 0 ? ` | ${extras.join(' | ')}` : ''}`;
    })
    .join('\n');

  const referentsSummary = (bible.referents || [])
    .map((r) => `"${r.phrase}" MUST DEPICT -> ${r.concreteEntity}: ${r.visualDepiction}`)
    .join('\n');

  const lightingSummary = (bible.lightingArc || [])
    .map((lp) => `${lp.phase} (${lp.timeOfDay}): ${lp.lightingDescription}`)
    .join(' -> ');

  return {
    castDescriptions,
    parallelDescriptions,
    locationDescriptions,
    referentsSummary,
    lightingSummary,
    styleFamily,
    renderCue,
  };
}

export function buildFallbackSceneVideoPrompt(
  beats: WrittenPromptBeat[],
  bible: StoryBible,
  format: StoryFormat,
  targetVideoDuration?: number,
  sceneMeta?: SceneStage3Meta
): string {
  const orientation = format === 'short' ? 'Vertical 9:16 portrait composition' : 'Cinematic 16:9 widescreen composition';
  const clipSec = targetVideoDuration || sceneMeta?.estimatedSeconds || 4;
  const firstBeat = beats[0];
  const lastBeat = beats[beats.length - 1] || firstBeat;
  const actionArc =
    beats.length > 1 && firstBeat && lastBeat && firstBeat.beatIndex !== lastBeat.beatIndex
      ? `${firstBeat.depicts}, progressing smoothly into ${lastBeat.depicts}`
      : firstBeat?.depicts || 'Continuous narrative action';
  const lightNote = sceneMeta?.lightingState || bible.lightingArc?.[0]?.lightingDescription || 'natural atmospheric lighting';
  const styleFamily = bible.styleFamily || classifyVisualStyleFamily(bible.worldStyle);
  const craftCue = getStyleNativeRenderCue(styleFamily, true);
  return `${orientation} (${clipSec}s continuous clip). ${actionArc}, ending in a steady visual hold. ${lightNote}. ${craftCue} ${bible.worldStyle}. Audio: subtle ambient room tone and natural foley only, no dialogue.`.replace(
    /\.\s*\./g,
    '.'
  );
}

export async function stage3WriteScenePrompts(
  sceneIndex: number,
  beats: PlannedBeat[],
  bible: StoryBible,
  prevDepicts: string[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  onProgress?: (partialBeats: WrittenPromptBeat[]) => void,
  sceneMeta?: SceneStage3Meta,
  targetVideoDuration?: number,
  outSceneVideoPrompt?: (videoPrompt: string) => void
): Promise<WrittenPromptBeat[]> {
  const isVideoMode = generationMode === 'video';
  const clipSeconds = targetVideoDuration || sceneMeta?.estimatedSeconds || 4;
  const ctx = formatBibleContextForStage3(bible, format, isVideoMode);

  const beatsSummary = beats
    .map((b) => {
      return `BEAT ${b.beatIndex}:
- Spoken Clause: "${b.textSpan}"
- What We See: ${b.depicts}
- Kind: ${b.kind} ${b.referentId ? `(Referent: ${b.referentId})` : ''}
- Shot Role: ${b.shotRole || 'story_action'}${b.transitionHint ? ` | Visual Bridge: ${b.transitionHint}` : ''}
- Subjects: ${b.subjectIds.join(', ')}
- Shot Size: ${b.shotSize}
- Camera Angle: ${b.angle}
- New Info: ${b.newInfo}`;
    })
    .join('\n\n');

  const sceneLightingHeader = sceneMeta?.lightingState || sceneMeta?.timeOfDay
    ? `Active Scene Atmosphere: ${[sceneMeta?.timeOfDay, sceneMeta?.lightingState].filter(Boolean).join(' - ')}`
    : '';

  const videoClipSchemaRule = isVideoMode
    ? `
7. LINEAR TEXT-TO-VIDEO CLIP SYNTHESIS ("sceneVideoPrompt"):
   - Write "sceneVideoPrompt" (45 to 85 words) for this whole ~${clipSeconds}s clip in strict linear order:
     1) Framing + aspect (${format === 'short' ? 'Vertical 9:16 portrait' : 'Wide 16:9 widescreen'})
     2) Subject(s) with permanentAnatomy & eraWardrobe (NEVER bare names)
     3) Continuous progressive action over ~${clipSeconds}s ending in a clear physical resting state
     4) Grounded setting (3-5 concrete spatial props matching spatialPlacement) + natural lightingState
     5) Single smooth camera vector settling cleanly into a steady hold (NEVER stack 2 moves)
     6) Style-native craft (${ctx.renderCue}) + worldStyle
     7) "Audio: [concrete ambient foley], no dialogue."
   - Per-beat "imagePrompt" entries MUST ALSO be kinetic, standalone T2V shots using progressive action verbs and ending with "Audio: [ambient foley], no dialogue."`
    : `
7. FROZEN STILL-FRAME DISCIPLINE:
   - Use crisp frozen peak-action moments (never video tracking/panning prose).
   - Strictly FORBID audio, foley, sound, or music words.`;

  const systemInstruction = `You are an expert Director of Photography and AI prompt artist.
Write production-ready, standalone ${isVideoMode ? 'Text-to-Video' : 'Text-to-Image'} prompts for SCENE ${sceneIndex}.

STORY BIBLE ENTITIES:
Cast Visual Locks (NEVER USE CHARACTER NAMES ALONE - EXPAND PHYSICAL ANATOMY & ERA WARDROBE):
${ctx.castDescriptions}
${ctx.parallelDescriptions ? `\nParallel / Dual-Era Cast Bridges:\n${ctx.parallelDescriptions}` : ''}

Threat Canonical Look:
${bible.threat.canonicalLook}

Locations & State Evolution:
${ctx.locationDescriptions}
${bible.spatialMap ? `World Spatial Map: ${bible.spatialMap}` : ''}
${ctx.lightingSummary ? `Lighting Arc: ${ctx.lightingSummary}` : ''}
${sceneLightingHeader}

Figurative Referents (RESOLVE IMMEDIATELY):
${ctx.referentsSummary}

Withheld Mysteries (NEVER SHOW THE CAUSE):
${bible.withheld.join('; ')}

World Style (${ctx.styleFamily}):
${bible.worldStyle}
Style-Native Craft Baseline:
${ctx.renderCue}

PREVIOUS SCENE CONTEXT (Last visible shots):
${prevDepicts.length > 0 ? prevDepicts.map((d) => `- ${d}`).join('\n') : 'Opening of the story.'}

BEATS TO WRITE FOR SCENE ${sceneIndex}:
${beatsSummary}

CRITICAL RULES FOR WRITING EACH PROMPT (35 to 60 crisp words per beat prompt - no padded filler):
1. ORDER OF PROSE:
   a. Framing and angle in natural words (${format === 'short' ? '"Vertical 9:16 portrait composition, low angle...", "Eye-level portrait framing..."' : '"Wide 16:9 landscape composition, low angle...", "Medium eye-level shot..."'}). Keep shot size aligned 1-to-1 with Beat Shot Size.
   b. The subject with permanent anatomy + era wardrobe repeated (NEVER use bare character names or open with detached limbs/pronouns like "he/she/they" or "his hands").
   c. Action (progressive continuous motion for Video; frozen peak action for Image), facing direction, and gaze vector. Respect Visual Bridge cues for match-cut continuity if specified.
   d. Setting, 3 to 5 spatial elements matching spatialPlacement and active stateTimeline, and background depth.
      ${format === 'short' ? 'PORTRAIT SAFE ZONES: Keep the bottom fifth and lateral sides clear of key subjects/heads. Position key heads and action in the upper-middle vertical third.' : 'LANDSCAPE FRAMING: Place primary subjects on a third with visible environmental negative space.'}
   e. Active natural lighting in descriptive words ("cold grey twilight", "warm amber desk lamp").
   f. Style-native craft + worldStyle summary once at the end (honor ${ctx.styleFamily} textures; NEVER force 35mm film grain or bokeh onto clay/3D/2D/minimalist art).
2. ABSOLUTE TEXT BAN & CLEAN ICON PROPS:
   - NEVER quote or paraphrase spoken narration. ZERO quotation marks (""), dialogue, or voiceover lines.
   - NEVER mention text, words, letters, captions, subtitles, titles, signage, typography, lettering, numbers, years, digits, or "on-screen".
   - If a beat depicts an abstract UI/explainer prop (speech bubble, card, document, plaque), describe ONLY blank surfaces or simple icon shapes ("blank grey speech bubble bearing one bold question-mark icon", "blank ivory card stamped with a crimson X mark").
3. NO STYLE BLEED:
   - Threat features must appear ONLY in beats where the threat is an explicit subject.
   - Crowds remain generic matching the story era.
4. NO FAKE PRECISION:
   - ZERO Kelvin numbers (no "3200K"), ZERO percentages (no "60% weight"), ZERO degree math, ZERO lens math (no "35mm f/1.8").
5. FIGURATIVE RESOLUTION & WITHHELD PROTECTION:
   - Resolve figurative beats to concrete referent visuals; for withheld-effect beats, depict ONLY environmental consequences, never the hidden cause.
6. ZERO EM DASHES: Never use em dashes anywhere.${videoClipSchemaRule}

Output ONLY raw JSON matching this exact structure:
{
  "sceneIndex": ${sceneIndex},
  ${isVideoMode ? '"sceneVideoPrompt": "45 to 85 word linear T2V clip prompt for the whole clip...",\n  ' : ''}"prompts": [
    {
      "beatIndex": 1,
      "imagePrompt": "Crisp self-contained prompt matching all rules above..."
    }
  ]
}`;

  const mapRawPromptsToWritten = (rawPromptList: any[]): WrittenPromptBeat[] => {
    const promptMap = new Map<number, string>();
    for (const item of rawPromptList || []) {
      if (typeof item?.beatIndex === 'number' && typeof item?.imagePrompt === 'string' && item.imagePrompt.trim()) {
        promptMap.set(item.beatIndex, item.imagePrompt.trim());
      }
    }
    return beats
      .filter((b) => promptMap.has(b.beatIndex))
      .map((b) => ({
        ...b,
        imagePrompt: promptMap.get(b.beatIndex)!,
      }));
  };

  let parsed: any;

  if (onProgress) {
    parsed = await streamJsonLlmWithSceneProgress<any>({
      provider,
      apiKey,
      systemPrompt: 'You are a cinematic prompt engineer writing visual prompts. Output valid raw JSON only without em dashes.',
      userPrompt: systemInstruction,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
      topP: 0.85,
      thinkingLevel: 'minimal',
      onPartialStoryboard: (partial) => {
        const partialPrompts =
          Array.isArray(partial.prompts) && partial.prompts.length > 0
            ? partial.prompts
            : Array.isArray(partial.scenes?.[0]?.prompts)
              ? partial.scenes[0].prompts
              : [];
        if (partialPrompts.length === 0) return;
        const writtenPartial = mapRawPromptsToWritten(partialPrompts);
        if (writtenPartial.length > 0) {
          onProgress(writtenPartial);
        }
      },
    });
  } else if (provider === 'groq') {
    parsed = await executeJsonLlmCall<any>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are a cinematic prompt engineer writing visual prompts. Output valid JSON without em dashes.',
      userPrompt: systemInstruction,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
    });
  } else {
    parsed = await executeGeminiSchemaCall<any>({
      apiKey,
      prompt: systemInstruction,
      modelQuality,
      responseSchema: SCENE_PROMPTS_SCHEMA,
      temperature: 0.2,
      thinkingLevel: 'minimal',
      errorContext: `Scene ${sceneIndex} prompt writing`,
      userSignal,
      onRetryMessage: (attempt, _max, delayMs) => {
        if (onStatusMessage) {
          onStatusMessage(`Writing cinematic prompts for Scene ${sceneIndex} (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
        }
      },
    });
  }

  const promptMap = new Map<number, string>();
  for (const item of parsed.prompts || []) {
    if (typeof item.beatIndex === 'number' && typeof item.imagePrompt === 'string') {
      promptMap.set(item.beatIndex, item.imagePrompt.trim());
    }
  }

  const writtenBeats: WrittenPromptBeat[] = beats.map((b) => {
    let generatedPrompt = promptMap.get(b.beatIndex) || '';
    if (!generatedPrompt) {
      const framing = `${b.shotSize} ${format === 'short' ? 'portrait' : 'landscape'} framing, ${b.angle}`;
      const orient = format === 'short' ? 'Vertical 9:16 composition' : 'Wide 16:9 composition';
      generatedPrompt = isVideoMode
        ? `${framing}. ${orient} showing ${b.depicts}. ${ctx.renderCue} ${bible.worldStyle}. Audio: subtle ambient room tone, no dialogue.`
        : `${framing}. ${orient} capturing ${b.depicts}. ${ctx.renderCue} ${bible.worldStyle}`;
    }
    return {
      ...b,
      imagePrompt: generatedPrompt.trim(),
    };
  });

  if (isVideoMode && outSceneVideoPrompt) {
    const rawMaster = typeof parsed.sceneVideoPrompt === 'string' ? parsed.sceneVideoPrompt.trim() : '';
    outSceneVideoPrompt(
      rawMaster || buildFallbackSceneVideoPrompt(writtenBeats, bible, format, targetVideoDuration, sceneMeta)
    );
  }

  return writtenBeats;
}

export async function stage3WriteScenePromptsBatch(
  sceneBatch: { sceneIndex: number; beats: PlannedBeat[] }[],
  bible: StoryBible,
  prevDepicts: string[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  onProgress?: (partialMap: Map<number, WrittenPromptBeat[]>) => void,
  sceneMetaMap?: Map<number, SceneStage3Meta>,
  targetVideoDuration?: number,
  outSceneVideoPrompts?: Map<number, string>
): Promise<Map<number, WrittenPromptBeat[]>> {
  if (sceneBatch.length === 0) return new Map();
  if (sceneBatch.length === 1) {
    const single = sceneBatch[0];
    const written = await stage3WriteScenePrompts(
      single.sceneIndex,
      single.beats,
      bible,
      prevDepicts,
      format,
      generationMode,
      apiKey,
      modelQuality,
      userSignal,
      onStatusMessage,
      provider,
      groqModel,
      onProgress
        ? (partialBeats) => {
            onProgress(new Map([[single.sceneIndex, partialBeats]]));
          }
        : undefined,
      sceneMetaMap?.get(single.sceneIndex),
      targetVideoDuration,
      outSceneVideoPrompts
        ? (vp) => {
            outSceneVideoPrompts.set(single.sceneIndex, vp);
          }
        : undefined
    );
    return new Map([[single.sceneIndex, written]]);
  }

  const isVideoMode = generationMode === 'video';
  const ctx = formatBibleContextForStage3(bible, format, isVideoMode);
  const sceneLabelRange = `${sceneBatch[0].sceneIndex} to ${sceneBatch[sceneBatch.length - 1].sceneIndex}`;

  const scenesSummary = sceneBatch
    .map((sc) => {
      const meta = sceneMetaMap?.get(sc.sceneIndex);
      const clipSeconds = targetVideoDuration || meta?.estimatedSeconds || 4;
      const metaHeader =
        meta?.timeOfDay || meta?.lightingState
          ? `  Atmosphere: ${[meta?.timeOfDay, meta?.lightingState].filter(Boolean).join(' - ')}\n`
          : '';
      const beatLines = sc.beats
        .map(
          (b) => `  BEAT ${b.beatIndex}:
  - Spoken Clause: "${b.textSpan}"
  - What We See: ${b.depicts}
  - Kind: ${b.kind} ${b.referentId ? `(Referent: ${b.referentId})` : ''}
  - Shot Role: ${b.shotRole || 'story_action'}${b.transitionHint ? ` | Visual Bridge: ${b.transitionHint}` : ''}
  - Subjects: ${b.subjectIds.join(', ')}
  - Shot Size: ${b.shotSize}
  - Camera Angle: ${b.angle}
  - New Info: ${b.newInfo}`
        )
        .join('\n');
      return `SCENE ${sc.sceneIndex}${isVideoMode ? ` (~${clipSeconds}s clip)` : ''}:\n${metaHeader}${beatLines}`;
    })
    .join('\n\n');

  const videoBatchRule = isVideoMode
    ? `6. LINEAR VIDEO CLIPS: For EACH scene in Video Mode, include "sceneVideoPrompt" (45-85 words) uniting the clip linearly: Framing -> Subject (permanentAnatomy + eraWardrobe) -> Continuous Action into settling hold -> Spatial Context & Lighting -> Single Camera Vector settling cleanly -> Style Craft -> "Audio: [ambient foley], no dialogue." Keep every beat "imagePrompt" kinetic with ambient foley (no dialogue).`
    : `6. STRICT STILL-IMAGE ISOLATION: Crisp frozen peak-action moments only. Strictly FORBID audio, foley, sound, or music words.`;

  const batchInstruction = `You are an expert Director of Photography and AI prompt artist.
Write production-ready, standalone ${isVideoMode ? 'Text-to-Video' : 'Text-to-Image'} prompts for SCENES ${sceneLabelRange} in sequence.

STORY BIBLE ENTITIES:
Cast Visual Locks (NEVER USE BARE CHARACTER NAMES - EXPAND ANATOMY & WARDROBE):
${ctx.castDescriptions}
${ctx.parallelDescriptions ? `\nParallel / Dual-Era Cast Bridges:\n${ctx.parallelDescriptions}` : ''}

Threat Canonical Look:
${bible.threat.canonicalLook}

Locations & State Evolution:
${ctx.locationDescriptions}
${bible.spatialMap ? `World Spatial Map: ${bible.spatialMap}` : ''}
${ctx.lightingSummary ? `Lighting Arc: ${ctx.lightingSummary}` : ''}

Figurative Referents (RESOLVE IMMEDIATELY):
${ctx.referentsSummary}

Withheld Mysteries (NEVER SHOW THE CAUSE):
${bible.withheld.join('; ')}

World Style (${ctx.styleFamily}):
${bible.worldStyle}
Style-Native Craft Baseline:
${ctx.renderCue}

PREVIOUS CONTEXT BEFORE SCENE ${sceneBatch[0].sceneIndex}:
${prevDepicts.length > 0 ? prevDepicts.map((d) => `- ${d}`).join('\n') : 'Opening of the story.'}

SCENES AND BEATS TO WRITE:
${scenesSummary}

CRITICAL RULES FOR WRITING EACH PROMPT (35 to 60 crisp words per beat prompt - no padded filler):
1. ORDER OF PROSE:
   a. Framing and angle in natural words (${format === 'short' ? '"Vertical 9:16 portrait composition, low angle...", "Eye-level portrait framing..."' : '"Wide 16:9 landscape composition, low angle...", "Medium eye-level shot..."'}).
   b. The subject with permanent anatomy + era wardrobe repeated (NEVER use bare names or open with detached limbs/pronouns).
   c. Action (progressive for Video; frozen peak action for Image), facing direction, and gaze vector.
   d. Setting (3-5 spatial props), environment state, and background depth.
      ${format === 'short' ? 'PORTRAIT SAFE ZONES: Keep the bottom fifth and lateral sides clear of key subjects/heads.' : 'LANDSCAPE FRAMING: Place primary subjects on a third with visible environmental negative space.'}
   e. Active natural lighting in descriptive words ("cold grey twilight", "warm amber lamp glow").
   f. Style-native craft + worldStyle summary once at the end (NEVER force 35mm film optics onto non-photoreal styles).
2. ABSOLUTE TEXT BAN & CLEAN ICON PROPS:
   - NEVER quote or paraphrase spoken narration. ZERO quotation marks (""), dialogue, captions, subtitles, titles, signage, lettering, typography, numbers, or "on-screen".
   - For explainer cards/bubbles/screens, describe blank surfaces or simple icon shapes ("blank grey bubble with one bold question-mark icon").
3. NO STYLE BLEED:
   - Threat features must appear ONLY in beats where the threat is an explicit subject.
4. NO FAKE PRECISION:
   - ZERO Kelvin numbers (no "3200K"), ZERO percentages (no "60% weight"), ZERO degree math, ZERO lens math (use "shallow depth of field" or "deep focus").
5. FIGURATIVE RESOLUTION & WITHHELD PROTECTION:
   - Draw concrete story-world referents for figurative lines and environmental effects only for withheld-effect lines.
${videoBatchRule}

Output ONLY valid raw JSON matching this exact structure without em dashes (write scenes in exact sequential order [${sceneBatch.map((s) => s.sceneIndex).join(', ')}] and beats in order):
{
  "scenes": [
    {
      "sceneIndex": ${sceneBatch[0].sceneIndex},
      ${isVideoMode ? '"sceneVideoPrompt": "45 to 85 word linear T2V clip prompt...",\n      ' : ''}"prompts": [
        {
          "beatIndex": 1,
          "imagePrompt": "Crisp self-contained prompt matching all rules above..."
        }
      ]
    }
  ]
}`;

  const mapRawScenesToPartialMap = (rawScenesList: any[]): Map<number, WrittenPromptBeat[]> => {
    const partialMap = new Map<number, WrittenPromptBeat[]>();
    for (let idx = 0; idx < rawScenesList.length; idx++) {
      const sc = rawScenesList[idx];
      const targetBatchScene =
        (typeof sc?.sceneIndex === 'number'
          ? sceneBatch.find((b) => b.sceneIndex === sc.sceneIndex)
          : undefined) || sceneBatch[idx];
      if (!targetBatchScene) continue;

      const bMap = new Map<number, string>();
      for (const item of sc?.prompts || []) {
        if (typeof item?.beatIndex === 'number' && typeof item?.imagePrompt === 'string' && item.imagePrompt.trim()) {
          bMap.set(item.beatIndex, item.imagePrompt.trim());
        }
      }
      const completedBeats = targetBatchScene.beats
        .filter((b) => bMap.has(b.beatIndex))
        .map((b) => ({
          ...b,
          imagePrompt: bMap.get(b.beatIndex)!,
        }));
      if (completedBeats.length > 0) {
        partialMap.set(targetBatchScene.sceneIndex, completedBeats);
      }
    }
    return partialMap;
  };

  let parsed: any;

  if (onProgress) {
    parsed = await streamJsonLlmWithSceneProgress<any>({
      provider,
      apiKey,
      systemPrompt: 'You are a cinematic prompt engineer writing batched visual prompts. Output valid raw JSON only without em dashes.',
      userPrompt: batchInstruction,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
      topP: 0.85,
      thinkingLevel: 'minimal',
      onPartialStoryboard: (partial) => {
        if (!Array.isArray(partial.scenes) || partial.scenes.length === 0) return;
        const partialMap = mapRawScenesToPartialMap(partial.scenes);
        if (partialMap.size > 0) {
          onProgress(partialMap);
        }
      },
    });
  } else if (provider === 'groq') {
    parsed = await executeJsonLlmCall<any>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are a cinematic prompt engineer writing batched visual prompts. Output valid JSON without em dashes.',
      userPrompt: batchInstruction,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
    });
  } else {
    parsed = await executeGeminiSchemaCall<any>({
      apiKey,
      prompt: batchInstruction,
      modelQuality,
      responseSchema: BATCH_PROMPTS_SCHEMA,
      temperature: 0.2,
      thinkingLevel: 'minimal',
      errorContext: `Scenes ${sceneLabelRange} prompt writing`,
      userSignal,
      onRetryMessage: (attempt, _max, delayMs) => {
        if (onStatusMessage) {
          onStatusMessage(`Writing prompts for Scenes ${sceneLabelRange} (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
        }
      },
    });
  }

  const resultMap = new Map<number, WrittenPromptBeat[]>();
  const rawScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  const scenePromptLookup = new Map<number, Map<number, string>>();
  const rawVideoPromptLookup = new Map<number, string>();

  for (const sc of rawScenes) {
    if (typeof sc?.sceneIndex !== 'number') continue;
    const bMap = new Map<number, string>();
    for (const item of sc.prompts || []) {
      if (typeof item?.beatIndex === 'number' && typeof item?.imagePrompt === 'string') {
        bMap.set(item.beatIndex, item.imagePrompt.trim());
      }
    }
    scenePromptLookup.set(sc.sceneIndex, bMap);
    if (typeof sc.sceneVideoPrompt === 'string' && sc.sceneVideoPrompt.trim()) {
      rawVideoPromptLookup.set(sc.sceneIndex, sc.sceneVideoPrompt.trim());
    }
  }

  for (const sc of sceneBatch) {
    const bMap = scenePromptLookup.get(sc.sceneIndex);
    const writtenBeats = sc.beats.map((b) => {
      let generatedPrompt = bMap?.get(b.beatIndex) || '';
      if (!generatedPrompt) {
        const framing = `${b.shotSize} ${format === 'short' ? 'portrait' : 'landscape'} framing, ${b.angle}`;
        const orient = format === 'short' ? 'Vertical 9:16 composition' : 'Wide 16:9 composition';
        generatedPrompt = isVideoMode
          ? `${framing}. ${orient} showing ${b.depicts}. ${ctx.renderCue} ${bible.worldStyle}. Audio: subtle ambient room tone, no dialogue.`
          : `${framing}. ${orient} capturing ${b.depicts}. ${ctx.renderCue} ${bible.worldStyle}`;
      }
      return {
        ...b,
        imagePrompt: generatedPrompt.trim(),
      };
    });
    resultMap.set(sc.sceneIndex, writtenBeats);

    if (isVideoMode && outSceneVideoPrompts) {
      const meta = sceneMetaMap?.get(sc.sceneIndex);
      const vp =
        rawVideoPromptLookup.get(sc.sceneIndex) ||
        buildFallbackSceneVideoPrompt(writtenBeats, bible, format, targetVideoDuration, meta);
      outSceneVideoPrompts.set(sc.sceneIndex, vp);
    }
  }

  return resultMap;
}

