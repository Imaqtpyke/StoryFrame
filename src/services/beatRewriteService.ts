import {
  AiProvider,
  Beat,
  GeminiModelQuality,
  GenerationMode,
  Scene,
  StoryBible,
  StoryFormat,
  StoryGenerationResult,
  VisualStyleFamily,
} from '../types';
import { WrittenPromptBeat } from './stage3PromptWriter';
import {
  classifyVisualStyleFamily,
  getStyleNativeRenderCue,
  sanitizeKineticMotionForImage,
} from './promptCompiler';
import {
  formatFinalBeatPrompt,
  normalizeUnicodeAndDashes,
  sanitizeFakePrecisionMath,
  synchronizeBeatMetadataWithPrompt,
} from './beatProgressionEngine';
import { assembleCleanPrompt, cleanAndDeduplicatePrompt } from './geminiClient';
import { repairFailingBeat, verifyBeatCodeChecks } from './stage4VerifyRepair';
import {
  executeGeminiSchemaCall,
  executeJsonLlmCall,
  formatGemini429Error,
  resolveGeminiModelId,
  sanitizeGenericErrorMessage,
} from './unifiedAiService';

export interface SingleBeatRewriteParams {
  result: StoryGenerationResult;
  scene: Scene;
  beat: Beat;
  prevBeat: Beat | null;
  nextBeat: Beat | null;
  format: StoryFormat;
  instruction: string;
  apiKey: string;
  aiProvider: AiProvider;
  modelQuality?: GeminiModelQuality;
  groqModel?: string;
  userSignal?: AbortSignal;
}

export interface SingleBeatRewriteResult {
  beat: Beat;
  warnings: string[];
}

const REWRITE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    imagePrompt: {
      type: 'STRING',
      description:
        'Rewritten self-contained visual prompt honoring locked Story Bible continuity, style family craft, and neighbor non-duplication.',
    },
    shotType: {
      type: 'STRING',
      description: 'Updated shot framing label if framing changed, otherwise match existing shotType.',
    },
    cameraAngle: {
      type: 'STRING',
      description: 'Updated camera angle (e.g. eye-level, low-angle, high-angle) if changed.',
    },
    cameraMovement: {
      type: 'STRING',
      description: 'Updated camera movement label (video mode) or Static Crisp Frame (image mode).',
    },
  },
  required: ['imagePrompt'],
};

function buildFallbackBibleFromResult(result: StoryGenerationResult): StoryBible {
  if (result.storyBible) {
    return result.storyBible;
  }
  const cast = Object.entries(result.characterSheet || {}).map(([id, visualLock]) => ({
    id,
    role: 'Cast',
    visualLock,
  }));
  const locations = Object.entries(result.locationSheet || {}).map(([id, visualLock]) => ({
    id,
    visualLock,
  }));
  return {
    cast,
    threat: { canonicalLook: '', allowedVariants: [] },
    locations,
    motifs: [],
    events: [],
    referents: [],
    withheld: [],
    forbidden: [],
    worldStyle: result.styleProfile?.artStyle || 'Cinematic visual storytelling',
    styleFamily: result.styleProfile?.styleFamily || classifyVisualStyleFamily(result.styleProfile?.artStyle),
    assumptions: [],
  };
}

function toWrittenPromptBeat(beat: Beat): WrittenPromptBeat {
  const shotSize = (beat.shotType || 'medium').toLowerCase();
  return {
    beatIndex: beat.beatIndex,
    wordRange: beat.wordRange || [0, 0],
    textSpan: beat.textSpan || '',
    depicts: beat.depicts || beat.textSpan || 'Visual beat moment',
    kind: beat.kind || 'literal',
    referentId: beat.referentId,
    intensity: beat.intensity || 'medium',
    subjectIds: Array.isArray(beat.subjectIds) ? beat.subjectIds : [],
    shotSize,
    angle: beat.cameraAngle || 'eye-level',
    newInfo: beat.newInfo || '',
    estimatedSeconds: beat.estimatedSeconds || 1.5,
    overlayText: beat.overlayText,
    shotRole: beat.shotRole,
    transitionHint: beat.transitionHint,
    imagePrompt: beat.imagePrompt || '',
    flaggedIssue: beat.flaggedIssue,
  };
}

