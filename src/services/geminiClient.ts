// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import { GenerateStoryRequest, StoryGenerationResult, StyleProfile, Beat } from '../types';
import {
  extractTemporalAnchor,
  cleanRedundantOnScreenText,
  sanitizeImagePromptShotFraming,
} from './beatSplitting';
import {
  buildCompactCharacterAnchor,
  deduplicateAndProgressSceneBeats,
  enrichStartFramePrompt,
  expandEntityKeysInPrompt,
  findUncoveredTrailingScript,
  isInfancyOrChildhoodFlashback,
  isMonochromeStyle,
  normalizeContinuitySheetKeys,
  normalizeUnicodeAndDashes,
  runTwoPhaseProgressionAndRepair,
  sanitizeFakePrecisionMath,
  sanitizeMasterVideoPrompt,
  sanitizeMonochromeLighting,
  sanitizeStillImageMotionAndOptics,
  stripLeadingOrientationPrefixes,
  stripTransientExpressionsAndPoses,
  STYLE_ANCHOR_MAX_WORDS,
  synchronizeCharacterSheetWithFirstAppearances,
} from './beatProgressionEngine';
import { generateEnhancedStory } from './enhanceStoryArchitect';
import { updateVideoPromptDuration } from './videoSuitability';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import { executeGroundedPipeline } from './groundedPipeline';
import { executeJsonLlmCall } from './unifiedAiService';
import { compileThumbnailPrompt } from './promptCompiler';

function removeEmDashes(text: string): string {
  return normalizeUnicodeAndDashes(text);
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
    return 'Google Gemini servers are temporarily busy. Please wait a moment and click Retry Breakdown.';
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

/**
 * Strips unwanted audio cues from image prompts, deduplicates redundant sentences,
 * eliminates trailing repetitive continuity loops, and cleans redundant style profile dumps.
 */
export function cleanAndDeduplicatePrompt(
  prompt: string,
  isVideoMode: boolean
): string {
  let cleaned = prompt.trim();

  // In Text to Image mode, strictly strip any audio, soundtrack, voice, or sound effect descriptions
  if (!isVideoMode) {
    cleaned = cleaned.replace(/\b(?:Audio|Sound|Foley|Soundtrack|Dialogue|Ambient sound)\s*:\s*[^.;\n]+[.;]?/gi, '');
    cleaned = cleaned.replace(/\b(?:no dialogue,\s*ambient sound only|ambient foley only|with ambient sound|silent|no dialogue)\b[.;]?/gi, '');
  }

  // Remove redundant explicit Continuity blocks if already integrated into the sentence
  cleaned = cleaned.replace(/\s*(?:Character|Location) Continuity \([^)]*\)\.?/gi, '');

  // Deduplicate adjacent identical sentences or repeated phrases
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const seenSentences = new Set<string>();
  const uniqueSentences: string[] = [];
  for (const s of sentences) {
    const normalized = s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.length > 0 && !seenSentences.has(normalized)) {
      seenSentences.add(normalized);
      uniqueSentences.push(s.trim());
    }
  }
  cleaned = uniqueSentences.join(' ');

  // Clean trailing punctuation and multiple spaces
  cleaned = cleaned.replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

const BOILERPLATE_PATTERNS = [
  /shot on 35mm[^.]*\./gi,
  /vertical 9:16[^.]*\./gi,
  /cinematic 16:9[^.]*\./gi,
  /--ar\s+[0-9:]+/gi,
  /visual style:[^.]*\./gi,
  /character continuity \([^)]*\)\.?/gi,
  /location continuity \([^)]*\)\.?/gi,
  /\bar\s+[0-9:]+[.,]?/gi,
];

const STOP_WORDS = new Set(
  'a an the of in on at to with and or as by for from is are was were its it this that his her their into over under across just than then'.split(' ')
);

export function getCorePromptTokens(prompt: string): string[] {
  let cleaned = prompt;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  // Strip any legacy variation table prefixes
  cleaned = cleaned.replace(/^(?:the altered environment|emphasizing grounded scale|focusing on tactile textures|vantage perspective[^.]*|reaction angle[^.]*)\.\s*/i, '');
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function compute3GramShingles(tokens: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i <= tokens.length - 3; i++) {
    s.add(tokens.slice(i, i + 3).join(' '));
  }
  return s;
}

