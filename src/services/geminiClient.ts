// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import { GenerateStoryRequest, StoryGenerationResult } from '../types';

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
  } = req;

  const isLongForm = format === 'long';
  const defaultAspectRatio = isLongForm ? '16:9 widescreen' : '9:16 vertical';

  let durationInstruction = '';
  if (durationMode === 'automatic') {
    durationInstruction = `Duration mode is Automatic. Break the story into however many scenes it naturally requires. Estimate realistic narration pacing with a floor of 3 to 6 seconds of spoken narration per scene. Calculate and return totalDurationSeconds accurately based on the scene pacing.`;
  } else if (durationSeconds && durationSeconds > 0) {
    durationInstruction = `Target total duration is exactly ${durationSeconds} seconds (${isLongForm ? Math.round(durationSeconds / 60) + ' minutes' : durationSeconds + ' seconds'}). Carefully pace the number of scenes and the length of each scene's spoken narrator line so their combined spoken narration matches this target duration closely.`;
  } else {
    durationInstruction = `Provide a well-paced scene sequence with 3 to 6 seconds per scene floor.`;
  }

  const systemPrompt = `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and a visual character sheet.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style adapting to the story's genre, tone, and character style input: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story (for example, muted earth tones, saturated neon, sepia chiaroscuro, or oceanic teals and golds)
   - "lighting": lighting style and atmospheric quality (for example, moody rim lighting, harsh equatorial sunlight, or soft lantern glow)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop of the story

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

4. Granular Visual Beat Partitioning & Cinematic Taxonomy:
   Split each scene's narratorLine at EVERY natural phrase pause (a comma, a clause shift, a change in subject, action, object, or location), NOT into a fixed 2 to 5 chunks.
   Most beats should run 2 to 8 words.
   
   CRITICAL CINEMATIC SHOT VARIETY:
   Vary camera angles across sequential beats to ensure rhythmic dynamic pacing (e.g., alternate Establishing Wide Shots, Medium Shots, Intimate Close-Ups, Dynamic Over-The-Shoulder angles, and Low-Angle Hero shots). Do not use the same shot type twice in a row.

   Each beat must specify:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": the exact words from the scene's narratorLine that this visual beat covers.
   - "shotType": explicit cinematography shot type (e.g., "Wide Establishing Shot", "Medium Shot", "Close-Up", "Extreme Close-Up", "Over-the-Shoulder (OTS)", "Low-Angle Shot", "High-Angle POV", "Dutch Angle")
   - "cameraMovement": cinematic motion cue (e.g., "Slow Push-In", "Static Frame", "Tracking Subject", "Smooth Pan", "Low Dolly Glide", "Aerial Drift")
   - "imagePrompt": a structured cinematic prompt formatted according to the formula:
     [Shot Type & Framing] of [Subject with exact character appearance details], [Key Action/Beat] in [Setting/Environment], [Lighting & Color Grade]. [Aspect ratio and style anchors: ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}].
   - "estimatedSeconds": estimated spoken narration duration for this phrase in seconds (typically 1 to 3 seconds).

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
  const sanitizedStyleProfile = {
    artStyle: removeEmDashes(rawStyle.artStyle || characterStyle || 'Cinematic conceptual illustration'),
    colorPalette: removeEmDashes(rawStyle.colorPalette || 'Cohesive cinematic palette tailored to narrative mood'),
    lighting: removeEmDashes(rawStyle.lighting || 'Directional cinematic lighting with atmospheric depth'),
    eraAndSetting: removeEmDashes(rawStyle.eraAndSetting || 'Story specific era and environment'),
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

    const calculatedSceneSeconds = sanitizedBeats.reduce((sum: number, b: any) => sum + b.estimatedSeconds, 0);
    const sceneSeconds = typeof scene.estimatedSeconds === 'number' && scene.estimatedSeconds > 0
      ? scene.estimatedSeconds
      : calculatedSceneSeconds;

    return {
      index: sceneIndex,
      narratorLine,
      estimatedSeconds: sceneSeconds,
      beats: sanitizedBeats,
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
  };
}
