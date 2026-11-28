// NOTE: Client-side BYOK (Bring Your Own Key) direct execution.
// In BYOK mode, calls are dispatched straight from the browser to Google Generative Language API.
// API keys are strictly kept in browser memory / sessionStorage and never sent to any remote backend.

import {
  GenerateStoryRequest,
  OnPartialStoryCallback,
  StoryGenerationResult,
  StyleProfile,
  Beat,
} from '../types';
import {
  extractTemporalAnchor,
  cleanRedundantOnScreenText,
} from './beatSplitting';
import {
  deduplicateAndProgressSceneBeats,
  expandEntityKeysInPrompt,
  isMonochromeStyle,
  normalizeContinuitySheetKeys,
  normalizeUnicodeAndDashes,
  sanitizeFakePrecisionMath,
  sanitizeMonochromeLighting,
  sanitizeSharedVisualStyle,
  sanitizeStillImageMotionAndOptics,
  stripLeadingOrientationPrefixes,
  stripTransientExpressionsAndPoses,
  synchronizeBeatMetadataWithPrompt,
} from './beatProgressionEngine';
import { executeGroundedPipeline } from './groundedPipeline';
import { PartialStoryboardStreamState } from './unifiedAiService';

function removeEmDashes(text: string): string {
  return normalizeUnicodeAndDashes(text);
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

export function normalizeStoryBibleResponse(rawInput: any): {
  styleProfile?: Record<string, any>;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
} {
  const emptyResult = { characterSheet: {}, locationSheet: {} };
  if (!rawInput || typeof rawInput !== 'object') return emptyResult;

  const root =
    (rawInput.storyBible && typeof rawInput.storyBible === 'object' ? rawInput.storyBible : null) ||
    (rawInput.bible && typeof rawInput.bible === 'object' ? rawInput.bible : null) ||
    rawInput;

  const rawStyle = root.styleProfile || root.style_profile || undefined;
  const styleProfile =
    rawStyle && typeof rawStyle === 'object'
      ? {
          artStyle: rawStyle.artStyle || rawStyle.art_style || rawStyle.medium,
          colorPalette: rawStyle.colorPalette || rawStyle.color_palette || rawStyle.palette,
          lighting: rawStyle.lighting,
          eraAndSetting: rawStyle.eraAndSetting || rawStyle.era_and_setting || rawStyle.setting,
          lensAndFilmStock: rawStyle.lensAndFilmStock || rawStyle.lens_and_film_stock || rawStyle.lens,
        }
      : undefined;

  const toSheetMap = (src: any): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!src) return out;
    if (Array.isArray(src)) {
      for (const item of src) {
        if (!item || typeof item !== 'object') continue;
        const name = item.name || item.id || item.role || item.character || item.location;
        const desc = item.visualLock || item.visual_lock || item.description || item.look || item.details;
        if (typeof name === 'string' && name.trim() && typeof desc === 'string' && desc.trim()) {
          out[name.trim()] = desc.trim();
        }
      }
      return out;
    }
    if (typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (typeof v === 'string' && v.trim()) {
          out[k.trim()] = v.trim();
        } else if (v && typeof v === 'object') {
          const nested = (v as any).visualLock || (v as any).description || (v as any).look;
          if (typeof nested === 'string' && nested.trim()) {
            out[k.trim()] = nested.trim();
          }
        }
      }
    }
    return out;
  };

  const characterSheet = toSheetMap(root.characterSheet || root.character_sheet || root.characters || root.cast);
  const locationSheet = toSheetMap(root.locationSheet || root.location_sheet || root.locations);

  return { styleProfile, characterSheet, locationSheet };
}

