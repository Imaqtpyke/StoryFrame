// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import { GenerateStoryRequest, StoryGenerationResult, StyleProfile } from '../types';
import { enforceBeatCeilings } from './beatSplitting';

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
  'Dutch Angle Hero Shot'
];

const DEFAULT_CAMERA_MOVEMENTS = [
  'Slow Push-In',
  'Static Frame',
  'Tracking Subject',
  'Smooth Pan',
  'Low Dolly Glide',
  'Handheld Cinematic Drift'
];

function inferShotType(imagePrompt: string, beatIndex: number): string {
  const lower = imagePrompt.toLowerCase();
  if (lower.includes('extreme close') || lower.includes('macro')) return 'Extreme Close-Up';
  if (lower.includes('close-up') || lower.includes('closeup') || lower.includes('face') || lower.includes('eyes')) return 'Close-Up';
  if (lower.includes('wide') || lower.includes('establishing') || lower.includes('landscape') || lower.includes('aerial')) return 'Wide Establishing Shot';
  if (lower.includes('over the shoulder') || lower.includes('ots')) return 'Over-the-Shoulder (OTS)';
  if (lower.includes('low angle') || lower.includes('looking up')) return 'Low-Angle Hero Shot';
  if (lower.includes('high angle') || lower.includes('top down') || lower.includes('bird')) return 'High-Angle Shot';
  if (lower.includes('medium') || lower.includes('waist up') || lower.includes('torso')) return 'Medium Shot';
  return DEFAULT_SHOT_TYPES[(beatIndex - 1) % DEFAULT_SHOT_TYPES.length];
}

function inferCameraMovement(imagePrompt: string, beatIndex: number): string {
  const lower = imagePrompt.toLowerCase();
  if (lower.includes('push') || lower.includes('zoom in')) return 'Slow Push-In';
  if (lower.includes('track') || lower.includes('follow') || lower.includes('run')) return 'Tracking Movement';
  if (lower.includes('pan')) return 'Smooth Pan';
  if (lower.includes('dolly')) return 'Dolly Slide';
  if (lower.includes('static') || lower.includes('still')) return 'Static Frame';
  return DEFAULT_CAMERA_MOVEMENTS[(beatIndex - 1) % DEFAULT_CAMERA_MOVEMENTS.length];
}

