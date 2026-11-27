// ============================================================================
// ENHANCE STORY ARCHITECT PIPELINE (Toggle ON Only)
// Dedicated service for automated concept research, hook optimization,
// duration-budgeted narrative pacing, visual token bible consistency,
// and self-contained prompts for AI video generators (Veo, Kling, Sora, Luma).
//
// This file is strictly isolated from the original generator in geminiClient.ts.
// ============================================================================

import {
  GenerateStoryRequest,
  OnPartialStoryCallback,
  StoryGenerationResult,
  StyleProfile,
  Beat,
} from '../types';
import {
  extractTemporalAnchor,
} from './beatSplitting';
import {
  expandEntityKeysInPrompt,
  isMonochromeStyle,
  normalizeContinuitySheetKeys,
  normalizeUnicodeAndDashes,
  runTwoPhaseProgressionAndRepair,
  sanitizeMonochromeLighting,
  sanitizeSharedVisualStyle,
  sanitizeStillImageMotionAndOptics,
  synchronizeBeatMetadataWithPrompt,
  synchronizeCharacterSheetWithFirstAppearances,
} from './beatProgressionEngine';
import {
  cleanAndDeduplicatePrompt,
  assembleCleanPrompt,
  sanitizeCharacterIdentitySheet,
  buildPartialStoryResultFromStream,
  normalizeStoryBibleResponse,
} from './geminiClient';
import { executeGroundedPipeline } from './groundedPipeline';
import {
  executeJsonLlmCall,
  paceGeminiStep,
  PartialStoryboardStreamState,
  sanitizeGenericErrorMessage,
  streamJsonLlmWithSceneProgress,
} from './unifiedAiService';
import {
  compileThumbnailPrompt,
  classifyVisualStyleFamily,
  getStyleNativeRenderCue,
} from './promptCompiler';

function removeEmDashes(text: string): string {
  return normalizeUnicodeAndDashes(text);
}