function jaccardIndex(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

export function calculatePromptSimilarity(a: string, b: string): number {
  const tokensA = getCorePromptTokens(a);
  const tokensB = getCorePromptTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const shinglesA = compute3GramShingles(tokensA);
  const shinglesB = compute3GramShingles(tokensB);
  const wordsA = new Set(tokensA);
  const wordsB = new Set(tokensB);

  const shingleScore = jaccardIndex(shinglesA, shinglesB);
  const wordScore = jaccardIndex(wordsA, wordsB);
  return 0.6 * shingleScore + 0.4 * wordScore;
}

/**
 * Strips frozen physical poses, hand gestures, and specific props from character continuity sheets.
 * Ensures the characterSheet retains only locked biometric identity (face, hair, skin) and wardrobe.
 */
export function sanitizeCharacterIdentitySheet(desc: string): string {
  if (!desc || typeof desc !== 'string') return '';
  let cleaned = desc.trim();
  // Strip specific frozen poses and props-in-hand
  cleaned = cleaned.replace(/Hands visible in lower frame[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/right hand clutching[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/left hand rests on[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/wrist flexed[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/weight \d+%\s*on[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/torso twisted \d+°[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/holds (?:her|his) own[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/standing in dim hallway[^.;]*[.;]?/gi, '');
  cleaned = cleaned.replace(/gaze fixed on phone screen[.;]?/gi, '');
  // Strip transient facial expressions and temporary posture phrases so sheet stays neutral & permanent
  cleaned = stripTransientExpressionsAndPoses(cleaned);
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  return cleaned;
}

/**
 * Ensures beats within a scene never repeat identical visual descriptions,
 * delegating to deduplicateAndProgressSceneBeats with Option A visual-event pacing.
 */
export function enforceBeatToBeatProgression(beats: Beat[]): Beat[] {
  return deduplicateAndProgressSceneBeats(beats);
}

/**
 * Assembles a clean, pristine visual prompt:
 * Strips legacy variation prefixes, eliminates duplicate --ar and orientation tags
 * (whether followed by period, comma, colon, or space),
 * filters degenerate prompts, and guarantees single orientation text and single --ar flag.
 */
export function assembleCleanPrompt(
  prompt: string,
  isLongForm: boolean
): string {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = sanitizeFakePrecisionMath(prompt.trim());

  // Strip legacy variation prefixes
  cleaned = cleaned.replace(/^(?:the altered environment|emphasizing grounded scale|focusing on tactile textures|vantage perspective looking down across the scene|reaction angle focusing on physical interaction)\.\s*/gi, '');

  // Strip redundant aspect ratio tags, orientation strings, and any orphaned prepositions before framing
  cleaned = cleaned.replace(/\s*--ar\s+[0-9:]+/gi, '');
  cleaned = cleaned.replace(/,\s*ar\s+[0-9:]+[.,]?/gi, '');
  cleaned = cleaned.replace(/\bar\s+[0-9:]+[.,]?/gi, '');
  cleaned = stripLeadingOrientationPrefixes(cleaned);
  cleaned = cleaned.replace(
    /(?:(?:framed|captured|shot|set)\s+)?(?:\b(?:in|with|as)\s+a\s+)?\b(?:Cinematic 16:9 widescreen composition|Vertical 9:16 portrait composition)(?:\s*[,.:;-]\s*|\s+)*/gi,
    ''
  );
  cleaned = cleaned.replace(
    /\b(?:in|with)\s+a\s+(?=(?:from\s+a|at\s+eye[-\s]*level|at\s+(?:low|high)[-\s]*angle|with\s+a\s+(?:tense\s+)?dutch|birds?[-\s]*eye|worms?[-\s]*eye)\b)/gi,
    ''
  );

  // Strip degenerate/empty prompts like "Extreme." or "Wide."
  if (/^(?:Extreme|Wide|Medium|Close-up|Macro|Point-of-View|Over-the-Shoulder)\.?\s*$/i.test(cleaned)) {
    return '';
  }

  // Fix missing spaces after commas, double focal lengths ("35mm 35mm"), and double periods ("..")
  cleaned = cleaned
    .replace(/\b(\d{2,3}mm)\s+\1\b/gi, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/,([^\s0-9])/g, ', $1')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  const orientationText = isLongForm ? 'Cinematic 16:9 widescreen composition' : 'Vertical 9:16 portrait composition';
  const arFlag = isLongForm ? '--ar 16:9' : '--ar 9:16';

  return `${orientationText}, ${cleaned} ${arFlag}`.trim();
}

// ============================================================================
// ORIGINAL STORY GENERATOR (Toggle OFF)
// 100% pure original workflow: natural beat pacing, unforced narrative rhythm,
// intact prompt details, and zero viral-hook or beat-subdivision interference.
// ============================================================================
export async function generateOriginalStory(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void
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

  // Long-form 16:9 landscape text-to-image is routed to the 5-stage Grounded Pipeline
  if (isLongForm && !isVideoMode) {
    return executeGroundedPipeline(req, apiKey, userSignal, onStatusMessage);
  }

  let durationInstruction = '';
  if (isVideoMode) {
    durationInstruction = `Generation mode is Text to Video. Target single video clip duration is strictly ${targetVideoDuration} seconds per scene. Partition the user's EXACT script words cleanly across clips without adding or expanding narration. Each scene's master "videoPrompt" MUST state Duration: ${targetVideoDuration} seconds.`;
  } else if (durationMode === 'automatic') {
    durationInstruction = `Duration mode is Automatic. Break the user's EXACT narration text into natural visual scenes without adding, rewriting, or expanding any spoken words (20 input words = 20 spoken words total). Estimate realistic spoken timing (~2.2 words/sec) and calculate totalDurationSeconds accurately from the user's actual word count.`;
  } else if (durationSeconds && durationSeconds > 0) {
    durationInstruction = `User selected duration reference: ${durationSeconds} seconds (${isLongForm ? Math.round(durationSeconds / 60) + ' minutes' : durationSeconds + ' seconds'}). STILL keep the user's input narration verbatim without padding extra sentences or inventing filler dialogue; distribute visual pacing across the user's exact words.`;
  } else {
    durationInstruction = `Break the user's EXACT narration words into natural visual scenes without expanding or inventing extra narration.`;
  }

  const systemPrompt = isVideoMode
    ? `You are an expert film director, cinematographer, and AI video prompt engineer.
Your task is to convert the user's EXACT script into a production-ready, scene-by-scene video generation breakdown with cinematic video prompts, smart video shot beats, style profile, and visual continuity sheets.

STRICT VERBATIM SCRIPT LOCK (ZERO EXPANSION / ZERO REWRITING):
- Standard Mode is active (Enhance Story is OFF). Treat the user's input as the FINAL spoken voiceover script, NEVER as an idea to expand.
- NEVER add new sentences, extra exposition, invented twists, or filler narration. Joining every scene's "narratorLine" from Scene 1 to Scene N MUST reproduce 100% of the user's input words verbatim in exact sequence (for example, 20 input words = 20 total spoken words across narratorLine and beats[].textSpan).
- If the script is short (e.g. 20 words), output a tight 1-to-3 scene storyboard matching those exact 20 words. Put all rich visual expansion inside "videoPrompt" and "imagePrompt", NEVER inside "narratorLine".

CLAUSE & MICRO-ACTION BEAT SEGMENTATION RULES (CRITICAL):
1. Grammar is NOT equal to Scene: Never force an entire long sentence with multiple actions into a single 4-second clip.
2. Commas, Clauses & Item Lists MUST Form Distinct Beats:
   - When a sentence contains commas separating distinct actions, items, transactions, or emotional pivots (e.g. "spending $15 on lunch, $6 on coffee, $4 on bus fare, and a few other small purchases"), EACH distinct item or clause MUST be its own distinct visual beat!
   - NEVER substitute or invent a different currency symbol: if the script says "dollars" or "$", strictly show "$" (NEVER output "₱" or foreign symbols unless the input script itself uses them).
   - Contrasting conjunctions and pivots MUST trigger separate visual beats! Never visualize isolated half-sentence fragments (e.g. the split word "Margins.") as literal bold text printed on a contract page.
3. Dynamic Scene Grouping for ${targetVideoDuration}-Second Clips:
   - Each Scene represents ONE continuous video clip of strictly ${targetVideoDuration} seconds.
   - Spoken Word Budget (~2.2 words/second): keep each scene's "narratorLine" concise (~${Math.max(6, Math.round(targetVideoDuration * 2.3))} words max, roughly <= 10-12 words for a 4-5s clip) so voiceover completes naturally within ${targetVideoDuration}s.
   - Each Scene contains ${targetVideoDuration <= 5 ? '2 to 3' : '3 to 4'} cohesive micro-beats whose "estimatedSeconds" precisely add up to ${targetVideoDuration}.0s (e.g., for 4s: 2.0s + 2.0s, or 1.4s + 1.3s + 1.3s).
   - If a sentence has >${Math.max(10, Math.round(targetVideoDuration * 2.5))} words or 4-6+ distinct visual cuts, DO NOT squeeze them all into one ${targetVideoDuration}s clip! Spill them across multiple successive ${targetVideoDuration}-second scenes.
4. MANDATORY CINEMATOGRAPHY & SHOT DIVERSITY (STRICT BAN ON REPETITIVE MEDIUM SHOTS):
   - You are STRICTLY FORBIDDEN from using "medium shot, eye-level" across consecutive beats!
   - You MUST vary the camera framing dynamically between beats:
     * Macro / Extreme Close-Up: On banknotes, tapping coins, coffee cup, contract clause.
     * Point-of-View (POV) & Over-the-Shoulder: Looking down into an empty leather wallet, across a counter, or over a shoulder.
     * High-Angle / Low-Angle Hero: Low angle when confident; high-angle looking down when depleted.
     * Wide Establishing: When showcasing setting or contrasting visual scale.
     * Close-Up / Reaction: Facial expression shifts (hopeful eyes, subtle brow furrow, realization).

5. LITERAL VISUAL KINEMATICS & TRANSFORMATION RULE (CRITICAL - SHOW, DO NOT JUST TELL):
   - When the narration verbs describe physical or metaphorical actions, loss, or transformations (e.g. "disappears", "vanishes", "dissolves", "melts", "drains away", "bursts", "transforms into"), the AI visual prompt MUST LITERALLY SHOW THAT ACTION HAPPENING TO THE OBJECT!
   - Respect physical story stakes and grounded materials: a clay or paper diorama uses physical tearing, sliding, stamping, or removing papers rather than magical glowing lasers or levitating papers (unless the story itself is fantasy/sci-fi).
   - In subsequent scenes, respect physical state: an empty hand stays empty, an empty wallet stays hollow.

6. Clean, Focused Prompts (NO REDUNDANT BOILERPLATE REPETITIONS):
   - In each beat's "imagePrompt", describe the precise visual moment, camera framing, subject pose, and action directly.
   - DO NOT copy-paste the entire character sheet paragraph three times inside the same prompt, and DO NOT append inline "9:16 vertical" or duplicate "Visual Style:" tags.

7. No Empty Text Spans:
   - Every single beat's "textSpan" MUST contain the exact spoken phrase/words from that moment in the story. Empty strings ("") or phantom beats are strictly forbidden.

   - PARALLEL ACTION-TRIPLET & SEMANTIC MONTAGE (VIDEO BEATS): If narration combines a semantic-anchor origin flashback AND an action triplet (e.g., "It's an entity that has studied you since birth, perfectly mimicking every blink, every breath, every move." = 17 words / ~7.4s), DO NOT cram 5-6 cuts into one ${targetVideoDuration}s clip: spill across TWO sequential ${targetVideoDuration}-second scenes with 2-3 cohesive sub-beats per clip summing to ${targetVideoDuration}.0s, distinct shot scale, and locked wardrobe consistency (infant wears crib blankets only, zero adult wardrobe). Also split repeated negations and lag/smile climax turns cleanly without spoiling later twists early.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium or cinematic style adapting to: "${characterStyle || 'cinematic hyperrealism'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality (e.g., golden hour rim light, misty neon glow, or soft lantern ambience)
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor (e.g. "Shot on 35mm anamorphic prime lens, subtle 35mm Kodak 5219 film grain, high dynamic range")

2. Continuity Sheets & Locked Wardrobe Token (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping EVERY recurring human character, secondary role/antagonist (e.g. both "Homeowner" AND "Bank Lender" / "Bank Clerk" if a lender or bank appears), AND recurring non-human entity/creature to ONE fixed, highly detailed visual description resolving face, hair, skin, eyewear (e.g. glasses/spectacles), and locked outfit/footwear WITHOUT any transient facial expressions (never write "neutral facial features", "eyes wide", "smiling", "horrified", or "neutral expression") and WITHOUT temporary poses or stance sentences ("Stance is natural..."). Keep infant/childhood flashback beats free of adult clothing!
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once to ONE fixed, highly detailed visual description. Use readable human keys ("Dim Bedroom") rather than smashed code variables, and always describe locations in natural prose inside prompts.

3. Character and Setting Continuity (STRICT BAN ON "MATCHING ESTABLISHED LOOK"):
   - DOWNSTREAM DIFFUSION MODELS (KLING, RUNWAY, SORA, FLUX, MIDJOURNEY) HAVE ZERO MEMORY BETWEEN CLIPS!
   - You are STRICTLY FORBIDDEN from writing shortcut phrases like "(matching established look from Scene 1)" or "(matching established look)"! That causes models to hallucinate random new clothes.
   - In EVERY scene's "videoPrompt", "startFramePrompt", and every beat's "imagePrompt" where the character appears, you MUST EXPLICITLY state their locked visual identity, eyewear, and exact clothing. NEVER allow the outfit to change without story reason!

4. Mandatory Master Scene "videoPrompt" Structure:
   For EACH scene, construct "videoPrompt" adhering strictly to these components:
   - subject: Explicit character description with locked outfit layers (e.g. "Kael, Filipino male in his 20s with angular jaw and dark textured hair, wearing plain crewneck white cotton t-shirt and blue slippers").
   - action: described in temporal order across the shot with FULL ANATOMICAL, BIOMECHANICAL & KINEMATIC SPECIFICITY:
     * LIMB PROPORTIONS & ACCURACY: Limbs must strictly maintain accurate human anatomical scale.
     * GROUNDED STANCE & FEET: Explicitly describe natural foot contact and gravity (e.g. "both boots planted shoulder-width on uneven stone, leaning slightly into the forward stride"). STRICT BAN ON FLOATING OR WEIGHTLESS FEET.
     * TORSO & POSTURE DYNAMICS: Describe natural shoulder and hip engagement (e.g. "shoulders squared and leaning slightly forward in athletic readiness"). STRICT BAN ON STIFF WOODEN MANNEQUIN POSES OR ROBOTIC DEGREE MATH.
     * HAND & GRIP ACTION: Describe natural finger grip and hand tension (e.g. "hands gripping the forend and pistol grip with firm knuckle tension").
     * GAZE & FACING DIRECTION: Precise head turn and eye gaze vector (e.g. "chin level, sharp eye gaze fixed downrange").
     * NEVER write numeric percentages or degree angles (e.g. NEVER write "70% weight", "15 degrees", "25 degrees"). Use natural descriptive language only!
     * MAIN VS. SIDE CHARACTER COMPOSITION: When multiple characters appear, main character commands the primary visual third with dominant eye-lead; side character occupies the secondary plane.
     * KINETIC PROGRESSION & VELOCITY TEMPO: Explicit velocity and progression tempo (e.g. "Velocity: measured slow-burn deliberate movement transitioning into a sudden sharp pivot").
   - camera: exactly ONE shot type, exactly ONE camera angle, and exactly ONE movement (e.g., "Medium shot, low-angle, slow forward push-in").
   - optics: explicit lens focal length and depth of field (e.g. "50mm anamorphic prime lens, shallow depth of field f/2.0 with creamy circular bokeh").
   - lighting: emotional lighting Kelvin temperature and contrast curve (e.g. "3200K warm tungsten key light with soft 5600K cool ambient fill and high-contrast rim light along jawline").
   - style: styleProfile artStyle plus film stock descriptor.
   - physics & environment: concrete physical and environmental dynamics (e.g. "powdery snow clinging to rough bark, breath vapor drifting in cold air, ripples expanding outward").
   - audio: concrete sound design cues (e.g. "Audio: muffled footsteps on concrete, coins clinking in palm, no dialogue, ambient foley only").
   - duration: in seconds matching ${targetVideoDuration} seconds.

5. Single Visual Focus & Distinct Beat Progression (NO CONFUSED HYBRIDS):
   Every beat MUST focus on exactly ONE clear visual subject or action, and EVERY beat MUST present a distinct visual progression that its neighbor does NOT.
   - NO CONFUSED HYBRIDS: NEVER combine two competing framing requests into a single beat (e.g. DO NOT write one prompt trying to frame a close-up on an object AND a character's reaction in the same image). Split into Beat A (close-up on object) and Beat B (character reaction).
   - EVERY BEAT MUST BE VISUALLY DISTINCT: Each beat must show something its neighbor does not (a different focal detail, framing distance, moment in the action, or emotional shift in pose/expression).
   - STRICT SHOT TYPE & PROSE ALIGNMENT (TIGHT SHOTS): When a beat's shotType is close-up, macro, extreme-close-up, or detail shot, its prompt prose MUST actually describe that tight framing and specific focal detail.

6. Grounded Story Constraint & Anti-Hallucination Engine:
   - ZERO UNSTATED INVENTIONS: Strictly forbid hallucinating phantom characters, arbitrary weapons, fictional sci-fi glowing lines, magic glowing paper, dissolving light particles, or unprompted plot twists in grounded/physical/clay/diorama stories unless the script explicitly describes fantasy/sci-fi.
   - CURRENCY FIDELITY: Match the currency spoken in the user script verbatim (e.g., "$" for dollars; NEVER emit "₱" unless "₱" appears in the user's input script).
   - CONCRETE NOUNS ONLY: Every noun must be a tangible, real-world object. Never write vague disjunctive placeholders ("holding something like a bag or a book").
   - NARRATIVE FAITHFULNESS: Do NOT invent fictitious specific story facts, character names, senders, or plot details not present in the narration or already locked in continuity sheets.

8. VISUAL INFORMATION BUDGET & REVEAL DISCIPLINE (STRICT NO-LEAKAGE RULE):
   - In multi-beat sentences (e.g. "If you pour tea into a harbor, something terrifying happens"):
     * SETUP BEAT (e.g. "If you pour tea"): Depict ONLY the immediate origin action (the teapot tilting, tea ribbon pouring downward). MUST STRICTLY WITHHOLD the destination! Show NO harbor, NO water surface, NO ships, NO ocean. The liquid descends beyond the lower frame edge into darkness.
     * REVEAL BEAT (e.g. "into a harbor"): This is the FIRST beat allowed to introduce the harbor, piers, anchored ships, and the tea stream striking the water surface. MUST WITHHOLD the subsequent terrifying reaction/escalation.
     * ESCALATION BEAT (e.g. "something terrifying happens"): Now introduces the dramatic consequence or tension through lighting, stillness, or ominous visual changes. Do NOT invent unrelated monsters or premature spoilers.
   - NEVER leak a future beat's location, destination, or outcome into an earlier beat!

9. CASTING & STYLE DECOUPLING:
   - When a scene or beat has NO characters (e.g. empty harbor, still life of an object, pure close-up on a brass lock or contract page), NEVER write characters or humans into the prompt.

10. GEOGRAPHIC DEMONYM & CARTOGRAPHIC ANCHOR RULE (DOCUMENTARY / REAL-WORLD CALLOUTS ONLY):
    - Whenever a real-world country, nationality/demonym (e.g. "Swedish", "British", "French", "German", "Japanese", "American", "in France", "in Sweden") appears as a geographic callout in documentary/historical narration, that entity forms its own standalone micro-beat (e.g. Beat 1: "In 1896", Beat 2: "Swedish", Beat 3: "scientist Svante Arrhenius").
    - DO NOT apply this tabletop map rule to fictionalized or hyphenated world settings (e.g. "Neo-Seoul", "Cyber-Tokyo") or when Scene 1 Beat 1 opens on a main character in action. Keep fictional world beats grounded inside the story environment with characters visible!
    - When triggered for a real-world documentary geographic beat, focus on a tactile 2.5D topographic map or vintage terrestrial globe with glowing borders, a dropped location pin, and the national flag (NO humans in frame).

11. Unified Stylistic Register (CONSISTENT ART MEDIUM VOCABULARY):
    When a specific art style or medium is requested, apply that art style's specific descriptive vocabulary consistently across ALL parts of the prompt.

11. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS:
    NEVER use a real, identifiable person's actual proper name in visual prompts.

12. OPENING BEAT VISUAL HOOK RULE (SCENE 1, BEAT 1):
    Scene 1 Beat 1 MUST show something concrete and visually arresting: the main character, a striking action already in motion, or the single most compelling visual element.

13. TEMPORAL ANCHOR & ON-SCREEN DATE/YEAR DISPLAY RULE (SINGLE BEAT ONLY):
    If the narrator line or beat phrase mentions a date, year, or elapsed duration, populate "temporalAnchor" on that single beat ONLY.

11. Start Frame Ingredients (Text to Image Prompt):
    For each scene, provide "startFramePrompt": a pristine text-to-image prompt to generate the initial reference keyframe image formatted as:
    [Shot framing and angle] of [Subject with exact character details and locked outfit], [Initial frame pose with grounded stance and gaze] in [Setting/Location Details], [3200K/5600K Lighting & Color palette], 50mm f/2.0 lens, ${defaultAspectRatio}, ${characterStyle || 'cinematic rendering'}.

12. Smart Video Beats Array ("beats"):
    For each scene, provide an array of video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
    Each beat MUST contain:
    - "beatIndex": integer (1, 2, 3...)
    - "textSpan": specific phrase or spoken clause from the narrator line. Every beat MUST correspond to actual spoken words from the narrator line. NO EMPTY STRINGS ("").
    - "estimatedSeconds": estimated duration in seconds for this beat, distributed so the sum of all beats in the scene equals approximately ${targetVideoDuration} seconds.
    - "shotType": explicit cinematography shot size or transition shot
    - "cameraAngle": explicit camera angle
    - "cameraMovement": cinematic camera motion cue
    - "temporalAnchor": optional string for explicit year, date, or elapsed duration
    - "imagePrompt": concise, standalone video beat prompt (35 to 65 words). MUST open directly with ONE shot size matching "shotType" and ONE camera angle matching "cameraAngle" (never mix "Close-up" and "extreme-close-up" in the same prompt), include [Subject with locked outfit] performing [concrete action], Optics, Lighting, Audio: [Ambient sound/foley, no dialogue]. DO NOT include inline aspect ratios ("9:16 vertical") or duplicate "Visual Style:" tags.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS.
4. CRITICAL COMPLETENESS: Include EVERY SINGLE WORD of the user's input script from first word to last word across "scenes[]". NEVER stop early.
5. You MUST respond with ONLY a valid JSON object matching this schema:
{
  "styleProfile": {
    "artStyle": "...",
    "colorPalette": "...",
    "lighting": "...",
    "eraAndSetting": "...",
    "lensAndFilmStock": "Shot on 35mm anamorphic lens, fine film grain..."
  },
  "characterSheet": {
    "Lead Software Engineer": "Detailed visual description with all physical attributes resolved (use spaced human names or roles, never smashed CamelCase)..."
  },
  "locationSheet": {
    "NASA Instrumentation Office": "Detailed visual description of the specific recurring location (use spaced readable names)..."
  },
  "thumbnail": {
    "heroMoment": "one line describing peak conflict/turning point of THIS story",
    "expression": "intense, emotionally charged facial expression",
    "bgDescription": "dark, simplified high-contrast background with deep separation matching THIS story",
    "accentColor": "dramatic rim lighting color matching Story Palette",
    "hookText": "bold 2 to 4 word curiosity headline in ALL CAPS specific to THIS story",
    "fontStyle": "story-adapted typography style fitting the medium and genre",
    "alternateHooks": ["ALT HOOK 1", "ALT HOOK 2"]
  },
  "totalDurationSeconds": number,
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "videoPrompt": "Subject: ... Action: ... Camera: [Shot Type], [Camera Angle], [Camera Movement]. Optics: ... Lighting: ... Style: ... Physics: ... Audio: no dialogue, ambient sound only. Duration: ${targetVideoDuration} seconds.",
      "startFramePrompt": "Text to image prompt for initial keyframe...",
      "establishedCharacters": ["Name"],
      "establishedSettings": ["Setting"],
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "estimatedSeconds": number,
          "shotType": "Extreme Wide Shot | Wide Establishing Shot | Medium Shot | Medium Close-Up | Close-Up | Extreme Close-Up | Over-the-Shoulder (OTS) | Point-of-View (POV) | Whip-Pan",
          "cameraAngle": "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow forward push-in | Static Frame | Tracking Subject | Smooth Pan | Whip-Pan",
          "temporalAnchor": "string (optional: e.g. 1945, December 24, 1971, for 29 years)",
          "imagePrompt": string
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just raw JSON.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to convert the user's EXACT script into a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, a style profile, and visual continuity sheets.

STRICT VERBATIM SCRIPT LOCK (ZERO EXPANSION / ZERO REWRITING):
- Standard Mode is active (Enhance Story is OFF). Treat the user's input as the FINAL spoken voiceover script, NEVER as an idea to expand or embellish.
- NEVER add new sentences, invented exposition, plot extensions, or filler narration. Joining every scene's "narratorLine" from Scene 1 to Scene N MUST reproduce 100% of the user's input words verbatim in exact sequence (e.g. 20 input words = 20 total spoken words across narratorLine and beats[].textSpan).
- Put all cinematic visual expansion strictly inside "imagePrompt", NEVER inside "narratorLine".

CLAUSE & MICRO-ACTION BEAT SEGMENTATION RULES (CRITICAL):
1. Do NOT make a boring 1-sentence = 1-image breakdown! A long sentence with multiple items, actions, or psychological turns MUST be broken into granular, rhythmic visual beats.
2. VISUAL EVENT INVARIANT & KINEMATIC ACTION PROGRESSION (CRITICAL):
   A VISUAL BEAT IS NOT MERELY A TEXT FRAGMENT. A VISUAL BEAT IS ONE PHYSICAL MOMENT IN A CONTINUOUS ACTION CHAIN.
   - Do NOT generate separate image prompts for sub-clauses that describe the exact same physical event! For example, "Pinakita niya sa akin ang phone na ring nang ring" should NOT produce 4 identical phone prompts. It should advance through a sequence of distinct actions or state transitions:
     * Beat A: Hand reaching and opening the door
     * Beat B: POV through door crack revealing the pale mother in the hallway
     * Beat C: Mother extending the phone forward (screen dark)
     * Beat D: Student hands taking and gripping the phone
     * Beat E: Phone screen illuminating amber with incoming call alert
     * Beat F: Macro insert of phone casing and speaker vibrating with visible physical distortion
   - Every beat in a scene MUST change at least one of:
     1) PHYSICAL STATE of an object or environment (e.g. door closed -> cracked -> open; screen dark -> backlit -> caller ID).
     2) POSSESSION / CONTACT (e.g. phone in mother's hands -> extended -> taken by student).
     3) CAMERA PERSPECTIVE (e.g. wide establishing -> over-the-shoulder -> POV -> macro insert -> reaction close-up).
     4) CHARACTER ACTION (e.g. reaching -> turning -> extending -> receiving -> reacting).
   - STRICT BAN ON REPETITIVE PROMPTS: Never describe the same frozen action across consecutive beats! If a spoken fragment merely finishes a sentence without introducing a new physical event, sustain the shot or combine the sub-words into a single coherent visual beat.
3. Dynamic Visual-Event Pacing (~1.5s to 3.0s default) + Selective Rapid Montage (~0.7s to 1.2s):
   - BASELINE PACING (~1.5s to 3.0s per beat): Cut to a new beat when a genuine physical action, object state transition, perspective shift, reaction, or reveal occurs. NEVER isolate plain grammar connectors ("But he has one problem:", "target for kings", "him live.") into stub beats.
   - EXCEPTION A - PARALLEL ACTION-TRIPLET / LIST MONTAGE (~0.7s to 1.2s per beat, regardless of total word count): Whenever narration lists 2-3+ serialized actions or sensory beats (e.g. "perfectly mimicking every blink, every breath, every move."), split EVERY item into its own rapid cut with a RADICALLY DIFFERENT shot scale and focal noun so diffusion prompts stay distinct:
     * Beat 1 ("perfectly mimicking every blink,"): Extreme Close-Up macro on half-shut eyelids in exact 1:1 frozen mirror symmetry (no full room).
     * Beat 2 ("every breath,"): Extreme Close-Up macro on faint frozen condensation breath mist blooming on cold mirror glass beside parted lips in 1:1 synchrony.
     * Beat 3 ("every move."): Medium Shot framing raised hand and tilted shoulder posture mirrored 1:1 with neutral unsmiling symmetry.
   - EXCEPTION B - SEMANTIC-ANCHOR & TEMPORAL-ORIGIN FLASHBACK DECOMPOSITION (~0.8s to 1.3s per beat): Whenever a short 7-14 word clause packs Subject Reveal + Observation Verb + Childhood/Birth Origin (e.g. "It's an entity that has studied you since birth,"), split into associative visual cuts:
     * Beat 1 ("It's an entity"): Medium Close-Up showcasing the unsmiling stylized entity silhouette clearly.
     * Beat 2 ("that has studied"): Over-the-Shoulder or deep-shadow frame showing the protagonist facing forward completely unaware in crisp foreground focus while the unsmiling entity looms behind in shadow watching (NEVER fuse heads or make protagonist already look back).
     * Beat 3 ("you since birth,"): Time-origin flashback showing the INFANT protagonist swaddled INSIDE a wooden nursery crib while the shadowy entity lurks/hides behind the crib slats in deep shadow watching. NEVER inject adult turtleneck/jeans onto the baby, NEVER reuse the adult bedroom, and NEVER etch dates onto mirrors!
   - EXCEPTION C - REPEATED NEGATIONS & CLIMAX TURNS (~0.8s to 1.5s per beat): Split repeated rhetorical negatives ("You never reach out." hands motionless at sides -> "You never cross." feet halted back from glass threshold) and separate late twist beats cleanly ("half-second late." protagonist turning while neutral reflection lags -> "Now it's smiling." Extreme Close-Up on unnatural grin -> "And you never smiled." Close-Up on protagonist's stone-still unsmiling mouth).
   - 100% SPOKEN NARRATION INVARIANT: Every single word in each scene's "narratorLine" MUST appear in exact sequential order across its "beats[].textSpan". Never drop or truncate trailing clauses!
   - SYNCHRONIZED SHOT METADATA & OPENING: Ensure each beat's "shotType" and "cameraAngle" match the exact framing described at the start of "imagePrompt" 1-for-1.
   - CHRONOLOGICAL ERA & LOCATION LOCK: Once a scene transitions into a new historical period or location, strictly maintain that era/environment across subsequent beats (except explicit infancy/childhood flashbacks, which shift to a nursery/childhood space).
4. LITERAL VISUAL KINEMATICS & TRANSFORMATION RULE (CRITICAL - SHOW, DO NOT JUST TELL):
   - When the narration verbs describe physical or metaphorical actions, loss, or transformations (e.g. "disappears", "vanishes", "dissolves", "melts", "drains away", "bursts", "transforms into"), the AI visual prompt MUST LITERALLY SHOW THAT ACTION HAPPENING TO THE OBJECT!
   - NEVER be lazy! If the narration says "₱1,000 disappears", DO NOT show the character still holding a crumpled banknote. Show the banknote literally dissolving into thin air or vanishing from an open palm, leaving fingers clutching empty space!
5. No Empty Text Spans:
   - Every single beat's "textSpan" MUST contain the exact spoken phrase/words from that moment in the story. Never output empty strings ("").

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium, rendering technique, or illustration style adapting to the story's genre, tone, and character style input: "${characterStyle || 'consistent visual style'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop of the story
   - "lensAndFilmStock": lens and film stock descriptor (e.g. "Shot on 35mm prime lens, fine film grain")

2. Continuity Sheets & Compact Locked Character Identity in Every Character Beat:
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping EVERY recurring human character AND recurring non-human entity/mimic/creature to ONE fixed, clear visual description resolving face, silhouette, hair, skin, and locked outfit/footwear:
     * STRICT PURITY RULE (NO EXPRESSIONS, NO FROZEN POSES, NO CONTRADICTORY FOOTWEAR): The characterSheet MUST ONLY describe permanent physical traits, entity silhouette, and wardrobe (e.g. hair cut, facial structure, sleepwear, barefoot vs boots). NEVER include transient facial expressions ("eyes wide", "neutral expression", "smiling", "horrified", "mouth open"), temporary poses, or inconsistent footwear.
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once to ONE fixed, detailed visual description. NEVER leak raw CamelCase variable tokens like "DarkRoom" or "Protagonist" inside imagePrompt prose; write descriptive English ("cramped dimly lit bedroom", "the protagonist").
   CRITICAL CONTINUITY RULE (COMPACT LOCKED IDENTITY IN EVERY CHARACTER BEAT):
   - Downstream image diffusion models have NO memory between frames.
   - NEVER write "(matching established look from Scene 1)" or "(matching established look)".
   - In EVERY beat's imagePrompt where the adult character or entity appears (even when referenced by pronoun "he/she"), weave a concise 14-18 word visual anchor of their locked face, hair, and key outfit directly into the action so every frame renders the same character consistently without bloating the prompt. EXCEPTION: For infancy/childhood flashback beats (e.g. baby in crib), NEVER inject adult clothing or bedroom traits onto the infant!

3. Grounded Physical Posture & Natural Gestures (NO DEGREE OR PERCENTAGE MATH):
   When characters appear in imagePrompt:
   - LIMB PROPORTIONS: Arms, legs, and torso must maintain natural human or stylized scale.
   - GROUNDED STANCE & FEET: Describe natural foot contact and gravity matching locked footwear (if wearing boots: "both boots planted firmly"; if barefoot per characterSheet: "bare feet pressed flat against cold floorboards"). STRICT BAN ON FLOATING FEET OR FOOTWEAR CONTRADICTIONS.
   - POSTURE & HAND ACTION: Describe natural shoulder engagement, hand grip, and facial expression using concrete physical language matching the beat's exact chronological emotion.
   - STRICTLY FORBIDDEN: NEVER write degree angles ("15 degrees", "25 degrees") or weight percentages ("70% weight") in visual prompts.
   - HEAD & GAZE VECTOR: Explicitly state head orientation and eye focus.

4. Atmospheric Micro-Environment, Tactile Physics & Style-Locked Lighting:
   Describe tangible physical interactions between characters/objects and the environment:
   - PARTICLES & WEATHER: Tangible atmosphere details (dust motes, dampness, condensation, wood grain).
   - LIGHTING & MONOCHROME STYLE LOCK (CRITICAL):
     * For color stories, specify Kelvin color temperature and contrast curve (e.g. "3200K warm tungsten key with 5400K rim").
     * STRICT MONOCHROME / BLACK-AND-WHITE RULE: Whenever the story's artStyle or colorPalette specifies pure black-and-white, monochrome, noir ink, or manga ("no gray gradients", "Junji Ito ink", "black and white"), you are STRICTLY FORBIDDEN from outputting chromatic Kelvin values ("3200K warm", "cold 5400K") or colors ("cold cyan", "amber", "golden"). Describe lighting strictly via stark high-contrast chiaroscuro, harsh directional shadows, and white-edge highlights!

5. Cinematic Optics & Lens Prescriptions (IMAGE MODE = ZERO MOTION LANGUAGE):
   Specify ONE focal length and aperture in every beat prompt (e.g. "Shot on 85mm f/1.4 portrait prime with shallow depth of field"). NEVER repeat the focal length ("35mm 35mm"). In Text-to-Image mode, NEVER write video camera movement prose ("tracking left to reveal", "tracking upward", "panning across"); represent blinks/breaths/moves as crisp frozen static instants (half-closed eyelids, frozen breath mist on cold glass, parallel shoulder posture).

6. STRICT BAN ON AUDIO / SOUND CUES & PHANTOM TEXT IN IMAGE PROMPTS:
   Diffusion image models generate static visuals and CANNOT render sound. DO NOT write audio cues or sound phrases like "listening to an unseen whisper", "hearing a sound", or ambient foley. Also NEVER invent unstated etched date timelines or floating text on mirrors/walls unless explicitly spoken in narration.

7. Grounded Story Constraint, Chronological Twist Protection & Negation Discipline:
   - CHRONOLOGICAL TWIST PROTECTION: Never spoil a late plot reveal in earlier scenes! For example, if a horror twist in a late scene reveals *"Now it's smiling"*, ALL earlier scenes (including *"It's an entity"*, *"that has studied"*, and *"you since birth"*) MUST show a blank, unblinking, or unsmiling entity: NEVER depict grinning or smiling early! If an early scene states a reflection is *"perfectly mimicking"*, show exact 1:1 zero-delay synchrony on blink, breath, and move, NEVER premature lag before the final lag beat!
   - NEGATION FIDELITY: If narration says *"You never reach out"* or *"don't touch it"*, depict the character with hands kept still at their sides or clasped away from the object: NEVER touching or pressing palms against the glass.
   - CONCRETE NOUNS & SINGLE VISUAL FOCUS PER BEAT: Every noun must be tangible. One clear visual focus per beat.
   - STRICT SHOT TYPE vs CAMERA ANGLE SEPARATION:
     * "shotType" captures FRAMING/PERSPECTIVE: "Extreme Wide Shot | Wide Establishing Shot | Medium Shot | Medium Close-Up | Close-Up | Extreme Close-Up | Over-the-Shoulder (OTS) | Point-of-View (POV) | Whip-Pan".
     * "cameraAngle" captures STRICTLY vertical/tilt camera angle: "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt". NEVER put "over-the-shoulder" or "pov" in cameraAngle! And keep beat shotType synchronized 1-for-1 with the opening words of imagePrompt.

8. High-Density Visual Prompts (MANDATORY 75-110 WORDS PER BEAT, NEVER FRUGAL):
   - Every visual beat MUST be rich, textured, and deeply descriptive (target 75 to 110 descriptive words per beat). Never write frugal, minimal, or brief prompts.
   - Weave in the 5 required cinematic layers:
     1) Exact framing, camera angle, and camera motion.
     2) Grounded subject biomechanics, posture, facial micro-expressions, garment fabric folds, and tactile physical interaction.
     3) Environmental depth, tactile textures (surfaces, particles, dust, moisture, ground elements).
     4) Atmospheric lighting Kelvin, directional shadow falloff, and rim light contrast.
     5) Precise optical lens prescription (focal length in mm, aperture) and aspect ratio flag.
   - DO NOT copy-paste the entire character sheet paragraph multiple times within the prompt. Weave locked traits directly into the scene action.

9. "THE DIFFERENCE" & COUNTERFACTUAL JUXTAPOSITION RULE (STRICT NO-DUPLICATION BEAT PROGRESSION):
   - When the story presents a hypothetical, comparative, or "what if" premise (e.g. "What would happen if...", "Instead of X, Y...", "The ecosystems of Earth would have evolved completely differently..."):
     * BASELINE BEAT ("What would happen", "The ecosystems of Earth would"): Visually depict the KNOWN BASELINE REALITY (e.g., familiar modern Earth, temperate recognizable biosphere, bustling human civilization).
     * DIVERGENCE / WHAT-IF PIVOT BEAT ("if the meteor never hit", "have evolved completely differently"): Visually cut to the STARK ALTERNATE REALITY with a new camera angle and distinct thematic contrast (e.g., the meteor missing Earth into vast deep space, or towering colossal mega-flora and apex predatory dinosaurs dominating the wild terrain).
     * CONSEQUENCE BEATS ("preventing humans from ever becoming the dominant species"): Focus exclusively on the aftermath (e.g., small, cloaked human scavengers huddled in fortified stone cliff crevices, watching dinosaur shadows).
   - NEVER repeat or duplicate the previous beat's imagePrompt! Every beat MUST represent a new stage, a different subject perspective, or an evolving dramatic reaction.

10. VISUAL INFORMATION BUDGET & REVEAL DISCIPLINE (STRICT NO-LEAKAGE RULE):
   In multi-beat sentences (e.g. "If you pour tea into a harbor, something terrifying happens"):
   - SETUP BEATS (e.g. "If you pour tea"): Depict ONLY the immediate origin action (the teapot tilting, tea ribbon descending into darkness). MUST STRICTLY WITHHOLD the destination! Show NO harbor, NO water, NO ocean, NO ships.
   - REVEAL BEATS (e.g. "into a harbor"): This is the FIRST beat allowed to introduce the harbor setting, ships, piers, and the tea stream striking the water surface.
   - ESCALATION BEATS (e.g. "something terrifying happens"): Now introduces the dramatic consequence or tension through lighting, stillness, or ominous visual changes. Do NOT invent unrelated monsters or premature spoilers.
   - NEVER leak a future beat's location, destination, or outcome into an earlier beat!

11. STYLE AND CASTING COMPATIBILITY:
   - If a scene or beat has NO characters (e.g. empty harbor, still life object), do NOT include character or animal mascot requirements in the visual prompt (e.g. do not write "with exaggerated stretchy animal characters" if the scene is an empty environment).

   - VISIBLE CONTENT & NAMED-OBJECT FIDELITY: When narration explicitly states that a photograph, print, newspaper, headline board, screen, or letter "shows", "displays", or "reveals" something, depict the visible front surface clearly showing all stated elements. NEVER turn the photo face-down to hide what narration says it shows, and depict EVERY named object listed in that beat's clause.

12. GEOGRAPHIC DEMONYM & CARTOGRAPHIC ANCHOR RULE (DOCUMENTARY / REAL-WORLD CALLOUTS ONLY):
   - Whenever a real-world country, nationality/demonym (e.g. "Swedish", "British", "French", "German", "Japanese", "American", "in France", "in Sweden") appears as a geographic callout in documentary/historical narration, that entity forms its own standalone micro-beat (e.g. Beat 1: "In 1896", Beat 2: "Swedish", Beat 3: "scientist Svante Arrhenius").
   - DO NOT apply this tabletop map rule to fictionalized or hyphenated world settings (e.g. "Neo-Seoul", "Cyber-Tokyo") or when Scene 1 Beat 1 opens on a main character in action. Keep fictional world beats grounded inside the story environment with characters visible!
   - When triggered for a real-world documentary geographic beat, focus on a tactile 2.5D topographic map or vintage terrestrial globe with glowing borders, a dropped location pin, and the national flag (NO humans in frame).

13. Nested Scenes and Beats:
   Break the story into a sequence of scenes with rich, dynamic visual beats.
   Each scene has index, narratorLine, estimatedSeconds, and beats array.

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
   CRITICAL ASPECT RATIO ENFORCEMENT: Every beat's imagePrompt MUST explicitly declare orientation ("${isLongForm ? 'Cinematic 16:9 widescreen composition' : 'Vertical 9:16 portrait composition'}") and end with the exact parameter flag "--ar ${isLongForm ? '16:9' : '9:16'}". Never generate landscape prompts for vertical formats!
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
    "Lead Software Engineer": "Fixed visual description with all physical attributes resolved (use spaced human names or roles, never smashed CamelCase)..."
  },
  "locationSheet": {
    "NASA Instrumentation Office": "Fixed visual description of the specific recurring location (use spaced readable names)..."
  },
  "thumbnail": {
    "heroMoment": "one line describing peak conflict/turning point",
    "expression": "intense, emotionally charged facial expression",
    "bgDescription": "dark, simplified high-contrast background with deep separation",
    "accentColor": "dramatic rim lighting color (e.g. amber, cold cyan, crimson - OR stark high-contrast white for black-and-white/monochrome styles)",
    "hookText": "bold 2 to 4 word headline in ALL CAPS (e.g. DAY 60: SURVIVED)",
    "fontStyle": "story-adapted font description (e.g. distressed weathered stencil sans-serif, chiseled gothic serif)",
    "alternateHooks": ["ALT HOOK 1", "ALT HOOK 2"]
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
          "shotType": "Extreme Wide Shot | Wide Establishing Shot | Medium Shot | Medium Close-Up | Close-Up | Extreme Close-Up | Over-the-Shoulder (OTS) | Point-of-View (POV) | Whip-Pan",
          "cameraAngle": "eye-level | high-angle | low-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow Push-In | Static Frame | Tracking Subject | Smooth Pan | Whip-Pan",
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
The user has explicitly segmented the story into exact scenes and custom visual beats. You MUST follow this exact scene breakdown and phrase assignment. For each beat, follow the user's specific visual guidance and shot suggestions:
${customScenes.map((cs, sIdx) => `Scene ${sIdx + 1} narration: "${cs.narratorLine}"
Beats:
${cs.beats.map((b, bIdx) => `  - Beat ${bIdx + 1} phrase: "${b.textSpan}"${b.userGuidance ? ` | Director's Visual Note: "${b.userGuidance}"` : ''}${b.shotType ? ` | Preferred Shot: "${b.shotType}"` : ''}`).join('\n')}`).join('\n\n')}`;
  }

  const userPrompt = `Exact Story / Voiceover Script (preserve every word verbatim, DO NOT expand):
${story}

Character Style Instruction:
${characterStyle || 'Consistent style specified by scene context.'}

Format: ${isLongForm ? 'Long form (16:9)' : 'Short form (9:16)'}
Platform: ${platform}
${durationInstruction}${customBeatsPrompt}`;

  const parsedData = await executeJsonLlmCall<any>({
    provider: req.aiProvider || 'gemini',
    apiKey,
    systemPrompt,
    userPrompt,
    modelQuality,
    groqModel: req.groqModel,
    userSignal,
    onStatusMessage,
    temperature: 0.3,
    topP: 0.85,
  });

  // Auto-continuation safeguard: if a long script truncated mid-JSON (especially in multi-scene Text to Video),
  // seamlessly generate the remaining uncovered script scenes reusing locked styleProfile & characterSheet.
  const canContinue =
    !isCustomBeats &&
    !userSignal?.aborted &&
    typeof apiKey === 'string' &&
    apiKey.trim().length > 10 &&
    !/^(?:mock|test|dummy|fake)/i.test(apiKey.trim());

  let scriptCoverage = findUncoveredTrailingScript(story, Array.isArray(parsedData.scenes) ? parsedData.scenes : []);
  let continuationAttempt = 0;

  while (
    canContinue &&
    scriptCoverage.missingWords >= 3 &&
    scriptCoverage.coverageRatio < 0.96 &&
    continuationAttempt < 2
  ) {
    continuationAttempt++;
    if (onStatusMessage) {
      onStatusMessage(
        `Completing remaining script scenes (${scriptCoverage.coveredWords}/${scriptCoverage.totalWords} words covered)...`
      );
    }

    try {
      const existingScenes = Array.isArray(parsedData.scenes) ? parsedData.scenes : [];
      const nextSceneIndex = existingScenes.length + 1;
      const lockedCastJson = JSON.stringify(parsedData.characterSheet || {});
      const lockedLocJson = JSON.stringify(parsedData.locationSheet || {});
      const lockedStyleJson = JSON.stringify(parsedData.styleProfile || {});
      const needThumb = !parsedData.thumbnail || !parsedData.thumbnail.hookText;

      const contUserPrompt = `CONTINUATION BATCH (DO NOT REPEAT ALREADY COVERED SCENES 1-${existingScenes.length}):
Already covered ending snippet: "...${existingScenes[existingScenes.length - 1]?.narratorLine || ''}"

LOCKED PRODUCTION BIBLE (MUST MAINTAIN 100% IDENTICAL VISUAL STYLE, CHARACTERS & LOCATIONS):
Style Profile: ${lockedStyleJson}
Character Sheet: ${lockedCastJson}
Location Sheet: ${lockedLocJson}

REMAINING UNCOVERED SCRIPT TO COMPLETE VERBATIM (starting cleanly at Scene ${nextSceneIndex}, covering EVERY remaining word to the very end):
${scriptCoverage.uncoveredText}

Character Style Instruction: ${characterStyle || 'Consistent style specified by scene context.'}
Format: ${isLongForm ? 'Long form (16:9)' : 'Short form (9:16)'}
Platform: ${platform}
${durationInstruction}

Return ONLY valid JSON containing:
- "characterSheet": {} (include any newly appearing recurring figures not yet listed above)
- "locationSheet": {} (include any newly appearing recurring places)
${needThumb ? '- "thumbnail": { "heroMoment": "...", "expression": "...", "bgDescription": "...", "accentColor": "...", "hookText": "...", "fontStyle": "...", "alternateHooks": ["..."] },\n' : ''}- "scenes": [ ...starting at index ${nextSceneIndex}... ]`;

      const contData = await executeJsonLlmCall<any>({
        provider: req.aiProvider || 'gemini',
        apiKey,
        systemPrompt,
        userPrompt: contUserPrompt,
        modelQuality,
        groqModel: req.groqModel,
        userSignal,
        onStatusMessage,
        temperature: 0.25,
        topP: 0.85,
      });

      const contScenes = Array.isArray(contData?.scenes) ? contData.scenes : [];
      if (contScenes.length === 0) break;

      if (!parsedData.scenes) parsedData.scenes = [];
      for (const cs of contScenes) {
        parsedData.scenes.push({
          ...cs,
          index: parsedData.scenes.length + 1,
        });
      }
      if (contData.characterSheet && typeof contData.characterSheet === 'object') {
        parsedData.characterSheet = { ...(parsedData.characterSheet || {}), ...contData.characterSheet };
      }
      if (contData.locationSheet && typeof contData.locationSheet === 'object') {
        parsedData.locationSheet = { ...(parsedData.locationSheet || {}), ...contData.locationSheet };
      }
      if (needThumb && contData.thumbnail && typeof contData.thumbnail === 'object') {
        parsedData.thumbnail = contData.thumbnail;
      }

      const nextCoverage = findUncoveredTrailingScript(story, parsedData.scenes);
      if (nextCoverage.coveredWords <= scriptCoverage.coveredWords) {
        break;
      }
      scriptCoverage = nextCoverage;
    } catch {
      break;
    }
  }

  // Sanitize styleProfile (and enforce monochrome lighting purity when style is B&W / monochrome)
  const rawStyleProfile = parsedData.styleProfile || {};
  const preliminaryStyleProfile: StyleProfile = {
    artStyle: removeEmDashes(rawStyleProfile.artStyle || characterStyle || 'Cinematic Rendering'),
    colorPalette: removeEmDashes(rawStyleProfile.colorPalette || 'Harmonious color grading matching narrative tone'),
    lighting: removeEmDashes(rawStyleProfile.lighting || 'Cinematic three-point lighting with soft rim fill'),
    eraAndSetting: removeEmDashes(rawStyleProfile.eraAndSetting || 'Contemporary atmospheric setting'),
    lensAndFilmStock: removeEmDashes(rawStyleProfile.lensAndFilmStock || 'Shot on 35mm prime lens, fine film grain'),
  };
  const sanitizedStyleProfile: StyleProfile = isMonochromeStyle(preliminaryStyleProfile)
    ? {
        ...preliminaryStyleProfile,
        colorPalette: sanitizeMonochromeLighting(preliminaryStyleProfile.colorPalette, preliminaryStyleProfile),
        lighting:
          sanitizeMonochromeLighting(preliminaryStyleProfile.lighting, preliminaryStyleProfile) ||
          'Stark high-contrast chiaroscuro lighting with deep pitch-black shadows and crisp white highlights',
      }
    : preliminaryStyleProfile;

  const sanitizedCharacterSheet: Record<string, string> = {};
  if (parsedData.characterSheet && typeof parsedData.characterSheet === 'object') {
    for (const [key, val] of Object.entries(parsedData.characterSheet)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        sanitizedCharacterSheet[key.trim()] = sanitizeCharacterIdentitySheet(removeEmDashes(val.trim()));
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
      let imagePrompt = removeEmDashes(beat.imagePrompt || '');

      // Replace any residual lazy AI shortcut phrases with actual character descriptions
      for (const [charName, visualDesc] of Object.entries(sanitizedCharacterSheet)) {
        const shortcutRegex = new RegExp(`\\(${charName}\\s*\\(matching established look[^)]*\\)\\)`, 'gi');
        imagePrompt = imagePrompt.replace(shortcutRegex, `${charName} (${visualDesc})`);
        const shortcutRegex2 = new RegExp(`\\b${charName}\\s*\\(matching established look[^)]*\\)`, 'gi');
        imagePrompt = imagePrompt.replace(shortcutRegex2, `${charName} (${visualDesc})`);
      }

      const shotType = removeEmDashes(beat.shotType || beat.shot_type || inferShotType(imagePrompt, beatIndex));
      const cameraAngle = removeEmDashes(beat.cameraAngle || beat.camera_angle || inferCameraAngle(imagePrompt, beatIndex));
      const cameraMovement = removeEmDashes(beat.cameraMovement || beat.camera_movement || inferCameraMovement(imagePrompt, beatIndex));

      const isFlashbackBeat = isInfancyOrChildhoodFlashback(textSpan, imagePrompt);
      const matchedCharClauses: string[] = [];
      for (const [charName, visualDesc] of Object.entries(sanitizedCharacterSheet)) {
        const isEntityKey = /\b(?:entity|creature|mimic|shadow|warden|monster|stalker|doppelganger)\b/i.test(
          `${charName} ${visualDesc}`
        );
        if (isFlashbackBeat && !isEntityKey) continue;
        const regex = new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textSpan) || regex.test(imagePrompt)) {
          // Avoid appending if visual details are already inside the prompt
          const snippet = visualDesc.slice(0, 25);
          if (!imagePrompt.toLowerCase().includes(snippet.toLowerCase())) {
            matchedCharClauses.push(`${charName}: ${visualDesc}`);
          }
        }
      }

      const matchedLocClauses: string[] = [];
      if (!isFlashbackBeat) {
        for (const [locName, visualDesc] of Object.entries(sanitizedLocationSheet)) {
          const regex = new RegExp(`\\b${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(textSpan) || regex.test(imagePrompt)) {
            const snippet = visualDesc.slice(0, 25);
            if (!imagePrompt.toLowerCase().includes(snippet.toLowerCase())) {
              matchedLocClauses.push(`${locName} environment: ${visualDesc}`);
            }
          }
        }
      }

      let finalImagePrompt = imagePrompt.trim();
      if (finalImagePrompt && !/[.!?]$/.test(finalImagePrompt)) {
        finalImagePrompt += '.';
      }

      // Append continuity only if details are not already embedded in prompt
      if (matchedCharClauses.length > 0 && !finalImagePrompt.toLowerCase().includes('character continuity')) {
        const charMissing = matchedCharClauses.filter(
          (c) => !finalImagePrompt.toLowerCase().includes(c.slice(0, 20).toLowerCase())
        );
        if (charMissing.length > 0) {
          finalImagePrompt += ` Character Continuity (${charMissing.join('. ')}).`;
        }
      }

      if (matchedLocClauses.length > 0 && !finalImagePrompt.toLowerCase().includes('location continuity')) {
        const locMissing = matchedLocClauses.filter(
          (l) => !finalImagePrompt.toLowerCase().includes(l.slice(0, 20).toLowerCase())
        );
        if (locMissing.length > 0) {
          finalImagePrompt += ` Location Continuity (${locMissing.join('. ')}).`;
        }
      }

      // Append compact style suffix without repeating a 40+ word style paragraph on every beat
      if (
        !finalImagePrompt.toLowerCase().includes(sanitizedStyleProfile.artStyle.toLowerCase().slice(0, 15)) &&
        !finalImagePrompt.toLowerCase().includes('visual style:')
      ) {
        const compactBeatStyle =
          buildCompactCharacterAnchor(sanitizedStyleProfile.artStyle, STYLE_ANCHOR_MAX_WORDS) ||
          sanitizedStyleProfile.artStyle;
        finalImagePrompt += ` Visual Style: ${compactBeatStyle}.`;
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

      // Expand CamelCase entity keys, enforce monochrome lighting purity, and clean still-image motion/optics
      finalImagePrompt = expandEntityKeysInPrompt(finalImagePrompt, sanitizedCharacterSheet, sanitizedLocationSheet);
      finalImagePrompt = sanitizeMonochromeLighting(finalImagePrompt, sanitizedStyleProfile);
      finalImagePrompt = sanitizeStillImageMotionAndOptics(finalImagePrompt, shotType, isVideoMode);

      // Clean redundant duplications and enforce strict mode isolation (no audio in image mode)
      finalImagePrompt = cleanAndDeduplicatePrompt(finalImagePrompt, isVideoMode);

      // Clean assembly: eliminates duplicate --ar, stray orientation, and filler prefixes
      finalImagePrompt = assembleCleanPrompt(finalImagePrompt, isLongForm);

      // Fallback if prompt was degenerate or empty (never leak literal spoken dialogue or negations)
      if (!finalImagePrompt || finalImagePrompt.length < 35) {
        finalImagePrompt = assembleCleanPrompt(
          `${shotType}, ${cameraAngle} framing inside ${sanitizedStyleProfile.eraAndSetting}, capturing a tense silent beat bathed in ${sanitizedStyleProfile.lighting}. Shot on 50mm f/2.0 lens. Visual Style: ${sanitizedStyleProfile.artStyle}.`,
          isLongForm
        );
      }

      let soundCue: string | undefined = undefined;
      if (isVideoMode) {
        const audioMatch = finalImagePrompt.match(/\bAudio:\s*([^.;\n]+)/i);
        if (audioMatch && audioMatch[1]) {
          soundCue = removeEmDashes(audioMatch[1].trim());
        }
      }

      let optics: string | undefined = undefined;
      const opticsMatch = finalImagePrompt.match(/\bOptics:\s*([^.;\n]+)/i) || finalImagePrompt.match(/\b(\d{2,3}mm\s+(?:f\/[0-9.]+|lens|prime)[^,.;]*)/i);
      if (opticsMatch && opticsMatch[1]) {
        optics = removeEmDashes(opticsMatch[1].trim());
      }

      return {
        beatIndex,
        textSpan,
        shotType,
        cameraAngle,
        cameraMovement,
        visualSoundEffect,
        temporalAnchor,
        soundCue,
        optics,
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
        videoPrompt = sanitizeMasterVideoPrompt(rawVP, {
          targetVideoDuration,
          calculatedSceneSeconds,
          styleProfile: sanitizedStyleProfile,
          characterSheet: sanitizedCharacterSheet,
          narratorLine,
          defaultAspectRatio,
        });
      } else {
        const charDesc = charactersInScene.length > 0
          ? charactersInScene.map((c) => `${c}: ${sanitizedCharacterSheet[c]}`).join(', ')
          : 'Scene subject';
        videoPrompt = `Subject: ${charDesc}. Action: ${narratorLine}. Camera: Medium shot, eye-level, slow forward push-in. Lighting & Environment: ${sanitizedStyleProfile.lighting}, ${sanitizedStyleProfile.eraAndSetting}. Style: ${sanitizedStyleProfile.artStyle}, ${sanitizedStyleProfile.lensAndFilmStock}. Physics: Natural kinetic motion. Audio: no dialogue, ambient sound only. Duration: ${targetVideoDuration} seconds.`;
      }

      const rawSFP = scene.startFramePrompt ? removeEmDashes(scene.startFramePrompt) : '';
      if (rawSFP.trim().length > 0) {
        startFramePrompt = enrichStartFramePrompt(rawSFP, {
          styleProfile: sanitizedStyleProfile,
          characterSheet: sanitizedCharacterSheet,
          narratorLine,
          defaultAspectRatio,
        });
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

  // Final Two-Phase Progression Repair, Narration Coverage Recovery, Compact Character Locking & Synchronization
  const preppedScenes = sanitizedScenes.map((scene: any) => ({
    ...scene,
    beats: (scene.beats || []).map((beat: any) => {
      const prompt = isVideoMode ? beat.imagePrompt : sanitizeImagePromptShotFraming(beat.imagePrompt || '');
      const directAnchor = extractTemporalAnchor(beat.textSpan || '');
      return directAnchor
        ? { ...beat, temporalAnchor: directAnchor, imagePrompt: prompt }
        : { ...beat, temporalAnchor: undefined, imagePrompt: cleanRedundantOnScreenText(prompt) };
    }),
  }));

  const readableCharacterSheet = synchronizeCharacterSheetWithFirstAppearances(
    preppedScenes,
    normalizeContinuitySheetKeys(sanitizedCharacterSheet)
  );
  const readableLocationSheet = normalizeContinuitySheetKeys(sanitizedLocationSheet);

  // Re-synchronize Video & StartFrame prompts with canonical first-appearance Character Sheet
  const castSyncedPreppedScenes = isVideoMode
    ? preppedScenes.map((sc: any) => ({
        ...sc,
        videoPrompt: sc.videoPrompt
          ? sanitizeMasterVideoPrompt(sc.videoPrompt, {
              targetVideoDuration,
              calculatedSceneSeconds: sc.estimatedSeconds || targetVideoDuration,
              styleProfile: sanitizedStyleProfile,
              characterSheet: readableCharacterSheet,
              narratorLine: sc.narratorLine,
              defaultAspectRatio,
            })
          : sc.videoPrompt,
        startFramePrompt: sc.startFramePrompt
          ? enrichStartFramePrompt(sc.startFramePrompt, {
              styleProfile: sanitizedStyleProfile,
              characterSheet: readableCharacterSheet,
              narratorLine: sc.narratorLine,
              defaultAspectRatio,
            })
          : sc.startFramePrompt,
      }))
    : preppedScenes;

  const scenesWithTransitionHints = await runTwoPhaseProgressionAndRepair({
    scenes: castSyncedPreppedScenes,
    styleProfile: sanitizedStyleProfile,
    characterSheet: readableCharacterSheet,
    locationSheet: readableLocationSheet,
    isLongForm,
    isVideoMode,
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
    apiKey,
    aiProvider: req.aiProvider,
    modelQuality,
    groqModel: req.groqModel,
    userSignal,
    onStatusMessage,
  });

  const calculatedTotalSeconds = Math.round(scenesWithTransitionHints.reduce((sum: number, s: any) => sum + (s.estimatedSeconds || 0), 0) * 10) / 10;
  const totalSeconds = calculatedTotalSeconds > 0 ? calculatedTotalSeconds : (parsedData.totalDurationSeconds || 30);

  const finalCoverage = findUncoveredTrailingScript(story, scenesWithTransitionHints);
  const assumptions: string[] | undefined =
    !isCustomBeats && finalCoverage.missingWords >= 3 && finalCoverage.coverageRatio < 0.95
      ? [
          `Script coverage notice: Output covered ${finalCoverage.coveredWords} of ${finalCoverage.totalWords} input words due to provider output limits. Uncovered tail starts at: "${finalCoverage.uncoveredText.slice(0, 90)}..."`,
        ]
      : undefined;

  const thumbnail = compileThumbnailPrompt({
    rawThumbnail: parsedData.thumbnail,
    styleProfile: sanitizedStyleProfile,
    characterSheet: readableCharacterSheet,
    storyPremise: story,
    format,
    platform,
  });

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: readableCharacterSheet,
    locationSheet: readableLocationSheet,
    totalDurationSeconds: totalSeconds,
    scenes: scenesWithTransitionHints,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
    assumptions,
    thumbnail,
  };
}

// ============================================================================
// PRIMARY ROUTER
// Seamlessly delegates to enhanceStoryArchitect.ts when Toggle is ON,
// and runs the pure, untouched generateOriginalStory when Toggle is OFF.
// ============================================================================
export async function generateStoryDirectly(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void
): Promise<StoryGenerationResult> {
  if (req.autoArchitectMode) {
    return generateEnhancedStory(req, apiKey, userSignal, onStatusMessage);
  }
  return generateOriginalStory(req, apiKey, userSignal, onStatusMessage);
}
