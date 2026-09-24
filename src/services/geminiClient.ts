// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import { GenerateStoryRequest, StoryGenerationResult, StyleProfile, Beat } from '../types';
import {
  extractTemporalAnchor,
  cleanRedundantOnScreenText,
  sanitizeImagePromptShotFraming,
  populateSceneTransitionHints,
} from './beatSplitting';
import { generateEnhancedStory } from './enhanceStoryArchitect';
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

export { extractTemporalAnchor, cleanRedundantOnScreenText };

// ============================================================================
// ORIGINAL STORY GENERATOR (Toggle OFF)
// 100% pure original workflow: natural beat pacing, unforced narrative rhythm,
// intact prompt details, and zero viral-hook or beat-subdivision interference.
// ============================================================================
export async function generateOriginalStory(
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

  const systemPrompt = isVideoMode
    ? `You are an expert film director, cinematographer, and AI video prompt engineer.
Your task is to take a story and generate a production-ready, scene-by-scene video generation breakdown with cinematic video prompts, smart video shot beats, narrator lines, a style profile, and visual continuity sheets.

CLAUSE & MICRO-ACTION BEAT SEGMENTATION RULES (CRITICAL):
1. Grammar is NOT equal to Scene: Never force an entire long sentence with multiple actions into a single 4-second clip.
2. Commas, Clauses & Item Lists MUST Form Distinct Beats:
   - When a sentence contains commas separating distinct actions, items, transactions, or emotional pivots (e.g. "spending ₱150 on lunch, ₱100 on coffee, ₱80 on transportation, and a few other small purchases"), EACH distinct item or clause MUST be its own distinct visual beat!
   - Contrasting conjunctions and pivots ("when you first receive it", "but somehow disappears", "thinking you can buy food", "save some", "and maybe even treat yourself", "your money suddenly starts looking dangerously low", "The strange part is", "none of those expenses felt expensive", "when you paid for them", "That's because your brain notices", "big purchases more easily than small ones", "even though several small purchases", "can quietly drain your wallet", "So next time you have ₱1,000", "don't just ask what you can buy with it", "ask what you want that ₱1,000 to become") MUST trigger separate visual beats!
3. Dynamic Scene Grouping for ${targetVideoDuration}-Second Clips:
   - Each Scene represents ONE video clip of approximately ${targetVideoDuration} seconds.
   - Each Scene contains 1 to 3 micro-beats (e.g. 2 beats of ~2.0s each, or 3 beats of ~1.3s each) totaling ${targetVideoDuration} seconds.
   - If a sentence has 6 or 8 distinct action beats, DO NOT squeeze them all into one scene! Splay them across multiple successive 4-second scenes (e.g. Scene A handles the first 2-3 beats, Scene B handles the next 2-3 beats, Scene C handles the resolution).
4. No Empty Text Spans:
   - Every single beat's "textSpan" MUST contain the exact spoken phrase/words from that moment in the story. Empty strings ("") or phantom beats are strictly forbidden.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium or cinematic style adapting to: "${characterStyle || 'cinematic hyperrealism'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality (e.g., golden hour rim light, misty neon glow, or soft lantern ambience)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor (e.g., "Shot on 35mm anamorphic prime lens, subtle 35mm Kodak 5219 film grain, high dynamic range")

2. Continuity Sheets (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping each recurring character name to ONE fixed, highly detailed visual description. You MUST resolve any unstated attributes (gender, age, build, hair) into concrete, locked choices. Ambiguity is forbidden. Side characters appearing more than once must be included, keyed by role (e.g., "the jockey") if unnamed.
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once (a particular room, a specific ridge) to ONE fixed, highly detailed visual description.

3. Character and Setting Continuity (MANDATORY ANCHOR-SHOT RULE):
   - Mark the first scene where each character or setting is established.
   - In that first scene, the character/setting is described in full detail.
   - In EVERY later videoPrompt for that character/location, reference it as matching the established look rather than re-describing it from scratch (e.g., "Subject: Kael (matching established look from Scene 1)").

4. Mandatory 8-Part Master Scene "videoPrompt" Structure:
   For EACH scene, construct "videoPrompt" adhering strictly to these exact 8 components:
   - subject: (from characterSheet for recurring characters. First scene uses full visual description; subsequent scenes state "matching established look from Scene [X]").
   - action: described in temporal order across the shot with FULL ANATOMICAL & KINEMATIC SPECIFICITY:
     * BODY ANGLE & ORIENTATION: Exact torso and hip angle relative to the lens (e.g. "torso angled three-quarters profile to screen-left", "full frontal square stance facing camera", "turned away in sharp dorsal three-quarter view").
     * GAZE & FACING DIRECTION: Precise head turn and eye gaze vector (e.g. "head tilted 15 degrees downward with gaze fixed sharply on the object on the desk", "eyes darting toward off-screen right").
     * HAND & ARM GESTURES: Specific finger, hand, and arm posture (e.g. "trembling right fingers clutching a frayed parchment while left arm hangs rigidly at hip level", "both palms pressed flat against the glass surface, fingers splayed").
     * MAIN VS. SIDE CHARACTER POSITIONING & COMPOSITION: When multiple characters appear in the frame:
       - MAIN CHARACTER: Centered or commanding the golden-ratio third of the frame, foreground or midground priority, dominant lighting and eye-lead.
       - SIDE CHARACTER: Placed in the secondary plane (flanking screen-right/left, over-the-shoulder foreground anchor, or subordinate background depth), oriented facing or reacting toward the main character to guide viewer eye-path.
     * PACING & MOTION VELOCITY: Explicit velocity and progression tempo (e.g. "measured, slow-burn deliberate motion transitioning over 3 seconds into a sudden burst of frantic stumbling", "frenetic high-cadence sprint", "slow breathing chest rise and fall at restful pace").
   - camera: exactly ONE shot type, exactly ONE camera angle, and exactly ONE movement, NEVER stacked movements (e.g., "Medium shot, low-angle, slow forward push-in").
   - lighting and environment: atmospheric lighting and environment details from styleProfile and locationSheet.
   - style: styleProfile artStyle plus the lens/film-stock descriptor.
   - physics: concrete physical dynamics (e.g. "cloth trailing in wind", "embers drifting upward", "waves crashing against rocks").
   - audio: ALWAYS state "no dialogue, ambient sound only" or "silent".
   - duration: in seconds matching ${targetVideoDuration} seconds.

5. Single Visual Focus & Distinct Beat Progression (NO CONFUSED HYBRID OR REDUNDANT BEATS):
   Every beat MUST focus on exactly ONE clear visual subject or action, and EVERY beat MUST present a distinct visual progression that its neighbor does NOT.
   - NO CONFUSED HYBRIDS: NEVER combine two competing framing requests into a single beat (e.g. DO NOT write one prompt trying to frame a close-up on an object AND a character's reaction in the same image). Split into Beat A (close-up on object) and Beat B (character reaction).
   - EVERY BEAT MUST BE VISUALLY DISTINCT: Each beat must show something its neighbor does not (a different focal detail, framing distance, moment in the action, or emotional shift in pose/expression).
   - STRICT SHOT TYPE & PROSE ALIGNMENT (TIGHT SHOTS): When a beat's shotType is close-up, macro, extreme-close-up, or detail shot, its prompt prose MUST actually describe that tight framing and specific focal detail, NOT the same full-body or wide environmental description used in a wider beat nearby. The camera framing tag and the prompt prose MUST strictly match.

6. Strict Narrative Faithfulness (NO UNSTATED FACTUAL INVENTIONS):
   Do NOT invent fictitious specific story facts, character names, senders, or plot details that are NOT present in the narration or already locked in characterSheet/locationSheet.

7. Unified Stylistic Register (CONSISTENT ART MEDIUM VOCABULARY):
   When a specific art style or medium is requested:
   You MUST apply that art style's specific descriptive vocabulary consistently across ALL parts of the prompt, including characterSheet, locationSheet, subject descriptions, lighting, textures, and backgrounds.

8. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS:
   NEVER use a real, identifiable person's actual proper name in visual prompts.

9. OPENING BEAT VISUAL HOOK RULE (SCENE 1, BEAT 1):
   Scene 1 Beat 1 MUST show something concrete and visually arresting: the main character, a striking action already in motion, or the single most compelling visual element.

10. TEMPORAL ANCHOR & ON-SCREEN DATE/YEAR DISPLAY RULE (SINGLE BEAT ONLY):
    If the narrator line or beat phrase mentions a date, year, or elapsed duration, populate "temporalAnchor" on that single beat ONLY.

11. Start Frame Ingredients (Text to Image Prompt):
    For each scene, provide "startFramePrompt": a pristine text-to-image prompt to generate the initial reference keyframe image formatted as:
    [Shot framing and angle] of [Subject with exact character details], [Initial frame pose] in [Setting/Location Details], [Lighting & Color palette], ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}.

12. Smart Video Beats Array ("beats"):
    For each scene, provide an array of video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
    Each beat MUST contain:
    - "beatIndex": integer (1, 2, 3...)
    - "textSpan": specific phrase or spoken clause from the narrator line. Every beat MUST correspond to actual spoken words from the narrator line. NO EMPTY STRINGS ("").
    - "estimatedSeconds": estimated duration in seconds for this beat, distributed so the sum of all beats in the scene equals approximately ${targetVideoDuration} seconds (e.g. 2.0s and 2.0s, or 1.5s and 2.5s).
    - "shotType": explicit cinematography shot size or transition shot
    - "cameraAngle": explicit camera angle
    - "cameraMovement": cinematic camera motion cue
    - "temporalAnchor": optional string for explicit year, date, or elapsed duration
    - "transitionHint": optional string describing a shared visual anchor (populated ONLY on last beat of scene or first beat of next scene)
    - "imagePrompt": complete, standalone text to video prompt capturing this specific beat's action.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS.
4. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "styleProfile": {
    "artStyle": "...",
    "colorPalette": "...",
    "lighting": "...",
    "eraAndSetting": "...",
    "lensAndFilmStock": "Shot on 35mm anamorphic lens, fine film grain..."
  },
  "characterSheet": {
    "CharacterName": "Detailed visual description with all physical attributes resolved..."
  },
  "locationSheet": {
    "LocationName": "Detailed visual description of the specific recurring location..."
  },
  "totalDurationSeconds": number,
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "videoPrompt": "Subject: ... Action: ... Camera: [Shot Type], [Camera Angle], [Camera Movement]. Lighting & Environment: ... Style: ... Physics: ... Audio: no dialogue, ambient sound only. Duration: ...",
      "startFramePrompt": "Text to image prompt for initial keyframe...",
      "establishedCharacters": ["Name"],
      "establishedSettings": ["Setting"],
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "estimatedSeconds": number,
          "shotType": "extreme-wide | wide | medium | close-up | extreme-close-up | whip-pan",
          "cameraAngle": "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow forward push-in | Static Frame | Tracking Subject | Smooth Pan | Whip-Pan",
          "temporalAnchor": "string (optional: e.g. 1945, December 24, 1971, for 29 years)",
          "transitionHint": "string (optional: populated ONLY on last beat of scene or first beat of next scene for editing cuts/dissolves)",
          "imagePrompt": string
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and visual continuity sheets.

CLAUSE & MICRO-ACTION BEAT SEGMENTATION RULES (CRITICAL):
1. Do NOT make a boring 1-sentence = 1-image breakdown! A long sentence with multiple items, actions, or psychological turns MUST be broken into granular, rhythmic visual beats.
2. Commas, Clauses & Item Lists MUST Form Distinct Beats:
   - When a sentence lists distinct items, transactions, or actions (e.g. "after spending ₱150 on lunch, ₱100 on coffee, ₱80 on transportation, and a few other small purchases"), EACH distinct item or action clause MUST be its own distinct visual beat!
   - Contrasting conjunctions and pivots ("when you first receive it", "but somehow disappears", "thinking you can buy food", "save some", "and maybe even treat yourself", "your money suddenly starts looking dangerously low", "The strange part is", "none of those expenses felt expensive", "when you paid for them", "That's because your brain notices", "big purchases more easily than small ones", "even though several small purchases", "can quietly drain your wallet", "So next time you have ₱1,000", "don't just ask what you can buy with it", "ask what you want that ₱1,000 to become") MUST trigger separate visual beats!
3. Pacing and Variety:
   - Break scenes so each scene has 2 to 4 distinct, engaging visual beats with varied shot types (e.g. alternating between Wide Establishing, Medium Action, Macro Detail, and Over-the-Shoulder).
   - If a sentence is long, divide it into multiple coherent scenes or multiple detailed beats so the viewer is never staring at the same visual idea for more than 2-3 seconds.
4. No Empty Text Spans:
   - Every single beat's "textSpan" MUST contain the exact spoken phrase/words from that moment in the story. Never output empty strings ("").

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style adapting to the story's genre, tone, and character style input: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop of the story
   - "lensAndFilmStock": lens and film stock descriptor (e.g. "Shot on 35mm prime lens, fine film grain")

2. Continuity Sheets (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping each recurring character name to ONE fixed, highly detailed visual description.
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once to ONE fixed, highly detailed visual description.
   CRITICAL CONTINUITY RULE: Whenever any character or location from these sheets appears in any beat's imagePrompt, you MUST reuse that exact visual description wording word-for-word in that imagePrompt to guarantee consistency across every frame.

3. Nested Scenes and Beats:
   Break the story into a sequence of scenes with rich, dynamic visual beats.
   Each scene has index, narratorLine, estimatedSeconds, and beats array.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS.
4. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "styleProfile": {
    "artStyle": "Specific art medium or style...",
    "colorPalette": "Specific palette...",
    "lighting": "Atmospheric lighting...",
    "eraAndSetting": "Era and setting..."
  },
  "characterSheet": {
    "CharacterName": "Fixed visual description with all physical attributes resolved..."
  },
  "locationSheet": {
    "LocationName": "Fixed visual description of the specific recurring location..."
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
          "shotType": "extreme-wide | wide | medium | close-up | extreme-close-up | whip-pan",
          "cameraAngle": "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow Push-In | Static Frame | Tracking Subject | Smooth Pan | Whip-Pan",
          "temporalAnchor": "string (optional: e.g. 1945, for 29 years)",
          "transitionHint": "string (optional: populated ONLY on last beat of scene or first beat of next scene for editing cuts/dissolves)",
          "imagePrompt": string,
          "estimatedSeconds": number
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just the raw JSON object.`;

  let customBeatsPrompt = '';
  if (isCustomBeats && customScenes) {
    customBeatsPrompt = `\n\nCRITICAL USER-SPECIFIED SCENE AND BEAT SEGMENTATION:
The user has explicitly segmented the story into exact scenes and custom visual beats. You MUST follow this exact scene breakdown and phrase assignment. For each beat, follow the user's specific visual guidance and shot suggestions:
${customScenes.map((cs, sIdx) => `Scene ${sIdx + 1} narration: "${cs.narratorLine}"
Beats:
${cs.beats.map((b, bIdx) => `  - Beat ${bIdx + 1} phrase: "${b.textSpan}"${b.userGuidance ? ` | Director's Visual Note: "${b.userGuidance}"` : ''}${b.shotType ? ` | Preferred Shot: "${b.shotType}"` : ''}${b.transitionHint ? ` | Editing Transition Note: "${b.transitionHint}"` : ''}`).join('\n')}`).join('\n\n')}`;
  }

  const userPrompt = `Story Idea / Concept Premise:
${story}

Character Style Instruction:
${characterStyle || 'Consistent style specified by scene context.'}

Format: ${isLongForm ? 'Long form (16:9)' : 'Short form (9:16)'}
Platform: ${platform}
${durationInstruction}${customBeatsPrompt}`;

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
    throw new Error(sanitizeErrorMessage(lastError?.message || 'Failed to generate story breakdown.', apiKey));
  }

  // Sanitize styleProfile
  const rawStyleProfile = parsedData.styleProfile || {};
  const sanitizedStyleProfile: StyleProfile = {
    artStyle: removeEmDashes(rawStyleProfile.artStyle || characterStyle || 'Cinematic Rendering'),
    colorPalette: removeEmDashes(rawStyleProfile.colorPalette || 'Harmonious color grading matching narrative tone'),
    lighting: removeEmDashes(rawStyleProfile.lighting || 'Cinematic three-point lighting with soft rim fill'),
    eraAndSetting: removeEmDashes(rawStyleProfile.eraAndSetting || 'Contemporary atmospheric setting'),
    lensAndFilmStock: removeEmDashes(rawStyleProfile.lensAndFilmStock || 'Shot on 35mm prime lens, fine film grain'),
  };

  const styleProfileWording = `Visual Style: ${sanitizedStyleProfile.artStyle}. Palette: ${sanitizedStyleProfile.colorPalette}. Lighting: ${sanitizedStyleProfile.lighting}. Setting: ${sanitizedStyleProfile.eraAndSetting}.`;

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
  const settingFirstScene = new Map<string, number>();

  const sanitizedScenes = rawScenes.map((scene: any, sIdx: number) => {
    const sceneIndex = typeof scene.index === 'number' ? scene.index : sIdx + 1;
    const narratorLine = removeEmDashes(scene.narratorLine || '');

    const rawBeats = (Array.isArray(scene.beats) ? scene.beats : [])
      .filter((beat: any) => {
        const span = typeof beat.textSpan === 'string' ? beat.textSpan.trim() : '';
        const prompt = typeof beat.imagePrompt === 'string' ? beat.imagePrompt.trim() : '';
        return span.length > 0 || prompt.length > 0;
      });

    // If all beats were filtered out, create at least one valid beat from the narratorLine
    if (rawBeats.length === 0 && narratorLine.trim().length > 0) {
      rawBeats.push({
        beatIndex: 1,
        textSpan: narratorLine.trim(),
        imagePrompt: scene.videoPrompt || scene.startFramePrompt || narratorLine.trim(),
        shotType: 'Medium Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Slow forward push-in',
        estimatedSeconds: isVideoMode ? targetVideoDuration : 3,
      });
    }

    // Pre-pass: map temporal anchors directly to beats that speak them
    const assignedBeatAnchorMap = new Map<number, string>();
    let assignedSceneAnchor: string | null = null;

    rawBeats.forEach((beat: any, bIdx: number) => {
      const span = beat.textSpan || '';
      const directAnchor = extractTemporalAnchor(span);
      if (directAnchor && !assignedSceneAnchor) {
        assignedBeatAnchorMap.set(bIdx, directAnchor);
        assignedSceneAnchor = directAnchor;
      }
    });

    if (!assignedSceneAnchor) {
      const sceneDirectAnchor = extractTemporalAnchor(narratorLine);
      if (sceneDirectAnchor) {
        let matchedIdx = -1;
        for (let i = 0; i < rawBeats.length; i++) {
          const span = rawBeats[i].textSpan || '';
          if (span.toLowerCase().includes(sceneDirectAnchor.toLowerCase())) {
            matchedIdx = i;
            break;
          }
        }
        if (matchedIdx !== -1) {
          assignedBeatAnchorMap.set(matchedIdx, sceneDirectAnchor);
        } else if (rawBeats.length > 0) {
          assignedBeatAnchorMap.set(0, sceneDirectAnchor);
        }
      }
    }

    const sanitizedBeats: Beat[] = rawBeats.map((beat: any, bIdx: number) => {
      const beatIndex = typeof beat.beatIndex === 'number' ? beat.beatIndex : bIdx + 1;
      const textSpan = removeEmDashes(beat.textSpan || '');
      const imagePrompt = removeEmDashes(beat.imagePrompt || '');

      const shotType = removeEmDashes(beat.shotType || beat.shot_type || inferShotType(imagePrompt, beatIndex));
      const cameraAngle = removeEmDashes(beat.cameraAngle || beat.camera_angle || inferCameraAngle(imagePrompt, beatIndex));
      const cameraMovement = removeEmDashes(beat.cameraMovement || beat.camera_movement || inferCameraMovement(imagePrompt, beatIndex));

      const matchedCharClauses: string[] = [];
      for (const [charName, visualDesc] of Object.entries(sanitizedCharacterSheet)) {
        const regex = new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textSpan) || regex.test(imagePrompt)) {
          if (!imagePrompt.includes(visualDesc)) {
            matchedCharClauses.push(`${charName}: ${visualDesc}`);
          }
        }
      }

      const matchedLocClauses: string[] = [];
      for (const [locName, visualDesc] of Object.entries(sanitizedLocationSheet)) {
        const regex = new RegExp(`\\b${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textSpan) || regex.test(imagePrompt)) {
          if (!imagePrompt.includes(visualDesc)) {
            matchedLocClauses.push(`${locName} environment: ${visualDesc}`);
          }
        }
      }

      let finalImagePrompt = imagePrompt.trim();
      if (finalImagePrompt && !/[.!?]$/.test(finalImagePrompt)) {
        finalImagePrompt += '.';
      }

      // Exact original continuity behavior
      if (matchedCharClauses.length > 0) {
        finalImagePrompt += ` Character Continuity (${matchedCharClauses.join('. ')}).`;
      }

      if (matchedLocClauses.length > 0) {
        finalImagePrompt += ` Location Continuity (${matchedLocClauses.join('. ')}).`;
      }

      if (!finalImagePrompt.includes(sanitizedStyleProfile.artStyle)) {
        finalImagePrompt += ` ${styleProfileWording}`;
      }

      // Sanitize visualSoundEffect (Image mode only; illustrated / comic styles only)
      let visualSoundEffect: string | undefined = undefined;
      const lowerArtStyle = (sanitizedStyleProfile.artStyle + ' ' + (characterStyle || '')).toLowerCase();
      const isIllustratedStyle = /(comic|cartoon|anime|manga|illustrated|illustration|stickman|pop-art|sketch|graphic novel|drawing|cel-animation|risograph|chibi|doodle|toon)/.test(lowerArtStyle);

      const rawSFX = removeEmDashes(beat.visualSoundEffect || beat.visual_sound_effect || '');
      if (isIllustratedStyle && !isVideoMode && rawSFX && rawSFX.trim().length > 0) {
        const cleanSFX = rawSFX.trim().toUpperCase().replace(/[^A-Z0-9!?-]/g, '');
        if (cleanSFX.length > 0) {
          visualSoundEffect = cleanSFX.endsWith('!') ? cleanSFX : `${cleanSFX}!`;
          if (!finalImagePrompt.toUpperCase().includes(visualSoundEffect)) {
            finalImagePrompt += ` Integrated bold stylized comic lettering reading "${visualSoundEffect}" in the artwork background with dynamic action lines.`;
          }
        }
      }

      const temporalAnchor = assignedBeatAnchorMap.get(bIdx);
      if (temporalAnchor) {
        const anchorUpper = temporalAnchor.toUpperCase();
        const hasOnScreenText = /text|title|typography|lettering/i.test(finalImagePrompt) && finalImagePrompt.toUpperCase().includes(anchorUpper);
        if (!hasOnScreenText) {
          const styleRef = sanitizedStyleProfile.artStyle || characterStyle || 'the visual aesthetic';
          finalImagePrompt += ` Featuring large clear legible on-screen text reading "${anchorUpper}" displayed above at the upper portion of the frame in a bold typography stylized to match ${styleRef}, clearly visible to the naked eye.`;
        }
      } else {
        finalImagePrompt = cleanRedundantOnScreenText(finalImagePrompt);
      }

      const rawTransitionHint = beat.transitionHint || beat.transition_hint;
      const transitionHint = typeof rawTransitionHint === 'string' && rawTransitionHint.trim().length > 0
        ? removeEmDashes(rawTransitionHint.trim())
        : undefined;

      return {
        beatIndex,
        textSpan,
        shotType,
        cameraAngle,
        cameraMovement,
        visualSoundEffect,
        temporalAnchor,
        transitionHint,
        imagePrompt: removeEmDashes(finalImagePrompt),
        estimatedSeconds: typeof beat.estimatedSeconds === 'number' && beat.estimatedSeconds > 0
          ? beat.estimatedSeconds
          : 2,
      };
    });

    const calculatedSceneSeconds = Math.round(
      sanitizedBeats.reduce((sum: number, b: any) => sum + (b.estimatedSeconds || 2), 0)
    );
    const sceneSeconds = isVideoMode
      ? targetVideoDuration
      : Math.max(
          calculatedSceneSeconds,
          typeof scene.estimatedSeconds === 'number' && scene.estimatedSeconds > 0
            ? scene.estimatedSeconds
            : calculatedSceneSeconds
        );

    // Track characters established in this scene
    const establishedCharacters: string[] = [];
    const charactersInScene: string[] = [];
    for (const charName of Object.keys(sanitizedCharacterSheet)) {
      const regex = new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(narratorLine) || sanitizedBeats.some((b) => regex.test(b.imagePrompt) || regex.test(b.textSpan))) {
        charactersInScene.push(charName);
      }
    }

    const establishedSettings: string[] = [];
    if (sceneIndex === 1) {
      establishedSettings.push(sanitizedStyleProfile.eraAndSetting);
      settingFirstScene.set(sanitizedStyleProfile.eraAndSetting, 1);
    } else if (!settingFirstScene.has(sanitizedStyleProfile.eraAndSetting)) {
      establishedSettings.push(sanitizedStyleProfile.eraAndSetting);
      settingFirstScene.set(sanitizedStyleProfile.eraAndSetting, sceneIndex);
    }

    let videoPrompt: string | undefined = undefined;
    let startFramePrompt: string | undefined = undefined;

    if (isVideoMode) {
      const rawVP = scene.videoPrompt ? removeEmDashes(scene.videoPrompt) : '';
      if (rawVP.trim().length > 0) {
        let vp = rawVP.trim();
        if (charactersInScene.length > 0) {
          const charClauses = charactersInScene.map((c) => `${c}: ${sanitizedCharacterSheet[c]}`).join('. ');
          if (!vp.toLowerCase().includes(charClauses.toLowerCase().substring(0, 20))) {
            vp += ` Character Continuity (${charClauses}).`;
          }
        }
        if (sceneIndex > 1 && settingFirstScene.has(sanitizedStyleProfile.eraAndSetting)) {
          vp += ` Location Continuity (${sanitizedStyleProfile.eraAndSetting}).`;
        }
        if (!vp.includes(sanitizedStyleProfile.artStyle)) {
          vp += ` ${styleProfileWording}`;
        }
        videoPrompt = updateVideoPromptDuration(vp, targetVideoDuration, calculatedSceneSeconds);
      } else {
        const charDesc = charactersInScene.length > 0
          ? charactersInScene.map((c) => `${c}: ${sanitizedCharacterSheet[c]}`).join(', ')
          : 'Scene subject';
        videoPrompt = `Subject: ${charDesc}. Action: ${narratorLine}. Camera: Medium shot, eye-level, slow forward push-in. Lighting & Environment: ${sanitizedStyleProfile.lighting}, ${sanitizedStyleProfile.eraAndSetting}. Style: ${sanitizedStyleProfile.artStyle}, ${sanitizedStyleProfile.lensAndFilmStock}. Physics: Natural kinetic motion. Audio: no dialogue, ambient sound only. Duration: ${targetVideoDuration} seconds. ${defaultAspectRatio}.`;
      }

      const rawSFP = scene.startFramePrompt ? removeEmDashes(scene.startFramePrompt) : '';
      if (rawSFP.trim().length > 0) {
        startFramePrompt = rawSFP.trim();
      } else {
        const leadSubject = charactersInScene[0] ? sanitizedCharacterSheet[charactersInScene[0]] : 'Main subject';
        startFramePrompt = `Cinematic establishing frame of ${leadSubject}, dynamic initial pose in ${sanitizedStyleProfile.eraAndSetting}, ${sanitizedStyleProfile.lighting}, ${sanitizedStyleProfile.colorPalette}, ${defaultAspectRatio}, ${sanitizedStyleProfile.artStyle}.`;
      }
    }

    return {
      index: sceneIndex,
      narratorLine,
      estimatedSeconds: sceneSeconds,
      beats: sanitizedBeats,
      videoPrompt,
      startFramePrompt,
      establishedCharacters,
      establishedSettings,
      isAnchorScene: establishedCharacters.length > 0 || establishedSettings.length > 0,
    };
  });

  // Final Storyboard-level safety pass for Original workflow
  const finalScenes = sanitizedScenes.map((scene: any) => {
    const rawBeats = scene.beats.map((beat: any) => {
      // In video mode, do not strip shot framing prefixes so prompt details remain intact
      const prompt = isVideoMode ? beat.imagePrompt : sanitizeImagePromptShotFraming(beat.imagePrompt || '');

      const directAnchor = extractTemporalAnchor(beat.textSpan || '');
      if (directAnchor) {
        return {
          ...beat,
          temporalAnchor: directAnchor,
          imagePrompt: prompt,
        };
      }
      return {
        ...beat,
        temporalAnchor: undefined,
        imagePrompt: cleanRedundantOnScreenText(prompt),
      };
    });

    return {
      ...scene,
      beats: rawBeats,
    };
  });

  const scenesWithTransitionHints = populateSceneTransitionHints(finalScenes, sanitizedStyleProfile);

  const calculatedTotalSeconds = scenesWithTransitionHints.reduce((sum: number, s: any) => sum + s.estimatedSeconds, 0);
  const totalSeconds = typeof parsedData.totalDurationSeconds === 'number' && parsedData.totalDurationSeconds > 0
    ? parsedData.totalDurationSeconds
    : calculatedTotalSeconds;

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: sanitizedCharacterSheet,
    locationSheet: sanitizedLocationSheet,
    totalDurationSeconds: totalSeconds,
    scenes: scenesWithTransitionHints,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
  };
}

// ============================================================================
// PRIMARY ROUTER
// Seamlessly delegates to enhanceStoryArchitect.ts when Toggle is ON,
// and runs the pure, untouched generateOriginalStory when Toggle is OFF.
// ============================================================================
export async function generateStoryDirectly(
  req: GenerateStoryRequest,
  apiKey: string
): Promise<StoryGenerationResult> {
  if (req.autoArchitectMode) {
    return generateEnhancedStory(req, apiKey);
  }
  return generateOriginalStory(req, apiKey);
}