function sanitizeErrorMessage(errorText: string, apiKey: string): string {
  return sanitizeGenericErrorMessage(errorText, apiKey, 'gemini');
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
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  onPartialResult?: OnPartialStoryCallback
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
    return executeGroundedPipeline(
      req,
      apiKey,
      userSignal,
      onStatusMessage,
      onPartialResult
    );
  }

  const requestedStyleFamily = classifyVisualStyleFamily(characterStyle);
  const nativeRenderCue = getStyleNativeRenderCue(requestedStyleFamily, isVideoMode);

  let durationInstruction = '';
  if (isVideoMode) {
    durationInstruction = `Generation mode is pure Text to Video. Target single video clip cadence is ${targetVideoDuration} seconds per scene. Break the story into distinct visual scenes with a cohesive linear clip prompt in scenes[].videoPrompt plus self-contained beat prompts in beats[].imagePrompt.`;
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
===============================================================================
The user has enabled the Auto Story Architect & Hook Optimizer pipeline.
You MUST take their raw premise, question, draft, or concept and perform comprehensive end-to-end research, hook engineering, duration-calibrated narrative scripting, and visual scene breakdown in this single pass:

1. ABSOLUTE PRESERVATION OF CORE NUMBERS, CURRENCIES & SPECIFIC EXAMPLES:
   - When the user provides specific numbers, currencies, and item examples (e.g. "₱1,000", "spending ₱150 on lunch, ₱100 on coffee, ₱80 on transportation"), you MUST STRICTLY PRESERVE THOSE EXACT FIGURES, CURRENCY SYMBOLS (₱, $, etc.), AND ITEMS in the narration!
   - NEVER replace specific prices or numbers with vague generalizations like "a few dollars" or substitute different currencies.

2. VISUAL CADENCE & COMMA-DELIBERATE SCRIPT STRUCTURE:
   - Write spoken sentences with deliberate, natural comma clauses so every distinct transaction, action, or shift forms its own clean visual beat (e.g. "You hand over ₱150 for lunch, tap for a ₱100 coffee, drop ₱80 on fare, and watch your balance dwindle.").
   - Avoid long, breathless run-on sentences. Let the voiceover breathe with crisp punctuation.

3. COMPREHENSIVE CONCEPT RESEARCH & CAUSAL CHAIN (APPLICABLE TO ANY STORY):
   - Analyze the premise deeply, whether it is a financial psychology phenomenon ("why money disappears fast"), a biological/medical curiosity (e.g. Zack D. Films style: "What happens if you swallow a magnet?"), scientific mechanism, historical event, or creative drama.
   - Establish the precise step-by-step physical, chemical, or psychological cause-and-effect chain. Break down what happens sequentially without hand-waving or skipping mechanical steps.

4. VIRAL OPENING HOOK ENGINEERING (MAXIMUM FIRST 2-SECOND RETENTION):
   - You MUST craft an irresistible, scroll-stopping opening hook sentence for Scene 1 using Zack D. Films retention architecture.
   - STRICTLY BAN WEAK, BORING CLICHES: NEVER begin with "Imagine a world where...", "Have you ever wondered...", "Picture this...", "In a distant future...", or abstract poetic fluff. Those cause instant swiping away.
   - EMPLOYS AUTHENTIC HIGH-RETENTION ZACK D. FILMS HOOK PATTERNS (under 16 words, direct 2nd person):
     * The Misconception Flip: "If you [action/accident], you might think [common belief]. But that is actually not what happens."
     * The Urgent Danger / "Why You Should Never" Hook: "Why you should never [bodily habit or common action]..."
     * The Visceral Internal Anatomy Hook: "Here is what actually happens inside your [body/organ] when you [action]..."
     * The Everyday Object Suspense Hook: "If you [everyday action with common item], something terrifying happens..."
     * The Extreme Hypothetical Hook: "What would happen if you [extreme physical scenario]?"
   - Populate the "hookAnalysis" object in the JSON output:
     - "headlineHook": the exact viral opening hook sentence used in Scene 1 Beat 1.
     - "hookType": the psychological hook category (e.g., "Misconception Flip", "Immediate Bodily Threat", "Counter-Intuitive Truth", "Urgent Warning").
     - "hookRationale": concise 1-2 sentence explanation of why this hook grabs and holds viewer retention in the first two seconds.

5. STRICT DURATION-AWARE SPOKEN NARRATION BUDGET (CRITICAL PACING MATH):
   ${isVideoMode
     ? `- VIDEO CLIP DURATION: Each scene clip represents EXACTLY ${targetVideoDuration} seconds.
   - SPOKEN WORD CEILING: Natural voiceover speech runs at ~2 to 2.2 words per second. Therefore, EACH scene's "narratorLine" MUST BE PUNCHY AND MUST NOT EXCEED ${maxSpokenWordsPerScene} WORDS (for a ${targetVideoDuration}-second clip, max ${maxSpokenWordsPerScene} words).
   - NEVER cram a long, complex 12-20 word sentence into a ${targetVideoDuration}-second scene!
   - If the premise requires more explanation, you MUST distribute the narrative across MULTIPLE sequential ${targetVideoDuration}-second scenes (e.g., Scene 1: hook premise in ≤${maxSpokenWordsPerScene} words; Scene 2: the purchases in ≤${maxSpokenWordsPerScene} words; Scene 3: the psychology in ≤${maxSpokenWordsPerScene} words; Scene 4: the mindset shift in ≤${maxSpokenWordsPerScene} words).`
     : `- Speech runs at ~2 words per second. Every scene's "narratorLine" must be a natural spoken sentence, and "estimatedSeconds" must reflect spoken pacing accurately (~1 second per 2 words).
   - If a target duration is set (${durationSeconds ? durationSeconds + 's' : 'automatic'}), pace the script length so all scenes combined match this target closely.`}

6. DYNAMIC VISUAL-EVENT & SELECTIVE MONTAGE BREAKDOWN & 100% NARRATION COVERAGE:
   ${isVideoMode
     ? `- CLIP COHESION & MICRO-BEAT PACING: Every ${targetVideoDuration}-second scene clip MUST use ${targetVideoDuration <= 4.5 ? '1 to 2 cohesive beats' : '2 to 3 cohesive micro-beats'} whose "estimatedSeconds" add up cleanly to ${targetVideoDuration}.0s within one continuous spatial setting.
   - ALSO output a top-level "videoPrompt" (45 to 85 words) on each Scene object uniting the entire ${targetVideoDuration}-second clip linearly: Framing -> Subject with permanent outfit -> Continuous action into settling hold -> Location & Lighting -> Single camera vector settling cleanly -> Style-native craft (${nativeRenderCue}) -> "Audio: [ambient foley], no dialogue."
   - If a line stacks a semantic-anchor origin flashback ("It's an entity that has studied you since birth" with infant inside wooden crib) AND an action triplet ("every blink, every breath, every move"), repeated negations, or climax turns, SPILL across consecutive ${targetVideoDuration}-second clips (max <=${maxSpokenWordsPerScene} spoken words and <=2-3 cuts per clip) instead of cramming 5-6 cuts into one ${targetVideoDuration}s AI video clip.`
     : `- OPTION B PHRASE-LEVEL VISUAL SEGMENTATION (2 TO 6 WORDS PER BEAT, NATURAL GRAMMAR, ~0.7s TO 2.0s PER CUT): Partition spoken narration into crisp 2 to 6 word visual phrases along natural grammatical boundaries so every short phrase receives its own distinct image!
     * Example: "If you pay off your mortgage ten years early, your lender might hit you with a massive penalty" ->
       - Beat 1 ("If you pay off"): Close-Up on hands sliding coins across a desk.
       - Beat 2 ("your mortgage"): Medium Shot of a miniature suburban house beside a contract ledger.
       - Beat 3 ("ten years early,"): Extreme Close-Up on calendar pages flipping to zero balance.
       - Beat 4 ("your lender"): Low-Angle Shot looming upward at the suited lender behind shadow.
       - Beat 5 ("might hit you"): Point-of-View of heavy ledger sliding across the table.
       - Beat 6 ("with a massive penalty"): Macro Detail of crimson stamp slamming onto paper.
   - NO STRANDED ARTICLES OR HANGING PREPOSITIONS: Never isolate bare function words away from their noun (NEVER output solo beats like "with a", "of the", "into a"). Keep articles/prepositions attached to the noun or verb phrase they modify.
   - DISTINCT VISUAL FOCUS PER CUT: Vary camera scale, angle, and subject focus between adjacent phrases so no two consecutive cuts look identical.
   - SELECTIVE RAPID MONTAGE TRIGGERS (apply cleanly across short and long scenes):
     * ACTION-TRIPLET / PARALLEL LISTS ("every blink, every breath, every move."): Split each item into its own rapid 0.7s-1.2s beat with distinct shot scale & focal noun (Extreme Close-Up eyelids mid-blink -> Extreme Close-Up condensation frost mist on glass -> Medium Shot raised shoulder/hand posture, all in exact 1:1 synchrony).
     * SEMANTIC-ANCHOR + ORIGIN FLASHBACK ("It's an entity that has studied you since birth"): Split into (1) Entity showcase (unsmiling stylized silhouette), (2) Watching from behind (protagonist facing forward unaware in crisp foreground focus while entity looms behind in deep shadow), and (3) Origin flashback (INFANT protagonist swaddled INSIDE a wooden crib while shadowy entity hides behind crib slats watching; zero adult clothing, zero modern bedroom traits, zero etched mirror dates!).
     * REPEATED NEGATIONS & CLIMAX TURNS: Split repeated negatives ("You never reach out." hands motionless -> "You never cross." feet halted before glass threshold) and separate reflection lag from smile reveal ("half-second late." -> "Now it's smiling." -> "And you never smiled.").
   - 100% SPOKEN NARRATION COVERAGE (ZERO DROPPED WORDS): Every single word of scene.narratorLine MUST appear across scene.beats[].textSpan in exact sequential order from start to finish. NEVER truncate or drop trailing clauses!`}

7. BIOMECHANICAL ANATOMY, ACCURATE GESTURES & GROUNDED POSTURE:
   When characters appear in prompts:
   - FIXED BIOMETRIC IDENTITY: Face bone structure (high cheekbones, angular jawline), skin undertones, and hair volume/texture/parting.
   - TACTILE MATERIALS & TEXTURES: Real-world surface textures (visible skin pores, weathered leather, brushed cotton, brass patina).
   - LAYERED OUTFIT ARCHITECTURE: Specific outerwear, underlayer, wear condition, footwear, and accessories locked across all scenes.
   - LIMB PROPORTIONS: Arms, legs, and torso must maintain accurate human proportions.
   - GROUNDED STANCE & FEET: Explicitly describe natural foot contact and gravity (e.g. "weight anchored firmly onto his back heel with toes braced in the dirt, front boot stepping forward in poised mid-stride", "both boots planted shoulder-width on uneven stone"). STRICT BAN ON FLOATING OR WEIGHTLESS FEET.
   - TORSO & HIP TWIST (CONTRAPPOSTO): Shoulders, ribcage, and pelvis must counter-rotate naturally to reflect the arm's motion (e.g. "shoulders and ribcage angled slightly into the movement with hips counter-balanced in natural contrapposto stance"). STRICT BAN ON WOODEN MANNEQUIN POSES.
   - HAND & WRIST BIOMECHANICS: Explicitly describe natural finger curvature, grip tension, and forearm alignment (e.g. "hand gripping the handle firmly with white-knuckled tension and natural finger curvature"). STRICT BAN ON FLAT CLAWS OR DISTORTED DIGITS.
   - HEAD, NECK & GAZE VECTORS: Explicitly describe head tilt and eye gaze (e.g. "neck angled slightly forward, chin dipped, gaze tracking sharply toward screen-right").
   - ZERO ROBOTIC BIOMECHANICAL MATH: NEVER write numeric weight percentages or joint degree angles (NEVER write "70% weight", "15 degrees", "25 degrees"). Use vivid, natural physical descriptions only.

8. ATMOSPHERIC MICRO-ENVIRONMENT, TACTILE PHYSICS & STYLE-LOCKED LIGHTING:
   - PARTICLES & WEATHER: (e.g. "powdery dry snow accumulating in seam creases of dark woolen fabric, subtle breath vapor rising in freezing air").
   - SURFACE TACTILITY: (e.g. "damp pine needles and crushed leaves compressed underfoot, glistening frost crystals on wood grain").
   - LIGHTING & MONOCHROME STYLE LOCK: For color stories, specify Kelvin color temperature (3000K warm tungsten vs 6500K daylight). For strictly BLACK-AND-WHITE, MONOCHROME, NOIR INK, or MANGA ("no gray gradients") stories, NEVER output chromatic Kelvin ("3200K warm", "cold 5400K") or color hues ("cold cyan", "amber"): use stark high-contrast chiaroscuro and harsh white highlights instead.

9. CINEMATIC OPTICS & LENS PRESCRIPTIONS (STILL IMAGE = ZERO MOTION LANGUAGE):
   Specify ONE focal length and aperture/f-stop in every prompt (e.g. "50mm anamorphic prime lens, f/2.0 shallow depth of field"). Never duplicate focal lengths ("35mm 35mm"). In Text-to-Image mode, NEVER write video motion prose ("tracking left to reveal", "tracking upward").

10. MODE ISOLATION FOR AUDIO & FOLEY CUES & PHANTOM TEXT:
    ${isVideoMode
      ? `- VIDEO MODE MANDATORY SOUND DESIGN: Every beat's video prompt MUST specify ambient foley, sound effects, footsteps, or handling cues (e.g. "Audio: muffled footsteps on wet gravel, metallic coin drop, no dialogue, ambient foley only").`
      : `- IMAGE MODE STRICT AUDIO PROHIBITION: Diffusion image models (Midjourney, Flux) cannot render sound. DO NOT include audio descriptions, sound cues ("listening to an unseen whisper"), or invented etched text date timelines.`}

11. KINETIC PROGRESSION & VELOCITY TEMPO:
    ${isVideoMode ? `- Explicit velocity and tempo progression (e.g. "Velocity: measured deliberate movement accelerating into a sharp sudden pivot").` : ''}

12. LITERAL VISUAL KINEMATICS, CHRONOLOGICAL TWISTS & NEGATION DISCIPLINE:
    - When narration verbs describe actions or losses (e.g. "disappears", "melts", "vanishes"), the AI visual prompt MUST LITERALLY SHOW THAT ACTION HAPPENING TO THE OBJECT!
    - CHRONOLOGICAL TWIST PROTECTION: Never spoil a late reveal earlier in the storyboard (e.g. if a reflection only smiles in Scene 7, ALL earlier beats including "It's an entity" and "that has studied" MUST remain neutral/unblinking; if Scene 3 states it is "perfectly mimicking", depict 1:1 zero-delay synchrony on blink, breath, and move).
    - NEGATION FIDELITY: Respect negations literally ("You never reach out" means hands stay down and glass remains untouched).
    - Keep characterSheet strictly expression-free and pose-free, lock recurring entities/antagonists in characterSheet as well as protagonists, maintain exact footwear consistency ("barefoot" stays barefoot, except infant crib flashbacks), expand CamelCase entity keys into natural English (never raw "DarkRoom" or "Protagonist"), and keep framing ("Over-the-Shoulder (OTS)", "Medium Close-Up") in shotType and vertical/tilt angles ("eye-level", "low-angle", "high-angle") in cameraAngle.

13. GROUNDED STORY CONSTRAINT & ANTI-HALLUCINATION ENGINE:
    - ZERO UNSTATED INVENTIONS: Strictly forbid hallucinating phantom characters, arbitrary weapons, glowing magic clauses/lines, dissolving light particles, or floating/levitating papers in grounded/physical/clay/diorama stories unless explicitly sci-fi/fantasy.
    - CURRENCY FIDELITY: Match the currency spoken in the user premise verbatim (e.g. "$" for dollars; NEVER emit "₱" unless "₱" appears in the user's input).
    - CONCRETE NOUNS ONLY: Every noun must be a tangible real-world item. Never write vague disjunctive placeholders ("holding something like a bag or a book").
    - SINGLE VISUAL FOCUS PER BEAT: Exactly ONE clear visual focus per beat. No conflicting hybrid prompts.
    - ZERO SPLIT-WORD TEXT ARTIFACTS: Never visualize isolated split sentence words ("Margins.") printed boldly on props.

14. TOKEN ECONOMY & DEDUPLICATION:
    - Every beat prompt must be crisp, punchy, and self-contained (35 to 60 descriptive words in Image Mode, 45 to 70 in Video Mode).
    - DO NOT copy-paste the entire character sheet paragraph multiple times within the prompt. Weave key traits concisely; our continuity compiler guarantees full locks.

15. MANDATORY GLOBAL VISUAL TOKEN BIBLE & UNBREAKABLE COLOR/MATERIAL CONSISTENCY:
    - Establish and strictly enforce a unified, permanent visual anchor palette across all scenes and beats.
    - RECURRING ENVIRONMENT GEOMETRY: Lock specific walls, textures, and architecture.

16. 100% SELF-CONTAINED PROMPTS FOR DOWNSTREAM VIDEO GENERATORS:
    - NEVER output empty references like "(matching established look from Scene 1)" or "(matching established look)". Every prompt must be fully self-contained.

17. FRONT-LOADED VISUAL FOUNDATION (FIRST 15-20 TOKENS):
    - In all prompts, front-load the visual foundation at the start:
      [${characterStyle || 'cinematic'}] [Environment Anchor] [Subject & Locked Color/Material]: [Action kinematics & movement]. Camera: [Shot Type], [Camera Angle], [Camera Movement]. Optics: [...]. Lighting: [...]. Physics: [...]. ${isVideoMode ? 'Audio: no dialogue, ambient sound only. ' : ''}${defaultAspectRatio}.`;

  const systemPrompt = isVideoMode
    ? `You are an expert film director, cinematographer, and AI video prompt engineer.
Your task is to take a story and generate a production-ready, scene-by-scene video generation breakdown with smart duration-adaptive video beats.${autoArchitectInstruction}

TARGET DURATION & SMART BEAT ADAPTATION:
The target video duration is ${targetVideoDuration} seconds per scene clip (e.g., ${targetVideoDuration}s).
You MUST analyze the narrator sentence and narrative action of each scene and break it into sequential visual video shot beats that TOGETHER precisely span and cover the ${targetVideoDuration}-second duration:
- For a ${targetVideoDuration}-second clip: create ${targetVideoDuration <= 4.5 ? '1 to 2 cohesive shot beats (totaling ' + targetVideoDuration + 's)' : '2 to 3 developmental shot beats (~1.5s to 2.5s each, totaling ' + targetVideoDuration + 's)'}, plus ONE unified linear scene "videoPrompt" (45-85 words).
- Each beat covers a natural spoken phrase from the narratorLine, with clear shotType, cameraAngle, and single-vector cameraMovement that settles cleanly.

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": visual art medium or cinematic style adapting to: "${characterStyle || 'cinematic hyperrealism'}"
   - "colorPalette": harmonious color palette matching the specific mood of this story
   - "lighting": lighting style and atmospheric quality described cleanly in natural words
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": style-native rendering craft matching "${nativeRenderCue}" (use camera optics ONLY for photorealistic styles; use tactile clay, 3D rendering, 2D brushwork, or geometric texture cues for non-photoreal styles)

2. Continuity Sheets & Locked Wardrobe Token (MANDATORY RESOLUTION):
   Generate the full breakdown in one model call that has the entire story in view.
   - "characterSheet": Create a top-level object mapping EVERY recurring human character, secondary role/antagonist (e.g. both "Homeowner" AND "Bank Lender" / "Bank Clerk"), AND recurring non-human entity/creature to ONE fixed, highly detailed expression-free visual description resolving face, hair, eyewear, and PERMANENT WARDROBE/SILHOUETTE without "neutral facial features" or stance sentences ("Stance is natural..."). Keep infant flashbacks free of adult clothing!
   - "locationSheet": Create a top-level object mapping any specific place returned to more than once to ONE fixed, highly detailed visual description.
    - CRITICAL WARDROBE LOCK & STRICT BAN ON "MATCHING ESTABLISHED LOOK":
      * Downstream AI video generators render each shot independently and have NO memory of prior scenes.
      * You are STRICTLY FORBIDDEN from writing shortcut phrases like "(matching established look from Scene 1)" or "(matching established look)"!
      * In EVERY beat's "imagePrompt" and scene "videoPrompt" where a character appears, you MUST explicitly repeat the character's locked clothing and eyewear. NEVER allow clothes to morph or change without story reason!
      * NEVER embed hero-pronoun wardrobe sentences ("He wears...", "His face...") inside "styleProfile.artStyle": keep artStyle strictly focused on medium, materials, and rendering aesthetics.

3. Smart Video Beats Array ("beats"):
   For each scene, provide a scene-level "videoPrompt" plus an array of video beats representing the temporal subdivisions of this ${targetVideoDuration}-second clip.
   Each beat MUST contain:
   - "beatIndex": integer (1, 2, 3...)
   - "textSpan": specific phrase or spoken clause from the narrator line. Every beat MUST correspond to actual spoken words from the narrator line. DO NOT create artificial extra beats with empty textSpan (""). Distribute the ${targetVideoDuration} seconds across the actual phrases of the sentence (e.g. 2 beats of 2.0s each for a 4-second clip).
   - "estimatedSeconds": estimated duration in seconds
   - "shotType": explicit cinematography shot size
   - "cameraAngle": explicit camera angle
   - "cameraMovement": single-vector camera motion cue
   - "temporalAnchor": optional string for explicit year/date/duration
   - "imagePrompt": Self-contained Text-to-Video prompt capturing this specific beat's action (45 to 70 words). Open cleanly once with ONE shot size matching "shotType", ONE camera angle matching "cameraAngle", and camera motion (never repeat framing openers or mix "Close-Up" and "extreme-close-up"), followed by [Subject with locked outfit when character is present] performing [grounded action with velocity], environmental physics, descriptive lighting, style-native craft (${nativeRenderCue}), and Audio: [foley, no dialogue]. Do NOT embed "9:16 vertical", "--ar 9:16", or duplicate "Visual Style:" tags.

6. VISUAL INFORMATION BUDGET & REVEAL DISCIPLINE (STRICT NO-LEAKAGE RULE):
   - In multi-beat sentences (e.g. "If you pour tea into a harbor, something terrifying happens"):
     * SETUP BEAT (e.g. "If you pour tea"): Depict ONLY the immediate origin action (the teapot tilting, tea ribbon pouring downward). MUST STRICTLY WITHHOLD the destination! Show NO harbor, NO water surface, NO ships, NO ocean. The liquid descends beyond the lower frame edge into darkness.
     * REVEAL BEAT (e.g. "into a harbor"): This is the FIRST beat allowed to introduce the harbor, piers, anchored ships, and the tea stream striking the water surface. MUST WITHHOLD the subsequent terrifying reaction/escalation.
     * ESCALATION BEAT (e.g. "something terrifying happens"): Now introduces the dramatic consequence or tension through lighting, stillness, or ominous visual changes. Do NOT invent unrelated monsters or premature spoilers.
   - NEVER leak a future beat's location, destination, or outcome into an earlier beat!

7. CASTING & STYLE DECOUPLING:
   - When a scene or beat has NO characters (e.g. empty harbor, still life of an object, pure close-up on a brass lock or contract page), NEVER write characters or humans into the prompt.

   - VISIBLE CONTENT & NAMED-OBJECT FIDELITY: When narration states that a photograph, print, newspaper, screen, or sign "shows", "displays", or "reveals" something, depict the visible front surface clearly showing all stated elements (never turn it face-down or omit named items like a headline board).

8. GEOGRAPHIC DEMONYM & CARTOGRAPHIC ANCHOR RULE (DOCUMENTARY / REAL-WORLD CALLOUTS ONLY):
   - Whenever a real-world country, nationality/demonym (e.g. "Swedish", "British", "French", "German", "Japanese", "American", "in France", "in Sweden") appears as a geographic callout in documentary/historical narration, that entity forms its own standalone micro-beat (e.g. Beat 1: "In 1896", Beat 2: "Swedish", Beat 3: "scientist Svante Arrhenius").
   - DO NOT apply this tabletop map rule to fictionalized or hyphenated world settings (e.g. "Neo-Seoul", "Cyber-Tokyo") or when Scene 1 Beat 1 opens on a main character in action. Keep fictional world beats grounded inside the story world with characters visible!
   - When triggered for a real-world documentary geographic beat, focus on a tactile 2.5D topographic map or vintage globe with glowing national borders, a dropped pin, and the national flag (no characters in frame).

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere. Use commas, periods, or parentheses instead.
2. Platform and Framing: Target platform is "${platform || (isLongForm ? 'YouTube' : 'TikTok')}". Format is ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS. Generic role descriptions only.
4. You MUST respond with ONLY a valid JSON object matching this schema (start directly with "scenes" so Scene 1 Beat 1 streams immediately using the locked Story Bible):
{
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "estimatedSeconds": number,
      "videoPrompt": "45 to 85 word cohesive linear T2V clip prompt for this full clip, ambient foley no dialogue",
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
          "imagePrompt": "string"
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just the raw JSON object.`
    : `You are an expert film director, cinematographer, and storyboard production supervisor.
Your task is to take a story and generate a production-ready, nested scene-and-beat visual breakdown with exact cinematic image prompts, shot taxonomy tags, narrator lines, a style profile, and visual continuity sheets.${autoArchitectInstruction}

SCHEMA AND STRUCTURE REQUIREMENTS:
1. Style Profile:
   Analyze the whole story to generate a top-level "styleProfile" object containing:
   - "artStyle": pure visual art medium and rendering technique: "${characterStyle || 'consistent visual style'}" (describe medium/textures only, NEVER plot transitions like portals between flashbacks)
   - "colorPalette": harmonious color palette matching the specific mood
   - "lighting": lighting style and atmospheric quality
   - "eraAndSetting": historical or fictional period, geography, and environmental backdrop
   - "lensAndFilmStock": lens and film stock descriptor

2. Continuity Sheets & Locked Wardrobe Token:
   - "characterSheet": recurring human character AND recurring non-human entity/creature descriptions with PERMANENT LOCKED WARDROBE/SILHOUETTE and ZERO transient facial expressions ("smiling", "horrified", "neutral expression") or frozen poses.
   - "locationSheet": recurring location descriptions.
   - CRITICAL WARDROBE LOCK & STRICT BAN ON SHORTCUTS:
     * NEVER write "(matching established look from Scene 1)" or "(matching established look)".
     * In EVERY single beat's imagePrompt where the adult character or entity appears, state their locked clothing/silhouette explicitly (except infancy/childhood flashbacks where baby wears crib blankets, NOT adult clothing).

3. Nested Scenes and Beats (100% NARRATION COVERAGE & NON-DUPLICATE PROGRESSION):
   - Each scene has index, narratorLine, estimatedSeconds, and beats array.
   - Each beat contains beatIndex, textSpan, estimatedSeconds, shotType, cameraAngle, cameraMovement, imagePrompt, etc.
   - 100% WORD-FOR-WORD NARRATION COVERAGE: Joining every beat's "textSpan" in order MUST reconstruct 100% of "scene.narratorLine" without dropping trailing clauses or ending words.
   - ZERO INTRA-SCENE DUPLICATE BEATS OR A-B-A-B CLONES: Every beat within a scene MUST depict a distinct physical action, object state change, or visual reaction that differs from ALL other beats in that scene.
   - METADATA & PROMPT OPENING ALIGNMENT: Every beat's "shotType" and "cameraAngle" MUST match the opening framing written in its "imagePrompt" (e.g. if shotType is "Close-Up" and cameraAngle is "low-angle", imagePrompt begins with "${isLongForm ? 'Cinematic 16:9 widescreen composition' : 'Vertical 9:16 portrait composition'}, Close-Up, low-angle..."). NEVER repeat the orientation phrase twice!
   - CHRONOLOGICAL ERA LOCK: Once a narrative shifts to a historical period (e.g. sent 800 years into the past, medieval era), strictly lock all environments and props to that era with zero modern/futuristic background bleed.

4. VISUAL INFORMATION BUDGET & REVEAL DISCIPLINE (STRICT NO-LEAKAGE RULE):
   - In multi-beat sentences (e.g. "If you pour tea into a harbor, something terrifying happens"):
     * SETUP BEAT (e.g. "If you pour tea"): Depict ONLY the immediate origin action (the teapot tilting, tea ribbon pouring downward). MUST STRICTLY WITHHOLD the destination! Show NO harbor, NO water surface, NO ships, NO ocean. The liquid descends beyond the lower frame edge into darkness.
     * REVEAL BEAT (e.g. "into a harbor"): This is the FIRST beat allowed to introduce the harbor, piers, anchored ships, and the tea stream striking the water surface. MUST WITHHOLD the subsequent terrifying reaction/escalation.
     * ESCALATION BEAT (e.g. "something terrifying happens"): Now introduces the dramatic consequence or tension through lighting, stillness, or ominous visual changes. Do NOT invent unrelated monsters or premature spoilers.
   - NEVER leak a future beat's location, destination, or outcome into an earlier beat!

5. CASTING & STYLE DECOUPLING:
   - When a scene or beat has NO characters (e.g. empty harbor, still life of an object), NEVER write character or mascot requirements into the prompt (e.g. do not write "with exaggerated stretchy animal characters" if the scene has no characters).

   - VISIBLE CONTENT & NAMED-OBJECT FIDELITY: When narration states that a photograph, print, newspaper, screen, or sign "shows", "displays", or "reveals" something, depict the visible front surface clearly showing all stated elements (never turn it face-down or omit named items like a headline board).

6. GEOGRAPHIC DEMONYM & CARTOGRAPHIC ANCHOR RULE (DOCUMENTARY / REAL-WORLD CALLOUTS ONLY):
   - Whenever a real-world country, nationality/demonym (e.g. "Swedish", "British", "French", "German", "Japanese", "American", "in France", "in Sweden") appears as a geographic callout in documentary/historical narration, that entity forms its own standalone micro-beat (e.g. Beat 1: "In 1896", Beat 2: "Swedish", Beat 3: "scientist Svante Arrhenius").
   - DO NOT apply this tabletop map rule to fictionalized or hyphenated world settings (e.g. "Neo-Seoul", "Cyber-Tokyo") or when Scene 1 Beat 1 opens on a main character in action. Keep fictional world beats grounded inside the story world with characters visible!
   - When triggered for a real-world documentary geographic beat, focus on a tactile 2.5D topographic map or vintage globe with glowing national borders, a dropped pin, and the national flag (no characters in frame).

STRICT CONSTRAINTS:
1. DO NOT use em dashes anywhere.
2. Format: ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}.
3. NO REAL OR IDENTIFIABLE PERSON NAMES IN VISUAL PROMPTS.
4. You MUST respond with ONLY a valid JSON object matching this schema (start directly with "scenes" so Scene 1 Beat 1 streams immediately using the locked Story Bible):
{
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
          "imagePrompt": "string",
          "estimatedSeconds": number
        }
      ]
    }
  ]
}
Do not include markdown code fences or backticks, just the raw JSON object.`;

  // ============================================================================
  // STEP 1: STORY BIBLE & HOOK ARCHITECT FIRST
  // ============================================================================
  if (onStatusMessage) {
    onStatusMessage('Step 1: Architecting Story Bible, viral hook & script outline...');
  }

  const enhanceBibleSystemPrompt = `You are an expert Story Architect and Continuity Supervisor.