export function buildSingleBeatRewritePrompt(params: {
  result: StoryGenerationResult;
  scene: Scene;
  beat: Beat;
  prevBeat: Beat | null;
  nextBeat: Beat | null;
  format: StoryFormat;
  instruction: string;
}): string {
  const { result, scene, beat, prevBeat, nextBeat, format, instruction } = params;
  const isVideoMode = result.generationMode === 'video';
  const bible = buildFallbackBibleFromResult(result);
  const styleFamily: VisualStyleFamily =
    bible.styleFamily ||
    result.styleProfile?.styleFamily ||
    classifyVisualStyleFamily(result.styleProfile?.artStyle || bible.worldStyle);
  const renderCue = getStyleNativeRenderCue(styleFamily, isVideoMode);

  const castLines =
    bible.cast.length > 0
      ? bible.cast
          .map((c) => {
            const parts = [c.visualLock];
            if (c.permanentAnatomy) parts.push(`Anatomy: ${c.permanentAnatomy}`);
            if (c.eraWardrobe) parts.push(`Wardrobe: ${c.eraWardrobe}`);
            return `- ${c.id}: ${parts.join(' | ')}`;
          })
          .join('\n')
      : Object.entries(result.characterSheet || {})
          .map(([id, desc]) => `- ${id}: ${desc}`)
          .join('\n') || 'None locked.';

  const locationLines =
    bible.locations.length > 0
      ? bible.locations
          .map((l) => `- ${l.id}${l.spatialPlacement ? ` (${l.spatialPlacement})` : ''}: ${l.visualLock}`)
          .join('\n')
      : Object.entries(result.locationSheet || {})
          .map(([id, desc]) => `- ${id}: ${desc}`)
          .join('\n') || 'None locked.';

  const lightingContext = [
    scene.timeOfDay ? `Time of Day: ${scene.timeOfDay}` : '',
    scene.lightingState ? `Scene Lighting: ${scene.lightingState}` : '',
    result.styleProfile?.lighting ? `Base Lighting: ${result.styleProfile.lighting}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const prevNeighbor = prevBeat
    ? `PREVIOUS BEAT (Beat ${prevBeat.beatIndex} - "${prevBeat.textSpan}"): [${prevBeat.shotType || 'Shot'}, ${prevBeat.cameraAngle || 'eye-level'}] ${prevBeat.imagePrompt}`
    : 'PREVIOUS BEAT: None (Opening beat of scene).';

  const nextNeighbor = nextBeat
    ? `NEXT BEAT (Beat ${nextBeat.beatIndex} - "${nextBeat.textSpan}"): [${nextBeat.shotType || 'Shot'}, ${nextBeat.cameraAngle || 'eye-level'}] ${nextBeat.imagePrompt}`
    : 'NEXT BEAT: None (Final beat of scene).';

  const modeRules = isVideoMode
    ? `- TEXT-TO-VIDEO RULES: Use progressive continuous action and ONE smooth camera vector that settles cleanly (never combine push-in and pull-out). End with "Audio: [brief concrete ambient foley], no dialogue." Never include --ar tags or external video tool names.`
    : `- TEXT-TO-IMAGE RULES: Keep this a crisp frozen still-frame moment with ZERO camera motion verbs (no dolly, pan, zoom, tracking, swaying) and ZERO audio/sound cues.`;

  return `You are an expert Director of Photography revising ONE single storyboard beat prompt while strictly preserving Story Bible continuity.

USER REWRITE REQUEST:
"""${instruction.trim()}"""

TARGET BEAT TO REWRITE (Scene ${scene.index}, Beat ${beat.beatIndex}):
- Spoken Line (DO NOT QUOTE THIS IN THE PROMPT): "${beat.textSpan || ''}"
- Visual Event / Depicts: ${beat.depicts || beat.textSpan || 'Current beat visual'}
- Current Shot Type: ${beat.shotType || 'Medium Shot'}
- Current Camera Angle: ${beat.cameraAngle || 'eye-level'}
- Current Camera Movement: ${beat.cameraMovement || (isVideoMode ? 'Slow Push-In' : 'Static Crisp Frame')}
- Current Prompt: "${beat.imagePrompt}"

IMMEDIATE NEIGHBORS (MUST STAY VISUALLY DISTINCT - DO NOT COPY OR CLONE):
- ${prevNeighbor}
- ${nextNeighbor}

LOCKED STORY BIBLE & VISUAL CONTINUITY:
- Aspect Ratio & Orientation: ${format === 'short' ? 'Vertical 9:16 portrait composition (keep heads/actions clear of bottom fifth and lateral edges)' : 'Cinematic 16:9 widescreen composition'}
- Visual Style (${styleFamily}): ${result.styleProfile?.artStyle || bible.worldStyle}
- Color Palette: ${result.styleProfile?.colorPalette || 'Consistent with style profile'}
- Lighting State: ${lightingContext || 'Natural directional lighting'}
- Style-Native Craft Baseline: ${renderCue}
- Cast Visual Locks (keep anatomy & wardrobe identical):
${castLines}
- Location Locks:
${locationLines}
${bible.spatialMap ? `- Spatial Layout: ${bible.spatialMap}` : ''}
${bible.withheld.length > 0 ? `- Withheld Secrets (NEVER reveal cause prematurely): ${bible.withheld.join('; ')}` : ''}
${bible.forbidden.length > 0 ? `- Forbidden Elements / Anachronisms: ${bible.forbidden.join('; ')}` : ''}

STRICT REVISION RULES:
1. Apply the user's rewrite instruction faithfully while keeping the beat aligned to "${beat.textSpan || beat.depicts || 'this moment'}".
2. Write 35 to 65 crisp words in natural prose starting directly with framing and angle, followed by concrete subject (with locked anatomy/wardrobe if present), action/gaze, setting, lighting, and world style.
3. ZERO quotation marks, ZERO spoken narration quotes, ZERO subtitles/captions/text overlays, ZERO Kelvin/percentage/degree math, ZERO em dashes.
4. Honor ${styleFamily} craft natively: never inject live-action 35mm film grain or bokeh onto clay/3D/2D/minimalist styles unless photoreal.
5. Make framing/pose clearly distinct from both neighboring beats.
6. If the rewrite shifts framing or camera angle (for example, changing to Close-Up or low-angle), return matching shotType and cameraAngle fields so metadata stays 1-to-1 synchronized.
${modeRules}

Output ONLY valid raw JSON matching:
{
  "imagePrompt": "...",
  "shotType": "...",
  "cameraAngle": "...",
  "cameraMovement": "..."
}`;
}

export function normalizeRewrittenBeat(params: {
  rawPrompt: string;
  rawShotType?: string;
  rawCameraAngle?: string;
  rawCameraMovement?: string;
  originalBeat: Beat;
  result: StoryGenerationResult;
  format: StoryFormat;
}): Beat {
  const {
    rawPrompt,
    rawShotType,
    rawCameraAngle,
    rawCameraMovement,
    originalBeat,
    result,
    format,
  } = params;
  const isVideoMode = result.generationMode === 'video';
  const isLongForm = format === 'long';

  let prompt = normalizeUnicodeAndDashes((rawPrompt || '').trim()).replace(/^["']|["']$/g, '');
  prompt = sanitizeFakePrecisionMath(prompt);
  if (!isVideoMode) {
    prompt = sanitizeKineticMotionForImage(prompt);
    prompt = prompt
      .replace(/,?\s*\bas\s+(?:the\s+)?camera\s+(?:slowly|gently|smoothly)?\s*(?:pans?|tilts?|dollies|tracks?|pushes\s+in|pulls\s+back|zooms?)[^.,;]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  prompt = cleanAndDeduplicatePrompt(prompt, isVideoMode);

  const candidateBeat: Beat = {
    ...originalBeat,
    imagePrompt: prompt,
    shotType: rawShotType?.trim()
      ? normalizeUnicodeAndDashes(rawShotType.trim())
      : originalBeat.shotType,
    cameraAngle: rawCameraAngle?.trim()
      ? normalizeUnicodeAndDashes(rawCameraAngle.trim())
      : originalBeat.cameraAngle,
    cameraMovement: isVideoMode
      ? rawCameraMovement?.trim()
        ? normalizeUnicodeAndDashes(rawCameraMovement.trim())
        : originalBeat.cameraMovement
      : 'Static Crisp Frame',
    userRewritten: true,
    flaggedIssue: undefined,
  };

  const formatted = formatFinalBeatPrompt(candidateBeat, isLongForm, isVideoMode, {
    styleProfile: result.styleProfile,
    characterSheet: result.characterSheet,
    locationSheet: result.locationSheet,
  });

  const assembledPrompt = assembleCleanPrompt(formatted.imagePrompt, isLongForm);
  const synced = synchronizeBeatMetadataWithPrompt({
    ...formatted,
    imagePrompt: isVideoMode ? assembledPrompt.replace(/\s*--ar\s+[0-9:]+/gi, '').trim() : assembledPrompt,
  });

  return {
    ...synced,
    cameraMovement: isVideoMode ? synced.cameraMovement : 'Static Crisp Frame',
    userRewritten: true,
  };
}

function formatRewriteError(
  error: unknown,
  apiKey: string,
  aiProvider: AiProvider,
  modelId?: string
): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('429') || /quota|rate limit/i.test(raw)) {
    return formatGemini429Error(raw, modelId);
  }
  if (/401|403|api key|permission/i.test(raw)) {
    return 'Your API key was rejected or lacks permission. Check Model & API Settings and try again.';
  }
  const friendly = sanitizeGenericErrorMessage(raw, apiKey, aiProvider, modelId);
  return friendly || 'Unable to rewrite this beat right now. Your instruction is preserved so you can try again.';
}

export async function rewriteSingleBeatPrompt(
  params: SingleBeatRewriteParams
): Promise<SingleBeatRewriteResult> {
  const {
    result,
    scene,
    beat,
    prevBeat,
    nextBeat,
    format,
    instruction,
    apiKey,
    aiProvider,
    modelQuality = 'standard',
    groqModel,
    userSignal,
  } = params;

  const trimmedInstruction = (instruction || '').trim();
  if (!trimmedInstruction) {
    throw new Error('Enter a rewrite instruction first.');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Add an API key in Model & API Settings before rewriting a beat.');
  }

  const prompt = buildSingleBeatRewritePrompt({
    result,
    scene,
    beat,
    prevBeat,
    nextBeat,
    format,
    instruction: trimmedInstruction,
  });

  let parsed: {
    imagePrompt?: string;
    shotType?: string;
    cameraAngle?: string;
    cameraMovement?: string;
  } | null = null;

  try {
    if (aiProvider === 'groq') {
      parsed = await executeJsonLlmCall<any>({
        provider: 'groq',
        apiKey,
        systemPrompt:
          'You are a Director of Photography rewriting one visual prompt. Output strictly valid raw JSON with no em dashes.',
        userPrompt: prompt,
        modelQuality,
        groqModel,
        userSignal,
        temperature: 0.25,
      });
    } else {
      parsed = await executeGeminiSchemaCall<any>({
        apiKey,
        prompt,
        modelQuality,
        responseSchema: REWRITE_RESPONSE_SCHEMA,
        temperature: 0.25,
        thinkingLevel: 'minimal',
        errorContext: `Scene ${scene.index} Beat ${beat.beatIndex} rewrite`,
        userSignal,
      });
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new Error(formatRewriteError(err, apiKey, aiProvider, resolveGeminiModelId(modelQuality)));
  }

  const rawPrompt = typeof parsed?.imagePrompt === 'string' ? parsed.imagePrompt.trim() : '';
  if (!rawPrompt) {
    throw new Error('The AI returned an empty prompt. Try adjusting your instruction and retry.');
  }

  let finalBeat = normalizeRewrittenBeat({
    rawPrompt,
    rawShotType: typeof parsed?.shotType === 'string' ? parsed.shotType : undefined,
    rawCameraAngle: typeof parsed?.cameraAngle === 'string' ? parsed.cameraAngle : undefined,
    rawCameraMovement: typeof parsed?.cameraMovement === 'string' ? parsed.cameraMovement : undefined,
    originalBeat: beat,
    result,
    format,
  });

  // Run deterministic Stage 4 verification checks (excluding dwell bounds, since rewrite keeps beat timing)
  const bible = buildFallbackBibleFromResult(result);
  const genMode: GenerationMode = result.generationMode || 'image';
  const siblingWritten = (scene.beats || []).map((b) =>
    b.beatIndex === finalBeat.beatIndex ? toWrittenPromptBeat(finalBeat) : toWrittenPromptBeat(b)
  );
  const targetWritten = toWrittenPromptBeat(finalBeat);
  const check = verifyBeatCodeChecks(
    targetWritten,
    siblingWritten,
    bible,
    format,
    genMode,
    result.targetVideoDuration
  );
  const promptIssues = check.issues.filter((iss) => !iss.includes('violates dwell bounds'));

  let warnings: string[] = [];
  if (promptIssues.length > 0 && !userSignal?.aborted) {
    try {
      const repairedWritten = await repairFailingBeat(
        targetWritten,
        promptIssues,
        bible,
        apiKey,
        modelQuality,
        aiProvider,
        groqModel,
        userSignal,
        genMode
      );
      finalBeat = normalizeRewrittenBeat({
        rawPrompt: repairedWritten.imagePrompt,
        rawShotType: finalBeat.shotType,
        rawCameraAngle: finalBeat.cameraAngle,
        rawCameraMovement: finalBeat.cameraMovement,
        originalBeat: beat,
        result,
        format,
      });
      const recheck = verifyBeatCodeChecks(
        toWrittenPromptBeat(finalBeat),
        siblingWritten,
        bible,
        format,
        genMode,
        result.targetVideoDuration
      );
      warnings = recheck.issues.filter((iss) => !iss.includes('violates dwell bounds'));
      if (warnings.length > 0) {
        finalBeat.flaggedIssue = warnings.join('; ');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      warnings = promptIssues;
    }
  }

  return {
    beat: finalBeat,
    warnings,
  };
}
