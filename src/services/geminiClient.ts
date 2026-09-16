// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import { GenerateStoryRequest, StoryGenerationResult, StyleProfile } from '../types';
import { enforceBeatCeilings, extractTemporalAnchor, cleanRedundantOnScreenText } from './beatSplitting';

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

const DEFAULT_CAMERA_ANGLES = [
  'eye-level',
  'high-angle',
  'low-angle',
  'birds-eye',
  'worms-eye',
  'dutch-tilt'
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
  if (lower.includes('push') || lower.includes('zoom in')) return 'Slow Push-In';
  if (lower.includes('track') || lower.includes('follow') || lower.includes('run')) return 'Tracking Movement';
  if (lower.includes('pan')) return 'Smooth Pan';
  if (lower.includes('dolly')) return 'Dolly Slide';
  if (lower.includes('static') || lower.includes('still')) return 'Static Frame';
  return DEFAULT_CAMERA_MOVEMENTS[(beatIndex - 1) % DEFAULT_CAMERA_MOVEMENTS.length];
}

export { extractTemporalAnchor, cleanRedundantOnScreenText };

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
   - BEAT CEILING IS A MAXIMUM, NOT A MANDATE: The beat duration/word ceiling is a MAXIMUM safety limit, NOT a mandate to force every sentence into extra beats. Do NOT split a sentence into extra phrase beats if adjacent splits would render as the exact same image.
   - EVERY BEAT MUST BE VISUALLY DISTINCT: Each beat must show something its neighbor does not (a different focal detail, framing distance, moment in the action, or emotional shift in pose/expression). If two adjacent phrase splits would render as the same picture, merge them into ONE beat instead of generating redundant near-duplicates.
   - STRICT SHOT TYPE & PROSE ALIGNMENT (TIGHT SHOTS): When a beat's shotType is close-up, macro, extreme-close-up, or detail shot, its prompt prose MUST actually describe that tight framing and specific focal detail (e.g. extreme close-up on buckled seatbelt straps, frayed nylon, water droplets, wide eyes), NOT the same full-body or wide environmental description used in a wider beat nearby. The camera framing tag and the prompt prose MUST strictly match.

   CRITICAL FEW-SHOT LESSON: CONTINUITY ANCHOR VS. PROGRESSION VARIABLE
   When a story moment spans multiple sequential beats, analyze every beat through two lenses:
   1. CONTINUITY ANCHOR (What stays consistent): e.g., the subject identity and their key equipment (a girl strapped to a row of three airplane seats).
   2. PROGRESSION VARIABLE (What MUST change each beat): phase of motion, altitude/environment, framing distance, or physical aftermath.
   
   ❌ UNACCEPTABLE (Near-Duplicate Slop):
   - Beat 1 ("She fell"): Wide shot of girl strapped to 3 airplane seats falling through sky.
   - Beat 2 ("two miles through open air"): Same wide shot of girl falling through sky, reworded.
   - Beat 3 ("and survived"): Same wide shot of girl falling through sky, slightly different angle.
   
   ✅ MANDATORY PROGRESSION (Gold Standard):
   - Beat 1 ("She fell"): INCITING MOMENT / DEPARTURE — Breaching out of the fractured aircraft fuselage into the void, sparks and debris tumbling away, strapped securely into the row of three seats.
   - Beat 2 ("two miles through open air"): ISOLATED MID-AIR FREEFALL — High altitude, NO plane in sight. Endless turbulent clouds and vast empty troposphere rushing past, disorientation, freezing wind whipping hair and clothing, still strapped to the seats.
   - Beat 3 ("strapped to three airplane seats, and survived"): AFTERMATH & IMPACT RESOLUTION — The row of seats has crashed through the thick Amazon canopy and rests on the jungle floor among broken ferns and vines. The survivor is bruised and breathing, grounded in the foliage.

6. Strict Narrative Faithfulness (NO UNSTATED FACTUAL INVENTIONS):
   Do NOT invent fictitious specific story facts, character names, senders, or plot details that are NOT present in the narration or already locked in characterSheet/locationSheet.
   If the narration mentions "a voice message" without naming who sent it, describe it neutrally as "an audio playback device emitting sound" — NEVER invent a named sender or backstory fact absent from the original story text.