Research the premise, preserve every exact number/currency/example from the user input, engineer a high-retention opening hook, outline the scene-by-scene spoken voiceover script (${durationInstruction}), and lock visual continuity.
Rules:
- "hookAnalysis": craft a punchy scroll-stopping opening hook (never start with "Imagine...", "Have you ever wondered...", or "Picture this...").
- "styleProfile": ALL 5 fields are REQUIRED and MUST be specific to this story (never generic placeholders):
  * "artStyle": medium, textures, and rendering style matching "${characterStyle || (isVideoMode ? 'cinematic hyperrealism' : 'cinematic realism')}" (never embed character wardrobe sentences inside artStyle).
  * "colorPalette": exact dominant palette grounded in this story.
  * "lighting": concrete atmospheric lighting matching this story's mood and eras.
  * "eraAndSetting": exact time period, weather, and world location from the story.
  * "lensAndFilmStock": style-native rendering craft matching "${nativeRenderCue}" (use camera optics ONLY for photorealistic styles; use tactile clay, 3D rendering, 2D brushwork, or geometric texture cues for non-photoreal styles).
- "characterSheet": MUST list EVERY recurring character, creature/spirit, parent/relative, and distinct age/flashback variant with permanent expression-free biometric traits, accurate anatomy (e.g. paws vs hooves, never unstated wings), and locked wardrobe/accessories. NEVER add inanimate graphic text, headlines, captions, or props (like "The Headlines") into characterSheet. Never leave empty when characters appear.
- "locationSheet": EVERY recurring setting with concrete physical surfaces and props.
- "scriptOutline": concise ordered list of the exact spoken voiceover sentences from Scene 1 to final Scene matching target duration.
- Do not use em dashes. Output raw JSON only:
{
  "hookAnalysis": {
    "headlineHook": "string",
    "hookType": "string",
    "hookRationale": "string"
  },
  "styleProfile": {
    "artStyle": "string",
    "colorPalette": "string",
    "lighting": "string",
    "eraAndSetting": "string",
    "lensAndFilmStock": "string"
  },
  "characterSheet": {
    "Role or Name": "Fixed expression-free visual lock"
  },
  "locationSheet": {
    "Place Name": "Fixed architectural and prop visual lock"
  },
  "scriptOutline": ["Scene 1 spoken line...", "Scene 2 spoken line..."]
}`;

  const bibleUserPrompt = `Premise:\n${story}\n\nRequested Style:\n${characterStyle || 'Consistent cinematic visual style matching premise.'}\nFormat: ${isLongForm ? '16:9 widescreen' : '9:16 vertical'}\nPlatform: ${platform}\n${durationInstruction}`;

  const rawBibleData = await executeJsonLlmCall<any>({
    provider: req.aiProvider || 'gemini',
    apiKey,
    systemPrompt: enhanceBibleSystemPrompt,
    userPrompt: bibleUserPrompt,
    modelQuality,
    groqModel: req.groqModel,
    userSignal,
    onStatusMessage,
    temperature: 0.3,
    topP: 0.85,
    thinkingLevel: 'minimal',
  });

  let bibleData = normalizeStoryBibleResponse(rawBibleData);
  if (
    (Object.keys(bibleData.characterSheet).length === 0 || !bibleData.styleProfile?.colorPalette) &&
    !userSignal?.aborted
  ) {
    try {
      const retryRaw = await executeJsonLlmCall<any>({
        provider: req.aiProvider || 'gemini',
        apiKey,
        systemPrompt: enhanceBibleSystemPrompt,
        userPrompt: `${bibleUserPrompt}\n\nCRITICAL: Output the COMPLETE JSON with non-empty "characterSheet" entries for EVERY character, creature, relative, and flashback age variant, plus all 5 "styleProfile" fields.`,
        modelQuality,
        groqModel: req.groqModel,
        userSignal,
        onStatusMessage,
        temperature: 0.25,
        topP: 0.85,
        thinkingLevel: 'minimal',
      });
      const retried = normalizeStoryBibleResponse(retryRaw);
      bibleData = {
        hookAnalysis: retried.hookAnalysis || bibleData.hookAnalysis,
        styleProfile: { ...(bibleData.styleProfile || {}), ...(retried.styleProfile || {}) },
        characterSheet:
          Object.keys(retried.characterSheet).length > 0
            ? { ...bibleData.characterSheet, ...retried.characterSheet }
            : bibleData.characterSheet,
        locationSheet:
          Object.keys(retried.locationSheet).length > 0
            ? { ...bibleData.locationSheet, ...retried.locationSheet }
            : bibleData.locationSheet,
        scriptOutline: retried.scriptOutline || bibleData.scriptOutline,
      };
    } catch {
      // Keep initial normalized Story Bible if retry fails
    }
  }

  if (onPartialResult && !userSignal?.aborted) {
    const biblePartial = buildPartialStoryResultFromStream({
      partial: {
        hookAnalysis: bibleData?.hookAnalysis,
        styleProfile: bibleData?.styleProfile,
        characterSheet: bibleData?.characterSheet,
        locationSheet: bibleData?.locationSheet,
        scenes: [],
      },
      req,
      isLongForm: format === 'long',
      isVideoMode,
      targetVideoDuration,
      autoArchitectMode: true,
      stageLabel: 'Story Bible & Hook locked. Streaming Scene 1, Beat 1...',
    });
    if (biblePartial) onPartialResult(biblePartial);
  }

  await paceGeminiStep({
    provider: req.aiProvider || 'gemini',
    apiKey,
    delayMs: 1500,
    userSignal,
    onStatusMessage,
    nextStepLabel: 'Step 2: Streaming enhanced storyboard beats live (Scene 1, Beat 1)...',
  });

  if (onStatusMessage) {
    onStatusMessage('Step 2: Streaming enhanced storyboard beats live (Scene 1, Beat 1)...');
  }

  const userPrompt = `[PIPELINE: AUTO STORY ARCHITECT & HOOK OPTIMIZER ACTIVE - Step 2 Beat Breakdown using Locked Story Bible & Script Outline]

