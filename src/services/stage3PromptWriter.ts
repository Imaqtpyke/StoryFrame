/**
 * Stage 3: Prompt Writing (Per-Scene LLM Calls)
 * Transforms each planned beat into a self-contained, 50-to-100-word image prompt paragraph.
 * Formatted strictly for stateless diffusion models in 16:9 widescreen landscape.
 */

import { StoryBible, StoryFormat, GenerationMode, AiProvider } from '../types';
import { PlannedBeat } from './stage2BeatPlan';
import { executeGeminiSchemaCall, executeJsonLlmCall, streamJsonLlmWithSceneProgress } from './unifiedAiService';

export interface WrittenPromptBeat extends PlannedBeat {
  imagePrompt: string;
  flaggedIssue?: string;
}

export interface WrittenScenePrompts {
  sceneIndex: number;
  beats: WrittenPromptBeat[];
}

export const SCENE_PROMPTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sceneIndex: { type: 'INTEGER' },
    prompts: {
      type: 'ARRAY',
      description: 'Array of self-contained image prompts matching beatIndex',
      items: {
        type: 'OBJECT',
        properties: {
          beatIndex: { type: 'INTEGER' },
          imagePrompt: {
            type: 'STRING',
            description:
              'Crisp self-contained prompt of 35 to 60 words in exact order: framing/angle, subject visual lock, action/gaze, setting, light, world style',
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
      description: 'Ordered list of scenes with self-contained image prompts matching each beatIndex',
      items: SCENE_PROMPTS_SCHEMA,
    },
  },
  required: ['scenes'],
};

export async function stage3WriteScenePrompts(
  sceneIndex: number,
  beats: PlannedBeat[],
  bible: StoryBible,
  prevDepicts: string[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  onProgress?: (partialBeats: WrittenPromptBeat[]) => void
): Promise<WrittenPromptBeat[]> {
  // Formulate prompt context
  const beatsSummary = beats.map((b) => {
    return `BEAT ${b.beatIndex}:
- Spoken Clause: "${b.textSpan}"
- What We See: ${b.depicts}
- Kind: ${b.kind} ${b.referentId ? `(Referent: ${b.referentId})` : ''}
- Subjects: ${b.subjectIds.join(', ')}
- Shot Size: ${b.shotSize}
- Camera Angle: ${b.angle}
- New Info: ${b.newInfo}`;
  }).join('\n\n');

  const castDescriptions = bible.cast
    .map((c) => `ID "${c.id}": ${c.visualLock}`)
    .join('\n');

  const locationDescriptions = bible.locations
    .map((l) => `Location "${l.id}": ${l.visualLock}`)
    .join('\n');

  const referentsSummary = bible.referents
    .map((r) => `"${r.phrase}" MUST DEPICT -> ${r.concreteEntity}: ${r.visualDepiction}`)
    .join('\n');

  const systemInstruction = `You are an expert Director of Photography and AI prompt artist.
Write production-ready, standalone image prompts for SCENE ${sceneIndex}.

STORY BIBLE ENTITIES:
Cast Visual Locks (DO NOT USE NAMES, USE THEIR PHYSICAL DESCRIPTIONS):
${castDescriptions}

Threat Canonical Look:
${bible.threat.canonicalLook}

Location Visual Locks:
${locationDescriptions}

Figurative Referents (RESOLVE THESE IMMEDIATELY):
${referentsSummary}

Withheld Mysteries (NEVER SHOW THE CAUSE):
${bible.withheld.join('; ')}

World Style:
${bible.worldStyle}

PREVIOUS SCENE CONTEXT (Last visible images):
${prevDepicts.length > 0 ? prevDepicts.map((d, i) => `- ${d}`).join('\n') : 'Opening of the story.'}

BEATS TO WRITE FOR SCENE ${sceneIndex}:
${beatsSummary}

CRITICAL RULES FOR WRITING EACH PROMPT (35 to 60 crisp words per prompt - no padded filler):
1. ORDER OF PROSE:
   a. Framing and angle in natural words (${format === 'short' ? '"Vertical 9:16 portrait composition, low angle...", "Eye-level portrait framing..."' : '"Wide 16:9 landscape composition, low angle...", "Medium eye-level shot..."'}).
   b. The subject with full visual lock repeated (NEVER use character names like "Father Thomas" or pronouns like "he/she/it/they" - write the full physical description because image models are stateless).
   c. Kinetic action, facing direction, and gaze vector.
   d. Setting, environment, and background depth.
      ${format === 'short' ? 'PORTRAIT SAFE ZONES: Keep the bottom fifth and lateral sides clear of key subjects to leave safe space for mobile UI buttons, captions, and creator overlays. Position key heads and action in the upper-middle vertical third.' : 'LANDSCAPE FRAMING: Place primary subjects on a third with visible environmental negative space.'}
   e. Natural lighting in words ("cold grey twilight", "flickering tallow candlelight casting long shadows").
   f. The short world style summary once at the end.
   ${generationMode === 'video' ? 'g. KINETIC VIDEO DYNAMICS: Describe continuous physical motion and camera trajectory. Include synchronized ambient foley and sound cues.' : 'g. STRICT AUDIO ISOLATION: This is Text to Image. Strictly FORBID sound cues, foley, audio, or music words.'}
2. ABSOLUTE TEXT BAN & NO SPOKEN DIALOGUE:
   - NEVER quote or paraphrase the spoken narration.
   - NEVER include quotation marks ("").
   - NEVER include spoken dialogue or voiceover lines in video or image prompts.
   - NEVER mention text, words, letters, captions, subtitles, titles, signs, numbers, years, digits, or "on-screen". Mentioning them causes the generator to print subtitles!
3. NO STYLE BLEED:
   - Threat features (such as glowing or decaying elements) must appear ONLY in beats where the threat is an explicit subject. Never put threat features on villagers, gates, or priests.
   - Crowds must remain generic ("frightened 14th-century peasants").
4. NO FAKE PRECISION:
   - ZERO Kelvin numbers (no "3200K", no "5600K").
   - ZERO percentages (no "60% weight", no "30% fill").
   - ZERO degrees (no "15-degree tilt").
   - ZERO lens math (no "35mm f/1.8"). Use plain cinematic words ("shallow depth of field", "deep focus").
5. FIGURATIVE RESOLUTION:
   - If a beat is marked figurative (e.g. "the worst thing God could send them. They were wrong."), draw the concrete referent entity (e.g. the clawing hands of the risen dead breaking from the muddy trench), NOT the spoken figure of speech.
6. WITHHELD PROTECTION:
   - If a beat is marked withheld-effect, show ONLY the environmental consequence (frost spreading across flagstones, bell swinging empty in the belfry, faces turning in horror), NEVER the hidden source.

Output ONLY raw JSON matching this exact structure (start directly with "sceneIndex" and "prompts" in exact beatIndex order so Beat 1 streams first):
{
  "sceneIndex": ${sceneIndex},
  "prompts": [
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
      systemPrompt: 'You are a cinematic prompt engineer writing visual prompts. Output valid raw JSON only.',
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
      systemPrompt: 'You are a cinematic prompt engineer writing visual prompts. Output valid JSON.',
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

  return beats.map((b) => {
    let generatedPrompt = promptMap.get(b.beatIndex) || '';
    if (!generatedPrompt) {
      // Fallback self-contained prompt
      const framing = `${b.shotSize} landscape framing, ${b.angle}`;
      generatedPrompt = `${framing}. Wide landscape composition capturing ${b.depicts}. ${bible.worldStyle}`.trim();
    }
    return {
      ...b,
      imagePrompt: generatedPrompt,
    };
  });
}

export async function stage3WriteScenePromptsBatch(
  sceneBatch: { sceneIndex: number; beats: PlannedBeat[] }[],
  bible: StoryBible,
  prevDepicts: string[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  onProgress?: (partialMap: Map<number, WrittenPromptBeat[]>) => void
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
        : undefined
    );
    return new Map([[single.sceneIndex, written]]);
  }

  const sceneLabelRange = `${sceneBatch[0].sceneIndex} to ${sceneBatch[sceneBatch.length - 1].sceneIndex}`;

  const scenesSummary = sceneBatch
    .map((sc) => {
      const beatLines = sc.beats
        .map(
          (b) => `  BEAT ${b.beatIndex}:
  - Spoken Clause: "${b.textSpan}"
  - What We See: ${b.depicts}
  - Kind: ${b.kind} ${b.referentId ? `(Referent: ${b.referentId})` : ''}
  - Subjects: ${b.subjectIds.join(', ')}
  - Shot Size: ${b.shotSize}
  - Camera Angle: ${b.angle}
  - New Info: ${b.newInfo}`
        )
        .join('\n');
      return `SCENE ${sc.sceneIndex}:\n${beatLines}`;
    })
    .join('\n\n');

  const castDescriptions = bible.cast.map((c) => `ID "${c.id}": ${c.visualLock}`).join('\n');
  const locationDescriptions = bible.locations.map((l) => `Location "${l.id}": ${l.visualLock}`).join('\n');
  const referentsSummary = bible.referents
    .map((r) => `"${r.phrase}" MUST DEPICT -> ${r.concreteEntity}: ${r.visualDepiction}`)
    .join('\n');

  const batchInstruction = `You are an expert Director of Photography and AI prompt artist.
Write production-ready, standalone image prompts for SCENES ${sceneLabelRange} in sequence.

STORY BIBLE ENTITIES:
Cast Visual Locks (DO NOT USE NAMES, USE THEIR PHYSICAL DESCRIPTIONS):
${castDescriptions}

Threat Canonical Look:
${bible.threat.canonicalLook}

Location Visual Locks:
${locationDescriptions}

Figurative Referents (RESOLVE THESE IMMEDIATELY):
${referentsSummary}

Withheld Mysteries (NEVER SHOW THE CAUSE):
${bible.withheld.join('; ')}

World Style:
${bible.worldStyle}

PREVIOUS CONTEXT BEFORE SCENE ${sceneBatch[0].sceneIndex}:
${prevDepicts.length > 0 ? prevDepicts.map((d) => `- ${d}`).join('\n') : 'Opening of the story.'}

SCENES AND BEATS TO WRITE:
${scenesSummary}

CRITICAL RULES FOR WRITING EACH PROMPT (35 to 60 crisp words per prompt - no padded filler):
1. ORDER OF PROSE:
   a. Framing and angle in natural words (${format === 'short' ? '"Vertical 9:16 portrait composition, low angle...", "Eye-level portrait framing..."' : '"Wide 16:9 landscape composition, low angle...", "Medium eye-level shot..."'}).
   b. The subject with full visual lock repeated (NEVER use bare names or pronouns like "he/she/it/they" without physical description).
   c. Kinetic action, facing direction, and gaze vector.
   d. Setting, environment, and background depth.
      ${format === 'short' ? 'PORTRAIT SAFE ZONES: Keep the bottom fifth and lateral sides clear of key subjects.' : 'LANDSCAPE FRAMING: Place primary subjects on a third with visible environmental negative space.'}
   e. Natural lighting in words ("cold grey twilight", "flickering tallow candlelight casting long shadows").
   f. The short world style summary once at the end.
   ${generationMode === 'video' ? 'g. KINETIC VIDEO DYNAMICS: Describe continuous physical motion and camera trajectory. Include synchronized ambient foley and sound cues.' : 'g. STRICT AUDIO ISOLATION: This is Text to Image. Strictly FORBID sound cues, foley, audio, or music words.'}
2. ABSOLUTE TEXT BAN & NO SPOKEN DIALOGUE:
   - NEVER quote or paraphrase the spoken narration.
   - NEVER include quotation marks (""), dialogue, captions, subtitles, titles, signs, numbers, or "on-screen".
3. NO STYLE BLEED:
   - Threat features must appear ONLY in beats where the threat is an explicit subject.
4. NO FAKE PRECISION:
   - ZERO Kelvin numbers (no "3200K"), ZERO percentages (no "60% weight"), ZERO degree math, ZERO lens math (use "shallow depth of field" or "deep focus").
5. FIGURATIVE RESOLUTION & WITHHELD PROTECTION:
   - Draw concrete story-world referents for figurative lines and environmental effects only for withheld-effect lines.

Output ONLY valid raw JSON matching this exact structure (write scenes in exact sequential order [${sceneBatch.map((s) => s.sceneIndex).join(', ')}] and beats in order):
{
  "scenes": [
    {
      "sceneIndex": ${sceneBatch[0].sceneIndex},
      "prompts": [
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
      systemPrompt: 'You are a cinematic prompt engineer writing batched visual prompts. Output valid raw JSON only.',
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
      systemPrompt: 'You are a cinematic prompt engineer writing batched visual prompts. Output valid JSON.',
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

  for (const sc of rawScenes) {
    if (typeof sc?.sceneIndex !== 'number') continue;
    const bMap = new Map<number, string>();
    for (const item of sc.prompts || []) {
      if (typeof item?.beatIndex === 'number' && typeof item?.imagePrompt === 'string') {
        bMap.set(item.beatIndex, item.imagePrompt.trim());
      }
    }
    scenePromptLookup.set(sc.sceneIndex, bMap);
  }

  for (const sc of sceneBatch) {
    const bMap = scenePromptLookup.get(sc.sceneIndex);
    const writtenBeats = sc.beats.map((b) => {
      let generatedPrompt = bMap?.get(b.beatIndex) || '';
      if (!generatedPrompt) {
        const framing = `${b.shotSize} ${format === 'short' ? 'portrait' : 'landscape'} framing, ${b.angle}`;
        generatedPrompt = `${framing}. ${format === 'short' ? 'Vertical 9:16 composition' : 'Wide 16:9 composition'} capturing ${b.depicts}. ${bible.worldStyle}`.trim();
      }
      return {
        ...b,
        imagePrompt: generatedPrompt,
      };
    });
    resultMap.set(sc.sceneIndex, writtenBeats);
  }

  return resultMap;
}