7. Unified Stylistic Register (CONSISTENT ART MEDIUM VOCABULARY):
   When a specific art style or medium is requested (e.g. "low-poly PS1 graphics", "90s anime cel", "stop-motion felt", "8-bit pixel art", "oil painting"):
   You MUST apply that art style's specific descriptive vocabulary consistently across ALL parts of the prompt, including characterSheet, locationSheet, subject descriptions, lighting, textures, and backgrounds.
   DO NOT allow competing descriptive registers (such as realistic photographic skin textures, subsurface scattering, or painterly brushstrokes) to compete with a low-poly or stylized medium.
   For example, for "low-poly PS1 graphics": describe characters as "flat-shaded 32-bit low-polygon 3D character models with blocky geometric shoulders, low-resolution pixelated face textures, retro flat lighting", NOT "a realistically detailed person with lifelike skin".

 8. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS:
   NEVER use a real, identifiable person's actual proper name (e.g. "Juliane Koepcke", "Maria Koepcke", "Elon Musk", "Napoleon Bonaparte", "Albert Einstein") in characterSheet keys, imagePrompt, videoPrompt, or startFramePrompt — even when the story is clearly based on real historical or true events and you recognize exactly who it is describing. Multiple downstream AI image and video generators refuse to generate prompts containing real people's names.
   Instead, describe people using generic role labels based on how the story describes them (e.g. "the 17-year-old female survivor", "her mother", "the 19th-century French general", "the theoretical physicist").
   characterSheet keys MUST be generic role labels (e.g. "the teenage survivor"), NEVER proper names of real people.
   MYTHOLOGICAL & LEGENDARY EXCEPTION: Mythological, legendary, and folkloric figures (e.g., Hercules, Zeus, King Arthur, Robin Hood, Thor, Gilgamesh) are EXEMPT. Name them normally in characterSheet and visual prompts since they have no real-world photographic existence and function as fictional archetypes. When a figure is part real and part legend (e.g. King Arthur, Vlad the Impaler / Dracula), treat them as the legendary version and name them freely.
   IMPORTANT EXCEPTION: This restriction ONLY applies to visual prompt fields (characterSheet, imagePrompt, videoPrompt, startFramePrompt). The narratorLine spoken script CAN and SHOULD still state real names, historical facts, dates, and context since it is purely the voiceover script and not fed into an image or video generator.

 9. OPENING BEAT VISUAL HOOK RULE (SCENE 1, BEAT 1):
   The opening beat of the whole story (Scene 1, Beat 1) MUST NOT be pure atmosphere, fog, smoke, an empty landscape/environment, an empty establishing shot, or a slow fade, UNLESS the story's actual first sentence is genuinely and explicitly about that atmospheric element.
   Scene 1 Beat 1 MUST show something concrete and visually arresting: the main character, a striking action already in motion, or the single most compelling visual subject/element the story possesses. A weak, abstract, or empty opening loses short-form viewers in the first two seconds.

 10. TEMPORAL ANCHOR & ON-SCREEN DATE/YEAR DISPLAY RULE (SINGLE BEAT ONLY):
   If the narrator line, story sentence, or beat phrase mentions a date, year, century, decade, or elapsed time duration (e.g. "in 1945", "December 24, 1971", "for 29 years", "in the 1920s", "300 BC"):
   - CRITICAL SINGLE-BEAT CONSTRAINT: The temporal anchor and on-screen date typography MUST ONLY appear in the prompt of the EXACT SINGLE BEAT whose spoken phrase ("textSpan") actually introduces or mentions that date/year. NEVER repeat or duplicate the year/date on other beats in the scene or across subsequent scenes!
   - You MUST populate "temporalAnchor" on that single beat ONLY with the exact date/year/duration phrase (e.g. "1945", "December 24, 1971", "for 29 years"). All other beats in the scene MUST have "temporalAnchor" omitted.
   - MANDATORY ON-SCREEN VISUAL TEXT DISPLAY (FOR THAT SINGLE BEAT ONLY): In that specific beat's prompt ("imagePrompt"), you MUST explicitly instruct the generator to display the text positioned at the top/above with a moderately large, clear font that is easily visible to the naked eye, stylized to seamlessly match the character style and art medium (e.g. "Featuring large clear legible text overlay reading '1945' displayed above at the top center in a bold font matching the scene's aesthetic style and color palette, clearly legible to the naked eye", or "Featuring bold stylized on-screen typography reading 'FOR 29 YEARS' displayed prominently above in the upper portion in matching art style").
   - For all other beats in the scene (where no date is spoken), DO NOT include any date or year text overlay instructions in their prompts.
   - In addition, reflect the historical era/weathering in the subject and setting (e.g. "1945 era military gear, authentic period details").

5. Start Frame Ingredients (Text to Image Prompt):
   For each scene, provide "startFramePrompt": a pristine text-to-image prompt to generate the initial reference keyframe image for image-to-video tools (Kling, Runway, Luma, Sora). Formatted as:
   [Shot framing and angle] of [Subject with exact character details], [Initial frame pose] in [Setting/Location Details], [Lighting & Color palette], ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}.

