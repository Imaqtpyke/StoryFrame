// ============================================================================
// ENHANCE STORY ARCHITECT PIPELINE (Toggle ON Only)
// Dedicated service for automated concept research, hook optimization,
// duration-budgeted narrative pacing, visual token bible consistency,
// and self-contained prompts for AI video generators (Veo, Kling, Sora, Luma).
//
// This file is strictly isolated from the original generator in geminiClient.ts.
// ============================================================================

import { GenerateStoryRequest, StoryGenerationResult, StyleProfile, Beat } from '../types';
import {
  enforceBeatCeilings,
  extractTemporalAnchor,
  cleanRedundantOnScreenText,
  populateSceneTransitionHints,
} from './beatSplitting';
import { updateVideoPromptDuration } from './videoSuitability';

function removeEmDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/[\u2014\u2013]/g, ', ')
    .replace(/\s*--\s*/g, ', ');
}

function sanitizeErrorMessage(errorText: string, apiKey: string): string {
  if (!errorText) return 'An unexpected error occurred.';
  let cleaned = errorText;
  if (apiKey && apiKey.length > 6) {
    cleaned = cleaned.replaceAll(apiKey, '[REDACTED]');
  }
  if (cleaned.toLowerCase().includes('caller does not have permission') || cleaned.toLowerCase().includes('permission_denied')) {
    return `The caller does not have permission. Please verify that:
1. Your API key has the "Generative Language API" enabled in Google Cloud / Google AI Studio.
2. If your key has HTTP referrer restrictions, ensure this application domain is permitted or remove the referrer restriction.
3. If using an AI Studio key, ensure it is active at https://aistudio.google.com/app/apikey.`;
  }
  if (cleaned.toLowerCase().includes('503') || cleaned.toLowerCase().includes('overloaded') || cleaned.toLowerCase().includes('service unavailable')) {
    return `Google Gemini servers are temporarily overloaded (503 Service Unavailable).
Automatic retries were attempted, but Google's cluster is experiencing high demand. Please wait 10-20 seconds and click "Generate Breakdown" again — server capacity usually clears up quickly.`;
  }
  if (cleaned.toLowerCase().includes('429') || cleaned.toLowerCase().includes('quota') || cleaned.toLowerCase().includes('resource has been exhausted')) {
    return `Gemini API rate limit or quota exceeded (429).
Please wait a moment before trying again, or check your quotas at https://aistudio.google.com/.`;
  }
  return cleaned;
}

const DEFAULT_SHOT_TYPES = [
  'Wide Establishing Shot',
  'Medium Shot',
  'Close-Up',
  'Over-the-Shoulder (OTS)',
  'Low-Angle Cinematic Shot',
  'Macro Detail Shot',
  'Point-of-View (POV)',
  'Dutch Angle Hero Shot',
  'Whip-Pan',
];

const DEFAULT_CAMERA_MOVEMENTS = [
  'Slow Push-In',
  'Static Frame',
  'Tracking Subject',
  'Smooth Pan',
  'Whip-Pan',
  'Low Dolly Glide',
  'Handheld Cinematic Drift',
];

const DEFAULT_CAMERA_ANGLES = [
  'eye-level',
  'high-angle',
  'low-angle',
  'birds-eye',
  'worms-eye',
  'dutch-tilt',
];

function inferShotType(imagePrompt: string, beatIndex: number): string {
  const lower = imagePrompt.toLowerCase();
  if (lower.includes('whip') || lower.includes('swish pan')) return 'Whip-Pan';
  if (lower.includes('extreme close') || lower.includes('macro')) return 'Extreme Close-Up';
  if (lower.includes('close-up') || lower.includes('closeup') || lower.includes('face') || lower.includes('eyes')) return 'Close-Up';
  if (lower.includes('wide') || lower.includes('establishing') || lower.includes('landscape') || lower.includes('aerial')) return 'Wide Establishing Shot';
  if (lower.includes('over the shoulder') || lower.includes('ots')) return 'Over-the-Shoulder (OTS)';
  if (lower.includes('low angle') || lower.includes('looking up')) return 'Low-Angle Hero Shot';
  if (lower.includes('high angle') || lower.includes('top down') || lower.includes('bird')) return 'High-Angle Shot';
  if (lower.includes('medium') || lower.includes('waist up') || lower.includes('torso')) return 'Medium Shot';
  return DEFAULT_SHOT_TYPES[(beatIndex - 1) % DEFAULT_SHOT_TYPES.length];
}