LOCKED STORY BIBLE (MUST FOLLOW 100% - DO NOT REPEAT THIS OBJECT IN YOUR OUTPUT):
Hook Analysis: ${JSON.stringify(bibleData?.hookAnalysis || {})}
Style Profile: ${JSON.stringify(bibleData?.styleProfile || {})}
Character Sheet: ${JSON.stringify(bibleData?.characterSheet || {})}
Location Sheet: ${JSON.stringify(bibleData?.locationSheet || {})}
Planned Voiceover Script Outline: ${JSON.stringify(bibleData?.scriptOutline || [])}

Story Idea / Concept Premise:
${story}

Character Style Instruction:
${characterStyle || 'Consistent style specified by scene context.'}

Format: ${isLongForm ? 'Long form (16:9)' : 'Short form (9:16)'}
Platform: ${platform}
${durationInstruction}

Output ONLY { "scenes": [ ... ] } starting immediately with Scene 1 Beat 1.`;

  const streamedScenesData = await streamJsonLlmWithSceneProgress<any>({
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
    thinkingLevel: 'minimal',
    onPartialStoryboard: onPartialResult
      ? (partial) => {
          const built = buildPartialStoryResultFromStream({
            partial: {
              ...partial,
              hookAnalysis: partial.hookAnalysis || bibleData?.hookAnalysis,
              styleProfile: partial.styleProfile || bibleData?.styleProfile,
              characterSheet: {
                ...(bibleData?.characterSheet || {}),
                ...(partial.characterSheet || {}),
              },
              locationSheet: {
                ...(bibleData?.locationSheet || {}),
                ...(partial.locationSheet || {}),
              },
            },
            req,
            isLongForm: format === 'long',
            isVideoMode,
            targetVideoDuration,
            autoArchitectMode: true,
          });
          if (built) onPartialResult(built);
        }
      : undefined,
  });

  const parsedData: any = {
    hookAnalysis: bibleData?.hookAnalysis || streamedScenesData?.hookAnalysis,
    styleProfile: bibleData?.styleProfile || streamedScenesData?.styleProfile || {},
    characterSheet: {
      ...(bibleData?.characterSheet || {}),
      ...(streamedScenesData?.characterSheet || {}),
    },
    locationSheet: {
      ...(bibleData?.locationSheet || {}),
      ...(streamedScenesData?.locationSheet || {}),
    },
    scenes: Array.isArray(streamedScenesData?.scenes) ? streamedScenesData.scenes : [],
    totalDurationSeconds: streamedScenesData?.totalDurationSeconds,
  };

  const finalizeEnhancedStoryboard = async (dataObj: any, skipLlmRepair = false): Promise<StoryGenerationResult> => {
    // Sanitize styleProfile (strip hero pronoun wardrobe leaks from shared artStyle, and enforce monochrome lighting purity)
    const rawStyleProfile = dataObj.styleProfile || {};
    const cleanedArtStyle = sanitizeSharedVisualStyle(removeEmDashes(rawStyleProfile.artStyle || characterStyle || 'Cinematic Rendering'));
    const resolvedStyleFamily = classifyVisualStyleFamily(cleanedArtStyle || characterStyle);
    const nativeCraftFallback = getStyleNativeRenderCue(resolvedStyleFamily, isVideoMode);
    const preliminaryStyleProfile: StyleProfile = {
      artStyle: cleanedArtStyle || removeEmDashes(characterStyle || 'Cinematic Rendering'),
      colorPalette: removeEmDashes(rawStyleProfile.colorPalette || 'Harmonious color grading matching narrative tone'),
      lighting: removeEmDashes(rawStyleProfile.lighting || 'Natural atmospheric lighting with soft rim fill'),
      eraAndSetting: removeEmDashes(rawStyleProfile.eraAndSetting || 'Contemporary atmospheric setting'),
      lensAndFilmStock: removeEmDashes(
        resolvedStyleFamily === 'photoreal'
          ? rawStyleProfile.lensAndFilmStock || nativeCraftFallback
          : nativeCraftFallback
      ),
      styleFamily: resolvedStyleFamily,
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
    if (dataObj.characterSheet && typeof dataObj.characterSheet === 'object') {
      for (const [key, val] of Object.entries(dataObj.characterSheet)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          sanitizedCharacterSheet[key.trim()] = sanitizeCharacterIdentitySheet(removeEmDashes(val.trim()));
        }
      }
    }

    const sanitizedLocationSheet: Record<string, string> = {};
    if (dataObj.locationSheet && typeof dataObj.locationSheet === 'object') {
      for (const [key, val] of Object.entries(dataObj.locationSheet)) {
        if (typeof val === 'string' && val.trim().length > 0) {
          sanitizedLocationSheet[key.trim()] = removeEmDashes(val.trim());
        }
      }
    }

    const rawScenes = Array.isArray(dataObj.scenes) ? dataObj.scenes : [];
    const sanitizedScenes = rawScenes.map((scene: any, sIdx: number) => {
      const sceneIndex = typeof scene.index === 'number' ? scene.index : sIdx + 1;
      const narratorLine = removeEmDashes(scene.narratorLine || '');

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

        const rawShotType = removeEmDashes(beat.shotType || inferShotType(imagePrompt, beatIndex));
        const rawCameraAngle = removeEmDashes(beat.cameraAngle || inferCameraAngle(imagePrompt, beatIndex));
        const cameraMovement = removeEmDashes(beat.cameraMovement || inferCameraMovement(imagePrompt, beatIndex));

        const preSynced = synchronizeBeatMetadataWithPrompt({
          beatIndex,
          textSpan,
          shotType: rawShotType,
          cameraAngle: rawCameraAngle,
          cameraMovement,
          imagePrompt,
          estimatedSeconds: 1.5,
        });

        // Expand CamelCase entity keys, enforce monochrome lighting purity, and clean still-image motion/optics
        imagePrompt = expandEntityKeysInPrompt(imagePrompt, sanitizedCharacterSheet, sanitizedLocationSheet);
        imagePrompt = sanitizeMonochromeLighting(imagePrompt, sanitizedStyleProfile);
        imagePrompt = sanitizeStillImageMotionAndOptics(imagePrompt, preSynced.shotType, isVideoMode);

        // Deduplicate and clean prompt, stripping any audio cues in image mode
        imagePrompt = cleanAndDeduplicatePrompt(imagePrompt, isVideoMode);

        let soundCue: string | undefined = undefined;
        if (isVideoMode) {
          const audioMatch = imagePrompt.match(/\bAudio:\s*([^.;\n]+)/i);
          if (audioMatch && audioMatch[1]) {
            soundCue = removeEmDashes(audioMatch[1].trim());
          }
        }

        let optics: string | undefined = undefined;
        const opticsMatch = imagePrompt.match(/\bOptics:\s*([^.;\n]+)/i) || imagePrompt.match(/\b(\d{2,3}mm\s+(?:f\/[0-9.]+|lens|prime)[^,.;]*)/i);
        if (opticsMatch && opticsMatch[1]) {
          optics = removeEmDashes(opticsMatch[1].trim());
        }

        const shotType = rawShotType;
        const cameraAngle = rawCameraAngle;
        const directAnchor = extractTemporalAnchor(textSpan);

        return {
          beatIndex,
          textSpan,
          shotType,
          cameraAngle,
          cameraMovement,
          temporalAnchor: directAnchor,
          soundCue,
          optics,
          imagePrompt: assembleCleanPrompt(imagePrompt.trim(), format === 'long'),
          estimatedSeconds: typeof beat.estimatedSeconds === 'number' && beat.estimatedSeconds > 0
            ? beat.estimatedSeconds
            : 2,
        };
      });

      const rawMasterVideo = typeof scene.videoPrompt === 'string' ? removeEmDashes(scene.videoPrompt.trim()) : '';
      const fallbackClipPrompt =
        isVideoMode && !rawMasterVideo && sanitizedBeats.length > 0
          ? `${format === 'long' ? 'Wide 16:9 composition' : 'Vertical 9:16 portrait composition'}, ${sanitizedBeats
              .map((b) =>
                b.imagePrompt
                  .replace(/\s*--ar\s+[0-9:]+/gi, '')
                  .replace(/\bAudio:[^.]*\./gi, '')
                  .trim()
              )
              .slice(0, 2)
              .join(' Transitioning smoothly, ')}. ${getStyleNativeRenderCue(resolvedStyleFamily, true)}. ${sanitizedStyleProfile.artStyle}. Audio: subtle ambient atmosphere matching scene action, no dialogue.`
          : rawMasterVideo;

      return {
        index: sceneIndex,
        narratorLine,
        estimatedSeconds: isVideoMode ? targetVideoDuration : Math.round(sanitizedBeats.reduce((s, b) => s + (b.estimatedSeconds || 1.5), 0)),
        beats: sanitizedBeats,
        establishedCharacters: Array.isArray(scene.establishedCharacters) ? scene.establishedCharacters : [],
        establishedSettings: Array.isArray(scene.establishedSettings) ? scene.establishedSettings : [],
        isAnchorScene: sIdx === 0,
        videoPrompt: isVideoMode ? fallbackClipPrompt || undefined : undefined,
      };
    });

    const readableCharacterSheet = synchronizeCharacterSheetWithFirstAppearances(
      sanitizedScenes,
      normalizeContinuitySheetKeys(sanitizedCharacterSheet)
    );
    const readableLocationSheet = normalizeContinuitySheetKeys(sanitizedLocationSheet);

    const scenesWithHints = await runTwoPhaseProgressionAndRepair({
      scenes: sanitizedScenes,
      styleProfile: sanitizedStyleProfile,
      characterSheet: readableCharacterSheet,
      locationSheet: readableLocationSheet,
      isLongForm: format === 'long',
      isVideoMode,
      targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
      apiKey,
      aiProvider: req.aiProvider,
      modelQuality,
      groqModel: req.groqModel,
      userSignal,
      onStatusMessage,
      skipLlmRepair,
      skipOptionBPhraseSplit: isCustomBeats,
    });

    const totalDuration = Math.round(scenesWithHints.reduce((sum: number, s: any) => sum + (s.estimatedSeconds || 0), 0) * 10) / 10;

    const hookAnalysis = dataObj.hookAnalysis && typeof dataObj.hookAnalysis === 'object'
      ? {
          headlineHook: typeof dataObj.hookAnalysis.headlineHook === 'string' ? dataObj.hookAnalysis.headlineHook : undefined,
          hookType: typeof dataObj.hookAnalysis.hookType === 'string' ? dataObj.hookAnalysis.hookType : undefined,
          hookRationale: typeof dataObj.hookAnalysis.hookRationale === 'string' ? dataObj.hookAnalysis.hookRationale : undefined,
        }
      : undefined;

    const thumbnail = compileThumbnailPrompt({
      rawThumbnail: dataObj.thumbnail,
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
      totalDurationSeconds: totalDuration,
      scenes: scenesWithHints,
      generationMode: isVideoMode ? 'video' : 'image',
      targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
      autoArchitectMode: true,
      hookAnalysis,
      thumbnail,
    };
  };

  // Auto-continuation safeguard if streamed output truncated mid-sentence
  const finalEnhanceScenes = Array.isArray(parsedData.scenes) ? parsedData.scenes : [];
  const finalLastLine = (finalEnhanceScenes[finalEnhanceScenes.length - 1]?.narratorLine || '').trim();
  const stillTruncated =
    finalEnhanceScenes.length > 0 &&
    finalLastLine.length > 0 &&
    !/[.!?]["']?$/.test(finalLastLine);
  const canContinue =
    !userSignal?.aborted &&
    typeof apiKey === 'string' &&
    apiKey.trim().length > 10 &&
    !/^(?:mock|test|dummy|fake)/i.test(apiKey.trim());

  if (canContinue && stillTruncated) {
    if (onStatusMessage) {
      onStatusMessage('Completing truncated ending scenes to finish story arc...');
    }
    try {
      await paceGeminiStep({
        provider: req.aiProvider || 'gemini',
        apiKey,
        delayMs: 1500,
        userSignal,
      });
      const existingScenes = [...finalEnhanceScenes];
      const nextSceneIndex = existingScenes.length + 1;
      const contData = await streamJsonLlmWithSceneProgress<any>({
        provider: req.aiProvider || 'gemini',
        apiKey,
        systemPrompt,
        userPrompt: `CONTINUATION BATCH (PREVIOUS OUTPUT TRUNCATED MID-SENTENCE):