6. Smart Video Beats Array ("beats"):
   For each scene, provide an array of fine-grained video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
   Each beat MUST contain:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": the specific phrase/action segment from the narrator line (e.g. "Imagine an entire island")
   - "estimatedSeconds": estimated duration in seconds for this beat, distributed so the sum of all beats in the scene equals approximately ${targetVideoDuration} seconds.
   - "shotType": explicit cinematography shot size (e.g., "extreme-wide", "wide", "medium", "close-up", "extreme-close-up")
   - "cameraAngle": explicit camera angle (e.g., "eye-level", "high-angle", "low-angle", "birds-eye", "worms-eye", "dutch-tilt")
   - "cameraMovement": cinematic camera motion cue (e.g., "Slow forward push-in", "Smooth lateral tracking", "Gentle crane tilt down")
   - "temporalAnchor": optional string for explicit year, date, or elapsed duration (e.g. "1945", "December 24, 1971", "for 29 years")
   - "imagePrompt": A complete, standalone, production-ready TEXT TO VIDEO PROMPT formatted for AI video generators capturing this specific beat's action with high-precision cinematography:
     * EXACT BODY ANGLE & GAZE: Torso orientation (e.g. 3/4 profile screen-left, frontal, dorsal), head direction, and eye gaze line.
     * PRECISE GESTURES: Exact hand, arm, and posture kinematics (e.g. clenched fists, reaching fingers, slumped shoulders).
     * CHARACTER STAGING (MAIN VS. SIDE): Main character anchoring the focal point; side character positioned in secondary depth/flanking plane reacting toward the protagonist.
     * PACING & TEMPO: Explicit kinetic speed (e.g. sudden snap, deliberate crawl, rapid cadence).
     * AUDIO & ON-SCREEN ANCHORS: "no dialogue, ambient sound only". If temporalAnchor is present, the prompt MUST explicitly instruct the generator to display that year/date/duration prominently above with a moderately large legible font rendered in the same design/medium as the character style. Aspect ratio: ${defaultAspectRatio}.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere (do not use "\\u2014", "\\u2013", or "--"). Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS: NEVER use real, identifiable people's actual proper names (historical figures, celebrities, private individuals) in characterSheet keys, imagePrompt, videoPrompt, or startFramePrompt — use generic role descriptions instead. Mythological, legendary, and folkloric figures (Hercules, Zeus, King Arthur, Robin Hood) are EXEMPT and should be named normally. Real names are permitted in narratorLine.
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
          "shotType": string,
          "cameraAngle": string,
          "cameraMovement": string,
          "temporalAnchor": "string (optional: e.g. 1945, December 24, 1971, for 29 years)",
          "imagePrompt": string
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and visual continuity sheets.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style adapting to the story's genre, tone, and character style input: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story (for example, muted earth tones, saturated neon, sepia chiaroscuro, or oceanic teals and golds)
   - "lighting": lighting style and atmospheric quality (for example, moody rim lighting, harsh equatorial sunlight, or soft lantern glow)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop of the story
   - "lensAndFilmStock": lens and film stock descriptor (e.g. "Shot on 35mm prime lens, fine film grain")