export function buildPartialStoryResultFromStream(params: {
  partial: PartialStoryboardStreamState;
  req: GenerateStoryRequest;
  isLongForm: boolean;
  isVideoMode: boolean;
  targetVideoDuration: number;
  stageLabel?: string;
}): StoryGenerationResult | null {
  const { partial, req, isLongForm, isVideoMode, targetVideoDuration, stageLabel } = params;
  const hasRawScenes = Array.isArray(partial.scenes) && partial.scenes.length > 0;
  const hasBible = Boolean(partial.styleProfile || partial.characterSheet || partial.locationSheet);
  if (!hasRawScenes && !hasBible) {
    return null;
  }

  const rawStyleProfile = partial.styleProfile || {};
  const cleanedArtStyle = sanitizeSharedVisualStyle(
    removeEmDashes(rawStyleProfile.artStyle || req.characterStyle || 'Cinematic Rendering')
  );
  const preliminaryStyleProfile: StyleProfile = {
    artStyle: cleanedArtStyle || removeEmDashes(req.characterStyle || 'Cinematic Rendering'),
    colorPalette: removeEmDashes(rawStyleProfile.colorPalette || 'Harmonious color grading matching narrative tone'),
    lighting: removeEmDashes(rawStyleProfile.lighting || 'Cinematic lighting'),
    eraAndSetting: removeEmDashes(rawStyleProfile.eraAndSetting || 'Atmospheric story setting'),
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
  if (partial.characterSheet && typeof partial.characterSheet === 'object') {
    for (const [key, val] of Object.entries(partial.characterSheet)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        sanitizedCharacterSheet[key.trim()] = sanitizeCharacterIdentitySheet(removeEmDashes(val.trim()));
      }
    }
  }

  const sanitizedLocationSheet: Record<string, string> = {};
  if (partial.locationSheet && typeof partial.locationSheet === 'object') {
    for (const [key, val] of Object.entries(partial.locationSheet)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        sanitizedLocationSheet[key.trim()] = removeEmDashes(val.trim());
      }
    }
  }

  const normalizedCharSheet = normalizeContinuitySheetKeys(sanitizedCharacterSheet);
  const normalizedLocSheet = normalizeContinuitySheetKeys(sanitizedLocationSheet);

  const partialScenes = (Array.isArray(partial.scenes) ? partial.scenes : [])
    .filter((sc) => sc && Array.isArray(sc.beats) && sc.beats.length > 0)
    .map((sc: any, sIdx: number) => {
      const sceneIndex = typeof sc.index === 'number' ? sc.index : sIdx + 1;
      const narratorLine = removeEmDashes(sc.narratorLine || '');
      const cleanBeats: Beat[] = sc.beats
        .filter((b: any) => b && (typeof b.textSpan === 'string' || typeof b.imagePrompt === 'string'))
        .map((b: any, bIdx: number) => {
          const beatIndex = typeof b.beatIndex === 'number' ? b.beatIndex : bIdx + 1;
          const textSpan = removeEmDashes(b.textSpan || '');
          let prompt = removeEmDashes(b.imagePrompt || '');
          prompt = expandEntityKeysInPrompt(prompt, normalizedCharSheet, normalizedLocSheet);
          prompt = sanitizeMonochromeLighting(prompt, sanitizedStyleProfile);
          const preSynced = synchronizeBeatMetadataWithPrompt({
            beatIndex,
            textSpan,
            shotType: removeEmDashes(b.shotType || inferShotType(prompt, beatIndex)),
            cameraAngle: removeEmDashes(b.cameraAngle || inferCameraAngle(prompt, beatIndex)),
            cameraMovement: removeEmDashes(b.cameraMovement || inferCameraMovement(prompt, beatIndex)),
            imagePrompt: prompt,
            estimatedSeconds:
              typeof b.estimatedSeconds === 'number' && b.estimatedSeconds > 0 ? b.estimatedSeconds : 1.5,
          });
          const shotType = preSynced.shotType;
          const cameraAngle = preSynced.cameraAngle;
          const cameraMovement = preSynced.cameraMovement;
          prompt = sanitizeStillImageMotionAndOptics(prompt, shotType, isVideoMode);
          prompt = cleanAndDeduplicatePrompt(prompt, isVideoMode);
          prompt = assembleCleanPrompt(prompt, isLongForm);

          return {
            beatIndex,
            textSpan,
            shotType,
            cameraAngle,
            cameraMovement,
            temporalAnchor: extractTemporalAnchor(textSpan) || undefined,
            imagePrompt: removeEmDashes(prompt),
            estimatedSeconds:
              typeof b.estimatedSeconds === 'number' && b.estimatedSeconds > 0 ? b.estimatedSeconds : 1.5,
          };
        });

      const progressedBeats = deduplicateAndProgressSceneBeats(cleanBeats, {
        isLongForm,
        isVideoMode,
        styleProfile: sanitizedStyleProfile,
        characterSheet: normalizedCharSheet,
        locationSheet: normalizedLocSheet,
      });

      const sceneSeconds = isVideoMode
        ? targetVideoDuration
        : Math.max(
            1,
            Math.round(progressedBeats.reduce((sum, b) => sum + (b.estimatedSeconds || 1.5), 0) * 10) / 10
          );

      return {
        index: sceneIndex,
        narratorLine,
        estimatedSeconds: sceneSeconds,
        beats: progressedBeats,
      };
    });

  if (partialScenes.length === 0 && !hasBible) return null;

  const totalDurationSeconds =
    Math.round(partialScenes.reduce((sum, s) => sum + (s.estimatedSeconds || 0), 0) * 10) / 10;

  const lastPartialScene = partialScenes[partialScenes.length - 1];
  const computedStageLabel =
    stageLabel ||
    (partialScenes.length === 0
      ? 'Story Bible locked. Streaming Scene 1, Beat 1...'
      : `Scene ${lastPartialScene.index}, Beat ${lastPartialScene.beats.length} ready...`);

  return {
    styleProfile: sanitizedStyleProfile,
    characterSheet: normalizedCharSheet,
    locationSheet: normalizedLocSheet,
    totalDurationSeconds,
    scenes: partialScenes,
    generationMode: isVideoMode ? 'video' : 'image',
    targetVideoDuration: isVideoMode ? targetVideoDuration : undefined,
    // Defer Thumbnail until all scenes complete
    thumbnail: undefined,
    progress: {
      completedScenes: partialScenes.length,
      isPartial: true,
      stageLabel: computedStageLabel,
    },
  };
}

// ============================================================================
// PRIMARY STORY GENERATOR
// Routes all stories (short/long, image/video, automatic/custom)
// through the 5-stage Grounded Pipeline.
// ============================================================================
export async function generateOriginalStory(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  onPartialResult?: OnPartialStoryCallback
): Promise<StoryGenerationResult> {
  return executeGroundedPipeline(
    req,
    apiKey,
    userSignal,
    onStatusMessage,
    onPartialResult
  );
}

export async function generateStoryDirectly(
  req: GenerateStoryRequest,
  apiKey: string,
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  onPartialResult?: OnPartialStoryCallback
): Promise<StoryGenerationResult> {
  return generateOriginalStory(
    req,
    apiKey,
    userSignal,
    onStatusMessage,
    onPartialResult
  );
}