Previous scenes covered up to Scene ${existingScenes.length}: "${finalLastLine}"

LOCKED BIBLE:
Style Profile: ${JSON.stringify(parsedData.styleProfile || {})}
Character Sheet: ${JSON.stringify(parsedData.characterSheet || {})}
Location Sheet: ${JSON.stringify(parsedData.locationSheet || {})}

Complete the interrupted final sentence cleanly starting at Scene ${nextSceneIndex} and finish the remaining story resolution for premise:
${story}

Return ONLY valid JSON with "scenes": [ ...starting at index ${nextSceneIndex}... ].`,
        modelQuality,
        groqModel: req.groqModel,
        userSignal,
        onStatusMessage,
        temperature: 0.25,
        topP: 0.85,
        thinkingLevel: 'minimal',
        onPartialStoryboard: onPartialResult
          ? (partial) => {
              const streamedCont = Array.isArray(partial.scenes) ? partial.scenes : [];
              if (streamedCont.length === 0) return;
              const reindexed = streamedCont.map((cs: any, idx: number) => ({
                ...cs,
                index: existingScenes.length + idx + 1,
              }));
              const built = buildPartialStoryResultFromStream({
                partial: {
                  ...parsedData,
                  scenes: [...existingScenes, ...reindexed],
                },
                req,
                isLongForm: format === 'long',
                isVideoMode,
                targetVideoDuration,
                autoArchitectMode: true,
              });
              if (built) onPartialResult(built);
            }
          : undefined,
      });
      if (Array.isArray(contData?.scenes) && contData.scenes.length > 0) {
        if (!parsedData.scenes) parsedData.scenes = [];
        for (const cs of contData.scenes) {
          parsedData.scenes.push({ ...cs, index: parsedData.scenes.length + 1 });
        }
        if (contData.characterSheet && typeof contData.characterSheet === 'object') {
          parsedData.characterSheet = { ...(parsedData.characterSheet || {}), ...contData.characterSheet };
        }
        if (contData.locationSheet && typeof contData.locationSheet === 'object') {
          parsedData.locationSheet = { ...(parsedData.locationSheet || {}), ...contData.locationSheet };
        }
      }
    } catch (contErr: any) {
      if (userSignal?.aborted || contErr?.name === 'AbortError') {
        throw contErr;
      }
      // Non-fatal fallback to existing scenes
    }
  }

  // Finalize scenes deterministically without stalling behind a blocking post-stream LLM repair call
  const finalizedBeforeThumbnail = await finalizeEnhancedStoryboard(parsedData, true);

  // ============================================================================
  // STEP 3: COMPILE THUMBNAIL & CTA ONLY AFTER SCENES FINISH
  // ============================================================================
  if (onPartialResult && !userSignal?.aborted) {
    onPartialResult({
      ...finalizedBeforeThumbnail,
      thumbnail: undefined,
      progress: {
        completedScenes: finalizedBeforeThumbnail.scenes.length,
        isPartial: true,
        stageLabel: 'All scenes finished. Generating cover thumbnail & CTA outro...',
      },
    });
  }

  if (canContinue) {
    if (onStatusMessage) {
      onStatusMessage('Step 3: Compiling cover thumbnail & CTA outro...');
    }
    const thumbSystemPrompt = `You are a high-CTR storyboard cover designer. Generate ONLY a JSON object for the story thumbnail using the locked cast and story scenes. No em dashes.