function inferCameraAngle(imagePrompt: string, beatIndex: number): string {
  const lower = imagePrompt.toLowerCase();
  if (lower.includes('high angle') || lower.includes('from above') || lower.includes('looking down')) return 'high-angle';
  if (lower.includes('low angle') || lower.includes('from below') || lower.includes('looking up')) return 'low-angle';
  if (lower.includes('bird') || lower.includes('overhead') || lower.includes('aerial') || lower.includes('top down') || lower.includes('top-down')) return 'birds-eye';
  if (lower.includes('worm') || lower.includes('ground level')) return 'worms-eye';
  if (lower.includes('dutch') || lower.includes('tilted') || lower.includes('canted')) return 'dutch-tilt';
  if (lower.includes('eye level') || lower.includes('eye-level') || lower.includes('straight-on')) return 'eye-level';
  return DEFAULT_CAMERA_ANGLES[(beatIndex - 1) % DEFAULT_CAMERA_ANGLES.length];
}

function inferCameraMovement(imagePrompt: string, beatIndex: number): string {
  const lower = imagePrompt.toLowerCase();
  if (lower.includes('whip') || lower.includes('swish') || lower.includes('fast blur pan') || lower.includes('blur pan')) return 'Whip-Pan';
  if (lower.includes('push') || lower.includes('zoom in')) return 'Slow Push-In';
  if (lower.includes('track') || lower.includes('follow') || lower.includes('run')) return 'Tracking Subject';
  if (lower.includes('pan')) return 'Smooth Pan';
  if (lower.includes('dolly')) return 'Low Dolly Glide';
  if (lower.includes('static') || lower.includes('still')) return 'Static Frame';
  return DEFAULT_CAMERA_MOVEMENTS[(beatIndex - 1) % DEFAULT_CAMERA_MOVEMENTS.length];
}

function resolveEstablishedLookPlaceholders(
  prompt: string,
  charSheet: Record<string, string>,
  locSheet: Record<string, string>
): string {
  const placeholderRegex = /\s*\((?:matching established look|matching established setting)[^)]*\)/gi;
  if (!placeholderRegex.test(prompt)) {
    return prompt;
  }

  return prompt.replace(/([A-Za-z0-9\s'-]+?)\s*\((?:matching established look|matching established setting)[^)]*\)/gi, (match, entityName) => {
    const trimmed = entityName.trim();
    const cleanLower = trimmed.toLowerCase();

    for (const [locKey, locDesc] of Object.entries(locSheet)) {
      if (cleanLower.includes(locKey.toLowerCase()) || locKey.toLowerCase().includes(cleanLower)) {
        return `${trimmed}: ${locDesc}`;
      }
    }

    for (const [charKey, charDesc] of Object.entries(charSheet)) {
      if (cleanLower.includes(charKey.toLowerCase()) || charKey.toLowerCase().includes(cleanLower)) {
        return `${trimmed}: ${charDesc}`;
      }
    }

    return trimmed;
  });
}

function resolveDisjunctivePhrasing(prompt: string): string {
  return prompt
    .replace(/\b(?:like a|such as a)\s+([a-zA-Z0-9\s-]+?)\s+(?:or|and)\s+[a-zA-Z0-9\s-]+(?=[,\.])/gi, '$1')
    .replace(/\b(?:like an|such as an)\s+([a-zA-Z0-9\s-]+?)\s+(?:or|and)\s+[a-zA-Z0-9\s-]+(?=[,\.])/gi, '$1');
}