2. Continuity Sheets (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping each recurring character name to ONE fixed, highly detailed visual description. You MUST resolve any unstated attributes (gender, age, build, hair) into concrete, locked choices. Ambiguity is forbidden. Side characters appearing more than once must be included, keyed by role (e.g., "the jockey") if unnamed.
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once (a particular room, a specific ridge) to ONE fixed, highly detailed visual description.
   CRITICAL CONTINUITY RULE: Whenever any character or location from these sheets appears in any beat's imagePrompt, you MUST reuse that exact visual description wording word-for-word in that imagePrompt to guarantee consistency across every frame.

3. Nested Scenes and Beats:
   Break the story into a sequence of scenes.
   Each scene has:
   - "index": integer (1, 2, 3...)
   - "narratorLine": complete spoken narration line for this scene.
   - "estimatedSeconds": total estimated spoken seconds for this entire scene.
   - "beats": an array of fine-grained visual beats.

4. Granular Visual Beat Partitioning & HARD CEILING RULE:
   HARD CEILING (SAFETY MAXIMUM): No beat may represent more than 2 seconds of estimated narration or 8 words, whichever is smaller.
   CRITICAL: This ceiling is a MAXIMUM safety limit, NOT a mandate to over-split sentences into redundant duplicate images.
   DO NOT force a sentence into extra phrase beats if adjacent splits would end up rendering as the exact same image.
   Every beat MUST show something distinct that its neighbor does NOT (a different focal detail, framing distance, sequential phase of action, or emotional beat reflected in pose and expression).
   If two adjacent phrase-level splits would render as the exact same picture, merge them into ONE single cohesive beat instead of generating redundant near-duplicates.
   
   CRITICAL CINEMATIC SHOT VARIETY:
   Vary camera sizes and angles across sequential beats to ensure rhythmic dynamic pacing. Do not default every beat to eye-level medium static shots. Vary size, angle, and movement deliberately based on what's happening in that beat.

   STRICT SHOT TYPE & PROSE ALIGNMENT (CLOSE-UP / MACRO / EXTREME-CLOSE-UP):
   When a beat's shotType is close-up, macro, extreme-close-up, or detail shot, its imagePrompt text prose MUST actually describe that tight framing and specific focal detail (e.g., extreme close-up on buckled seatbelt straps, frayed nylon webbing, rain droplets on a metal latch, wide panicked eyes), NOT the same full-body or wide environmental description used in a wider beat nearby. The camera framing tag and the text prose MUST strictly match!

   CRITICAL ACTION AND POSE SPECIFICITY:
   For all character action and pose descriptions in imagePrompt, ALWAYS explicitly include: (1) what the hands/arms are doing, (2) which direction the body and torso are facing, and (3) where the eyes are looking, not just a generic pose. For example: "Facing left toward the horizon, right arm raised, pointing at the volcano, eyes following the gesture" instead of "a person standing there."

   CRITICAL FEW-SHOT LESSON: CONTINUITY ANCHOR VS. PROGRESSION VARIABLE
   When a story moment spans multiple sequential beats, analyze every beat through two lenses:
   1. CONTINUITY ANCHOR (What stays consistent): e.g., the subject identity and their key equipment (a girl strapped to a row of three airplane seats).
   2. PROGRESSION VARIABLE (What MUST change each beat): phase of motion, altitude/environment, framing distance, or physical aftermath.
   
   ❌ UNACCEPTABLE (Near-Duplicate Slop):
   - Beat 1 ("She fell"): Wide shot of girl strapped to 3 airplane seats falling through sky.
   - Beat 2 ("two miles through open air"): Same wide shot of girl falling through sky, reworded.
   - Beat 3 ("and survived"): Same wide shot of girl falling through sky, slightly different angle.
   
   ✅ MANDATORY PROGRESSION (Gold Standard):
   - Beat 1 ("She fell"): INCITING MOMENT / DEPARTURE — Breaching out of the fractured aircraft fuselage into the void, sparks and debris tumbling away, strapped securely into the row of three seats.
   - Beat 2 ("two miles through open air"): ISOLATED MID-AIR FREEFALL — High altitude, NO plane in sight. Endless turbulent clouds and vast empty troposphere rushing past, disorientation, freezing wind whipping hair and clothing, still strapped to the seats.
   - Beat 3 ("strapped to three airplane seats, and survived"): AFTERMATH & IMPACT RESOLUTION — The row of seats has crashed through the thick Amazon canopy and rests on the jungle floor among broken ferns and vines. The survivor is bruised and breathing, grounded in the foliage.

   ANATOMICAL ORIENTATION, GESTURES, PACING, & CHARACTER STAGING (MANDATORY IN EVERY BEAT):
   For every beat prompt (both main and side characters):
   1. BODY ANGLE & TORSO ORIENTATION: Explicitly state the angle of the character's torso relative to the camera lens (e.g. "torso angled in 3/4 profile facing screen-left", "standing in wide frontal stance squared directly to lens", "back turned in sharp dorsal silhouette looking back over left shoulder"). Never state "a character stands" without torso angle.
   2. GAZE & HEAD DIRECTION: Specify exact head turn angle and eye line direction (e.g. "head tilted 20 degrees upward gazing at the storm clouds", "eyes locked in intense downward stare at the glowing console").
   3. GESTURES & HANDS: Specify what the hands, fingers, and limbs are doing down to the fingertips (e.g. "fingers white-knuckled around the steering wheel", "right hand outstretched palm-forward in defensive posture while left arm braces against the wall", "arms limp at sides in utter exhaustion").
   4. MAIN VS. SIDE CHARACTER STAGING & POSITIONING:
      - When two or more characters share a scene: The MAIN CHARACTER must occupy the primary focal position (dominant Rule-of-Thirds line, foreground or strong midground, front-lit).
      - The SIDE CHARACTER must be placed in a deliberate supporting spatial plane (subordinate depth, flanking at screen edge, or over-the-shoulder foreground silhouette) with body/gestures oriented toward the main character to reinforce narrative hierarchy and visual balance.
   5. KINETIC PACING & MOTION INTENSITY: Define the pacing and physical momentum of the shot (e.g. "explosive sudden sprint", "slow hypnotic drifting cadence", "tense frozen standstill", "staccato hurried heartbeat tempo").

   SINGLE VISUAL FOCUS PER BEAT (NO CONFUSED HYBRID COMPOSITIONS):
   Every beat MUST focus on exactly ONE clear visual subject or action.
   NEVER combine two competing framing requests into a single beat (e.g. DO NOT write one prompt trying to frame a close-up on an object AND a character's reaction in the same image). Trying to show both in one prompt produces confused hybrid compositions with oversized foreground objects and floating background characters.
   If a story moment involves both an object/detail AND a character's reaction, split it into two separate sequential beats: Beat A (extreme close-up on object) and Beat B (close-up character reaction).

   STRICT NARRATIVE FAITHFULNESS (NO UNSTATED FACTUAL INVENTIONS):
   Do NOT invent fictitious specific story facts, character names, senders, or plot details that are NOT present in the narration or already locked in characterSheet/locationSheet.
   If the narration mentions "a voice message" or "a mysterious phone call" without stating who sent or made it, describe it neutrally as "an audio playback device emitting a recorded voice" — NEVER invent a named sender, fictitious relative, or arbitrary backstory fact absent from the original story text.

    UNIFIED STYLISTIC REGISTER (CONSISTENT ART MEDIUM VOCABULARY):
   When a specific art style or medium is requested (e.g. "low-poly PS1 graphics", "90s anime cel animation", "stop-motion felt", "8-bit pixel art", "claymation", "oil painting"):
   You MUST apply that art style's specific descriptive vocabulary consistently across ALL parts of the prompt — including characterSheet, locationSheet, subject descriptions, lighting, textures, and backgrounds.
   DO NOT allow competing descriptive registers (such as realistic photographic skin textures, subsurface scattering, or painterly brushwork) to compete with a low-poly or stylized medium.
   For example, for "low-poly PS1 graphics": describe characters as "flat-shaded 32-bit low-polygon 3D character models with blocky geometric shoulders, low-resolution pixelated face textures, flat retro 90s lighting", NOT "a realistically detailed person with lifelike skin".

   NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS:
   NEVER use a real, identifiable person's actual proper name (e.g. "Juliane Koepcke", "Maria Koepcke", "Elon Musk", "Napoleon Bonaparte", "Albert Einstein") in characterSheet keys, imagePrompt, videoPrompt, or startFramePrompt — even when the story is clearly based on real historical or true events and you recognize exactly who it is describing. Multiple downstream AI image and video generators refuse to generate prompts containing real people's names.
   Instead, describe real people using generic role labels based on how the story describes them (e.g. "the 17-year-old female survivor", "her mother", "the 19th-century French general", "the theoretical physicist").
   characterSheet keys for real people MUST be generic role labels (e.g. "the teenage survivor"), NEVER proper names of real individuals.
   MYTHOLOGICAL & LEGENDARY EXCEPTION: Mythological, legendary, and folkloric figures (e.g., Hercules, Zeus, King Arthur, Robin Hood, Thor, Gilgamesh) are EXEMPT. Name them normally in characterSheet and visual prompts since they have no real-world photographic existence and function as fictional archetypes. When a figure is part real and part legend (e.g. King Arthur, Vlad the Impaler / Dracula), treat them as the legendary version and name them freely.
   IMPORTANT EXCEPTION: This restriction ONLY applies to visual prompt fields (characterSheet, imagePrompt, videoPrompt, startFramePrompt). The narratorLine spoken script CAN and SHOULD still state real names, historical facts, dates, and context since it is purely the voiceover script and not fed into an image or video generator.

   OPENING BEAT VISUAL HOOK RULE (SCENE 1, BEAT 1):
   The opening beat of the whole story (Scene 1, Beat 1) MUST NOT be pure atmosphere, fog, smoke, an empty landscape/environment, an empty establishing shot, or a slow fade, UNLESS the story's actual first sentence is genuinely and explicitly about that atmospheric element.
   Scene 1 Beat 1 MUST show something concrete and visually arresting: the main character, a striking action already in motion, or the single most compelling visual subject/element the story possesses. A weak, abstract, or empty opening loses short-form viewers in the first two seconds.

   TEMPORAL ANCHOR & ON-SCREEN DATE/YEAR DISPLAY RULE (SINGLE BEAT ONLY):
   If the narrator line, story sentence, or beat phrase mentions a date, year, century, decade, or elapsed time duration (e.g. "in 1945", "December 24, 1971", "for 29 years", "in the 1920s", "300 BC"):
   - CRITICAL SINGLE-BEAT CONSTRAINT: The temporal anchor and on-screen date typography MUST ONLY appear in the prompt of the EXACT SINGLE BEAT whose spoken phrase ("textSpan") actually introduces or mentions that date/year. NEVER repeat or duplicate the year/date on other beats in the scene or across subsequent scenes!
   - You MUST populate "temporalAnchor" on that single beat ONLY with the exact date/year/duration phrase (e.g. "1945", "December 24, 1971", "for 29 years"). All other beats in the scene MUST have "temporalAnchor" omitted.
   - MANDATORY ON-SCREEN VISUAL TEXT DISPLAY (FOR THAT SINGLE BEAT ONLY): In that specific beat's prompt ("imagePrompt"), you MUST explicitly include instructions to display this text positioned above (in the upper portion of the frame) with a moderately large, clear font that is easily readable by the naked eye, with typography styled in the exact same art medium and aesthetic design as the character style (e.g. "Featuring large clear legible on-screen text reading '1945' displayed above at the top center in a bold stylized font that matches the artwork medium and character style", or "Featuring prominent stylized title text reading 'FOR 29 YEARS' displayed in the upper frame matching the scene's artistic aesthetic").
   - For all other beats in the scene (where no date is spoken), DO NOT include any date or year text overlay instructions in their prompts.
   - In addition, describe the period-accurate attire, setting, or weathering corresponding to that year or elapsed time.

   VISUAL SOUND EFFECT RULE (IMAGE MODE ONLY):
   Check styleProfile.artStyle and characterStyle input.
   IF AND ONLY IF the visual style is illustrated or comic-adjacent (e.g. stickman, anime, manga, comic book, cartoon, pop-art, graphic novel, line illustration — NOT photorealistic film / 3D realistic rendering):
   - You MAY optionally add a "visualSoundEffect" string field (e.g. "CRASH!", "SPLASH!", "BAM!", "ZAP!", "WHAM!", "BOOM!", "THUD!") to beats representing sudden high-impact action or physical collisions.
   - USE SPARINGLY! Only populate on genuine impact moments, not every beat.
   - When "visualSoundEffect" is populated, the "imagePrompt" MUST describe this sound effect as bold lettering integrated into the scene artwork, styled to match the illustration (e.g. 'integrated bold stylized comic lettering reading "CRASH!" in the artwork background with dynamic action lines'), NOT a caption appended outside the image.
   - IF the style is photorealistic or realistic film, "visualSoundEffect" MUST be omitted.

   Each beat must specify:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": the exact words from the scene's narratorLine that this visual beat covers (MAX 8 WORDS).
   - "shotType": explicit cinematography shot size (e.g., "extreme-wide", "wide", "medium", "close-up", "extreme-close-up")
   - "cameraAngle": explicit camera angle (e.g., "eye-level", "high-angle", "low-angle", "birds-eye", "worms-eye", "dutch-tilt")
   - "cameraMovement": cinematic motion cue (e.g., "Slow Push-In", "Static Frame", "Tracking Subject", "Smooth Pan", "Low Dolly Glide", "Aerial Drift")
   - "visualSoundEffect": optional string for comic-style bold sound effect lettering (e.g. "CRASH!", "SPLASH!") for illustrated styles on impact beats only. Omit for photorealistic style.
   - "temporalAnchor": optional string for explicit year, date, or elapsed duration (e.g. "1945", "December 24, 1971", "for 29 years").
   - "imagePrompt": a structured cinematic prompt formatted according to the formula:
     [Shot Type & Camera Angle] of [Subject with exact character appearance details word-for-word from characterSheet], [Key Action & Staging: exact body angle (e.g. 3/4 screen-left, profile, frontal), gaze vector, hand/finger gestures, character staging (main character commanding focal thirds, side characters placed flanking or in depth reacting toward them), and kinetic pacing/tempo], [Integrated bold comic sound effect lettering if visualSoundEffect is present] in [Exact Location Details word-for-word from locationSheet], [Lighting & Color Grade]. [Aspect ratio and style anchors: ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}].
   - "estimatedSeconds": estimated spoken narration duration in seconds (HARD CEILING: MAXIMUM 2.0 SECONDS, typically 1.0 to 1.8 seconds).

5. Duration and Pacing:
   ${durationInstruction}
   Total duration ("totalDurationSeconds") must reflect the combined estimated duration of all scenes.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere (do not use "\\u2014", "\\u2013", or "--"). Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS: NEVER use real, identifiable people's actual proper names (historical figures, celebrities, private individuals) in characterSheet keys, imagePrompt, videoPrompt, or startFramePrompt — use generic role descriptions instead. Mythological, legendary, and folkloric figures (Hercules, Zeus, King Arthur, Robin Hood) are EXEMPT and should be named normally. Real names are permitted in narratorLine.
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
          "shotType": "extreme-wide | wide | medium | close-up | extreme-close-up",
          "cameraAngle": "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow Push-In | Static Frame | Tracking...",
          "temporalAnchor": "string (optional: e.g. 1945, for 29 years)",
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
The user has explicitly segmented the story into exact scenes and custom visual beats. You MUST follow this exact scene breakdown and phrase assignment. For each beat, follow the user's specific visual guidance and shot suggestions while ensuring NO near-duplicate frames and strict visual progression:
${customScenes.map((cs, sIdx) => `Scene ${sIdx + 1} narration: "${cs.narratorLine}"
Beats:
${cs.beats.map((b, bIdx) => `  - Beat ${bIdx + 1} phrase: "${b.textSpan}"${b.userGuidance ? ` | Director's Visual Note: "${b.userGuidance}"` : ''}${b.shotType ? ` | Preferred Shot: "${b.shotType}"` : ''}`).join('\n')}`).join('\n\n')}`;
  }

  const userPrompt = `Story Idea:
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

  // Sanitize locationSheet
  const rawLocSheet = parsedData.locationSheet && typeof parsedData.locationSheet === 'object' && !Array.isArray(parsedData.locationSheet)
    ? parsedData.locationSheet
    : {};
  const sanitizedLocationSheet: Record<string, string> = {};
  for (const [locName, desc] of Object.entries(rawLocSheet)) {
    if (typeof desc === 'string' && desc.trim()) {
      sanitizedLocationSheet[removeEmDashes(locName.trim())] = removeEmDashes(desc.trim());
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

    // Resolve single-beat temporal anchor assignment for this scene:
    // CRITICAL: Only assign a temporal anchor to a beat if that beat's OWN textSpan explicitly contains a date/year
    const assignedBeatAnchorMap = new Map<number, string>();
    rawBeats.forEach((b: any, bIdx: number) => {
      const span = removeEmDashes(b.textSpan || b.text_span || '');
      const anchor = extractTemporalAnchor(span);
      if (anchor) {
        assignedBeatAnchorMap.set(bIdx, anchor);
      } else if (typeof b.temporalAnchor === 'string' && b.temporalAnchor.trim().length > 0) {
        const directAnchor = extractTemporalAnchor(b.temporalAnchor);
        if (directAnchor && directAnchor.toLowerCase() === span.toLowerCase()) {
          assignedBeatAnchorMap.set(bIdx, directAnchor);
        }
      }
    });

    const sanitizedBeats = rawBeats.map((beat: any, bIdx: number) => {
      const beatIndex = typeof beat.beatIndex === 'number' ? beat.beatIndex : bIdx + 1;
      const textSpan = removeEmDashes(beat.textSpan || beat.text_span || '');
      let imagePrompt = removeEmDashes(beat.imagePrompt || beat.image_prompt || '');
      const shotType = removeEmDashes(beat.shotType || beat.shot_type || inferShotType(imagePrompt, beatIndex));
      const cameraAngle = removeEmDashes(beat.cameraAngle || beat.camera_angle || inferCameraAngle(imagePrompt, beatIndex));
      const cameraMovement = removeEmDashes(beat.cameraMovement || beat.camera_movement || inferCameraMovement(imagePrompt, beatIndex));

      const matchedCharClauses: string[] = [];
      for (const [charName, visualDesc] of Object.entries(sanitizedCharacterSheet)) {
        const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        if (nameRegex.test(textSpan) || nameRegex.test(imagePrompt) || nameRegex.test(narratorLine)) {
          if (!imagePrompt.includes(visualDesc)) {
            matchedCharClauses.push(`${charName} appearance: ${visualDesc}`);
          }
        }
      }

      const matchedLocClauses: string[] = [];
      for (const [locName, visualDesc] of Object.entries(sanitizedLocationSheet)) {
        const escapedName = locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        if (nameRegex.test(textSpan) || nameRegex.test(imagePrompt) || nameRegex.test(narratorLine)) {
          if (!imagePrompt.includes(visualDesc)) {
            matchedLocClauses.push(`${locName} environment: ${visualDesc}`);
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

      // Extract or preserve temporal anchor ONLY if this beat is the designated single owner
      const temporalAnchor = assignedBeatAnchorMap.get(bIdx);

      // Ensure that if a temporal anchor exists, it is explicitly displayed on-screen above with a large font in matching character style
      if (temporalAnchor) {
        const anchorUpper = temporalAnchor.toUpperCase();
        // Check if prompt already directs on-screen text display of this anchor
        const hasOnScreenText = /text|title|typography|lettering/i.test(finalImagePrompt) && finalImagePrompt.toUpperCase().includes(anchorUpper);
        if (!hasOnScreenText) {
          const styleRef = sanitizedStyleProfile.artStyle || characterStyle || 'the visual aesthetic';
          finalImagePrompt += ` Featuring large clear legible on-screen text reading "${anchorUpper}" displayed above at the upper portion of the frame in a bold typography stylized to match ${styleRef}, clearly visible to the naked eye.`;
        }
      } else {
        // For beats WITHOUT a temporal anchor, strip any accidental or repeated date text overlay instructions
        finalImagePrompt = cleanRedundantOnScreenText(finalImagePrompt);
      }

      return {
        beatIndex,
        textSpan,
        shotType,
        cameraAngle,
        cameraMovement,
        visualSoundEffect,
        temporalAnchor,
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

  // Final Storyboard-level safety pass:
  // 1. Ensure date text overlay and temporal anchors ONLY exist on beats whose spoken textSpan contains the date
  // 2. Strip any leftover bracketed labels like [Shot, Angle, Movement] from prompt bodies
  // 3. Compare adjacent beats within each scene and ensure visual progression without prompt duplication
  const finalScenes = sanitizedScenes.map((scene: any) => {
    const rawBeats = scene.beats.map((beat: any) => {
      let prompt = (beat.imagePrompt || '').replace(/^\[.*?\]\s*/, '').trim();

      const directAnchor = extractTemporalAnchor(beat.textSpan || '');
      if (directAnchor) {
        return {
          ...beat,
          temporalAnchor: directAnchor,
          imagePrompt: prompt,
        };
      }
      // If beat does not speak the date, scrub any leftover temporal anchor and date overlay instructions
      return {
        ...beat,
        temporalAnchor: undefined,
        imagePrompt: cleanRedundantOnScreenText(prompt),
      };
    });

    // Helper to strip boilerplate styles and get the core visual description of a beat
    const getCoreDescription = (prompt: string): string => {
      let core = prompt
        .replace(/Character Continuity \([^)]*\)\.?/gi, '')
        .replace(/Location Continuity \([^)]*\)\.?/gi, '')
        .replace(/Visual Style:.*$/i, '')
        .replace(/\b(?:9:16 vertical|16:9 widescreen|4:3|1:1)\b[^.]*\.?/gi, '')
        .replace(/\bShot on 35mm[^.]*\.?/gi, '')
        .replace(/^\[.*?\]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      return core;
    };

    const distinctBeats = rawBeats.map((beat: any, bIdx: number) => {
      if (bIdx === 0) return beat;
      const prevBeat = rawBeats[bIdx - 1];
      const prevCore = getCoreDescription(prevBeat.imagePrompt || '');
      const currCore = getCoreDescription(beat.imagePrompt || '');

      // If the core descriptions are identical or near-identical, make the current beat visually distinct
      const isDuplicate = prevCore.length > 10 && (currCore === prevCore || (currCore.length > 20 && (currCore.includes(prevCore) || prevCore.includes(currCore))));

      if (isDuplicate) {
        const textSpan = (beat.textSpan || '').trim();
        const cleanShot = (beat.shotType || 'Dynamic medium angle shot').trim();
        const cleanAngle = (beat.cameraAngle || 'eye-level').trim();
        // Replace duplicated core with distinct action & subject focus derived from its own textSpan
        const distinctCore = `${cleanShot} from a ${cleanAngle} perspective, distinct visual moment specifically capturing "${textSpan}".`;
        
        let newPrompt = beat.imagePrompt.replace(prevCore, distinctCore);
        if (newPrompt === beat.imagePrompt) {
          newPrompt = `${distinctCore} ${beat.imagePrompt}`;
        }
        return {
          ...beat,
          imagePrompt: newPrompt.replace(/^\[.*?\]\s*/, '').trim(),
        };
      }
      return beat;
    });

    return {
      ...scene,
      beats: distinctBeats,
    };
  });

  const calculatedTotalSeconds = finalScenes.reduce((sum: number, s: any) => sum + s.estimatedSeconds, 0);
  const totalSeconds = typeof parsedData.totalDurationSeconds === 'number' && parsedData.totalDurationSeconds > 0
    ? parsedData.totalDurationSeconds
    : calculatedTotalSeconds;

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: sanitizedCharacterSheet,
    locationSheet: sanitizedLocationSheet,
    totalDurationSeconds: totalSeconds,
    scenes: finalScenes,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
  };
}