Rules:
- "heroMoment" MUST refer to characters ONLY using their exact Character Sheet names (never invent ungrounded labels like "a spectral traveler" when the sheet defines "Spirit Patron" or "Wandering Ghost"), and MUST use frozen static visuals (never audio/motion phrases like "as it emits musical harmonic pulses").
- "expression" MUST fit the literal hero anatomy and headgear in Character Sheet (singular helmet/visor for a single helmeted hero, stickman posture for circle-head stickmen).
- "fontStyle" must NOT end with punctuation.
- "accentColor" must match a concrete color from Color Palette without stray words.
Schema:
{
  "heroMoment": "one crisp frozen visual sentence describing the central conflict or turning point using exact Character Sheet names",
  "expression": "emotionally fitting expression or posture matching the hero's literal Character Sheet anatomy",
  "bgDescription": "dark, simplified high-contrast background with deep separation",
  "accentColor": "dramatic rim lighting color fitting the story palette",
  "hookText": "bold 2 to 4 word curiosity headline in ALL CAPS specific to this story (never generic like SURVIVE)",
  "fontStyle": "story-adapted typography style without trailing period",
  "alternateHooks": ["ALT HOOK 1", "ALT HOOK 2"]
}`;
    const thumbUserPrompt = `Premise: ${story}