export async function generateEnhancedStory(
  req: GenerateStoryRequest,
  apiKey: string
): Promise<StoryGenerationResult> {
  const {
    story,
    characterStyle,
    format,
    platform,
    durationMode,
    durationSeconds,
    modelQuality,
    generationMode = 'image',
    targetVideoDuration: reqTargetVideoDuration,
    beatMode = 'automatic',
    customScenes,
  } = req;

  const isVideoMode = generationMode === 'video';
  const isCustomBeats = beatMode === 'custom' && Array.isArray(customScenes) && customScenes.length > 0;
  const targetVideoDuration = reqTargetVideoDuration || (typeof durationSeconds === 'number' && durationSeconds <= 15 ? durationSeconds : 5);

  const isLongForm = format === 'long';
  const defaultAspectRatio = isLongForm ? '16:9 widescreen' : '9:16 vertical';

  let durationInstruction = '';
  if (isVideoMode) {
    durationInstruction = `Generation mode is Text to Video. Target single video clip duration is strictly ${targetVideoDuration} seconds per scene. Break the story into distinct visual scenes that can each be captured in a single ${targetVideoDuration}-second AI video shot. Each scene's master "videoPrompt" MUST state Duration: ${targetVideoDuration} seconds.`;
  } else if (durationMode === 'automatic') {
    durationInstruction = `Duration mode is Automatic. Break the story into however many scenes it naturally requires. Estimate realistic narration pacing with a floor of 3 to 6 seconds of spoken narration per scene. Calculate and return totalDurationSeconds accurately based on the scene pacing.`;
  } else if (durationSeconds && durationSeconds > 0) {
    durationInstruction = `Target total duration is exactly ${durationSeconds} seconds (${isLongForm ? Math.round(durationSeconds / 60) + ' minutes' : durationSeconds + ' seconds'}). Carefully pace the number of scenes and the length of each scene's spoken narrator line so their combined spoken narration matches this target duration closely.`;
  } else {
    durationInstruction = `Provide a well-paced scene sequence with 3 to 6 seconds per scene floor.`;
  }

  const maxSpokenWordsPerScene = isVideoMode
    ? Math.max(6, Math.round(targetVideoDuration * 2.2))
    : 10;

  const autoArchitectInstruction = `\n\n================================================================================
CRITICAL: AUTO STORY ARCHITECT & VIRAL HOOK OPTIMIZATION ACTIVE:
================================================================================
The user has enabled the Auto Story Architect & Hook Optimizer pipeline.
You MUST take their raw premise, question, draft, or concept and perform comprehensive end-to-end research, hook engineering, duration-calibrated narrative scripting, and visual scene breakdown in this single pass:

1. COMPREHENSIVE CONCEPT RESEARCH & CAUSAL CHAIN (APPLICABLE TO ANY STORY):
   - Analyze the premise deeply, whether it is a biological or medical curiosity (e.g. Zack D. Films style: "What happens if you swallow a magnet/battery?"), a scientific phenomenon, historical turning point, urban legend, mystery, or creative drama.
   - Establish the precise step-by-step physical, chemical, or psychological cause-and-effect chain. Break down what happens sequentially without hand-waving or skipping mechanical steps.

2. VIRAL OPENING HOOK ENGINEERING (MAXIMUM FIRST 2-SECOND RETENTION):
   - You MUST craft an irresistible, scroll-stopping opening hook sentence for Scene 1.
   - Ban boring traditional narrative intros (e.g., NEVER begin with "Have you ever wondered...", "This is the story of...", or "In 1999...").
   - Employ high-retention formats: Curiosity Gap, Imminent Jeopardy, or Counter-Intuitive Truth (e.g., "Swallowing two tiny magnets can silently tear your organs.", "The moment a diver breaches 300 feet without a cage, the ocean goes pitch black, but that is not what kills you.").
   - Populate the "hookAnalysis" object in the JSON output:
     - "headlineHook": the exact viral opening hook sentence used in Scene 1 Beat 1.
     - "hookType": the psychological hook category (e.g., "Curiosity Gap", "Immediate Biological Threat", "Counter-Intuitive Truth", "High-Stakes Dilemma").
     - "hookRationale": concise 1-2 sentence explanation of why this hook grabs and holds viewer retention in the first two seconds.

3. STRICT DURATION-AWARE SPOKEN NARRATION BUDGET (CRITICAL PACING MATH):
   ${isVideoMode
     ? `- VIDEO CLIP DURATION: Each scene clip represents EXACTLY ${targetVideoDuration} seconds.
   - SPOKEN WORD CEILING: Natural voiceover speech runs at ~2 to 2.2 words per second. Therefore, EACH scene's "narratorLine" MUST BE PUNCHY AND MUST NOT EXCEED ${maxSpokenWordsPerScene} WORDS (for a ${targetVideoDuration}-second clip, max ${maxSpokenWordsPerScene} words).
   - NEVER cram a long, complex 12-20 word sentence into a ${targetVideoDuration}-second scene!
   - If the premise or scientific fact requires more explanation, you MUST distribute the narrative across MULTIPLE sequential ${targetVideoDuration}-second scenes (e.g., Scene 1: hook premise in ≤${maxSpokenWordsPerScene} words; Scene 2: biological/causal mechanism in ≤${maxSpokenWordsPerScene} words; Scene 3: visual outcome in ≤${maxSpokenWordsPerScene} words).`
     : `- Speech runs at ~2 words per second. Every scene's "narratorLine" must be a natural spoken sentence, and "estimatedSeconds" must reflect spoken pacing accurately (~1 second per 2 words).
   - If a target duration is set (${durationSeconds ? durationSeconds + 's' : 'automatic'}), pace the script length so all scenes combined match this target closely.`}

4. MANDATORY MULTI-BEAT BREAKDOWN (NEVER A SINGLE BEAT PER SCENE):
   ${isVideoMode
     ? `- MANDATORY MULTI-BEAT RULE: A single beat spanning an entire ${targetVideoDuration}-second video clip is STRICTLY FORBIDDEN.
   - Every ${targetVideoDuration}-second scene MUST be subdivided into 2 to 3 sequential micro-beats (${targetVideoDuration <= 6 ? '2 to 3 beats of ~1.0s to 2.0s each' : '3 to 5 beats of ~1.5s to 2.5s each'}).
   - Each beat covers a short 2 to 4 word phrase segment of the narratorLine and presents a distinct visual camera shot, angle, and movement progression (Beat 1: establishing/starting action, Beat 2: dynamic reaction or shift, Beat 3: immediate consequence or visual punchline).`
     : `- HARD CEILING RULE: No single beat may represent more than 2 seconds of estimated narration or 8 words, whichever is smaller.
   - Partition each scene's spoken sentence across 2 to 4 distinct visual beats with dynamic camera variety (wide → medium → close-up).`}

5. MANDATORY GLOBAL VISUAL TOKEN BIBLE & UNBREAKABLE COLOR/MATERIAL CONSISTENCY:
   - Establish and strictly enforce a unified, permanent visual anchor palette across all scenes and beats:
     * FLUIDS, GASES & ENERGETIC SUBSTANCES: If acid, gastric fluid, poison, potion, fire, blood, or energy is present, you MUST explicitly declare its EXACT color up front in Scene 1 (e.g., "toxic fluorescent-green bubbling acid" or "viscous dark plum-purple gastric fluid"). That EXACT color descriptor MUST BE REPEATED in every single beat that features it. Switching colors mid-story (e.g. green in scene 1 and purple in scene 2) or leaving color unstated so the video generator guesses is STRICTLY FORBIDDEN.
     * PROPS & SWALLOWED / HELD OBJECTS: Explicitly define key objects with exact, singular geometry, material, and dimensions (e.g., "a 1-inch hexagonal galvanized steel bolt with screw threads"). Disjunctive or indecisive phrasing like "like a small bolt or coin", "either X or Y", or "a metal object" is STRICTLY FORBIDDEN.
     * RECURRING ENVIRONMENT GEOMETRY & ARCHITECTURE: Lock the specific walls, geometry, textures, and color tones of the recurring location (e.g., "cavernous internal organ environment with blocky, textured walls representing organic stomach lining rugae folds with 32-bit flat shading").

6. 100% SELF-CONTAINED PROMPTS FOR DOWNSTREAM VIDEO GENERATORS (GOOGLE FLOW / VEO / KLING):
   - Downstream video generation tools render each clip in isolation without access to previous scenes.
   - Therefore, NEVER output empty references like "(matching established look from Scene 1)" or "(matching established look)" in any videoPrompt or beat imagePrompt without the full concrete visual details!
   - Every single beat prompt MUST be completely self-contained with its visual DNA (art style, environment architecture, subject/object geometry, and locked fluid color).

7. FRONT-LOADED VISUAL FOUNDATION (FIRST 15-20 TOKENS):
   - Video diffusion models give the highest attention weight to the first 15 to 20 tokens.
   - In all beat prompts and scene video prompts, FRONT-LOAD the visual foundation at the start:
     [${characterStyle || 'cinematic'}, 32-bit flat-shaded] [Environment Anchor] [Subject & Locked Color/Material]: [Action kinematics & movement]. Camera: [Shot Type], [Camera Angle], [Camera Movement]. Lighting: [...]. Physics: [...]. Audio: no dialogue, ambient sound only. ${defaultAspectRatio}.
   - NEVER bury the environment description in a trailing parenthetical at the end like "Location Continuity (...)" where video diffusion engines will ignore it.`;

  const systemPrompt = isVideoMode
    ? `You are an expert film director, cinematographer, and AI video prompt engineer.
Your task is to take a story and generate a production-ready, scene-by-scene video generation breakdown with smart duration-adaptive video beats.${autoArchitectInstruction}

TARGET DURATION & SMART BEAT ADAPTATION:
The target video duration is ${targetVideoDuration} seconds per scene clip (e.g., ${targetVideoDuration}s).
You MUST analyze the narrator sentence and narrative action of each scene and break it into sequential visual video shot beats that TOGETHER precisely span and cover the ${targetVideoDuration}-second duration:
- For a ${targetVideoDuration}-second clip: create ${targetVideoDuration <= 6 ? '2 to 3 concise video shot beats (~1.0s to 2.0s each, precisely totaling ' + targetVideoDuration + 's)' : '3 to 5 developmental video shot beats (~1.5s to 2.5s each, precisely totaling ' + targetVideoDuration + 's)'}.
- SINGLE-BEAT SCENES ARE STRICTLY FORBIDDEN. Every scene clip MUST feature multiple progressive shot beats.
- Each beat covers a phrase fragment of 2 to 4 words from the narratorLine, with distinct camera shotType, cameraAngle, and cameraMovement.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium or cinematic style adapting to: "${characterStyle || 'cinematic hyperrealism'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor (e.g., "Shot on 35mm anamorphic prime lens, subtle 35mm Kodak 5219 film grain, high dynamic range")

2. Continuity Sheets (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping each recurring character name to ONE fixed, highly detailed visual description.
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once to ONE fixed, highly detailed visual description.

3. Mandatory 8-Part Master Scene "videoPrompt" Structure:
   For EACH scene, construct "videoPrompt" adhering strictly to these exact 8 components:
   - subject: full concrete visual description front-loaded with style and environment.
   - action: described in temporal order with anatomical & kinematic specificity.
   - camera: exactly ONE shot type, exactly ONE camera angle, and exactly ONE movement.
   - lighting and environment: atmospheric lighting and environment details.
   - style: styleProfile artStyle plus lens descriptor.
   - physics: concrete physical dynamics.
   - audio: ALWAYS state "no dialogue, ambient sound only" or "silent".
   - duration: in seconds matching ${targetVideoDuration} seconds.

4. Start Frame Ingredients (Text to Image Prompt):
   For each scene, provide "startFramePrompt": initial reference keyframe image formatted as:
   [Shot framing and angle] of [Subject with exact details], [Initial frame pose] in [Setting Details], [Lighting & Color palette], ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}.

5. Smart Video Beats Array ("beats"):
   For each scene, provide an array of fine-grained video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
   Each beat MUST contain:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": specific phrase or spoken clause from the narrator line. Every beat MUST correspond to actual spoken words from the narrator line. DO NOT create artificial extra beats with empty textSpan ("") or ghost beats. Distribute the ${targetVideoDuration} seconds across the actual phrases of the sentence (e.g. 2 beats of 2.0s each for a 4-second clip).
   - "estimatedSeconds": estimated duration in seconds
   - "shotType": explicit cinematography shot size
   - "cameraAngle": explicit camera angle
   - "cameraMovement": cinematic camera motion cue
   - "temporalAnchor": optional string for explicit year/date/duration
   - "transitionHint": optional string describing a shared visual anchor
   - "imagePrompt": A complete, standalone, production-ready TEXT TO VIDEO PROMPT formatted for AI video generators capturing this specific beat's action.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS. Generic role descriptions only.
4. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "hookAnalysis": {
    "headlineHook": "string (Scene 1 Beat 1 viral hook)",
    "hookType": "string (e.g. Curiosity Gap | Immediate Threat | Counter-Intuitive Truth | Dilemma)",
    "hookRationale": "string (1-2 sentences on retention psychology)"
  },
  "styleProfile": {
    "artStyle": "...",
    "colorPalette": "...",
    "lighting": "...",
    "eraAndSetting": "...",
    "lensAndFilmStock": "Shot on 35mm anamorphic lens, fine film grain..."
  },
  "characterSheet": {
    "CharacterName": "Detailed visual description..."
  },
  "locationSheet": {
    "LocationName": "Detailed visual description..."
  },
  "totalDurationSeconds": number,
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "videoPrompt": "string",
      "startFramePrompt": "string",
      "establishedCharacters": ["Name"],
      "establishedSettings": ["Setting"],
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "estimatedSeconds": number,
          "shotType": "string",
          "cameraAngle": "string",
          "cameraMovement": "string",
          "temporalAnchor": "string (optional)",
          "transitionHint": "string (optional)",
          "imagePrompt": "string"
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and visual continuity sheets.${autoArchitectInstruction}

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood
   - "lighting": lighting style and atmospheric quality
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor

2. Continuity Sheets:
   - "characterSheet": recurring character descriptions.
   - "locationSheet": recurring location descriptions.

3. Nested Scenes and Beats:
   Each scene has index, narratorLine, estimatedSeconds, and beats array.
   Each beat contains beatIndex, textSpan, estimatedSeconds, shotType, cameraAngle, cameraMovement, imagePrompt, etc.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere.
2. Format: ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS.
4. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "hookAnalysis": {
    "headlineHook": "string (Scene 1 Beat 1 viral hook)",
    "hookType": "string (e.g. Curiosity Gap | Immediate Threat | Counter-Intuitive Truth | Dilemma)",
    "hookRationale": "string (1-2 sentences on retention psychology)"
  },
  "styleProfile": {
    "artStyle": "...",
    "colorPalette": "...",
    "lighting": "...",
    "eraAndSetting": "...",
    "lensAndFilmStock": "..."
  },
  "characterSheet": {},
  "locationSheet": {},
  "totalDurationSeconds": number,
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "shotType": "string",
          "cameraAngle": "string",
          "cameraMovement": "string",
          "temporalAnchor": "string (optional)",
          "transitionHint": "string (optional)",
          "imagePrompt": "string",
          "estimatedSeconds": number
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`;

  const userPrompt = `[PIPELINE: AUTO STORY ARCHITECT & HOOK OPTIMIZER ACTIVE - Research concept, engineer viral opening hook, write full-sentence voiceover script, and generate breakdown]

Story Idea / Concept Premise:
${story}

Character Style Instruction:
${characterStyle || 'Consistent style specified by scene context.'}

Format: ${isLongForm ? 'Long form (16:9)' : 'Short form (9:16)'}
Platform: ${platform}
${durationInstruction}`;

  const candidateModels = modelQuality === 'high'
    ? ['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash']
    : ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-pro-preview'];

  let rawText = '';
  let parsedData: any = null;
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.85,
          responseMimeType: 'application/json',
        },
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API error (${resp.status}): ${errText}`);
      }

      const resJson = await resp.json();
      const contentCandidate = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentCandidate) {
        throw new Error('Empty response from model');
      }

      rawText = contentCandidate;
      parsedData = JSON.parse(rawText);
      break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!parsedData) {
    throw new Error(sanitizeErrorMessage(lastError?.message || 'Failed to generate enhanced story breakdown.', apiKey));
  }

  // Sanitize styleProfile
  const rawStyleProfile = parsedData.styleProfile || {};
  const sanitizedStyleProfile: StyleProfile = {
    artStyle: removeEmDashes(rawStyleProfile.artStyle || characterStyle || 'Cinematic Rendering'),
    colorPalette: removeEmDashes(rawStyleProfile.colorPalette || 'Harmonious color grading matching narrative tone'),
    lighting: removeEmDashes(rawStyleProfile.lighting || 'Cinematic three-point lighting with soft rim fill'),
    eraAndSetting: removeEmDashes(rawStyleProfile.eraAndSetting || 'Contemporary atmospheric setting'),
    lensAndFilmStock: removeEmDashes(rawStyleProfile.lensAndFilmStock || 'Shot on 35mm anamorphic prime lens, subtle film grain'),
  };

  const sanitizedCharacterSheet: Record<string, string> = {};
  if (parsedData.characterSheet && typeof parsedData.characterSheet === 'object') {
    for (const [key, val] of Object.entries(parsedData.characterSheet)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        sanitizedCharacterSheet[key.trim()] = removeEmDashes(val.trim());
      }
    }
  }

  const sanitizedLocationSheet: Record<string, string> = {};
  if (parsedData.locationSheet && typeof parsedData.locationSheet === 'object') {
    for (const [key, val] of Object.entries(parsedData.locationSheet)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        sanitizedLocationSheet[key.trim()] = removeEmDashes(val.trim());
      }
    }
  }

  const rawScenes = Array.isArray(parsedData.scenes) ? parsedData.scenes : [];
  const sanitizedScenes = rawScenes.map((scene: any, sIdx: number) => {
    const sceneIndex = typeof scene.index === 'number' ? scene.index : sIdx + 1;
    const narratorLine = removeEmDashes(scene.narratorLine || '');

    let videoPrompt = scene.videoPrompt ? removeEmDashes(scene.videoPrompt) : undefined;
    let startFramePrompt = scene.startFramePrompt ? removeEmDashes(scene.startFramePrompt) : undefined;

    if (videoPrompt) {
      videoPrompt = resolveEstablishedLookPlaceholders(videoPrompt, sanitizedCharacterSheet, sanitizedLocationSheet);
      videoPrompt = resolveDisjunctivePhrasing(videoPrompt);
      if (isVideoMode) {
        videoPrompt = updateVideoPromptDuration(videoPrompt, targetVideoDuration, targetVideoDuration);
      }
    }
    if (startFramePrompt) {
      startFramePrompt = resolveEstablishedLookPlaceholders(startFramePrompt, sanitizedCharacterSheet, sanitizedLocationSheet);
      startFramePrompt = resolveDisjunctivePhrasing(startFramePrompt);
    }

    const rawBeats = Array.isArray(scene.beats) ? scene.beats : [];
    const sanitizedBeats: Beat[] = rawBeats.map((beat: any, bIdx: number) => {
      const beatIndex = typeof beat.beatIndex === 'number' ? beat.beatIndex : bIdx + 1;
      const textSpan = removeEmDashes(beat.textSpan || '');
      let imagePrompt = removeEmDashes(beat.imagePrompt || '');

      imagePrompt = resolveEstablishedLookPlaceholders(imagePrompt, sanitizedCharacterSheet, sanitizedLocationSheet);
      imagePrompt = resolveDisjunctivePhrasing(imagePrompt);
      imagePrompt = imagePrompt.replace(/\s*(?:Location|Character) Continuity \([^)]*\)\.?/gi, '');

      // Front-load style if not present
      if (!imagePrompt.includes(sanitizedStyleProfile.artStyle)) {
        imagePrompt = `[${sanitizedStyleProfile.artStyle}] ${imagePrompt}`;
      }

      const shotType = removeEmDashes(beat.shotType || inferShotType(imagePrompt, beatIndex));
      const cameraAngle = removeEmDashes(beat.cameraAngle || inferCameraAngle(imagePrompt, beatIndex));
      const cameraMovement = removeEmDashes(beat.cameraMovement || inferCameraMovement(imagePrompt, beatIndex));

      const directAnchor = extractTemporalAnchor(textSpan);

      return {
        beatIndex,
        textSpan,
        shotType,
        cameraAngle,
        cameraMovement,
        temporalAnchor: directAnchor,
        transitionHint: beat.transitionHint ? removeEmDashes(beat.transitionHint) : undefined,
        imagePrompt: imagePrompt.trim(),
        estimatedSeconds: typeof beat.estimatedSeconds === 'number' && beat.estimatedSeconds > 0
          ? beat.estimatedSeconds
          : 2,
      };
    });

    // Enforce smart duration calibration and beat ceilings for Enhance Story mode
    const ceilingEnforcedBeats = enforceBeatCeilings(sanitizedBeats, sceneIndex, {
      isVideoMode,
      targetVideoDuration,
    });

    return {
      index: sceneIndex,
      narratorLine,
      estimatedSeconds: isVideoMode ? targetVideoDuration : Math.round(ceilingEnforcedBeats.reduce((s, b) => s + (b.estimatedSeconds || 1.5), 0)),
      beats: ceilingEnforcedBeats,
      videoPrompt,
      startFramePrompt,
      establishedCharacters: Array.isArray(scene.establishedCharacters) ? scene.establishedCharacters : [],
      establishedSettings: Array.isArray(scene.establishedSettings) ? scene.establishedSettings : [],
      isAnchorScene: sIdx === 0,
    };
  });

  const scenesWithHints = populateSceneTransitionHints(sanitizedScenes, sanitizedStyleProfile);
  const totalDuration = scenesWithHints.reduce((sum: number, s: any) => sum + s.estimatedSeconds, 0);

  const hookAnalysis = parsedData.hookAnalysis && typeof parsedData.hookAnalysis === 'object'
    ? {
        headlineHook: typeof parsedData.hookAnalysis.headlineHook === 'string' ? parsedData.hookAnalysis.headlineHook : undefined,
        hookType: typeof parsedData.hookAnalysis.hookType === 'string' ? parsedData.hookAnalysis.hookType : undefined,
        hookRationale: typeof parsedData.hookAnalysis.hookRationale === 'string' ? parsedData.hookAnalysis.hookRationale : undefined,
      }
    : undefined;

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: sanitizedCharacterSheet,
    locationSheet: sanitizedLocationSheet,
    totalDurationSeconds: totalDuration,
    scenes: scenesWithHints,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
    autoArchitectMode: true,
    hookAnalysis,
  };
}