export async function generateStoryDirectly(
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
  } = req;

  const isVideoMode = generationMode === 'video';
  const targetVideoDuration = reqTargetVideoDuration || (typeof durationSeconds === 'number' && durationSeconds <= 15 ? durationSeconds : 5);

  const isLongForm = format === 'long';
  const defaultAspectRatio = isLongForm ? '16:9 widescreen' : '9:16 vertical';

  let durationInstruction = '';
  if (isVideoMode) {
    durationInstruction = `Generation mode is Text to Video. Target single video clip duration is ${targetVideoDuration} seconds per scene (options 5-15s). Break the story into distinct visual scenes that can each be captured in a single ${targetVideoDuration}-second AI video shot.`;
  } else if (durationMode === 'automatic') {
    durationInstruction = `Duration mode is Automatic. Break the story into however many scenes it naturally requires. Estimate realistic narration pacing with a floor of 3 to 6 seconds of spoken narration per scene. Calculate and return totalDurationSeconds accurately based on the scene pacing.`;
  } else if (durationSeconds && durationSeconds > 0) {
    durationInstruction = `Target total duration is exactly ${durationSeconds} seconds (${isLongForm ? Math.round(durationSeconds / 60) + ' minutes' : durationSeconds + ' seconds'}). Carefully pace the number of scenes and the length of each scene's spoken narrator line so their combined spoken narration matches this target duration closely.`;
  } else {
    durationInstruction = `Provide a well-paced scene sequence with 3 to 6 seconds per scene floor.`;
  }

  const systemPrompt = isVideoMode
    ? `You are an expert film director, cinematographer, and AI video prompt engineer.
Your task is to take a story and generate a production-ready, scene-by-scene video generation breakdown with smart duration-adaptive video beats.

TARGET DURATION & SMART BEAT ADAPTATION:
The target video duration is ${targetVideoDuration} seconds per scene clip (e.g., 5s, 6s, 8s, 10s, 15s).
You MUST analyze the narrator sentence and narrative action of each scene and break it into sequential visual video shot beats that TOGETHER precisely span and cover the ${targetVideoDuration}-second duration.
- For a 5-second clip: create 2 to 3 concise video shot beats (~1.5s to 2.5s each, totaling ~5s).
- For a 10-second clip: create 3 to 5 developmental video shot beats (~2.0s to 3.0s each, totaling ~10s).
- For a 15-second clip: create 4 to 6 expansive video shot beats (~2.5s to 3.5s each, totaling ~15s).

For example, for the sentence: "Imagine an entire island, packed with a bustling mining town, completely vanishing into the ocean overnight":
- Beat 1 ("Imagine an entire island"): Complete video prompt of an entire island shot with aerial camera movement.
- Beat 2 ("packed with a bustling mining town"): Complete video prompt of the mining town shot with street-level tracking.
- Beat 3 ("completely vanishing into the ocean overnight"): Complete video prompt of the town being consumed by waves.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium or cinematic style adapting to: "${characterStyle || 'cinematic hyperrealism'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality (e.g., golden hour rim light, misty neon glow, or soft lantern ambience)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor (e.g., "Shot on 35mm anamorphic prime lens, subtle 35mm Kodak 5219 film grain, high dynamic range")

2. Character Sheet:
   Create a top-level "characterSheet" object mapping each recurring character name to ONE fixed, highly detailed visual description.

3. Character and Setting Continuity (MANDATORY ANCHOR-SHOT RULE):
   - Mark the first scene where each character or setting is established.
   - In that first scene, the character/setting is described in full detail.
   - In EVERY later videoPrompt for that character, reference it as matching the established look rather than re-describing it from scratch (e.g., "Subject: Kael (matching established look from Scene 1)").
   - Apply the same rule to recurring settings (e.g., "Lighting & Environment: The Clockwork Observatory (matching established setting from Scene 1)").

4. Mandatory 8-Part Master Scene "videoPrompt" Structure:
   For EACH scene, construct "videoPrompt" adhering strictly to these exact 8 components:
   - subject: (from characterSheet for recurring characters. First scene uses full visual description; subsequent scenes state "matching established look from Scene [X]").
   - action: described in temporal order across the shot.
   - camera: exactly ONE shot type plus exactly ONE movement, NEVER stacked movements (e.g., "Medium shot, slow forward push-in").
   - lighting and environment: atmospheric lighting and environment details from styleProfile.
   - style: styleProfile artStyle plus the lens/film-stock descriptor.
   - physics: concrete physical dynamics (e.g. "cloth trailing in wind", "embers drifting upward", "waves crashing against rocks").
   - audio: ALWAYS state "no dialogue, ambient sound only" or "silent".
   - duration: in seconds matching ${targetVideoDuration} seconds.

5. Start Frame Ingredients (Text to Image Prompt):
   For each scene, provide "startFramePrompt": a pristine text-to-image prompt to generate the initial reference keyframe image for image-to-video tools (Kling, Runway, Luma, Sora). Formatted as:
   [Shot framing] of [Subject with exact character details], [Initial frame pose] in [Setting], [Lighting & Color palette], ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}.

6. Smart Video Beats Array ("beats"):
   For each scene, provide an array of fine-grained video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
   Each beat MUST contain:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": the specific phrase/action segment from the narrator line (e.g. "Imagine an entire island")
   - "estimatedSeconds": estimated duration in seconds for this beat, distributed so the sum of all beats in the scene equals approximately ${targetVideoDuration} seconds.
   - "shotType": explicit cinematography shot framing (e.g., "Wide Aerial Establishing Shot", "Medium Tracking Shot", "Close-Up Facial Reaction", "Low-Angle Hero Shot")
   - "cameraMovement": cinematic camera motion cue (e.g., "Slow forward push-in", "Smooth lateral tracking", "Gentle crane tilt down")
   - "imagePrompt": A complete, standalone, production-ready TEXT TO VIDEO PROMPT formatted for AI video generators capturing this specific beat's action, shot framing, camera motion, physics, lighting, and audio: "no dialogue, ambient sound only". Aspect ratio: ${defaultAspectRatio}.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere (do not use "\\u2014", "\\u2013", or "--"). Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. You MUST respond with ONLY a valid JSON object matching this schema:
{
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
  "totalDurationSeconds": number,
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "videoPrompt": "Subject: ... Action: ... Camera: ... Lighting & Environment: ... Style: ... Physics: ... Audio: no dialogue, ambient sound only. Duration: ...",
      "startFramePrompt": "Text to image prompt for initial keyframe...",
      "establishedCharacters": ["Name"],
      "establishedSettings": ["Setting"],
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "estimatedSeconds": number,
          "shotType": string,
          "cameraMovement": string,
          "imagePrompt": string
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and a visual character sheet.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style adapting to the story's genre, tone, and character style input: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story (for example, muted earth tones, saturated neon, sepia chiaroscuro, or oceanic teals and golds)
   - "lighting": lighting style and atmospheric quality (for example, moody rim lighting, harsh equatorial sunlight, or soft lantern glow)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop of the story
   - "lensAndFilmStock": lens and film stock descriptor (e.g. "Shot on 35mm prime lens, fine film grain")

2. Character Sheet:
   Create a top-level "characterSheet" object mapping each recurring character name to ONE fixed, highly detailed visual description.
   Example: { "Kael": "A 32-year-old weathered scout with amber eyes, tied-back raven hair, wearing a patched olive-gray canvas cloak and worn leather gauntlets in a cinematic digital painting style." }
   CRITICAL CONTINUITY RULE: Whenever any character from the characterSheet appears in any beat's imagePrompt, you MUST reuse that exact visual description wording word-for-word in that imagePrompt to guarantee character consistency across every frame.

3. Nested Scenes and Beats:
   Break the story into a sequence of scenes.
   Each scene has:
   - "index": integer (1, 2, 3...)
   - "narratorLine": complete spoken narration line for this scene.
   - "estimatedSeconds": total estimated spoken seconds for this entire scene.
   - "beats": an array of fine-grained visual beats.

4. Granular Visual Beat Partitioning & HARD CEILING RULE:
   HARD CEILING: No beat may represent more than 2 seconds of estimated narration or 8 words, whichever is smaller.
   A sentence like "If you think volcanoes take thousands of years to grow," MUST be split into micro-beats:
   - "If you think" [~1.2s]
   - "volcanoes" [~1.0s]
   - "take thousands of years" [~1.8s]
   - "to grow," [~1.1s]
   Split each scene's narratorLine at EVERY natural phrase pause, comma, conjunction, preposition, and clause boundary.
   NEVER leave a whole sentence as one static beat. Expect 6 to 12 fine-grained micro-beats per scene.
   
   CRITICAL CINEMATIC SHOT VARIETY:
   Vary camera angles across sequential beats to ensure rhythmic dynamic pacing (e.g., alternate Establishing Wide Shots, Medium Shots, Intimate Close-Ups, Dynamic Over-The-Shoulder angles, and Low-Angle Hero shots). Do not use the same shot type twice in a row.

   Each beat must specify:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": the exact words from the scene's narratorLine that this visual beat covers (MAX 8 WORDS).
   - "shotType": explicit cinematography shot type (e.g., "Wide Establishing Shot", "Medium Shot", "Close-Up", "Extreme Close-Up", "Over-the-Shoulder (OTS)", "Low-Angle Shot", "High-Angle POV", "Dutch Angle")
   - "cameraMovement": cinematic motion cue (e.g., "Slow Push-In", "Static Frame", "Tracking Subject", "Smooth Pan", "Low Dolly Glide", "Aerial Drift")
   - "imagePrompt": a structured cinematic prompt formatted according to the formula:
     [Shot Type & Framing] of [Subject with exact character appearance details], [Key Action/Beat] in [Setting/Environment], [Lighting & Color Grade]. [Aspect ratio and style anchors: ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}].
   - "estimatedSeconds": estimated spoken narration duration in seconds (HARD CEILING: MAXIMUM 2.0 SECONDS, typically 1.0 to 1.8 seconds).

5. Duration and Pacing:
   ${durationInstruction}
   Total duration ("totalDurationSeconds") must reflect the combined estimated duration of all scenes.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere (do not use "\\u2014", "\\u2013", or "--"). Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "styleProfile": {
    "artStyle": "Specific art medium or style...",
    "colorPalette": "Specific palette...",
    "lighting": "Atmospheric lighting...",
    "eraAndSetting": "Era and setting..."
  },
  "characterSheet": {
    "CharacterName": "Fixed visual description..."
  },
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
          "shotType": "Wide Establishing Shot | Medium Shot | Close-Up | Over-the-Shoulder | Low-Angle Shot...",
          "cameraMovement": "Slow Push-In | Static Frame | Tracking...",
          "imagePrompt": string,
          "estimatedSeconds": number
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just the raw JSON object.`;

  const userPrompt = `Story Idea:
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

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const model = candidateModels[mIdx];
    let modelSuccess = false;

    // Up to 2 attempts per model with backoff on 503/429/transient errors
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          const status = response.status;
          const rawMsg = data?.error?.message || `Direct Gemini API call failed (${status})`;

          // Non-retryable client errors (invalid key, permission denied, bad request)
          if (status === 400 || status === 403) {
            throw new Error(sanitizeErrorMessage(rawMsg, apiKey));
          }

          // Transient server overload or rate limits: retry with backoff
          if (status === 503 || status === 429 || status >= 500) {
            if (attempt === 1) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              continue; // try attempt 2 for this model
            }
          }

          throw new Error(sanitizeErrorMessage(rawMsg, apiKey));
        }

        rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanedText = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        parsedData = JSON.parse(cleanedText);
        if (parsedData && Array.isArray(parsedData.scenes) && parsedData.scenes.length > 0) {
          modelSuccess = true;
          break;
        }
      } catch (err: any) {
        lastError = new Error(sanitizeErrorMessage(err.message || 'Direct generation failed.', apiKey));

        // If permission denied or invalid key, abort immediately - trying other models won't help
        const lowerMsg = (err.message || '').toLowerCase();
        if (lowerMsg.includes('permission') || lowerMsg.includes('api key not valid') || lowerMsg.includes('bad request')) {
          throw lastError;
        }

        // On attempt 1, sleep briefly before retry
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    if (modelSuccess && parsedData) {
      break;
    }
  }

  if (!parsedData || !Array.isArray(parsedData.scenes) || parsedData.scenes.length === 0) {
    throw lastError || new Error('Failed to parse structured scene JSON from Gemini API direct output.');
  }

  // Sanitize styleProfile
  const rawStyle = parsedData.styleProfile && typeof parsedData.styleProfile === 'object'
    ? parsedData.styleProfile
    : {};
  const sanitizedStyleProfile: StyleProfile = {
    artStyle: removeEmDashes(rawStyle.artStyle || characterStyle || 'Cinematic conceptual illustration'),
    colorPalette: removeEmDashes(rawStyle.colorPalette || 'Cohesive cinematic palette tailored to narrative mood'),
    lighting: removeEmDashes(rawStyle.lighting || 'Directional cinematic lighting with atmospheric depth'),
    eraAndSetting: removeEmDashes(rawStyle.eraAndSetting || 'Story specific era and environment'),
    lensAndFilmStock: removeEmDashes(rawStyle.lensAndFilmStock || 'Shot on 35mm anamorphic prime lens, subtle 35mm Kodak 5219 film grain, high dynamic range cinematic grade'),
  };

  const styleProfileWording = `Visual Style: ${sanitizedStyleProfile.artStyle}. Color Palette: ${sanitizedStyleProfile.colorPalette}. Lighting: ${sanitizedStyleProfile.lighting}. Era and Setting: ${sanitizedStyleProfile.eraAndSetting}.`;

  // Sanitize characterSheet
  const rawCharSheet = parsedData.characterSheet && typeof parsedData.characterSheet === 'object' && !Array.isArray(parsedData.characterSheet)
    ? parsedData.characterSheet
    : {};
  const sanitizedCharacterSheet: Record<string, string> = {};
  for (const [charName, desc] of Object.entries(rawCharSheet)) {
    if (typeof desc === 'string' && desc.trim()) {
      sanitizedCharacterSheet[removeEmDashes(charName.trim())] = removeEmDashes(desc.trim());
    }
  }

  function toRoman(num: number): string {
    const romanMap: [number, string][] = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let res = '';
    let n = num;
    for (const [val, sym] of romanMap) {
      while (n >= val) {
        res += sym;
        n -= val;
      }
    }
    return res || 'I';
  }

  // Continuity tracking for characters and settings in video mode
  const characterFirstScene = new Map<string, number>();
  const settingFirstScene = new Map<string, number>();

  // Sanitize scenes and beats
  const sanitizedScenes = parsedData.scenes.map((scene: any, sIdx: number) => {
    // Strictly enforce 1-based sequential scene numbering (Scene 1, Scene 2, Scene 3...)
    const sceneIndex = sIdx + 1;
    const narratorLine = removeEmDashes(scene.narratorLine || scene.narrator_line || '');

    let rawBeats = Array.isArray(scene.beats) ? scene.beats : [];
    if (rawBeats.length === 0) {
      const phrases = narratorLine.split(/(?<=[,;:.?!])\s+/).filter(Boolean);
      if (phrases.length >= 2) {
        rawBeats = phrases.map((span: string, bIdx: number) => ({
          beatIndex: bIdx + 1,
          textSpan: span.trim(),
          imagePrompt: scene.imagePrompt || `${span.trim()} (${characterStyle || 'consistent visual style'})`,
          estimatedSeconds: Math.max(1, Math.round(span.split(/\s+/).length * 0.4)),
        }));
      } else {
        const words = narratorLine.split(/\s+/).filter(Boolean);
        const chunks: string[] = [];
        for (let i = 0; i < words.length; i += 5) {
          chunks.push(words.slice(i, i + 5).join(' '));
        }
        rawBeats = chunks.map((chunk, bIdx) => ({
          beatIndex: bIdx + 1,
          textSpan: chunk,
          imagePrompt: scene.imagePrompt || `${chunk} (${characterStyle || 'consistent visual style'})`,
          estimatedSeconds: Math.max(1, Math.round(chunk.split(/\s+/).length * 0.4)),
        }));
      }
    }

    const sanitizedBeats = rawBeats.map((beat: any, bIdx: number) => {
      const beatIndex = typeof beat.beatIndex === 'number' ? beat.beatIndex : bIdx + 1;
      const textSpan = removeEmDashes(beat.textSpan || beat.text_span || '');
      let imagePrompt = removeEmDashes(beat.imagePrompt || beat.image_prompt || '');
      const shotType = removeEmDashes(beat.shotType || beat.shot_type || inferShotType(imagePrompt, beatIndex));
      const cameraMovement = removeEmDashes(beat.cameraMovement || beat.camera_movement || inferCameraMovement(imagePrompt, beatIndex));

      const matchedCharClauses: string[] = [];
      for (const [charName, visualDesc] of Object.entries(sanitizedCharacterSheet)) {
        const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        if (nameRegex.test(textSpan) || nameRegex.test(imagePrompt)) {
          if (!imagePrompt.includes(visualDesc)) {
            matchedCharClauses.push(`${charName} appearance: ${visualDesc}`);
          }
        }
      }

      let finalImagePrompt = imagePrompt.trim();
      if (finalImagePrompt && !/[.!?]$/.test(finalImagePrompt)) {
        finalImagePrompt += '.';
      }

      if (matchedCharClauses.length > 0) {
        finalImagePrompt += ` Character Continuity (${matchedCharClauses.join('. ')}).`;
      }

      if (!finalImagePrompt.includes(sanitizedStyleProfile.artStyle)) {
        finalImagePrompt += ` ${styleProfileWording}`;
      }

      return {
        beatIndex,
        textSpan,
        shotType,
        cameraMovement,
        imagePrompt: removeEmDashes(finalImagePrompt),
        estimatedSeconds: typeof beat.estimatedSeconds === 'number' && beat.estimatedSeconds > 0
          ? beat.estimatedSeconds
          : 2,
      };
    });

    // Enforce ceiling validation: in Image mode, max 2.0s / 8 words; in Video mode, smart duration calibration spanning targetVideoDuration
    const ceilingEnforcedBeats = enforceBeatCeilings(sanitizedBeats, sceneIndex, {
      isVideoMode,
      targetVideoDuration,
    });

    const calculatedSceneSeconds = Math.round(
      ceilingEnforcedBeats.reduce((sum: number, b: any) => sum + (b.estimatedSeconds || 1.5), 0)
    );
    const sceneSeconds = Math.max(
      calculatedSceneSeconds,
      typeof scene.estimatedSeconds === 'number' && scene.estimatedSeconds > 0
        ? scene.estimatedSeconds
        : calculatedSceneSeconds
    );

    // Track characters established in this scene
    const establishedCharacters: string[] = [];
    const charactersInScene: string[] = [];
    for (const charName of Object.keys(sanitizedCharacterSheet)) {
      const escaped = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'i');
      if (
        reg.test(narratorLine) ||
        reg.test(scene.videoPrompt || '') ||
        reg.test(scene.startFramePrompt || '') ||
        (Array.isArray(scene.establishedCharacters) && scene.establishedCharacters.includes(charName))
      ) {
        charactersInScene.push(charName);
        if (!characterFirstScene.has(charName)) {
          characterFirstScene.set(charName, sceneIndex);
          establishedCharacters.push(charName);
        }
      }
    }

    // Track settings established in this scene
    const establishedSettings: string[] = [];
    if (sceneIndex === 1 && sanitizedStyleProfile.eraAndSetting) {
      establishedSettings.push(sanitizedStyleProfile.eraAndSetting);
      settingFirstScene.set(sanitizedStyleProfile.eraAndSetting, 1);
    }
    if (Array.isArray(scene.establishedSettings)) {
      scene.establishedSettings.forEach((setting: string) => {
        const cleanSetting = removeEmDashes(String(setting).trim());
        if (cleanSetting && !settingFirstScene.has(cleanSetting)) {
          settingFirstScene.set(cleanSetting, sceneIndex);
          if (!establishedSettings.includes(cleanSetting)) {
            establishedSettings.push(cleanSetting);
          }
        }
      });
    }

    // Video Mode: construct or sanitize 8-part videoPrompt and startFramePrompt
    let videoPrompt: string | undefined = undefined;
    let startFramePrompt: string | undefined = undefined;

    if (isVideoMode) {
      const primaryBeat = ceilingEnforcedBeats[0] || sanitizedBeats[0] || {
        shotType: 'Medium Shot',
        cameraMovement: 'Slow Push-In',
        textSpan: narratorLine,
        imagePrompt: narratorLine,
      };

      // 1. Subject description with anchor continuity
      let subjectDesc = '';
      if (charactersInScene.length > 0) {
        subjectDesc = charactersInScene.map(cName => {
          const firstSeen = characterFirstScene.get(cName);
          if (firstSeen === sceneIndex) {
            return `${cName}, ${sanitizedCharacterSheet[cName] || 'cinematic protagonist'} [Established Look]`;
          } else {
            return `${cName} (matching established look from Scene ${toRoman(firstSeen || 1)})`;
          }
        }).join(' and ');
      } else {
        subjectDesc = `Cinematic subject reflecting "${narratorLine.substring(0, 50)}"`;
      }

      // 2. Action in temporal order
      let actionDesc = '';
      if (ceilingEnforcedBeats.length >= 3) {
        const firstBeat = ceilingEnforcedBeats[0].textSpan;
        const midBeat = ceilingEnforcedBeats[Math.floor(ceilingEnforcedBeats.length / 2)].textSpan;
        const lastBeat = ceilingEnforcedBeats[ceilingEnforcedBeats.length - 1].textSpan;
        actionDesc = `Initially begins as "${firstBeat}", dynamically progresses through "${midBeat}", and settles as "${lastBeat}".`;
      } else if (ceilingEnforcedBeats.length === 2) {
        actionDesc = `Initially starts with "${ceilingEnforcedBeats[0].textSpan}", then naturally transitions into "${ceilingEnforcedBeats[1].textSpan}".`;
      } else {
        actionDesc = `Unfolds continuously across the shot portraying "${narratorLine}".`;
      }

      // 3. Camera: exactly one shot type plus one movement (never stacked)
      const shotType = primaryBeat.shotType || 'Medium Shot';
      const rawMove = primaryBeat.cameraMovement || 'Slow push-in';
      const singleCameraMove = rawMove.replace(/\b(and|then|with)\b/gi, ',').split(/[,;]/)[0].trim() || 'Slow push-in';
      const cameraDesc = `${shotType}, ${singleCameraMove}`;

      // 4. Lighting & Environment from styleProfile
      let envDesc = sanitizedStyleProfile.eraAndSetting;
      if (sceneIndex > 1 && settingFirstScene.has(sanitizedStyleProfile.eraAndSetting)) {
        const sFirst = settingFirstScene.get(sanitizedStyleProfile.eraAndSetting);
        if (sFirst && sFirst < sceneIndex) {
          envDesc += ` (matching established setting from Scene ${toRoman(sFirst)})`;
        }
      }
      const lightingDesc = `${sanitizedStyleProfile.lighting} in ${envDesc}, palette: ${sanitizedStyleProfile.colorPalette}`;

      // 5. Style + lens/film-stock descriptor
      const styleDesc = `${sanitizedStyleProfile.artStyle}, ${sanitizedStyleProfile.lensAndFilmStock || 'shot on 35mm anamorphic lens, fine 35mm film grain'}`;

      // 6. Physics (only when it matters, concrete dynamics)
      const physicsDesc = 'Natural atmospheric dynamics, subtle cloth movement and airborne particles drifting in light';

      // 7. Audio (always no dialogue / ambient sound only)
      const audioDesc = 'no dialogue, ambient sound only';

      // 8. Duration capped to targetVideoDuration with note if narration runs longer
      let durationDesc = `${targetVideoDuration} seconds`;
      if (sceneSeconds > targetVideoDuration + 1) {
        durationDesc += ` (Note: Scene spoken narration runs ~${sceneSeconds}s; consider splitting across multiple shots or trimming narration for single-generation video models)`;
      } else {
        durationDesc += `.`;
      }

      // If Gemini returned a structured videoPrompt, sanitize and align it
      const rawVP = scene.videoPrompt || scene.video_prompt;
      if (typeof rawVP === 'string' && rawVP.trim().length > 30) {
        let cleanedVP = removeEmDashes(rawVP.trim());
        // Ensure Audio is explicit
        if (!cleanedVP.toLowerCase().includes('audio:')) {
          cleanedVP += `\nAudio: ${audioDesc}.`;
        } else {
          cleanedVP = cleanedVP.replace(/Audio:[^\n.]*/i, `Audio: ${audioDesc}`);
        }
        // Ensure Duration is aligned to target
        if (!cleanedVP.toLowerCase().includes('duration:')) {
          cleanedVP += `\nDuration: ${durationDesc}`;
        } else {
          cleanedVP = cleanedVP.replace(/Duration:[^\n.]*(?:\.|$)/i, `Duration: ${durationDesc}`);
        }
        videoPrompt = cleanedVP;
      } else {
        videoPrompt = [
          `Subject: ${subjectDesc}.`,
          `Action: ${actionDesc}`,
          `Camera: ${cameraDesc}.`,
          `Lighting & Environment: ${lightingDesc}.`,
          `Style: ${styleDesc}.`,
          `Physics: ${physicsDesc}.`,
          `Audio: ${audioDesc}.`,
          `Duration: ${durationDesc}`
        ].join('\n');
      }

      // Generate startFramePrompt (Text to Image Prompt for start frame ingredient)
      const rawStartFrame = scene.startFramePrompt || scene.start_frame_prompt || scene.start_frame_image_prompt;
      if (typeof rawStartFrame === 'string' && rawStartFrame.trim().length > 20) {
        startFramePrompt = removeEmDashes(rawStartFrame.trim());
      } else {
        startFramePrompt = removeEmDashes(
          `[${shotType}] of ${subjectDesc}, opening start frame pose in ${sanitizedStyleProfile.eraAndSetting}, ${sanitizedStyleProfile.lighting}, ${sanitizedStyleProfile.colorPalette}. ${sanitizedStyleProfile.lensAndFilmStock}. ${defaultAspectRatio}, ${characterStyle || 'cinematic production rendering'}.`
        );
      }
    }

    return {
      index: sceneIndex,
      narratorLine,
      estimatedSeconds: sceneSeconds,
      beats: ceilingEnforcedBeats,
      videoPrompt,
      startFramePrompt,
      establishedCharacters,
      establishedSettings,
      isAnchorScene: establishedCharacters.length > 0 || establishedSettings.length > 0,
    };
  });

  const calculatedTotalSeconds = sanitizedScenes.reduce((sum: number, s: any) => sum + s.estimatedSeconds, 0);
  const totalSeconds = typeof parsedData.totalDurationSeconds === 'number' && parsedData.totalDurationSeconds > 0
    ? parsedData.totalDurationSeconds
    : calculatedTotalSeconds;

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: sanitizedCharacterSheet,
    totalDurationSeconds: totalSeconds,
    scenes: sanitizedScenes,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
  };
}