Hook Headline: ${finalizedBeforeThumbnail.hookAnalysis?.headlineHook || ''}
Style Profile: ${JSON.stringify(finalizedBeforeThumbnail.styleProfile)}
Character Sheet: ${JSON.stringify(finalizedBeforeThumbnail.characterSheet)}
Platform: ${platform} (${format === 'long' ? '16:9 widescreen' : '9:16 vertical'})`;

    await paceGeminiStep({
      provider: req.aiProvider || 'gemini',
      apiKey,
      delayMs: 1500,
      userSignal,
    });

    let thumbRaw: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const candidate = await executeJsonLlmCall<any>({
          provider: req.aiProvider || 'gemini',
          apiKey,
          systemPrompt: thumbSystemPrompt,
          userPrompt:
            attempt === 0
              ? thumbUserPrompt
              : `${thumbUserPrompt}\n\nOutput strict raw JSON object with non-empty heroMoment and hookText keys.`,
          modelQuality,
          groqModel: req.groqModel,
          userSignal,
          onStatusMessage,
          temperature: 0.3,
          topP: 0.85,
          thinkingLevel: 'minimal',
        });
        if (candidate && typeof candidate === 'object' && (candidate.heroMoment || candidate.hookText)) {
          thumbRaw = candidate;
          break;
        }
      } catch (thumbErr: any) {
        if (userSignal?.aborted || thumbErr?.name === 'AbortError') {
          throw thumbErr;
        }
        if (/\b(?:429|401|403|404)\b|quota|rate limit/i.test(String(thumbErr?.message || ''))) {
          break;
        }
      }
    }

    if (thumbRaw) {
      return {
        ...finalizedBeforeThumbnail,
        thumbnail: compileThumbnailPrompt({
          rawThumbnail: thumbRaw,
          styleProfile: finalizedBeforeThumbnail.styleProfile,
          characterSheet: finalizedBeforeThumbnail.characterSheet,
          storyPremise: story,
          format,
          platform,
        }),
      };
    }
  }

  return finalizedBeforeThumbnail;
}
