import { AiProvider, Beat, GeminiModelQuality, Scene, StyleProfile } from '../types';
import {
  extractGeographicAnchor,
  extractTemporalAnchor,
  generateCartographicPrompt,
  getWordCount,
  populateSceneTransitionHints,
  sanitizeImagePromptShotFraming,
  splitPhraseIntoSubBeats,
} from './beatSplitting';
import { executeJsonLlmCall } from './unifiedAiService';
import { updateVideoPromptDuration } from './videoSuitability';

// Dynamic Visual-Event Pacing (~1.5s - 3.0s default) + Selective Rapid Montage (~0.7s - 1.2s)
export const VISUAL_EVENT_MAX_SECONDS = 3.1;
export const VISUAL_EVENT_MAX_WORDS = 15;
export const FILLER_FRAGMENT_MAX_WORDS = 4;
export const FILLER_FRAGMENT_MAX_SECONDS = 1.25;
export const MONTAGE_MIN_SECONDS = 0.7;

/**
 * Detects infancy or childhood flashback beats (e.g. "you since birth", crib scenes)
 * where adult clothing and present-day adult bedrooms must NOT be force-injected.
 */
export function isInfancyOrChildhoodFlashback(textSpan: string, imagePrompt: string = ''): boolean {
  const combined = `${textSpan || ''} ${imagePrompt || ''}`;
  return /\b(?:since\s+birth|infant|newborn|baby|cradle|crib|nursery|swaddled|as\s+a\s+child|in\s+childhood|toddler)\b/i.test(
    combined
  );
}

/**
 * Classifies deliberate rapid-montage, semantic-anchor, negation, or climax sub-beats
 * so shared character/lighting boilerplate does not cause Pass 2 auto-merging or Pass 3 fallback overwrites.
 */
export function extractMontageFocalCategory(textSpan: string, imagePrompt: string = ''): string | null {
  const span = (textSpan || '').trim().toLowerCase();
  const prompt = (imagePrompt || '').trim().toLowerCase();

  if (/\b(?:every\s+blink|blinking|eyelid)\b/i.test(span) || (/\bblink\b/i.test(span) && span.split(/\s+/).length <= 6)) {
    return 'montage-blink';
  }
  if (/\b(?:every\s+breath|breathing|exhale)\b/i.test(span) || (/\bbreath\b/i.test(span) && span.split(/\s+/).length <= 6)) {
    return 'montage-breath';
  }
  if (/\b(?:every\s+move|every\s+step|every\s+turn)\b/i.test(span) || (/\bmove\b/i.test(span) && span.split(/\s+/).length <= 5)) {
    return 'montage-move';
  }
  if (isInfancyOrChildhoodFlashback(span, prompt)) {
    return 'flashback-crib';
  }
  if (/\b(?:that\s+has\s+studied|has\s+studied|studied\s+you|watching\s+from\s+behind)\b/i.test(span)) {
    return 'semantic-studied';
  }
  if (/^\s*(?:it'?s\s+an\s+entity|it\s+is\s+an\s+entity|an\s+entity)\b/i.test(span)) {
    return 'semantic-entity';
  }
  if (/\bnever\s+reach\s+out\b/i.test(span)) {
    return 'negation-reach';
  }
  if (/\bnever\s+cross\b/i.test(span)) {
    return 'negation-cross';
  }
  if (/\bhalf[- ]second\s+late\b/i.test(span)) {
    return 'climax-lag';
  }
  if (/\bnow\s+it'?s\s+smiling\b/i.test(span)) {
    return 'climax-smile';
  }
  if (/\bnever\s+smiled\b/i.test(span)) {
    return 'climax-unsmiling';
  }

  // General parallel list cue ("every X", "each X") in rapid montage beats
  const everyMatch = span.match(/\b(?:every|each)\s+([a-z]{3,})\b/i);
  if (everyMatch && everyMatch[1] && !/^(?:day|night|time|single|one)$/.test(everyMatch[1])) {
    return `montage-parallel-${everyMatch[1]}`;
  }

  return null;
}

export function isIntentionalMontageOrSemanticBeat(beat: Beat): boolean {
  return extractMontageFocalCategory(beat.textSpan || '', beat.imagePrompt || '') !== null;
}

export function hasDistinctMontageFocalSubject(beatA: Beat, beatB: Beat): boolean {
  const catA = extractMontageFocalCategory(beatA.textSpan || '', beatA.imagePrompt || '');
  const catB = extractMontageFocalCategory(beatB.textSpan || '', beatB.imagePrompt || '');
  if (catA && catB && catA !== catB) {
    return true;
  }
  // Also preserve distinct rapid montage pairs where one explicitly has a focal category and prompts are below clone threshold
  if ((catA || catB) && (beatA.textSpan || '').trim().toLowerCase() !== (beatB.textSpan || '').trim().toLowerCase()) {
    const tokensA = new Set((beatA.textSpan || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
    const tokensB = new Set((beatB.textSpan || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
    let shared = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) shared++;
    }
    if (shared === 0 && (catA || catB)) {
      return true;
    }
  }
  return false;
}

/**
 * Flags short (7-14 word) multi-concept or parallel-list beats that were previously skipped
 * by the 15-word ceiling check so Phase-2 repair splits them cleanly.
 */
export function detectUnsplitDenseBeatPattern(textSpan: string): string | null {
  const span = (textSpan || '').trim();
  if (!span) return null;

  // 1. Repeated parallel "every X, every Y" or 3+ serialized comma action items
  if (/(?:\bevery\s+[a-z]+[^,;]*[,;]\s*){1,}\bevery\s+[a-z]+/i.test(span)) {
    return 'Contains unsplit serialized "every X, every Y" montage actions that should be split into distinct rapid visual cuts (0.7s-1.2s each)';
  }
  const commaParts = span.split(/,+/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (commaParts.length >= 3 && getWordCount(span) >= 6) {
    return 'Contains 3 or more comma-separated clauses/items packed into one beat; split into distinct montage cuts';
  }

  // 2. Combined Entity + Observation + Temporal Origin Flashback ("It's an entity that has studied you since birth")
  if (
    /\b(?:entity|creature|shadow|mimic|warden)\b/i.test(span) &&
    /\b(?:since\s+birth|as\s+a\s+baby|from\s+childhood|inside\s+a\s+crib)\b/i.test(span)
  ) {
    return 'Combines an entity introduction/observation with a birth/childhood temporal flashback; decompose into distinct beats (Entity -> Watching Behind -> Crib Flashback)';
  }

  // 3. Combined repeated negations ("You never reach out. You never cross.")
  if (/\bnever\s+[a-z]+[^.!?]*[.!?]\s*(?:you\s+)?never\s+[a-z]+/i.test(span)) {
    return 'Packs multiple distinct rhetorical negation beats into one frame; split each negation into its own visual beat';
  }

  // 4. Combined climax timing-lag and smile reveal ("half-second late. Now it's smiling.")
  if (/\b(?:half[- ]second\s+late|delayed|lags?\s+behind)\b.*\b(?:smiling|smile|grin)\b/i.test(span)) {
    return 'Merges the delayed reflection reveal and the smiling reveal into one beat; split into separate climax beats';
  }

  return null;
}


const STOP_WORDS = new Set(
  'a an the of in on at to with and or as by for from is are was were its it this that his her their into over under across just than then composition vertical portrait widescreen cinematic visual style lighting optics shot framing'.split(
    ' '
  )
);

const BOILERPLATE_STRIP_PATTERNS = [
  /^(?:Cinematic 16:9 widescreen composition|Vertical 9:16 portrait composition)(?:\s*[,.:;-]\s*|\s+)*/gi,
  /\s*--ar\s+[0-9:]+/gi,
  /visual style:[^.]*\.?/gi,
  /character continuity \([^)]*\)\.?/gi,
  /location continuity \([^)]*\)\.?/gi,
  /featuring\s+[^.(]+\([^)]*\)\.?/gi,
  /shot\s+on\s+\d{2,3}mm[^.]*\.?/gi,
];

const ACTION_OR_BODY_KEEP_WORDS = new Set([
  'hand', 'hands', 'face', 'eyes', 'mouth', 'finger', 'fingers', 'head', 'shoulder', 'shoulders',
  'hold', 'holding', 'grip', 'gripping', 'open', 'close', 'stamp', 'seal', 'shears', 'ribbon',
  'coin', 'coins', 'compass', 'mirror', 'lantern', 'sword', 'rifle', 'magazine', 'door', 'window',
  'contract', 'ledger', 'vault', 'abacus', 'beads', 'magnifying', 'glass', 'pen', 'signature',
]);

export function buildSharedContextIgnoreTokens(
  styleProfile?: StyleProfile,
  locationSheet?: Record<string, string>,
  characterSheet?: Record<string, string>
): Set<string> {
  const ignore = new Set<string>();
  const addFromText = (text?: string) => {
    if (!text) return;
    const toks = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !ACTION_OR_BODY_KEEP_WORDS.has(w));
    for (const t of toks) {
      ignore.add(t);
    }
  };

  if (styleProfile) {
    addFromText(styleProfile.artStyle);
    addFromText(styleProfile.colorPalette);
    addFromText(styleProfile.lighting);
    addFromText(styleProfile.eraAndSetting);
    addFromText(styleProfile.lensAndFilmStock);
  }
  const cameraBoilerplate = [
    'vertical', 'portrait', 'composition', 'cinematic', 'widescreen', 'establishing',
    'wide', 'medium', 'close', 'level', 'angle', 'lens', 'prime', 'fisheye', 'macro',
    'focus', 'depth', 'field', 'balanced', 'shallow', 'deep', 'shot', 'grain', 'texture',
    'digital', 'visual', 'style', 'frame', 'static',
  ];
  for (const word of cameraBoilerplate) {
    ignore.add(word);
  }
  if (locationSheet) {
    for (const [k, v] of Object.entries(locationSheet)) {
      addFromText(k);
      addFromText(v);
    }
  }
  if (characterSheet) {
    const entries = Object.values(characterSheet);
    for (const desc of entries) {
      addFromText(desc);
    }
  }

  return ignore;
}

/**
 * Normalizes Unicode non-breaking spaces, non-breaking hyphens, and en/em dashes
 * into clean ASCII typography without altering sentence structure.
 */
export function normalizeUnicodeAndDashes(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2212]/g, '-')
    .replace(/[\u2014\u2015]/g, ', ')
    .replace(/\s+\u2013\s+/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/\s+--\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Removes unnatural biomechanical math (e.g. "weight anchored 70% on left boot",
 * "torso twisted 15 degrees right", "wrist flexed at 25 degrees") that confuses
 * diffusion image models, leaving natural physical posture descriptions.
 */
export function sanitizeFakePrecisionMath(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = normalizeUnicodeAndDashes(prompt);

  // Replace weight percentage phrases with natural stance phrasing
  cleaned = cleaned.replace(
    /,?\s*\b(?:body\s+)?weight\s+(?:anchored\s+|balanced\s+|shifted\s+)?\d{1,3}%\s*(?:onto|on)\s+the\s+([^,.;]+)/gi,
    ', weight planted firmly on the $1'
  );
  cleaned = cleaned.replace(
    /,?\s*\b(?:body\s+)?weight\s+(?:anchored\s+|balanced\s+|shifted\s+)?\d{1,3}%\s*(?:onto|on)\s+([^,.;]+)/gi,
    ', weight planted firmly on $1'
  );
  cleaned = cleaned.replace(/,?\s*\b(?:body\s+)?weight\s+\d{1,3}%[^,.;]*/gi, '');

  // Strip degree angles attached to body parts (e.g. "torso twisted 15 degrees right", "wrist flexed at 25 degrees")
  cleaned = cleaned.replace(
    /,?\s*\b(?:torso|chest|shoulders?|hips?|pelvis|head|neck|chin|wrist|wrists|hand|hands|arm|arms|elbow|elbows|knee|knees|ankle|ankles|boot|boots|foot|feet|spine|back)\s+(?:is\s+|are\s+)?(?:twisted|rotated|angled|tilted|leaning|bent|flexed|slouched|turned|raised)\s+(?:at\s+)?\d{1,3}(?:\s*degrees?|°)(?:\s+(?:to\s+(?:the\s+)?(?:screen-)?(?:left|right)|forward|backward|back|upward|downward|inward|outward|in|out|up|down))?/gi,
    ''
  );

  // Strip standalone "at 25 degrees" / "15-degree slouch" expressions
  cleaned = cleaned.replace(
    /\b(?:flexed|bent|angled|tilted|rotated|twisted|slouched)\s+(?:at\s+)?\d{1,3}(?:\s*degrees?|°)/gi,
    'poised naturally'
  );
  cleaned = cleaned.replace(/\bat\s+(?:a\s+)?\d{1,3}(?:-|\s*)degrees?\s+(?:angle|slouch|tilt|bend|turn|rotation)?/gi, '');
  cleaned = cleaned.replace(/\b\d{1,3}(?:-|\s*)degrees?\s+(?:angle|slouch|tilt|bend|turn|rotation|lean)\b/gi, 'natural angle');
  cleaned = cleaned.replace(/,\s*with\s+\d{1,3}(?:\s*degrees?|°)\s+(?:angle|tilt|rotation|turn|flex)[^,.;]*/gi, '');

  // Fix grammar artifacts from stripped clauses
  cleaned = cleaned
    .replace(/\bshowing\s+(?:finger|hand)\s+arcs\s+poised\s+naturally\b/gi, 'fingers gripped naturally')
    .replace(/\bwith\s+poised\s+naturally\b/gi, 'with natural poise')
    .replace(/\bpoised\s+naturally\b(?=\s+(?:with|in|on|against|around))/gi, 'positioned')
    .replace(/,\s*(?:with|showing|and)\s*(?=[,.])/gi, '')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Computes semantic similarity between two visual prompts (3-gram shingles + token overlap),
 * ignoring framing boilerplate, style/location context noise, and optics so true action clones are caught reliably.
 */
export function computeVisualPromptSimilarity(
  a: string,
  b: string,
  ignoredTokens?: Set<string>
): number {
  const tokenize = (raw: string): string[] => {
    let clean = raw || '';
    for (const pat of BOILERPLATE_STRIP_PATTERNS) {
      clean = clean.replace(pat, ' ');
    }
    return clean
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !(ignoredTokens && ignoredTokens.has(w)));
  };

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const shingles = (toks: string[]): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= toks.length - 3; i++) {
      set.add(`${toks[i]} ${toks[i + 1]} ${toks[i + 2]}`);
    }
    return set;
  };

  const sA = shingles(tokensA);
  const sB = shingles(tokensB);
  const wA = new Set(tokensA);
  const wB = new Set(tokensB);

  const jaccard = (x: Set<string>, y: Set<string>): number => {
    if (x.size === 0 || y.size === 0) return 0;
    let inter = 0;
    for (const item of x) {
      if (y.has(item)) inter++;
    }
    return inter / (x.size + y.size - inter);
  };

  return 0.6 * jaccard(sA, sB) + 0.4 * jaccard(wA, wB);
}

/**
 * Strips transient facial expressions, temporary poses, and conflicting props from
 * permanent character descriptions so identities never clash with beat-specific emotions or actions.
 */
export function stripTransientExpressionsAndPoses(desc: string): string {
  if (!desc || typeof desc !== 'string') return '';
  let cleaned = normalizeUnicodeAndDashes(desc)
    .replace(/\bwith\s+eyes\s+wide(?:\s+and\s+mouth\s+open)?/gi, '')
    .replace(/,?\s*\beyes\s+(?:wide|narrowed|shut|closed|unblinking|blinking)\b/gi, '')
    .replace(
      /,?\s*\b(?:neutral|blank|natural|calm|stoic|unreadable)\s+(?:facial\s+)?features\b/gi,
      ''
    )
    .replace(/,?\s*\b(?:neutral|blank|horrified|terrified|stoic|expressionless|intense|calm|fearful|shocked)\s+expression\b/gi, '')
    .replace(/,?\s*\bmouth\s+(?:open|closed|shut|agape|pressed)\b/gi, '')
    .replace(/,?\s*\b(?:smiling|grinning|frowning|scowling|sneering|crying|whispering|listening(?:\s+to\s+[^,.;]+)?)\b/gi, '')
    .replace(/,?\s*\b(?:standing|sitting|kneeling|leaning|crouching)\s+(?:in|on|near|beside)\s+[^,.;]+/gi, '')
    .replace(/\.?\s*\b(?:stance|posture)\s+is\s+(?:natural|relaxed|upright|tense|rigid|neutral)[^.]*\.?/gi, '')
    .replace(/,?\s*\bfeet\s+planted(?:\s+firmly)?\s+on\s+[^,.;]+/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Checks whether the story's visual style is strictly monochrome / black-and-white ink.
 */
export function isMonochromeStyle(styleProfile?: StyleProfile): boolean {
  if (!styleProfile) return false;
  const artLower = (styleProfile.artStyle || '').toLowerCase();
  const paletteRaw = (styleProfile.colorPalette || '').toLowerCase();
  // Strip references where monochrome/B&W modifies a physical prop (e.g. "black-and-white film prints") rather than overall style
  const paletteWithoutProps = paletteRaw.replace(
    /\b(?:stark\s+)?(?:monochrome\s+)?black[-\s]+and[-\s]+white\s+(?:silver[-\s]+gelatin\s+)?(?:film\s+)?(?:prints?|photos?|photographs?|negatives?|snapshots?|polaroids?)\b/gi,
    ''
  );
  const combined = `${artLower} ${paletteWithoutProps}`.trim();
  const hasMono = /\b(?:black\s+and\s+white|black-and-white|black-white|monochrome|monochromatic|greyscale|grayscale|no\s+gray\s+gradients|b&w)\b/i.test(
    combined
  );
  if (!hasMono) return false;

  // Preserve full-color palettes that only contrast selective accents or use multiple rich chromatic hues
  if (
    /\b(?:contrasted\s+with\s+(?:\w+\s+){0,2}(?:red|crimson|neon|amber|orange)|selective\s+color)\b/i.test(
      `${artLower} ${paletteRaw}`
    )
  ) {
    return false;
  }
  const artDeclaresMono = /\b(?:black\s+and\s+white|black-and-white|monochrome|greyscale|grayscale|no\s+gray\s+gradients|b&w)\b/i.test(
    artLower
  );
  if (!artDeclaresMono && /\b(?:crimson|amber|orange|khaki|emerald|cobalt|magenta|yellow)\b/i.test(paletteWithoutProps)) {
    return false;
  }
  return true;
}

/**
 * Strips chromatic Kelvin and color-light descriptors ("3200K warm tungsten", "cold 5400K",
 * "cold cyan rim light") when generating monochrome / black-and-white manga prompts.
 */
export function sanitizeMonochromeLighting(text: string, styleProfile?: StyleProfile): string {
  if (!text || typeof text !== 'string' || !isMonochromeStyle(styleProfile)) {
    return text;
  }

  let cleaned = normalizeUnicodeAndDashes(text)
    .replace(
      /\b(?:dim\s+candlelit\s+key\s+light\s+at\s+\d{4}K\s+(?:warm\s+|cool\s+|cold\s+)?(?:tungsten|daylight)?)/gi,
      'stark chiaroscuro candlelit key light'
    )
    .replace(/\b(?:at\s+)?\d{4}K\s+(?:warm\s+|cool\s+|cold\s+)?(?:tungsten|daylight|balanced\s+daylight)?/gi, '')
    .replace(/\b(?:intense\s+)?(?:cold\s+|cool\s+|electric\s+)?cyan\s+(?:rim\s+)?light(?:ing)?/gi, 'stark white-edge rim highlight')
    .replace(/\b(?:cold\s+|cool\s+|electric\s+)?cyan\s+(accents?|tints?|glow|highlights?)\b/gi, 'stark white $1')
    .replace(/\b(?:cold\s+|cool\s+|electric\s+)?cyan\b/gi, 'white')
    .replace(/\b(?:warm\s+(?:tungsten|amber|golden)|cool\s+(?:daylight|fluorescent|blue)|cold\s+(?:blue|5400K))\b/gi, 'stark high-contrast')
    .replace(/\b(?:amber|crimson|ruby\s+red|neon\s+cyan|emerald|cobalt)\s+(?:rim\s+|key\s+|glow|light(?:ing)?|highlight|accents?)/gi, 'stark monochrome $1')
    .replace(/\bwith\s+stark\s+white\s+accents\s+accents/gi, 'with stark white highlights')
    .replace(/\bhard\s+noir\s+film\s+noir\b/gi, 'hard film noir')
    .replace(/\b(?:stark high-contrast\s+){2,}/gi, 'stark high-contrast ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Fixes accidental consecutive duplicate words ("curtain curtain" -> "curtain")
 * and obvious "a <vowel>" article typos ("a indigo" -> "an indigo") without altering
 * intentional narration text.
 */
export function sanitizePromptGrammarAndTypos(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = normalizeUnicodeAndDashes(text);
  // Collapse accidental consecutive duplicate words of 3+ letters and "hard noir film noir"
  cleaned = cleaned
    .replace(/\b([a-zA-Z]{3,})\s+\1\b/gi, '$1')
    .replace(/\bhard\s+noir\s+film\s+noir\b/gi, 'hard film noir')
    .replace(/\bsharp,\s*deep,\s*yet\s+soft-edged\s+shadows\b/gi, 'sharp, deep cast shadows')
    .replace(/\bof\s+extreme\s+detail\s+of\b/gi, 'extreme detail of')
    .replace(/\bof\s+(?:a\s+|an\s+|the\s+)?(?:macro|close)\s+view\s+of\b/gi, 'macro detail of')
    .replace(/\bneo-(Seoul|Tokyo|Kyoto)\b/g, 'Neo-$1');
  // Fix "a <vowel-word>" article errors on common colors, materials, and visual nouns
  cleaned = cleaned.replace(
    /\b(a)\s+(?=(?:indigo|amber|orange|ivory|olive|emerald|onyx|ebony|obsidian|ochre|ethereal|ornate|elderly|elder|aged|ancient|oversized|empty|eerie|iron|open|arch|oval|alley|awning|apron|oak|ash|overcoat)\b)/gi,
    (_m, article: string) => (article === 'A' ? 'An ' : 'an ')
  );
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Replaces raw CamelCase sheet variable keys ("DarkRoom", "Protagonist", "CastleCourtyard")
 * with natural descriptive prose so image generators never receive unexpanded variable tokens.
 */
export function normalizeContinuitySheetKeys(sheet: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, val] of Object.entries(sheet || {})) {
    const cleanKey = rawKey
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanKey && val) {
      normalized[cleanKey] = sanitizePromptGrammarAndTypos(val);
    }
  }
  return normalized;
}

export function expandEntityKeysInPrompt(
  prompt: string,
  characterSheet?: Record<string, string>,
  locationSheet?: Record<string, string>
): string {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = normalizeUnicodeAndDashes(prompt).replace(/,([^\s0-9])/g, ', $1');

  // Handle location keys (expand multi-word CamelCase tokens like DarkRoom or strip redundant key prefix)
  if (locationSheet) {
    for (const [locKey, locDesc] of Object.entries(locationSheet)) {
      const escaped = locKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isCamelCaseVar = /^[A-Z][a-z]+[A-Z][a-zA-Z0-9]+$/.test(locKey);
      if (!isCamelCaseVar) continue;

      const conciseLoc = stripTransientExpressionsAndPoses(locDesc).split('.')[0].trim();
      const shortLoc = buildCompactCharacterAnchor(conciseLoc, 14) || locKey.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

      // Pattern 1: "DarkRoom (description)" -> "description" or "cramped dark room (description)"
      cleaned = cleaned.replace(
        new RegExp(`\\b${escaped}\\s*\\(([^)]+)\\)`, 'gi'),
        (_m, inner) => inner.trim()
      );
      // Pattern 2: "DarkRoom, cramped dim bedroom" -> "cramped dim bedroom"
      cleaned = cleaned.replace(
        new RegExp(`\\b${escaped},\\s*`, 'gi'),
        ''
      );
      // Pattern 3: bare "DarkRoom" -> readable description
      cleaned = cleaned.replace(
        new RegExp(`\\bin\\s+the\\s+cramped\\s+${escaped}\\b`, 'gi'),
        `inside a ${shortLoc}`
      );
      cleaned = cleaned.replace(
        new RegExp(`\\b${escaped}\\b`, 'g'),
        shortLoc
      );
    }
  }

  // Replace generic role placeholder key "Protagonist" with natural prose
  cleaned = cleaned.replace(/\bProtagonist\s*\(([^)]+)\)/g, 'the protagonist ($1)');
  cleaned = cleaned.replace(/\bon\s+Protagonist\b/gi, 'on the protagonist');
  cleaned = cleaned.replace(/\bProtagonist\b/g, 'the protagonist');

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Removes residual Video-mode camera motion phrases in Image mode, deduplicates focal lengths ("35mm 35mm"),
 * fixes double periods (".."), and ensures a valid lens prescription is present for Image mode.
 */
export function sanitizeStillImageMotionAndOptics(
  prompt: string,
  shotType: string,
  isVideoMode: boolean
): string {
  let cleaned = sanitizePromptGrammarAndTypos(prompt || '');

  // Deduplicate repeated focal lengths (e.g. "35mm 35mm f/2.8" or "8mm 8mm" -> "35mm f/2.8")
  cleaned = cleaned.replace(/\b(\d{1,3}mm)\s+\1\b/gi, '$1');

  // Derive effective shot framing from the actual prompt opening first so stale caller shotType never stamps 85mm onto a Wide shot
  const bodyNoOrient = stripLeadingOrientationPrefixes(cleaned).toLowerCase();
  const inferredOpeningShot = /\bextreme\s+close[-\s]*up\b/.test(bodyNoOrient.slice(0, 60))
    ? 'extreme close-up'
    : /\bmedium\s+close[-\s]*up\b/.test(bodyNoOrient.slice(0, 60))
      ? 'medium close-up'
      : /\bclose[-\s]*up\b/.test(bodyNoOrient.slice(0, 60))
        ? 'close-up'
        : /\b(?:extreme\s+wide|wide(?:\s+establishing)?)\b/.test(bodyNoOrient.slice(0, 60))
          ? 'wide'
          : /\bmedium\b/.test(bodyNoOrient.slice(0, 60))
            ? 'medium'
            : (shotType || '').toLowerCase();

  if (!isVideoMode) {
    // Strip kinetic camera tracking directives and freeze active continuous motion into still-frame states
    cleaned = cleaned
      .replace(/\btracking\s+(?:left|right|upward|downward|forward|back)\s+to\s+reveal\b/gi, 'revealing')
      .replace(/\btracking\s+(?:left|right|upward|downward|forward|back)\s+as\b/gi, 'as')
      .replace(/\btracking\s+(?:left|right|upward|downward|across|subject)\b/gi, '')
      .replace(/\bunfurl\s+dramatically\b/gi, 'frozen mid-unfurl')
      .replace(/\btip\s+over\s+and\s+slide\s+rapidly\b/gi, 'tipped over mid-slide')
      .replace(/\bslide\s+rapidly\b/gi, 'frozen mid-slide')
      .replace(/\bswing\s+abruptly\s+inward\b/gi, 'angled sharply inward')
      .replace(/\bcompress\s+shut\b/gi, 'tightly compressed')
      .replace(/\b(crisp|clean|sharp|frozen|single)\s+static\s+frame\s+of\b/gi, '$1 view of')
      .replace(/\bstatic\s+frame\s+of\b/gi, 'of')
      .replace(/\b(?:eye-level|low-angle|high-angle)\s+static\s+frame\s+showing\b/gi, '$1 showing')
      .replace(/\bpanning\s+(?:left|right|across)\s+(?:to|over)\b/gi, 'across')
      .replace(/\blistening\s+to\s+an\s+unseen\s+whisper,?\s*/gi, 'standing tense in silence, ')
      .replace(/\bvibrating\s+with\s+pulsating\b/gi, 'etched with glowing')
      .replace(/\boutward-expanding\b/gi, 'frozen outward concentric')
      .replace(/\bpulsating\b/gi, 'glowing')
      .replace(/\bvibrating\b/gi, 'charged')
      .replace(/\bas\s+it\s+emits\s+musical\s+harmonic\s+pulses\b/gi, 'radiating crisp luminous concentric rings')
      .replace(/\bmusical\s+harmonic\s+pulses\b/gi, 'luminous concentric ring patterns')
      .replace(/\bswirling\s+vortex\s+of\b/gi, 'radiant spiral pattern of')
      .replace(/\b(?:clouds?\s+)?swirls?\s+above\b/gi, 'dense curved storm-cloud formations hang frozen above')
      .replace(
        /\b(the\s+|a\s+|an\s+)?swirling\s+((?:storm\s+)?(?:rain|snow|mist|fog|smoke|dust|ash|clouds?|leaves|water|petals|sparks|embers|wind|spray))\b/gi,
        '$1$2 frozen in curved spiral patterns'
      )
      .replace(/\bswirling\b/gi, 'frozen in curved spiral patterns')
      .replace(/\blashing\s+violently\s+against\b/gi, 'frozen mid-lash against')
      .replace(/\blashing\s+against\b/gi, 'pressed mid-splash against')
      .replace(/\bsweeping\s+out\s+over\b/gi, 'stretching across')
      .replace(/\bslicing\s+through\b/gi, 'cutting sharply through')
      .replace(/\bpouring\b/gi, 'suspended mid-pour')
      .replace(/\b(particles|embers|sparks|steam|mist|dust|smoke)\s+rising\b/gi, '$1 suspended mid-air')
      .replace(/\b(steam|particles|embers|dust)\s+rising\s+in\b/gi, '$1 suspended in')
      .replace(/\bstreaming\s+in\s+a\s+thin\s+ribbon\b/gi, 'suspended in a thin frozen ribbon')
      .replace(/\bhovering\b/gi, 'hanging motionless')
      .replace(/\bfluttering\s+in\s+(?:the\s+)?breeze\b/gi, 'frozen mid-billow')
      .replace(/\bflickering\s+((?:[a-z]+\s+){0,2}?(?:bulb|lamp|light|candle|lantern|flame|sign|screen|monitor|neon|tube))\b/gi, 'still-lit $1')
      .replace(/\bflickering\b/gi, 'frozen in mid-glow')
      .replace(/\bchurning\b/gi, 'crisp frozen ripples')
      .replace(/\bliquid\s+motion\b/gi, 'frozen liquid details');

    // Correct mismatched wide-angle 24mm lens descriptors accidentally copied onto tight Close-Up / Extreme Close-Up shots
    if (inferredOpeningShot.includes('extreme close') || /\bextreme\s+close[-\s]*up\b/i.test(cleaned.slice(0, 90))) {
      cleaned = cleaned.replace(/\bShot\s+on\s+24mm\s+(?:wide(?:-angle)?\s+)?prime\s+lens/gi, 'Shot on 100mm macro prime lens');
    } else if (inferredOpeningShot.includes('close-up') || /\bclose[-\s]*up\b/i.test(cleaned.slice(0, 80))) {
      cleaned = cleaned.replace(/\bShot\s+on\s+24mm\s+(?:wide(?:-angle)?\s+)?prime\s+lens/gi, 'Shot on 85mm portrait prime lens');
    }

    // Collapse conflicting double lens statements when a bare fisheye/wide-angle lens clause precedes a "Shot on ..." lens clause
    const hasShotOnClause = /\bShot\s+on\s+\d{1,3}mm\b/i.test(cleaned);
    if (hasShotOnClause) {
      if (inferredOpeningShot.includes('wide') && /\b(?:\d{1,3}mm\s+)?(?:wide-angle\s+)?fisheye\s+lens\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/,\s*Shot\s+on\s+(?:50|85|100)mm[^.]*\./gi, '.').replace(/\.\s*Shot\s+on\s+(?:50|85|100)mm[^.]*\./gi, '.');
      }
      cleaned = cleaned
        .replace(/^\s*(?:\d{1,3}mm\s+)?(?:wide-angle\s+)?(?:distorted\s+)?fisheye\s+lens(?:\s+simulation)?\.(?=\s*Shot\s+on\b)/gi, '')
        .replace(/\.\s+(?:\d{1,3}mm\s+)?(?:wide-angle\s+)?(?:distorted\s+)?fisheye\s+lens(?:\s+simulation)?\.(?=\s*Shot\s+on\b)/gi, '.')
        .trim();
    }
  }

  // Fix double periods (".." -> ".") and duplicate commas
  cleaned = cleaned
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/,([^\s0-9])/g, ', $1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Ensure lens/optics prescription in Image Mode when missing (recognize 1-digit mm like 8mm and descriptive fisheye/wide/macro lens phrases)
  const hasExplicitOptics =
    /\b\d{1,3}mm\b/i.test(cleaned) ||
    /\b(?:fisheye|macro|wide-angle|telephoto|anamorphic|portrait|prime)\s+lens\b/i.test(cleaned);
  if (!isVideoMode && !hasExplicitOptics) {
    const defaultLens =
      inferredOpeningShot.includes('extreme close') || inferredOpeningShot.includes('close-up')
        ? 'Shot on 85mm f/1.4 portrait prime lens, shallow depth of field'
        : inferredOpeningShot.includes('wide')
          ? 'Shot on 24mm f/4 wide lens, deep focus'
          : 'Shot on 50mm f/2.0 prime lens, balanced depth of field';

    const styleIdx = cleaned.search(/\bVisual Style:/i);
    if (styleIdx > 0) {
      const before = cleaned.slice(0, styleIdx).replace(/[.,\s]+$/, '');
      const after = cleaned.slice(styleIdx);
      cleaned = `${before}, ${defaultLens}. ${after}`;
    } else {
      const arIdx = cleaned.search(/\s*--ar\b/i);
      if (arIdx > 0) {
        const before = cleaned.slice(0, arIdx).replace(/[.,\s]+$/, '');
        const after = cleaned.slice(arIdx);
        cleaned = `${before}, ${defaultLens}.${after}`;
      } else {
        cleaned = `${cleaned.replace(/[.,\s]+$/, '')}, ${defaultLens}.`;
      }
    }
  }

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export const CHARACTER_ANCHOR_MAX_WORDS = 40;
export const STYLE_ANCHOR_MAX_WORDS = 28;

/**
 * Option A: Builds a compact, high-signal visual identity + eyewear + outfit/gear anchor
 * breaking strictly at complete comma/clause boundaries so descriptions never truncate glasses or outfits.
 */
export function buildCompactCharacterAnchor(fullDesc: string, maxWords: number = 40): string {
  if (!fullDesc || typeof fullDesc !== 'string') return '';
  let clean = stripTransientExpressionsAndPoses(fullDesc)
    .replace(/^(?:[A-Z][a-zA-Z0-9_-]*)\s+(?:has|is|wears|wearing)\s+/i, '')
    .replace(/\bAll fabrics show[^.]*\.?/gi, '')
    .replace(/\bHis\s+/gi, '')
    .replace(/\bHer\s+/gi, '')
    .replace(/\bThey\s+/gi, '')
    .replace(/\bHe wears\b/gi, 'wearing')
    .replace(/\bShe wears\b/gi, 'wearing')
    .replace(/\bThe weapon is a\b/gi, 'with')
    .replace(/\bThe rifle is a\b/gi, 'with')
    .trim();

  // Split by sentences/commas so we keep only whole semantic traits (no broken endings like "neutral)")
  const phrases = clean
    .split(/[.;,]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const selectedPhrases: string[] = [];
  let runningWords = 0;

  for (const phrase of phrases) {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (runningWords + words.length <= maxWords) {
      selectedPhrases.push(phrase);
      runningWords += words.length;
    } else if (selectedPhrases.length === 0) {
      // First phrase alone exceeds maxWords: take crisp prefix cleanly
      selectedPhrases.push(words.slice(0, maxWords).join(' '));
      break;
    } else {
      break;
    }
  }

  let summary = selectedPhrases.join(', ').replace(/[,:;.\s]+$/, '').trim();
  if (!summary) {
    summary = clean.split(/\s+/).slice(0, maxWords).join(' ').replace(/[,:;.\s]+$/, '').trim();
  }
  return summary;
}

const SIGNATURE_TRAIT_CLAUSE_REGEX =
  /\b(?:glasses|spectacles|eyeglasses|goggles|monocle|sunglasses|beard|mustache|scar|freckles|hair|suit|sweater|cardigan|jacket|coat|trench|blazer|shirt|blouse|tie|bowtie|dress|gown|hoodie|cloak|robe|apron|vest|uniform|boots|shoes|sneakers|hat|cap|helmet|scarf)\b/i;

/**
 * Reconciles each character's Continuity Sheet entry with their first clean appearance in the storyboard
 * (typically Scene 1 Beat 1 for the protagonist, Scene 1 Beat 2 for secondary cast), copying concrete
 * fixed visual traits (hair, eyewear/glasses, outfit, footwear) without pulling transient actions or scenes.
 */
export function synchronizeCharacterSheetWithFirstAppearances(
  scenes: Scene[],
  characterSheet: Record<string, string>
): Record<string, string> {
  if (!characterSheet || Object.keys(characterSheet).length === 0) {
    return characterSheet || {};
  }

  const synced: Record<string, string> = {};
  for (const [k, v] of Object.entries(characterSheet)) {
    synced[k] = (stripTransientExpressionsAndPoses(v || '') || v || '').replace(/\s+/g, ' ').trim();
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return synced;
  }

  const allBeats: Beat[] = [];
  for (const sc of scenes) {
    for (const b of sc.beats || []) {
      allBeats.push(b);
    }
  }
  if (allBeats.length === 0) return synced;

  const charEntries = Object.entries(synced);
  const allCharNames = charEntries.map(([name]) => name);

  for (const [charName, baseDesc] of charEntries) {
    if (!baseDesc) continue;
    const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\b${escapedName}(?:'s)?\\b`, 'i');
    const aliasRegex = buildCharacterAliasRegex(charName, allCharNames);
    const charIsChild = /\b(?:child|nine-year-old|\d+-year-old\s+(?:boy|girl|child)|young\s+(?:boy|girl)|little\s+(?:boy|girl))\b/i.test(
      `${charName} ${baseDesc}`
    );
    const charIsFlashbackRole =
      charIsChild ||
      /\b(?:mother|father|grandmother|grandfather|parent|elder|mentor|late\s+(?:mother|father))\b/i.test(
        `${charName} ${baseDesc}`
      );

    let firstBeat: Beat | undefined;
    for (const b of allBeats) {
      const p = b.imagePrompt || '';
      if (!p || isCharacterFreeBeat(p, b.textSpan || '')) continue;
      const bodyOnly = p.replace(/\s*--ar\s+[0-9:]+.*$/i, '').replace(/\bVisual Style:[^.]*\.?/gi, '');
      const beatIsFlashback = isInfancyOrChildhoodFlashback(b.textSpan || '', bodyOnly);
      if (beatIsFlashback && !charIsFlashbackRole) continue;
      if (!beatIsFlashback && charIsChild && !/\b(?:girl|boy|child|young)\b/i.test(bodyOnly)) continue;

      const mentionsSelf =
        nameRegex.test(bodyOnly) ||
        nameRegex.test(b.textSpan || '') ||
        (aliasRegex ? aliasRegex.test(bodyOnly) || aliasRegex.test(b.textSpan || '') : false) ||
        (charEntries.length === 1 && allBeats[0] === b);

      if (!mentionsSelf) continue;

      const mentionsOtherChar = charEntries.some(([otherName]) => {
        if (otherName === charName) return false;
        const escOther = otherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const otherAlias = buildCharacterAliasRegex(otherName, allCharNames);
        return (
          new RegExp(`\\b${escOther}(?:'s)?\\b`, 'i').test(bodyOnly) ||
          (otherAlias ? otherAlias.test(bodyOnly) : false)
        );
      });
      if (mentionsOtherChar) continue;

      firstBeat = b;
      break;
    }

    if (!firstBeat) continue;

    const firstBody = (firstBeat.imagePrompt || '')
      .replace(/\s*--ar\s+[0-9:]+.*$/i, '')
      .replace(/\bVisual Style:[^.]*\.?/gi, '')
      .replace(/\bShot on\s+\d{2,3}mm[^.]*\.?/gi, '')
      .trim();

    const appositiveRegex = new RegExp(
      `(?:the\\s+)?${escapedName}\\s*,\\s*(?:an?\\s+[^.;]+?)(?=\\s+(?:leans|stands|looms|sits|walks|steps|runs|adjusts|tucks|holds|pulls|reaches|places|spreads|poises|stares|looks|grips|signs|checks|opens|closes|turns|braces|moves|catches|smiles|frowns|writes)\\b|[.;])`,
      'i'
    );
    const appositiveMatch = firstBody.match(appositiveRegex);
    const parentheticalMatch = firstBody.match(new RegExp(`\\b${escapedName}\\s*\\(([^)]+)\\)`, 'i'));

    const extractedRaw =
      parentheticalMatch?.[1] ||
      (appositiveMatch ? appositiveMatch[0].replace(new RegExp(`^(?:the\\s+)?${escapedName}\\s*,\\s*`, 'i'), '') : '');
    if (!extractedRaw) continue;

    const cleanedExtracted = (stripTransientExpressionsAndPoses(extractedRaw) || extractedRaw)
      .replace(/\bplanted on[^,.;]+/gi, '')
      .trim();
    if (!cleanedExtracted) continue;

    const baseLower = baseDesc.toLowerCase();
    const extractedClauses = cleanedExtracted
      .split(/[,;]+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 4 && SIGNATURE_TRAIT_CLAUSE_REGEX.test(c));

    const missingClauses: string[] = [];
    for (const clause of extractedClauses) {
      const sigWords = clause
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .filter((w) => w.length > 3 && SIGNATURE_TRAIT_CLAUSE_REGEX.test(w));
      const alreadyCovered = sigWords.some((sw) => {
        if (sw === 'glasses' || sw === 'spectacles' || sw === 'eyeglasses') {
          return /\b(?:glasses|spectacles|eyeglasses)\b/i.test(baseLower);
        }
        return new RegExp(`\\b${sw}\\b`, 'i').test(baseLower);
      });
      if (!alreadyCovered) {
        missingClauses.push(clause);
      }
    }

    if (missingClauses.length > 0) {
      const combined = `${baseDesc.replace(/[.,;]+$/, '')}, ${missingClauses.join(', ')}`;
      synced[charName] = buildCompactCharacterAnchor(combined, CHARACTER_ANCHOR_MAX_WORDS + 4) || combined;
    }
  }

  return synced;
}

/**
 * Checks whether a beat explicitly depicts an empty/character-free or cartographic shot.
 */
export function isCharacterFreeBeat(prompt: string, textSpan: string): boolean {
  const lower = `${prompt} ${textSpan}`.toLowerCase();
  if (
    lower.includes('no characters') ||
    lower.includes('no soldier in frame') ||
    lower.includes('no people') ||
    lower.includes('absent') ||
    lower.includes('terrestrial globe') ||
    lower.includes('topographic map') ||
    lower.includes('location pin') ||
    lower.includes('empty scene')
  ) {
    return true;
  }
  const hasEmptyLocationPhrase = /\b(?:empty|uninhabited|deserted)\s+(?:headland|pier|dock|shoreline|coastline|beach|cove|street|alley|plaza|square|room|hallway|parlor|landscape|skyline|lighthouse|house)\b/i.test(
    prompt
  );
  const promptHasPersonNoun = /\b(?:man|woman|boy|girl|child|baby|infant|person|figure|silhouette|crowd|people|soldier|detective|inventor|artist|scientist|engineer|astronaut|photographer|archivist|cat|dog|creature|entity|his|her|their|she|he)\b/i.test(
    prompt.replace(/\bVisual Style:[^.]*\.?/gi, '')
  );
  if (hasEmptyLocationPhrase && !promptHasPersonNoun) {
    return true;
  }
  const geo = extractGeographicAnchor(textSpan);
  if (geo && getWordCount(textSpan) <= 3) {
    return true;
  }
  return false;
}

/**
 * Option A: Injects the compact locked visual identity anchor into every beat where
 * a character is present or referenced (including via pronouns when the scene subject is known),
 * unless the beat is explicitly character-free or already contains the locked traits.
 */
const GENERIC_ALIAS_WORDS = new Set([
  'the', 'a', 'an', 'young', 'old', 'tall', 'tiny', 'dark', 'bright', 'chrome', 'chrome-faced',
  'street', 'shadow', 'neon', 'black', 'white', 'red', 'blue', 'cyber', 'armored', 'masked',
  'lead', 'main', 'unknown', 'stranger', 'figure', 'person', 'man', 'woman', 'boy', 'girl',
  'brass', 'bronze', 'copper', 'gold', 'golden', 'silver', 'iron', 'steel', 'titanium',
  'metal', 'metallic', 'amber', 'resin', 'clay', 'porcelain', 'ceramic', 'glass', 'frosted',
  'obsidian', 'marble', 'stone', 'wood', 'wooden', 'oak', 'paper', 'cardstock', 'cloth',
  'wool', 'velvet', 'leather', 'plastic', 'mechanical', 'clockwork', 'translucent', 'brushed',
  'articulated', 'matte', 'heavy', 'short', 'ancient', 'modern', 'antique', 'polymer',
  'ramen', 'midnight', 'noodle', 'noodles', 'broth', 'soup', 'tea', 'coffee', 'bread',
  'stall', 'shop', 'cart', 'market', 'shrine', 'lantern', 'wandering', 'spirit', 'ghost',
  'spectral', 'patron', 'guest', 'customer', 'traveler', 'traveller', 'visitor', 'chef',
  'cook', 'baker', 'keeper', 'owner', 'master', 'elder', 'monk', 'priest', 'vendor',
  'merchant', 'witch', 'wizard', 'healer', 'guard', 'watchman', 'forest', 'mountain',
]);

const ROLE_SUFFIX_NOUNS = new Set([
  'chef', 'cook', 'baker', 'keeper', 'owner', 'master', 'vendor', 'merchant', 'patron',
  'guest', 'customer', 'traveler', 'traveller', 'visitor', 'ghost', 'spirit', 'elder',
  'monk', 'priest', 'witch', 'wizard', 'healer', 'guard', 'soldier', 'knight', 'driver',
  'worker', 'student', 'teacher', 'artist', 'scientist', 'waiter', 'barista', 'bartender',
]);

function buildCharacterAliasRegex(charName: string, allCharNames: string[]): RegExp | null {
  const parts = charName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const firstToken = parts[0].replace(/[^a-zA-Z0-9-]/g, '');
  const lastToken = parts[parts.length - 1].replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  if (firstToken.length < 3 || GENERIC_ALIAS_WORDS.has(firstToken.toLowerCase())) return null;
  if (parts.length === 2 && ROLE_SUFFIX_NOUNS.has(lastToken)) return null;

  const collidesWithOther = allCharNames.some((other) => {
    if (other === charName) return false;
    return new RegExp(`\\b${firstToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(other);
  });
  if (collidesWithOther) return null;

  const escapedFirst = firstToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedFirst}(?:'s)?\\b(?!\\s+(?:stall|cart|shop|bowl|soup|broth|noodles|stand|counter)\\b)`, 'i');
}

const COMMON_NOUN_CHARACTER_NAMES = new Set([
  'ink', 'shadow', 'ash', 'rain', 'dust', 'stone', 'flame', 'light', 'rose', 'grace',
  'faith', 'storm', 'frost', 'glass', 'mirror', 'time', 'hope', 'echo', 'wolf', 'crow',
  'cat', 'dog', 'sky', 'sun', 'moon', 'star',
]);

const GENERIC_VISUAL_TRAIT_WORDS = new Set([
  'soft', 'hard', 'warm', 'cool', 'cold', 'dark', 'light', 'bright', 'deep', 'pale',
  'white', 'black', 'gray', 'grey', 'terracotta', 'charcoal', 'crimson', 'amber', 'gold',
  'golden', 'cobalt', 'slate', 'silver', 'cream', 'small', 'large', 'tiny', 'tall',
  'long', 'short', 'thick', 'thin', 'round', 'flat', 'simple', 'clean', 'bold', 'heavy',
  'wooden', 'paper', 'painted', 'stylized', 'expressive', 'lumpy', 'young', 'older',
  'companion', 'artist', 'edges', 'surface', 'textures',
  'adult', 'back', 'weathered', 'worn', 'fair', 'brown', 'yellow', 'navy', 'green',
  'rolled', 'tanned', 'buttoned', 'striped', 'over', 'under', 'coastal', 'neatly', 'tied',
  'clay', 'handcrafted', 'miniature', 'miniatures', 'figure', 'figures', 'figurine',
  'sculpted', 'matte', 'proportions', 'planes', 'rounded', 'angular', 'tailored',
  'crisp', 'polished', 'sturdy', 'diorama', 'porcelain', 'puppet', 'plush', 'human', 'tone',
  'brass', 'brushed', 'articulated', 'translucent', 'resin', 'mechanical', 'clockwork',
  'frosted', 'obsidian', 'marble', 'oak', 'wool', 'smooth', 'minimal', 'waistcoat', 'cotton',
]);

export function injectCompactCharacterLocks(
  prompt: string,
  textSpan: string,
  sceneNarration: string,
  characterSheet: Record<string, string>
): string {
  if (!prompt || !characterSheet || Object.keys(characterSheet).length === 0) {
    return prompt;
  }
  if (isCharacterFreeBeat(prompt, textSpan)) {
    return prompt;
  }

  const isFlashback = isInfancyOrChildhoodFlashback(textSpan, prompt);
  let updated = prompt;
  // Filter out pure graphic/typography overlay entries accidentally placed in characterSheet (e.g. "The Headlines")
  const charEntries = Object.entries(characterSheet).filter(([cName, cDesc]) => {
    const combined = `${cName} ${cDesc || ''}`;
    const isTypographyEffectOnly =
      /\b(?:text\s+blocks?|terminal\s+font|digital\s+text|captions?|subtitles?|headlines?)\b/i.test(combined) &&
      !/\b(?:person|man|woman|boy|girl|figure|stickman|character|photographer|chef|biologist|scientist|soldier|detective|spirit|ghost|creature|entity|submersible|robot|wearing|eyes|hair|hands|arms)\b/i.test(
        combined
      );
    return !isTypographyEffectOnly;
  });
  if (charEntries.length === 0) {
    return prompt;
  }
  const allCharNames = charEntries.map(([name]) => name);
  const singleLeadChar = charEntries.length === 1 ? charEntries[0] : null;
  const spanLower = (textSpan || '').toLowerCase();

  // Compute tokens shared across multiple characters in the cast (e.g. shared clay/robot/knight traits)
  // so shared cast medium adjectives never cross-trigger an absent character
  const sharedCastTokens = new Set<string>();
  if (charEntries.length > 1) {
    const tokenFreq = new Map<string, number>();
    for (const [, desc] of charEntries) {
      const uniq = new Set(
        (desc || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, ' ')
          .split(/[\s-]+/)
          .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      );
      for (const tok of uniq) {
        tokenFreq.set(tok, (tokenFreq.get(tok) || 0) + 1);
      }
    }
    for (const [tok, count] of tokenFreq.entries()) {
      if (count >= 2) sharedCastTokens.add(tok);
    }
  }

  // Strip Visual Style and --ar suffixes before scanning visual character traits so style keywords never trigger phantom casts
  const bodyWithoutStyleOrAr = updated
    .replace(/\s*--ar\s+[0-9:]+.*$/i, '')
    .replace(/\bVisual Style:[^.]*\.?/gi, '')
    .trim();
  const bodyLower = bodyWithoutStyleOrAr.toLowerCase();
  const bodyWordTokens = new Set(
    bodyLower
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(Boolean)
  );
  const bodyHasCharacterSubject =
    /\b(?:man|woman|boy|girl|child|baby|infant|person|figure|silhouette|stickman|cat|dog|inventor|artist|soldier|enforcer|enforcers|operative|operatives|scientist|engineer|astronaut|astronauts|photographer|detective|archivist|homeowner|lender|entity|creature|creatures|spirit|snow-spirit|mother|father|healer|sketches|drawings|crowd|people|eyes|face|hand|hands|finger|fingers|arm|arms|shoulder|shoulders|boots|feet|hair)\b/i.test(
      bodyLower
    );

  const isCloseUpOrEcu = /\b(?:Close-Up|Extreme Close-Up)\b/i.test(updated);
  const isTightMacroScale = isCloseUpOrEcu && !/\bMedium\s+Close-Up\b/i.test(updated);
  // Pure food/prop macro close-ups (e.g. a bowl of ramen, teacup, stamp) with zero body parts, pronouns, or cast present
  const isPropOrFoodOnlyMacro =
    isTightMacroScale &&
    /\b(?:bowl|ramen|broth|soup|cup|teacup|mug|plate|dish|spoon|chopsticks|cauldron|lantern|stamp|coin|ledger|contract|bottle|scroll|key|ring|book|letter)\b/i.test(
      bodyLower
    ) &&
    !/\b(?:he|him|his|she|her|hers|they|them|their|hand|hands|finger|fingers|palm|knuckles|wrist|arm|arms|face|eyes|head|shoulder|shoulders|mouth|lips|foot|feet|silhouette|figure|man|woman|boy|girl|child|chef|patron|spirit|ghost)\b/i.test(
      bodyLower
    );
  if (isPropOrFoodOnlyMacro) {
    return updated;
  }
  const foregroundSlice = bodyLower
    .replace(/\b(?:toward|at|past)\s+(?:the\s+)?blurred\b[^.]*/gi, '')
    .slice(0, 280);
  const foregroundHasOlder = /\b(?:older woman|older man|elderly|aged|silver-streaked)\b/i.test(foregroundSlice);
  const foregroundHasYoung = /\b(?:young woman|young man|teenager|little boy|little girl)\b/i.test(foregroundSlice);

  const spanHasFemalePronoun = /\b(?:she|her|hers)\b/i.test(spanLower);
  const spanHasMalePronoun = /\b(?:he|him|his)\b/i.test(spanLower);
  const spanHasPluralPronoun = /\b(?:they|them|their|theirs)\b/i.test(spanLower);
  const spanHasNeutralPronoun = /\b(?:it|its)\b/i.test(spanLower);

  const bodyHasFemaleCue = /\b(?:woman|girl|mother|sister|daughter|lady|actress|she|her|hers)\b/i.test(bodyLower);
  const bodyHasMaleCue = /\b(?:man|boy|father|brother|son|guy|actor|he|him|his)\b/i.test(bodyLower);
  const bodyHasNeutralCue = /\b(?:it|its|creature|spirit|snow-spirit|animal|beast|fox|wolf|deer|owl|companion)\b/i.test(
    bodyLower
  );
  const promptHasExplicitChild =
    /\b(?:young\s+girl|young\s+boy|nine-year-old|\d+-year-old\s+(?:boy|girl|child)|childhood\s+(?:summer\s+)?flashback|both\s+children|little\s+girl|little\s+boy|boyhood|girlhood)\b/i.test(
      bodyLower
    );
  const promptHasExplicitAdult =
    /\b(?:adult\s+woman|adult\s+man|older\s+woman|older\s+man|elderly|mid-thirties|silver-streaked)\b/i.test(
      bodyLower
    );

  const tokenMatchesBody = (token: string): boolean => {
    if (bodyWordTokens.has(token)) return true;
    if (token === 'hair' && bodyWordTokens.has('haired')) return true;
    if (token.endsWith('s') && token.length > 4 && bodyWordTokens.has(token.slice(0, -1))) return true;
    return false;
  };

  // Pre-compute visual token match counts (total + distinctive non-generic) on the scene body only
  const tokenMatchCounts = new Map<string, number>();
  const distinctiveMatchCounts = new Map<string, number>();
  let maxMatchedTokens = 0;
  for (const [charName, fullDesc] of charEntries) {
    if (!fullDesc || fullDesc.trim().length < 6) continue;
    const compact = buildCompactCharacterAnchor(fullDesc, CHARACTER_ANCHOR_MAX_WORDS + 4);
    if (!compact) continue;
    const tokens = compact
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    let count = 0;
    let distinctiveCount = 0;
    for (const t of tokens) {
      if (tokenMatchesBody(t)) {
        count++;
        if (!GENERIC_VISUAL_TRAIT_WORDS.has(t) && !sharedCastTokens.has(t)) {
          distinctiveCount++;
        }
      }
    }
    tokenMatchCounts.set(charName, count);
    distinctiveMatchCounts.set(charName, distinctiveCount);
    if (count > maxMatchedTokens) maxMatchedTokens = count;
  }

  for (const [charName, fullDesc] of charEntries) {
    if (!fullDesc || fullDesc.trim().length < 6) continue;

    const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isCommonNounName = COMMON_NOUN_CHARACTER_NAMES.has(charName.trim().toLowerCase());
    const nameFlags = isCommonNounName ? '' : 'i';
    const nameRegex = new RegExp(`\\b${escapedName}(?:'s)?\\b`, nameFlags);
    const aliasRegex = buildCharacterAliasRegex(charName, allCharNames);

    const charIsChild =
      /\b(?:child|nine-year-old|\d+-year-old\s+(?:boy|girl|child)|young\s+(?:boy|girl)|little\s+(?:boy|girl)|boyhood|girlhood)\b/i.test(
        `${charName} ${fullDesc}`
      );
    const isEntityKey = /\b(?:entity|creature|mimic|shadow|warden|monster|stalker|doppelganger|spirit|snow-spirit)\b/i.test(
      `${charName} ${fullDesc}`
    );
    const isFlashbackFamilyOrMentor =
      charIsChild ||
      /\b(?:mother|father|grandmother|grandfather|parent|mentor|elder|late\s+(?:mother|father))\b/i.test(
        `${charName} ${fullDesc}`
      );

    // Protect childhood/infancy flashback beats from present-day adult lead locks leaking in
    // (even when labeled "infant protagonist"), while keeping child variants, flashback relatives (Mother), and entities/creatures active.
    if (isFlashback && !isEntityKey && !isFlashbackFamilyOrMentor) {
      continue;
    }

    // Safe distinctive role/species matching when character name itself is not repeated (e.g. "mother" -> "Sable's Mother", "snow-spirit" -> "Frost")
    const roleTerms: string[] = [];
    const rolePatterns = /\b(snow-spirit|spirit|mother|father|grandmother|grandfather|healer|creature|wolf|fox|owl|deer)\b/gi;
    let roleMatch: RegExpExecArray | null;
    while ((roleMatch = rolePatterns.exec(`${charName} ${fullDesc}`)) !== null) {
      const term = roleMatch[1].toLowerCase();
      if (!roleTerms.includes(term)) {
        const claimedByOther = charEntries.some(
          ([otherName, otherDesc]) =>
            otherName !== charName && new RegExp(`\\b${term.replace('-', '[-\\s]?')}\\b`, 'i').test(`${otherName} ${otherDesc}`)
        );
        if (!claimedByOther) {
          roleTerms.push(term);
        }
      }
    }
    const roleRegex =
      roleTerms.length > 0
        ? new RegExp(`\\b(?:${roleTerms.map((t) => t.replace('-', '[-\\s]?')).join('|')})(?:'s)?\\b`, 'i')
        : null;

    const promptMentionsName =
      nameRegex.test(bodyWithoutStyleOrAr) || (aliasRegex ? aliasRegex.test(bodyWithoutStyleOrAr) : false);
    const beatMentionsName = nameRegex.test(textSpan) || (aliasRegex ? aliasRegex.test(textSpan) : false);
    const narrationMentionsName =
      nameRegex.test(sceneNarration) || (aliasRegex ? aliasRegex.test(sceneNarration) : false);
    const promptMentionsUniqueRole = Boolean(roleRegex && roleRegex.test(bodyWithoutStyleOrAr));
    const beatMentionsUniqueRole = Boolean(roleRegex && roleRegex.test(textSpan));

    const compactAnchor = buildCompactCharacterAnchor(fullDesc, CHARACTER_ANCHOR_MAX_WORDS);
    if (!compactAnchor) continue;

    const anchorTokens = compactAnchor
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    const matchedAnchorTokens = anchorTokens.filter((t) => tokenMatchesBody(t)).length;
    const matchedTokens = tokenMatchCounts.get(charName) || 0;
    const distinctiveTokens = distinctiveMatchCounts.get(charName) || 0;
    const coverageRatio = anchorTokens.length > 0 ? matchedAnchorTokens / anchorTokens.length : 1;

    // Determine gender/plurality/age compatibility to prevent stamping mismatched subjects onto solo beats
    const isPluralChar =
      /\b(?:enforcers|operatives|guards|soldiers|officers|assassins|agents|hunters|twins|drones|crowd|drawings|sketches|creatures)\b/i.test(
        `${charName} ${fullDesc}`
      );
    const isFemaleChar =
      !isPluralChar && /\b(?:woman|girl|female|mother|sister|daughter|lady|actress)\b/i.test(fullDesc);
    const isMaleChar =
      !isPluralChar && !isFemaleChar && /\b(?:man|boy|male|father|brother|son|guy|actor)\b/i.test(fullDesc);
    const isNeutralCreatureChar =
      !isPluralChar && !isFemaleChar && !isMaleChar && isEntityKey;

    const charIsAdult =
      !charIsChild &&
      /\b(?:adult|mid-thirties|late twenties|early twenties|thirties|forties|fifties|older woman|older man|elderly|middle-aged|silver-streaked)\b/i.test(
        `${charName} ${fullDesc}`
      );

    const charIsYoung = /\b(?:young woman|young man|twenties|early twenties|late twenties|teen|teenager|boy|girl)\b/i.test(
      fullDesc
    );
    const charIsOlder = /\b(?:older woman|older man|elderly|aged|middle-aged|silver-streaked|gray-haired)\b/i.test(
      fullDesc
    );
    const ageMismatch =
      (charIsYoung && foregroundHasOlder && !foregroundHasYoung) ||
      (charIsOlder && foregroundHasYoung && !foregroundHasOlder) ||
      (charIsAdult && promptHasExplicitChild && !promptHasExplicitAdult) ||
      (charIsChild && promptHasExplicitAdult && !promptHasExplicitChild);

    const isRunnerUpInCloseUp =
      isCloseUpOrEcu &&
      charEntries.length > 1 &&
      !promptMentionsName &&
      !beatMentionsName &&
      !promptMentionsUniqueRole &&
      maxMatchedTokens >= 3 &&
      matchedTokens < maxMatchedTokens;

    const effectiveFemalePronounOnly =
      spanHasFemalePronoun && !spanHasMalePronoun && !spanHasPluralPronoun && !bodyHasMaleCue;
    const effectiveMalePronounOnly =
      spanHasMalePronoun && !spanHasFemalePronoun && !spanHasPluralPronoun && !bodyHasFemaleCue;

    const bodyGenderMismatch =
      !promptMentionsName &&
      !beatMentionsName &&
      !promptMentionsUniqueRole &&
      ((isFemaleChar && bodyHasMaleCue && !bodyHasFemaleCue) ||
        (isMaleChar && bodyHasFemaleCue && !bodyHasMaleCue));

    const pronounMismatch =
      (isPluralChar && (spanHasFemalePronoun || spanHasMalePronoun) && !spanHasPluralPronoun) ||
      (isFemaleChar && effectiveMalePronounOnly) ||
      (isMaleChar && effectiveFemalePronounOnly) ||
      bodyGenderMismatch;

    const bodyHasPersonOrSingularPronoun =
      bodyHasCharacterSubject || /\b(?:he|him|his|she|her|hers|it|its)\b/i.test(bodyLower);
    const pronounOrRoleMatch = /\b(?:he|him|his|she|her|hers|they|them|their|it|its|soldier|warrior|knight|hero|man|woman|boy|girl|mother|father|spirit|snow-spirit|forearm|chest plate|trigger|rifle|boots)\b/i.test(
      `${textSpan} ${bodyWithoutStyleOrAr}`
    );

    const matchesViaSingleLead = Boolean(
      singleLeadChar &&
        singleLeadChar[0] === charName &&
        pronounOrRoleMatch &&
        bodyHasPersonOrSingularPronoun &&
        !pronounMismatch
    );

    const matchesViaVisualTraits =
      bodyHasCharacterSubject &&
      distinctiveTokens >= 2 &&
      matchedTokens >= 2 &&
      !pronounMismatch &&
      !ageMismatch &&
      !isRunnerUpInCloseUp;
    const matchesViaBeatPronounAndNarration =
      narrationMentionsName &&
      bodyHasPersonOrSingularPronoun &&
      !pronounMismatch &&
      !ageMismatch &&
      !isRunnerUpInCloseUp &&
      ((isFemaleChar && (spanHasFemalePronoun || bodyHasFemaleCue) && !spanHasPluralPronoun) ||
        (isMaleChar && (spanHasMalePronoun || bodyHasMaleCue) && !spanHasPluralPronoun) ||
        (isNeutralCreatureChar && (spanHasNeutralPronoun || bodyHasNeutralCue)) ||
        (isPluralChar && spanHasPluralPronoun));

    const matchesViaUniqueRole =
      (promptMentionsUniqueRole || (beatMentionsUniqueRole && narrationMentionsName)) &&
      !ageMismatch &&
      !pronounMismatch;

    const shouldInject =
      promptMentionsName ||
      beatMentionsName ||
      matchesViaUniqueRole ||
      matchesViaSingleLead ||
      matchesViaVisualTraits ||
      matchesViaBeatPronounAndNarration;

    if (!shouldInject) {
      continue;
    }

    // Detect tight extremity close-ups (hands/fingers/cuffs or feet/shoes) so unrelated hair/trousers/shoes do not break tight framing
    const isHandDetailCloseUp =
      isCloseUpOrEcu &&
      /\b(?:hand|hands|finger|fingers|palm|knuckles|wrist|cuff|cuffs|sleeve|sleeves|thumb)\b/i.test(bodyLower) &&
      !/\b(?:face|head|hair|eyes|shoulders|torso|chest|standing|stands|sits|sitting|looms)\b/i.test(bodyLower);
    const isFootDetailCloseUp =
      isCloseUpOrEcu &&
      /\b(?:foot|feet|shoe|shoes|boot|boots|heel|sole|ankle|ankles)\b/i.test(bodyLower) &&
      !/\b(?:face|head|hair|eyes|shoulders|torso|chest|hand|hands|fingers|standing|stands|sits|sitting|looms)\b/i.test(bodyLower);

    const bodyHasUpperGarmentOrCuff =
      /\b(?:suit|sweater|cardigan|jacket|coat|trench|blazer|shirt|blouse|hoodie|cloak|robe|sleeve|sleeves|cuff|cuffs|collar)\b/i.test(
        bodyLower
      );
    const bodyHasFootwear = /\b(?:boots|shoes|sneakers|heels|sandals|loafers)\b/i.test(bodyLower);

    // Skip injecting full-body locks onto tight hand/foot close-ups that already carry matching material/garment cues
    if (
      !promptMentionsName &&
      ((isHandDetailCloseUp && bodyHasUpperGarmentOrCuff && matchedTokens >= 2) ||
        (isFootDetailCloseUp && bodyHasFootwear && matchedTokens >= 2))
    ) {
      continue;
    }

    // Verify signature eyewear/garment nouns (glasses/spectacles, suit, sweater, tie, etc.) are present before skipping
    const extractSignatureNouns = (txt: string): string[] => {
      const matches =
        (txt || '')
          .toLowerCase()
          .match(
            /\b(?:glasses|spectacles|eyeglasses|goggles|monocle|sunglasses|suit|sweater|cardigan|jacket|coat|trench|blazer|shirt|blouse|tie|bowtie|dress|gown|hoodie|cloak|robe|apron|vest|uniform)\b/g
          ) || [];
      return Array.from(
        new Set(matches.map((m) => (m === 'glasses' || m === 'eyeglasses' ? 'spectacles' : m)))
      );
    };
    const bodySigSet = new Set(extractSignatureNouns(bodyLower));
    const missingSigItems = extractSignatureNouns(compactAnchor).filter((item) => {
      if (isHandDetailCloseUp && /\b(?:boots|shoes|sneakers|trousers|pants|jeans|skirt)\b/i.test(item)) {
        return false;
      }
      return !bodySigSet.has(item);
    });

    const anchorTokenSet = new Set(anchorTokens);
    const traitStopWords = new Set(['a', 'an', 'the', 'her', 'his', 'their', 'on', 'with', 'in', 'over', 'and', 'of', 'tiny', 'small']);
    const actionVerbCheck =
      /\b(?:[a-z]+ing|peeking|leaning|hunched|standing|sitting|seated|gripping|holding|looking|staring|reaching|walking|running|turning|swinging|pulling|pushing|adjusting|pointing|tightening|attaching|steady|steadying|resting|planted|looming|crouching|kneeling|smiling|frowning|listening|watching|peering|glancing)\b/i;
    const pruneAppositiveTraitsAfterLock = (text: string): string => {
      const existingLockRegex = new RegExp(
        `(${escapedName}\\s*\\([^)]+\\))(?:\\s*,\\s*|\\s+(?=(?:carrying|wearing|with|in|stickman|figure|creature)\\b))([^.]+)`,
        'i'
      );
      let pruned = text.replace(existingLockRegex, (fullSeg, headAnchor, tailStr) => {
        const cleanTail = tailStr.replace(/^(?:stickman|figure|creature)\s+/i, '');
        const parts = cleanTail.split(/,\s*/);
        let dropCount = 0;
        for (const part of parts) {
          const pTrim = part.trim();
          if (!pTrim) break;
          // Separate leading redundant appositive like "carrying an ethereal lantern approaching" or "in oil-stained heavy canvas trousers ascends"
          const redundantCarryWearMatch = pTrim.match(
            /^((?:carrying|wearing|with|in)\s+(?:an?\s+|the\s+)?[^,.]+?)(?:\s+(?=(?:approaching|walking|standing|sitting|leaning|holding|entering|looking|staring|crossing|ascending|descending|climbing|stands|sits|works|uses|draws|reaches|picks|ascends|descends|climbs|opens|pulls|strikes|ignites|lights|reads|searches)\b)(.+))?$/i
          );
          if (redundantCarryWearMatch) {
            const candidateClause = redundantCarryWearMatch[1].trim();
            const restAction = (redundantCarryWearMatch[2] || '').trim();
            const cWords = candidateClause
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, ' ')
              .split(/[\s-]+/)
              .filter((w) => w.length > 2 && !traitStopWords.has(w));
            const cOverlap = cWords.filter((w) => anchorTokenSet.has(w) || GENERIC_VISUAL_TRAIT_WORDS.has(w)).length;
            if (cWords.length > 0 && cOverlap / cWords.length >= 0.55) {
              if (restAction) {
                parts[dropCount] = restAction;
                return `${headAnchor} ${parts.slice(dropCount).join(', ')}`.trim();
              }
              dropCount++;
              continue;
            }
          }
          if (actionVerbCheck.test(pTrim)) break;
          const pWords = pTrim
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/[\s-]+/)
            .filter(Boolean);
          if (pWords.length === 0 || pWords.length > 9) break;
          const contentWords = pWords.filter((w) => !traitStopWords.has(w));
          if (contentWords.length === 0) break;
          const overlap = contentWords.filter((w) => anchorTokenSet.has(w) || GENERIC_VISUAL_TRAIT_WORDS.has(w)).length;
          if (overlap / contentWords.length >= 0.7) {
            dropCount++;
          } else {
            break;
          }
        }
        if (dropCount === 0) return fullSeg;
        const keptTail = parts.slice(dropCount).join(', ').trim();
        return keptTail ? `${headAnchor}, ${keptTail}` : headAnchor;
      });
      // Strip redundant glowing/semi-transparent summary sentences if those traits already appear inside a character lock
      if (/\b(?:translucent|semi-transparent)\b/i.test(pruned) && /\bsoft glowing edges\b/i.test(pruned)) {
        pruned = pruned.replace(/\s*They appear semi-transparent with glowing edges\.?/gi, '');
      }
      return pruned;
    };

    // Skip duplicate lock only when inline prompt already preserves the character AND all signature eyewear/garments
    if (
      missingSigItems.length === 0 &&
      ((promptMentionsName && coverageRatio >= 0.5) || coverageRatio >= 0.72)
    ) {
      updated = pruneAppositiveTraitsAfterLock(updated);
      continue;
    }

    // For tight hand-only close-ups (e.g. "Ramen Chef's hands", "Homeowner's hand"), scope lock to upper-body/skin/garment cues without face/headwear/stature/carrying bleed
    let scopedAnchor = compactAnchor;
    if (isHandDetailCloseUp) {
      const handClauses = compactAnchor
        .split(/,\s*/)
        .map((c) =>
          c
            .replace(/\s+and\s+(?:a\s+|the\s+)?(?:traditional\s+)?(?:hachimaki\s+)?(?:headband|bandana|hat|cap|helmet|crown|glasses|spectacles)[^,]*/gi, '')
            .replace(/,?\s*(?:with\s+)?(?:a\s+|the\s+)?(?:traditional\s+)?(?:hachimaki\s+)?(?:headband|bandana|hat|cap|helmet)[^,]*/gi, '')
            .trim()
        )
        .filter(
          (c) =>
            Boolean(c) &&
            !/\b(?:hair|cheeks?|freckles?|face|facial|eyes|eyebrows?|nose|mouth|lips?|chin|jaw|forehead|ears?|head|headband|bandana|hat|cap|helmet|wig|neck|brow|goggles|spectacles|glasses|trousers|pants|jeans|skirt|boots|shoes|sneakers|barefoot|tall|short|stature)\b/i.test(
              c
            ) &&
            !/^\s*carrying\s+/i.test(c)
        );
      if (handClauses.length > 0) {
        scopedAnchor = handClauses.join(', ').trim();
      } else {
        // Only facial/hair/footwear/carrying traits remained outside hands -> skip injecting non-hand lock onto tight hands close-up
        continue;
      }
      // If the hand close-up already names upper garments and only redundant garment phrasing remains, skip noisy Featuring wrap
      const remainingTokens = scopedAnchor
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      const allCoveredByBody = remainingTokens.length > 0 && remainingTokens.every((t) => tokenMatchesBody(t));
      if (!bodyHasUpperGarmentOrCuff && remainingTokens.length === 0) {
        continue;
      }
      if (allCoveredByBody) {
        continue;
      }
    } else if (isFootDetailCloseUp) {
      const footClauses = compactAnchor
        .split(/,\s*/)
        .filter((c) => !/\b(?:hair|eyes|cheeks?|freckles?|glasses|spectacles|eyewear|hat|cap|helmet|headband|collar)\b/i.test(c));
      if (footClauses.length > 0) {
        scopedAnchor = footClauses.join(', ').trim();
      }
    }

    if (promptMentionsName) {
      // Attach compact visual anchor right after the first non-possessive mention, skipping lowercase noun modifiers like "submersible searchlights"
      const modifierNextWords =
        'searchlights?|headlights?|floodlights?|lights?|beams?|doors?|hatch|hull|viewport|viewports|window|windows|panels?|propellers?|engines?|sonar|crew';
      const nonPossessiveRegex = new RegExp(`\\b(${escapedName})\\b(?!'s|\\s*\\()`, nameFlags);
      const modifierLookahead = new RegExp(`^\\s+(?:${modifierNextWords})\\b`, 'i');
      const matchedCandidate = updated.match(nonPossessiveRegex);
      const isLowercaseCompoundModifier =
        matchedCandidate &&
        typeof matchedCandidate.index === 'number' &&
        /^[a-z]/.test(matchedCandidate[1]) &&
        modifierLookahead.test(updated.slice(matchedCandidate.index + matchedCandidate[0].length));

      if (nonPossessiveRegex.test(updated) && !isLowercaseCompoundModifier) {
        updated = updated.replace(nonPossessiveRegex, (_fullMatch, matchedName) => {
          return `${matchedName} (${scopedAnchor})`;
        });
        updated = pruneAppositiveTraitsAfterLock(updated);
      } else if (!isLowercaseCompoundModifier) {
        updated = pruneAppositiveTraitsAfterLock(updated);
        if (!new RegExp(`\\b${escapedName}\\s*\\(`, nameFlags).test(updated)) {
          updated = insertClauseBeforeStyleOrAr(updated, `Featuring ${charName} (${scopedAnchor})`);
        }
      }
    } else {
      // Character is active in the beat via alias, pronoun, or visual traits: inject canonical identity anchor cleanly
      updated = insertClauseBeforeStyleOrAr(updated, `Featuring ${charName} (${scopedAnchor})`);
    }
  }

  return updated;
}

function insertClauseBeforeStyleOrAr(prompt: string, clause: string): string {
  const cleanClause = clause.replace(/[.,]+$/, '').trim();
  if (!cleanClause) return prompt;

  const arMatch = prompt.match(/\s*--ar\s+[0-9:]+.*$/i);
  const arSuffix = arMatch ? arMatch[0] : '';
  let body = arMatch ? prompt.slice(0, arMatch.index).trim() : prompt.trim();

  const styleMatch = body.match(/\bVisual Style:/i);
  if (styleMatch && typeof styleMatch.index === 'number') {
    const beforeStyle = body.slice(0, styleMatch.index).replace(/[\s,]+$/, '').trim();
    const withPeriod = /[.!?]$/.test(beforeStyle) ? beforeStyle : `${beforeStyle}.`;
    const stylePart = body.slice(styleMatch.index).trim();
    body = `${withPeriod} ${cleanClause}. ${stylePart}`;
  } else {
    const baseClean = body.replace(/[\s,]+$/, '').trim();
    const withPeriod = /[.!?]$/.test(baseClean) ? baseClean : `${baseClean}.`;
    body = `${withPeriod} ${cleanClause}.`;
  }

  return `${body}${arSuffix}`.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Strips any stacked or duplicated orientation strings ("Vertical 9:16 portrait composition",
 * "Cinematic 16:9 widescreen composition") separated by periods, commas, colons, or spaces.
 */
export function stripLeadingOrientationPrefixes(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = prompt.trim();
  let prev = '';
  let guard = 0;
  while (cleaned !== prev && guard < 6) {
    prev = cleaned;
    guard++;
    cleaned = cleaned.replace(
      /^(?:(?:framed|captured|shot|set)\s+)?(?:\b(?:in|with|as)\s+a\s+)?(?:Cinematic 16:9 widescreen composition|Vertical 9:16 portrait composition|9:16 vertical composition|16:9 widescreen composition)(?:\s*[,.:;-]\s*|\s+)*/gi,
      ''
    );
  }
  // Remove embedded orientation strings along with any dangling preposition right before them
  cleaned = cleaned.replace(
    /(?:(?:framed|captured|shot|set)\s+)?\b(?:in|with|as)\s+a\s+(?:Cinematic 16:9 widescreen composition|Vertical 9:16 portrait composition|9:16 vertical composition|16:9 widescreen composition)(?:\s*[,.:;-]\s*|\s+)*/gi,
    ''
  );
  cleaned = cleaned.replace(
    /,?\s*\b(?:9:16\s+(?:vertical|portrait)|16:9\s+(?:widescreen|landscape)|vertical\s+9:16|widescreen\s+16:9)\b(?=\s*(?:[,.;]|$|\bVisual Style:))/gi,
    ''
  );
  cleaned = cleaned.replace(
    /\b(?:in|with)\s+a\s+(?=(?:from\s+a|at\s+eye[-\s]*level|at\s+(?:low|high)[-\s]*angle|with\s+a\s+(?:tense\s+)?dutch|birds?[-\s]*eye|worms?[-\s]*eye)\b)/gi,
    ''
  );
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extracts explicit shot type and vertical camera angle written in the opening or Camera directive of prompt prose
 * and synchronizes table metadata (`shotType`, `cameraAngle`, `cameraMovement`) cleanly so:
 * 1) `over-the-shoulder` / `POV` stay strictly in `shotType` and NEVER enter `cameraAngle`.
 * 2) `Medium Close-Up` takes precedence over `Close-Up` so table badges match prompt prose 1-for-1.
 * 3) Inline shot directives later in a Video prompt (after character descriptions) are still detected.
 */
export function synchronizeBeatMetadataWithPrompt(beat: Beat): Beat {
  const withoutOrientation = stripLeadingOrientationPrefixes(beat.imagePrompt || '')
    .replace(/\bVisual Style:[^.]*\.?/gi, '')
    .replace(/\s*--ar\s+[0-9:]+.*$/i, '')
    .trim();
  const openingWindow = withoutOrientation.slice(0, 100).toLowerCase();
  const fullWindow = withoutOrientation.toLowerCase();

  let syncedShotType = '';
  let syncedAngle = '';
  let syncedMovement = (beat.cameraMovement || '').trim();

  // Normalize existing beat.shotType casing first as fallback
  const normalizeRawShot = (raw: string): string => {
    const r = raw.trim().toLowerCase();
    if (!r) return '';
    if (r === 'extreme-wide' || r.includes('extreme wide')) return 'Extreme Wide Shot';
    if (r === 'wide' || r.includes('wide establishing')) return 'Wide Establishing Shot';
    if (r === 'medium close-up' || r === 'medium-close-up' || r.includes('medium close')) return 'Medium Close-Up';
    if (r === 'extreme-close-up' || r.includes('extreme close')) return 'Extreme Close-Up';
    if (r === 'close-up' || r.includes('close-up') || r === 'closeup') return 'Close-Up';
    if (r.includes('over-the-shoulder') || r === 'ots') return 'Over-the-Shoulder (OTS)';
    if (r.includes('point-of-view') || r === 'pov') return 'Point-of-View (POV)';
    if (r === 'medium' || r.includes('medium shot')) return 'Medium Shot';
    if (r.includes('low-angle')) return 'Low-Angle Hero Shot';
    return raw.trim();
  };

  const detectShotFromWindow = (win: string): string => {
    if (/\bwhip[-\s]*pan\b/i.test(win)) return 'Whip-Pan';
    if (/\b(?:over[-\s]*the[-\s]*shoulder|ots)\b/i.test(win)) return 'Over-the-Shoulder (OTS)';
    if (/\b(?:point[-\s]*of[-\s]*view|first[-\s]*person|pov)\b/i.test(win)) return 'Point-of-View (POV)';
    if (/\bmedium\s+close[-\s]*up\b/i.test(win)) return 'Medium Close-Up';
    if (/\b(?:extreme[-\s]*close[-\s]*up|macro\s+(?:insert|detail|shot|view))\b/i.test(win)) return 'Extreme Close-Up';
    if (/\bclose[-\s]*up\b/i.test(win)) return 'Close-Up';
    if (/\b(?:extreme[-\s]*wide|establishing\s+(?:wide|vista))\b/i.test(win)) return 'Extreme Wide Shot';
    if (/\bwide(?:\s+(?:establishing\s+)?(?:shot|view|angle))?\b/i.test(win)) return 'Wide Establishing Shot';
    if (/\bmedium\s+(?:shot|view|framing)\b/i.test(win)) return 'Medium Shot';
    return '';
  };

  // Detect shot size explicitly present in prompt opening first, then explicit Camera directive / full body
  const leadingMatch = openingWindow.match(
    /^(?:(whip[-\s]*pan)|(medium\s+close[-\s]*up)|(extreme[-\s]*close[-\s]*up)|(close[-\s]*up)|(extreme[-\s]*wide)|(wide\s+(?:establishing\s+)?(?:shot|view|high-angle|low-angle|eye-level))|(medium\s+(?:shot|view|high-angle|low-angle|eye-level))|(over[-\s]*the[-\s]*shoulder|ots)|(point[-\s]*of[-\s]*view|pov))/i
  );
  if (leadingMatch) {
    if (leadingMatch[1]) syncedShotType = 'Whip-Pan';
    else if (leadingMatch[2]) syncedShotType = 'Medium Close-Up';
    else if (leadingMatch[3]) syncedShotType = 'Extreme Close-Up';
    else if (leadingMatch[4]) syncedShotType = 'Close-Up';
    else if (leadingMatch[5]) syncedShotType = 'Extreme Wide Shot';
    else if (leadingMatch[6]) syncedShotType = 'Wide Establishing Shot';
    else if (leadingMatch[7]) syncedShotType = 'Medium Shot';
    else if (leadingMatch[8]) syncedShotType = 'Over-the-Shoulder (OTS)';
    else if (leadingMatch[9]) syncedShotType = 'Point-of-View (POV)';
  } else {
    syncedShotType =
      detectShotFromWindow(openingWindow) ||
      detectShotFromWindow(fullWindow) ||
      (/\bwide\b/i.test(openingWindow) ? 'Wide Establishing Shot' : '') ||
      (/\bmedium\b/i.test(openingWindow) ? 'Medium Shot' : '') ||
      normalizeRawShot(beat.shotType || '');
  }

  // Detect ONLY valid vertical/tilt camera angles in prompt (prioritizing explicit hyphenated angles ahead of loose prop nouns like "overhead tube")
  const normalizeValidAngle = (raw: string): string => {
    const r = raw.trim().toLowerCase();
    if (r === 'birds-eye' || r === 'worms-eye' || r === 'low-angle' || r === 'high-angle' || r === 'dutch-tilt' || r === 'eye-level') {
      return r;
    }
    if (r.includes('bird') || r.includes('overhead') || r.includes('top-down')) return 'birds-eye';
    if (r.includes('worm') || r.includes('ground')) return 'worms-eye';
    if (r.includes('low')) return 'low-angle';
    if (r.includes('high') || r.includes('elevated')) return 'high-angle';
    if (r.includes('dutch') || r.includes('canted')) return 'dutch-tilt';
    return 'eye-level';
  };

  const explicitAngleRegex =
    /\b(?:birds?[-\s]*eye|top[-\s]*down|worms?[-\s]*eye|ground[-\s]*level|low[-\s]*angle|high[-\s]*angle|elevated\s+angle|dutch[-\s]*angle|dutch[-\s]*tilt|canted|eye[-\s]*level|straight[-\s]*on)\b/i;
  const looseAngleRegex =
    /\b(?:birds?[-\s]*eye|overhead|top[-\s]*down|worms?[-\s]*eye|ground[-\s]*level|low[-\s]*angle|high[-\s]*angle|elevated\s+angle|dutch[-\s]*angle|dutch[-\s]*tilt|canted|eye[-\s]*level|straight[-\s]*on)\b/i;

  const angleWindow = explicitAngleRegex.test(openingWindow)
    ? openingWindow
    : explicitAngleRegex.test(fullWindow)
      ? fullWindow
      : looseAngleRegex.test(openingWindow)
        ? openingWindow
        : fullWindow;

  if (/\b(?:birds?[-\s]*eye|top[-\s]*down)\b/i.test(angleWindow)) {
    syncedAngle = 'birds-eye';
  } else if (/\b(?:worms?[-\s]*eye|ground[-\s]*level)\b/i.test(angleWindow)) {
    syncedAngle = 'worms-eye';
  } else if (/\b(?:low[-\s]*angle|slightly\s+low\s+angle)\b/i.test(angleWindow)) {
    syncedAngle = 'low-angle';
  } else if (/\b(?:high[-\s]*angle|slightly\s+elevated\s+angle|elevated\s+angle)\b/i.test(angleWindow)) {
    syncedAngle = 'high-angle';
  } else if (/\b(?:dutch[-\s]*angle|dutch[-\s]*tilt|canted)\b/i.test(angleWindow)) {
    syncedAngle = 'dutch-tilt';
  } else if (/\b(?:eye[-\s]*level|straight[-\s]*on)\b/i.test(angleWindow)) {
    syncedAngle = 'eye-level';
  } else if (/\boverhead\b/i.test(angleWindow)) {
    syncedAngle = 'birds-eye';
  } else if (/\blooking\s+up\b/i.test(angleWindow)) {
    syncedAngle = 'low-angle';
  } else if (/\blooking\s+down\b/i.test(angleWindow)) {
    syncedAngle = 'high-angle';
  } else {
    syncedAngle = normalizeValidAngle(beat.cameraAngle || 'eye-level');
  }

  if (!syncedShotType) {
    const lowerFull = withoutOrientation.toLowerCase();
    if (lowerFull.includes('face') || lowerFull.includes('eyes') || lowerFull.includes('forearm') || lowerFull.includes('trigger')) {
      syncedShotType = 'Close-Up';
    } else if (lowerFull.includes('sprawling') || lowerFull.includes('landscape') || lowerFull.includes('kingdom') || lowerFull.includes('battlefield')) {
      syncedShotType = 'Wide Establishing Shot';
    } else {
      syncedShotType = 'Medium Shot';
    }
  }
  if (!syncedMovement) {
    syncedMovement = 'Static Frame';
  }

  return {
    ...beat,
    shotType: syncedShotType,
    cameraAngle: syncedAngle,
    cameraMovement: syncedMovement,
  };
}

/**
 * Formats a beat prompt with a single clean orientation declaration, synchronized framing opening
 * when none is present in the prose, expanded entity keys, monochrome-safe lighting, still-image
 * motion filtering, cleaned punctuation, and exact --ar parameter flag.
 */
export function sanitizeStyleForEra(
  text: string,
  era: 'present' | 'flashback'
): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();

  if (era === 'present') {
    cleaned = cleaned
      .replace(/;\s*[^;.]*\b(?:childhood\s+flashbacks?|youth\s+flashbacks?|golden-hour\s+coastal\s+sunlight\s+in\s+childhood)\b[^;.]*/gi, '')
      .replace(/,?\s*\b(?:contrasted\s+with|and\s+clear\s+visual\s+transitions\s+between)\b[^,.;]*\b(?:flashbacks?|past\s+and\s+present)\b[^,.;]*/gi, '')
      .replace(/,?\s*\bwith\s+[^,.;]*\b(?:childhood\s+flashbacks?|golden\s+childhood)\b[^,.;]*/gi, '')
      .replace(/\bin\s+present-day\s+[^,.;]+;\s*/gi, '')
      .replace(/\bin\s+the\s+present\b/gi, '');
  } else {
    cleaned = cleaned
      .replace(/,?\s*\bcool\s+[^,.;]*\bpresent-day\b[^,.;]*/gi, '')
      .replace(/\b[^;.]*\bin\s+the\s+present\s*;\s*(?:rich\s+)?/gi, '')
      .replace(/,?\s*\band\s+clear\s+visual\s+transitions\s+between\s+past\s+and\s+present\b/gi, '')
      .replace(/,?\s*\bcool\s+slate\s+blue-gray[^;.]*\bpresent-day[^;.]*;\s*/gi, '');
  }

  return cleaned
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s*;\s*;+/g, ';')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .trim();
}

/**
 * Removes hero-specific pronoun/wardrobe/body sentences (e.g. "He wears a fitted wool jacket.",
 * "His face has minimal features...") from shared world Visual Style descriptors so they do not bleed
 * onto secondary characters, empty rooms, or prop close-ups.
 */
export function sanitizeSharedVisualStyle(artStyle: string): string {
  if (!artStyle || typeof artStyle !== 'string') return '';
  let cleanedStyle = artStyle
    .trim()
    .replace(
      /(?:,\s*|\s+and\s+)?(?:glowing\s+blue\s+)?(?:time-portal|portal|flashback|memory)?\s*\btransitions?\s+between\s+[^.,;]+(?:memories|past|present|flashback|childhood)[^.,;]*/gi,
      ''
    )
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = cleanedStyle
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return cleanedStyle;

  const nonHeroSentences = sentences.filter((sent) => {
    const hasHeroPronounOutfit =
      /\b(?:he|she)\s+(?:wears?|has|is)\b/i.test(sent) ||
      /\b(?:his|her)\s+(?:face|eyes|skin|hair|chest|shirt|jacket|coat|suit|trousers|boots|shoes)\b/i.test(sent);
    return !hasHeroPronounOutfit;
  });

  if (nonHeroSentences.length > 0) {
    return nonHeroSentences.join(' ').replace(/\s{2,}/g, ' ').trim();
  }
  return cleanedStyle;
}

/**
 * Formats a beat prompt with a single clean orientation declaration, synchronized framing opening
 * when none is present in the prose, expanded entity keys, monochrome-safe lighting, still-image
 * motion filtering, cleaned punctuation, and exact --ar parameter flag.
 */
export function formatFinalBeatPrompt(
  beat: Beat,
  isLongForm: boolean,
  isVideoMode: boolean,
  options?: {
    styleProfile?: StyleProfile;
    characterSheet?: Record<string, string>;
    locationSheet?: Record<string, string>;
  }
): Beat {
  const synced = synchronizeBeatMetadataWithPrompt(beat);
  let body = stripLeadingOrientationPrefixes(synced.imagePrompt || '');

  // Collapse any stacked duplicate framing openers regardless of delimiter mix (e.g. "Whip-Pan, eye-level: Whip-Pan, eye-level, ...")
  body = body.replace(
    /^((?:Whip[-\s]*Pan|Over-the-Shoulder \(OTS\)|Point-of-View \(POV\)|Medium Close-Up|Extreme Close-Up|Close-Up|Extreme Wide Shot|Wide Establishing Shot|Medium Shot)(?:\s*,\s*[a-z-]+)?)(?:\s*[:,-]\s*\1)+(?=\s*[:,-]|\s|$)/i,
    '$1'
  );

  // Strip stray ar flags anywhere in body
  body = body
    .replace(/\s*--ar\s+[0-9:]+/gi, '')
    .replace(/,\s*ar\s+[0-9:]+[.,]?/gi, '')
    .replace(/\bar\s+[0-9:]+[.,]?/gi, '')
    .trim();

  // Scrub footwear & anatomical contradictions (e.g. boots on barefoot lead, or phantom wings on pawed creatures)
  if (options?.characterSheet) {
    const charText = Object.values(options.characterSheet).join(' ').toLowerCase();
    if (/\bbarefoot\b/.test(charText) && !/\bboots?\b/.test(charText)) {
      body = body.replace(/\b(?:both|weight balanced on|planted on)\s+(?:both\s+)?boots\b/gi, 'weight balanced on bare feet');
    }
    if (/\b(?:paws?|hooves|claws)\b/.test(charText) && !/\b(?:wing|wings|feathered)\b/.test(charText)) {
      body = body
        .replace(/\binjured\s+wings?\s+drooping\b/gi, 'injured side speckled with faint frost')
        .replace(/\bwith\s+wings?\s+drooping\b/gi, 'head drooping slightly');
    }
  }

  // Expand CamelCase entity/location variable names & fix monochrome lighting if monochrome style
  if (options?.characterSheet || options?.locationSheet) {
    body = expandEntityKeysInPrompt(body, options.characterSheet, options.locationSheet);
  }
  if (options?.styleProfile) {
    body = sanitizeMonochromeLighting(body, options.styleProfile);
  }

  // Clean video tracking verbs & duplicated optics in Text-to-Image mode
  body = sanitizeStillImageMotionAndOptics(body, synced.shotType || 'Medium Shot', isVideoMode);

  // Scope dual-era style suffixes cleanly to present-day vs flashback beats & ensure Visual Style tag consistency
  const beatEra: 'present' | 'flashback' = /\b(?:flashbacks?|childhood\s+(?:summer\s+)?(?:memor(?:y|ies)|flashbacks?|era|days|years)|years\s+earlier|nine-year-old|shared\s+summers)\b/i.test(
    `${beat.textSpan || ''} ${body}`
  )
    ? 'flashback'
    : 'present';

  body = body.replace(/\bVisual Style:\s*([^.]+(?:\.[^.]*)?)/gi, (_match, rawStylePart: string) => {
    const sharedSafe = sanitizeSharedVisualStyle(rawStylePart.replace(/\.$/, ''));
    const cleanedStyle = sanitizeStyleForEra(sharedSafe, beatEra);
    return cleanedStyle ? `Visual Style: ${cleanedStyle}.` : '';
  });

  if (options?.styleProfile?.artStyle && !/\bVisual Style:/i.test(body)) {
    const sharedSafeStyle = sanitizeSharedVisualStyle(options.styleProfile.artStyle);
    const cleanedArt = sanitizeStyleForEra(sharedSafeStyle, beatEra) || sharedSafeStyle;
    const eraArtStyle =
      getWordCount(cleanedArt) <= 34
        ? cleanedArt.replace(/[.!?]+$/, '').trim()
        : sanitizeStyleForEra(
            buildCompactCharacterAnchor(sharedSafeStyle, STYLE_ANCHOR_MAX_WORDS) || sharedSafeStyle,
            beatEra
          );
    if (eraArtStyle) {
      body = `${body.replace(/[.,\s]+$/, '')}. Visual Style: ${eraArtStyle}.`;
    }
  }

  // Check if prose already opens with shot framing; strip contradictory trailing shot-size labels, or prepend framing when absent
  const angleOnlyOpeningRegex =
    /^(eye[-\s]*level|low[-\s]*angle|high[-\s]*angle|birds?[-\s]*eye|worms?[-\s]*eye|dutch[-\s]*tilt)(?:\s+(?:framing|shot|view|angle))?(?:\s*,|\s+of\b|\s+showing\b|\s+depicting\b|\s*:)?\s*/i;
  if (angleOnlyOpeningRegex.test(body)) {
    body = body.replace(angleOnlyOpeningRegex, '').trim();
  }

  // Expand bare shot-size + angle opener (e.g. "Wide eye-level," -> "Wide Establishing Shot, eye-level,")
  body = body
    .replace(
      /^Wide\s+(eye[-\s]*level|low[-\s]*angle|high[-\s]*angle|birds?[-\s]*eye|worms?[-\s]*eye|dutch[-\s]*tilt)\b/i,
      'Wide Establishing Shot, $1'
    )
    .replace(
      /^Medium\s+(eye[-\s]*level|low[-\s]*angle|high[-\s]*angle|birds?[-\s]*eye|worms?[-\s]*eye|dutch[-\s]*tilt)\b/i,
      'Medium Shot, $1'
    );

  const hasOpeningFraming =
    /^(?:Extreme\s+Wide|Wide\s+Establishing|Wide|Medium\s+Close-Up|Medium|Extreme\s+Close-Up|Close-Up|Macro|Over-the-Shoulder|Point-of-View|First-person|Whip[-\s]*Pan|Low-angle|High-angle|Birds-eye|Worms-eye|Dutch)/i.test(
      body
    );

  if (hasOpeningFraming) {
    // Eliminate contradictory mid-sentence shot-size tags (e.g. "Close-up of his hands..., extreme-close-up, eye-level")
    const leadEndIdx = Math.min(body.length, 40);
    const leadChunk = body.slice(0, leadEndIdx);
    const restChunk = body
      .slice(leadEndIdx)
      .replace(
        /,\s*(?:extreme[-\s]*close[-\s]*up|close[-\s]*up|medium\s+close[-\s]*up|medium\s+shot|wide\s+shot|extreme\s+wide\s+shot)\b(?=\s*,)/gi,
        ''
      );
    body = `${leadChunk}${restChunk}`;
  } else if (body.length > 0) {
    // If mid-sentence already has an inline shot-size tag, lift framing cleanly to front and strip the duplicate inline tag
    body = body.replace(
      /,\s*(?:extreme[-\s]*close[-\s]*up|close[-\s]*up|medium\s+close[-\s]*up|medium\s+shot|wide\s+shot|extreme\s+wide\s+shot)\b(?=\s*,|\s+(?:low|high|eye)[-\s])/gi,
      ''
    );
    if (!isVideoMode) {
      const lowerFirst = body.charAt(0).toLowerCase() + body.slice(1);
      const startsWithOf = /^(?:of|showing|depicting|capturing)\b/i.test(lowerFirst);
      const connector = startsWithOf ? ' ' : ' of ';
      const angleLabel = synced.cameraAngle ? `, ${synced.cameraAngle}` : '';
      body = `${synced.shotType}${angleLabel}${connector}${lowerFirst}`;
    } else {
      const angleLabel = synced.cameraAngle ? `, ${synced.cameraAngle}` : '';
      body = `${synced.shotType}${angleLabel}: ${body}`;
    }
  }

  // Synchronize bare shot openers that dropped their angle (e.g. "Extreme wide exterior shot of...", "Over-the-shoulder framing...")
  if (!isVideoMode && synced.cameraAngle) {
    const lead70 = body.slice(0, 75);
    const hasAngleInLead = /\b(?:eye[-\s]*level|low[-\s]*angle|high[-\s]*angle|birds?[-\s]*eye|worms?[-\s]*eye|dutch[-\s]*tilt)\b/i.test(
      lead70
    );
    if (!hasAngleInLead) {
      if (/^Over-the-shoulder\s+framing\b/i.test(body)) {
        body = body.replace(/^Over-the-shoulder\s+framing\b/i, `Over-the-Shoulder (OTS), ${synced.cameraAngle}`);
      } else if (/^Macro\s+detail\s+of\b/i.test(body) && /extreme\s+close/i.test(synced.shotType)) {
        body = body.replace(/^Macro\s+detail\s+of\b/i, `Extreme Close-Up, ${synced.cameraAngle}, macro detail of`);
      } else if (/^Extreme\s+wide(?:\s+exterior)?\s+shot\s+(?:of|on)\b/i.test(body)) {
        body = body.replace(
          /^(Extreme\s+wide(?:\s+exterior)?\s+shot)\s+(of|on)\b/i,
          `$1, ${synced.cameraAngle} $2`
        );
      } else if (/^Close-?up\s+(?:on|of)\b/i.test(body)) {
        body = body.replace(/^(Close-?up)\s+(on|of)\b/i, `Close-Up, ${synced.cameraAngle} $2`);
      }
    }
  }

  // Protect exact characterSheet & locationSheet proper names if lowerFirst turned a leading or multi-word proper name lowercase ("of pip" -> "of Pip", "The keeper (" -> "The Keeper (")
  const restoreLeadingProperNames = (text: string): string => {
    let fixed = text;
    if (options?.characterSheet) {
      for (const charKey of Object.keys(options.characterSheet)) {
        const trimmedChar = charKey.trim();
        if (!trimmedChar || !/^[A-Z]/.test(trimmedChar)) continue;
        const escChar = trimmedChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        fixed = fixed.replace(new RegExp(`(\\bof\\s+)${escChar}\\b`, 'gi'), `$1${trimmedChar}`);
        if (/\s+/.test(trimmedChar)) {
          fixed = fixed.replace(new RegExp(`\\b${escChar}\\b`, 'gi'), trimmedChar);
        }
      }
    }
    if (options?.locationSheet) {
      for (const locKey of Object.keys(options.locationSheet)) {
        const trimmedLoc = locKey.trim();
        if (!trimmedLoc || !/^[A-Z]/.test(trimmedLoc)) continue;
        const escLoc = trimmedLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (/^(?:The|A|An)\s+/i.test(trimmedLoc)) {
          fixed = fixed.replace(new RegExp(`(\\bof\\s+)${escLoc}\\b`, 'gi'), `$1${trimmedLoc}`);
        } else {
          fixed = fixed.replace(
            new RegExp(`(\\bof\\s+)(?:the\\s+)?${escLoc}\\b`, 'gi'),
            `$1the ${trimmedLoc}`
          );
        }
      }
    }
    return fixed;
  };
  body = restoreLeadingProperNames(body);

  // Fix finite-verb grammar right after "Shot..., angle of <Subject/Location> ... stands/sits/works/uses/ascends/strikes/ignites" -> participle
  if (/^(?:Extreme\s+Wide|Wide\s+Establishing|Wide|Medium\s+Close-Up|Medium|Extreme\s+Close-Up|Close-Up)[^.]*?\bof\s+/i.test(body)) {
    body = body.replace(
      /^([^.]*?\bof\s+(?:(?:a|an|the)\s+)?[A-Za-z](?:[^.()]|\([^)]*\))*?)(?:,\s*(?=[a-z]))?\b(stands|sits|waits|kneels|leans|stares|looks|gazes|walks|works|uses|draws|reaches|picks|holds|ascends|descends|climbs|strikes|ignites|lights|opens|pulls|clutches|braces|reveals|shows|reflects|rises|gleams|shimmers)\b(\s+(?:inside|at|by|near|on|in|under|beside|behind|across|toward|over|before|amidst|with|against|from|onto|through|up|out|forward|down|still|firm|tall|poised|frantically|firmly|a|an|the|cluster|clusters|rows?|lines?|columns?|beams?|shards?|pools?)\b)/i,
      (_m, prefix: string, verb: string, prep: string) => {
        const participleMap: Record<string, string> = {
          stands: 'standing',
          sits: 'sitting',
          waits: 'waiting',
          kneels: 'kneeling',
          leans: 'leaning',
          stares: 'staring',
          looks: 'looking',
          gazes: 'gazing',
          walks: 'walking',
          works: 'working',
          uses: 'using',
          draws: 'drawing',
          reaches: 'reaching',
          picks: 'picking',
          holds: 'holding',
          ascends: 'ascending',
          descends: 'descending',
          climbs: 'climbing',
          strikes: 'striking',
          ignites: 'igniting',
          lights: 'lighting',
          opens: 'opening',
          pulls: 'pulling',
          clutches: 'clutching',
          braces: 'bracing',
          reveals: 'revealing',
          shows: 'showing',
          reflects: 'reflecting',
          rises: 'rising',
          gleams: 'gleaming',
          shimmers: 'shimmering',
        };
        const replacement = participleMap[verb.toLowerCase()] || verb;
        const normalizedPrep =
          verb.toLowerCase() === 'reveals' && /^\s+cluster\b/i.test(prep)
            ? prep.replace(/^\s+cluster\b/i, ' a cluster')
            : prep;
        const cleanPrefix = prefix.replace(/,\s*$/, ' ');
        return `${cleanPrefix}${cleanPrefix.endsWith(' ') ? '' : ' '}${replacement}${normalizedPrep}`;
      }
    );
  }

  // Strip redundant tiny mid-prompt chibi style tags when full Visual Style suffix already specifies chibi/cel-shaded
  if (/\bVisual Style:[^.]*\bchibi\b/i.test(body)) {
    body = body.replace(
      /\.\s*(?:Chibi\s+(?:art\s+)?(?:style|aesthetic)(?:\s*,\s*(?:thick\s+(?:clean\s+)?outlines|clean\s+cel-shading)|\s+with\s+clean\s+lines)?)[.,](?=\s*(?:Shot\s+on|Featuring|Visual\s+Style:))/gi,
      '.'
    );
  }

  // Final punctuation, duplicated angle-of-angle guard, dangling preposition & spacing cleanup
  body = sanitizePromptGrammarAndTypos(body)
    .replace(/\b(eye[-\s]*level|low[-\s]*angle|high[-\s]*angle|birds?[-\s]*eye|worms?[-\s]*eye|dutch[-\s]*tilt)\s+of\s+\1\b/gi, '$1 of')
    .replace(/\b(?:in|with)\s+a\s+(?=(?:from\s+a|at\s+eye[-\s]*level|at\s+(?:low|high)[-\s]*angle|with\s+a\s+(?:tense\s+)?dutch|birds?[-\s]*eye|worms?[-\s]*eye)\b)/gi, '')
    .replace(/\),\s+(Shot\s+on\b|Visual\s+Style:)/g, '). $1')
    .replace(/,\s+(Shot\s+on\s+\d{2,3}mm\b)/g, '. $1')
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/,([^\s0-9])/g, ', $1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (body.length > 0) {
    body = body.charAt(0).toUpperCase() + body.slice(1);
    if (!/[.!?]$/.test(body)) {
      body += '.';
    }
  }

  const orientationText = isLongForm ? 'Cinematic 16:9 widescreen composition' : 'Vertical 9:16 portrait composition';
  const arFlag = isLongForm ? '--ar 16:9' : '--ar 9:16';

  const assembled = body ? `${orientationText}, ${body} ${arFlag}` : '';

  return {
    ...synced,
    imagePrompt: normalizeUnicodeAndDashes(assembled),
  };
}

/**
 * Verifies that 100% of spoken words in `scene.narratorLine` are covered in sequential order
 * across `scene.beats[].textSpan`. If the LLM truncated trailing clauses (e.g. Scene VII missing
 * the second half of a sentence), repairs the scene by recovering the exact missing text spans
 * and generating distinct grounded continuation visual beats.
 */
export function verifyAndRepairSceneNarrationCoverage(
  scenes: Scene[],
  styleProfile: StyleProfile,
  characterSheet: Record<string, string>,
  locationSheet: Record<string, string>,
  options: { isLongForm: boolean; isVideoMode: boolean }
): Scene[] {
  const normWord = (w: string) =>
    normalizeUnicodeAndDashes(w)
      .toLowerCase()
      .replace(/^[^a-z0-9\u00C0-\u024F]+|[^a-z0-9\u00C0-\u024F]+$/g, '');

  return scenes.map((scene) => {
    const fullNarration = normalizeUnicodeAndDashes(scene.narratorLine || '');
    if (!fullNarration) return scene;

    const narrationRawWords = fullNarration.split(/\s+/).filter(Boolean);
    const narrationNormWords = narrationRawWords.map(normWord).filter(Boolean);
    if (narrationNormWords.length === 0) return scene;

    const currentBeats = (scene.beats || []).map((b) => ({ ...b }));
    const coveredWords = currentBeats
      .map((b) => b.textSpan || '')
      .join(' ')
      .split(/\s+/)
      .map(normWord)
      .filter(Boolean);

    // Match covered words sequentially against narratorLine words
    let matchedUpTo = 0;
    let cIdx = 0;
    while (matchedUpTo < narrationNormWords.length && cIdx < coveredWords.length) {
      if (narrationNormWords[matchedUpTo] === coveredWords[cIdx]) {
        matchedUpTo++;
        cIdx++;
      } else {
        // Look ahead slightly in case a word was slightly rephrased
        let found = false;
        for (let look = 1; look <= 3 && matchedUpTo + look < narrationNormWords.length; look++) {
          if (narrationNormWords[matchedUpTo + look] === coveredWords[cIdx]) {
            matchedUpTo += look + 1;
            cIdx++;
            found = true;
            break;
          }
        }
        if (!found) {
          cIdx++;
        }
      }
    }

    // If all spoken words are already covered, return untouched
    if (matchedUpTo >= narrationNormWords.length) {
      return scene;
    }

    // Find raw word offset corresponding to matchedUpTo
    let normCounter = 0;
    let rawSplitIndex = narrationRawWords.length;
    for (let r = 0; r < narrationRawWords.length; r++) {
      if (normWord(narrationRawWords[r])) {
        if (normCounter === matchedUpTo) {
          rawSplitIndex = r;
          break;
        }
        normCounter++;
      }
    }

    const missingText = narrationRawWords.slice(rawSplitIndex).join(' ').trim();
    if (!missingText) return scene;

    const missingWordCount = getWordCount(missingText);
    const lastBeat = currentBeats[currentBeats.length - 1];

    // If only 1-3 plain non-montage trailing words were dropped and last beat has room under Option A pacing, append cleanly
    const missingHasDistinctVisualCue =
      extractMontageFocalCategory(missingText) !== null ||
      extractTemporalAnchor(missingText) !== null ||
      extractGeographicAnchor(missingText) !== null;

    if (
      lastBeat &&
      !missingHasDistinctVisualCue &&
      missingWordCount <= 3 &&
      getWordCount(lastBeat.textSpan) + missingWordCount <= VISUAL_EVENT_MAX_WORDS
    ) {
      lastBeat.textSpan = `${lastBeat.textSpan.trim()} ${missingText}`.trim();
      lastBeat.estimatedSeconds = Math.min(
        VISUAL_EVENT_MAX_SECONDS,
        Math.round(((lastBeat.estimatedSeconds || 1.6) + missingWordCount * 0.45) * 10) / 10
      );
      return {
        ...scene,
        beats: currentBeats,
      };
    }

    // Partition longer missing narration into 2-6 word phrase cuts in Image Mode (or broader chunks in Video Mode)
    const recoveryWordTarget = options.isVideoMode ? 11 : 6;
    const missingChunks = splitPhraseIntoSubBeats(missingText, recoveryWordTarget);
    const mergedMissingChunks: string[] = [];
    for (const chunk of missingChunks) {
      if (
        options.isVideoMode &&
        mergedMissingChunks.length > 0 &&
        (getWordCount(chunk) <= 4 || getWordCount(mergedMissingChunks[mergedMissingChunks.length - 1]) + getWordCount(chunk) <= 11) &&
        !extractGeographicAnchor(chunk) &&
        !extractTemporalAnchor(chunk) &&
        extractMontageFocalCategory(chunk) === null
      ) {
        mergedMissingChunks[mergedMissingChunks.length - 1] = `${mergedMissingChunks[mergedMissingChunks.length - 1]} ${chunk}`.trim();
      } else {
        mergedMissingChunks.push(chunk);
      }
    }

    const leadCharEntry = Object.entries(characterSheet)[0];
    const leadCharLabel = leadCharEntry
      ? (/^(?:protagonist|narrator|subject|character)$/i.test(leadCharEntry[0]) ? 'the protagonist' : leadCharEntry[0])
      : 'the solitary protagonist';
    const leadCharClause = leadCharEntry
      ? `${leadCharLabel} (${buildCompactCharacterAnchor(leadCharEntry[1], CHARACTER_ANCHOR_MAX_WORDS)})`
      : 'the solitary protagonist';

    const locEntry = Object.entries(locationSheet)[0];
    const activeLocDesc = locEntry
      ? `${buildCompactCharacterAnchor(locEntry[1], 24) || locEntry[0]}`
      : styleProfile.eraAndSetting || 'a dimly lit interior room';

    const cleanLighting = sanitizeMonochromeLighting(styleProfile.lighting, styleProfile);

    const shotProgression = [
      { shotType: 'Close-Up', angle: 'eye-level', move: 'Static Frame', lens: '85mm f/1.8 portrait prime lens' },
      { shotType: 'Over-the-Shoulder (OTS)', angle: 'eye-level', move: 'Static Frame', lens: '50mm f/2.0 prime lens' },
      { shotType: 'Medium Close-Up', angle: 'low-angle', move: 'Static Frame', lens: '50mm f/2.0 prime lens' },
    ];

    mergedMissingChunks.forEach((span, idx) => {
      const framing = shotProgression[(currentBeats.length + idx) % shotProgression.length];
      const wordCnt = getWordCount(span);
      const isMontageBeat = extractMontageFocalCategory(span) !== null;
      const minSecFloor = isMontageBeat ? MONTAGE_MIN_SECONDS : 1.4;
      const sec = Math.max(minSecFloor, Math.min(VISUAL_EVENT_MAX_SECONDS, Math.round((wordCnt / 2.3) * 10) / 10));
      const lowerSpan = span.toLowerCase();

      let visualMomentDesc = '';
      if (isInfancyOrChildhoodFlashback(lowerSpan)) {
        visualMomentDesc = `Medium Shot, high-angle framing of a tiny infant protagonist swaddled inside a wooden nursery crib, while a dark gaunt entity lurks silently in deep shadow behind the crib slats watching`;
      } else if (/\b(?:never\s+smiled|smiling|smile|grin)\b/i.test(lowerSpan)) {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} of ${leadCharClause} standing stone-faced with a completely motionless, unsmiling mouth inside ${activeLocDesc}, while the mirror surface behind frames an eerie contrasting reflection smiling unnaturally wide`;
      } else if (/\bnever\s+reach\s+out\b/i.test(lowerSpan)) {
        visualMomentDesc = `Medium Close-Up, eye-level of ${leadCharClause} with both hands resting completely still at their sides inside ${activeLocDesc}, keeping cold mirror glass untouched`;
      } else if (/\bnever\s+cross\b/i.test(lowerSpan)) {
        visualMomentDesc = `Medium Shot, low-angle of ${leadCharClause} halting motionless behind the threshold of the standing ebony mirror frame inside ${activeLocDesc}, barrier unbroken`;
      } else if (/\b(?:every\s+blink|blink)\b/i.test(lowerSpan)) {
        visualMomentDesc = `Extreme Close-Up, eye-level macro framing of eyelids lowered mid-blink in exact 1:1 mirror symmetry inside ${activeLocDesc}`;
      } else if (/\b(?:every\s+breath|breath)\b/i.test(lowerSpan)) {
        visualMomentDesc = `Extreme Close-Up, eye-level macro view of faint condensation breath mist blooming across cold mirror glass beside parted lips in exact 1:1 synchrony`;
      } else if (/\b(?:every\s+move|move)\b/i.test(lowerSpan)) {
        visualMomentDesc = `Medium Shot, eye-level of ${leadCharClause} with tilted shoulder and raised hand synchronized 1:1 with an unsmiling reflection inside ${activeLocDesc}`;
      } else if (/\b(?:reflection|mirror)\b/i.test(lowerSpan)) {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} of ${leadCharClause} staring straight into a cold glass mirror inside ${activeLocDesc}, locked eye-to-eye with an unblinking neutral double inside the shadowed glass`;
      } else if (/\b(?:ammunition|bullet|magazine|empty|running out)\b/i.test(lowerSpan)) {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} focusing on ${leadCharClause} gazing down at nearly empty supplies with tense stillness inside ${activeLocDesc}`;
      } else if (/\b(?:guarding|warden|wall|behind|cross)\b/i.test(lowerSpan)) {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} revealing deep impenetrable shadows coiled behind the threshold of ${activeLocDesc} beyond ${leadCharClause}`;
      } else if (idx % 2 === 0) {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} framing ${leadCharClause} frozen in sudden quiet realization inside ${activeLocDesc}, shoulders taut and gaze locked forward`;
      } else {
        visualMomentDesc = `${framing.shotType}, ${framing.angle} capturing stillness across ${activeLocDesc}, subtle environmental shadow depth behind ${leadCharClause}`;
      }

      const rawContinuationPrompt = `${visualMomentDesc}, ${cleanLighting}, ${styleProfile.colorPalette} palette, ${framing.lens}, Visual Style: ${styleProfile.artStyle}.`;

      currentBeats.push(
        formatFinalBeatPrompt(
          {
            beatIndex: currentBeats.length + 1,
            textSpan: span,
            shotType: framing.shotType,
            cameraAngle: framing.angle,
            cameraMovement: framing.move,
            imagePrompt: rawContinuationPrompt,
            estimatedSeconds: sec,
          },
          options.isLongForm,
          options.isVideoMode,
          { styleProfile, characterSheet, locationSheet }
        )
      );
    });

    return {
      ...scene,
      beats: currentBeats.map((b, i) => ({ ...b, beatIndex: i + 1 })),
    };
  });
}

/**
 * Strips era-bleed locations (e.g. "background blurred armory" in scenes after time travel into
 * historical past) and legacy horror fallback strings, replacing them with the active scene's
 * authentic environment.
 */
export function sanitizeEraBleedAcrossScenes(
  scenes: Scene[],
  styleProfile: StyleProfile,
  locationSheet: Record<string, string>
): Scene[] {
  const historicalShiftRegex =
    /\b(?:sent\s+\d+\s+years\s+into\s+the\s+past|back\s+in\s+time|medieval\s+kingdom|medieval\s+era|knight|castle|centuries\s+in\s+the\s+past)\b/i;
  const modernTechBleedRegex =
    /\b(?:background\s+blurred\s+armory(?:\s+racks)?|metallic\s+(?:armory\s+)?racks\s+glowing\s+with\s+neon\s+cyan\s+panels|futuristic\s+armory|glass\s+skyscrapers|holographic\s+billboards|neon[- ]lit\s+city\s+street)\b/gi;

  const locEntry = Object.entries(locationSheet)[0];
  const historicalSettingFallback = locEntry
    ? `stone walls and torch-lit arches of ${locEntry[0]}`
    : 'weathered medieval stone battlements and smoke-hazed battlefield';

  let enteredHistoricalPast = false;

  return scenes.map((scene) => {
    const combinedText = `${scene.narratorLine} ${(scene.beats || []).map((b) => b.textSpan).join(' ')}`;
    if (historicalShiftRegex.test(combinedText)) {
      enteredHistoricalPast = true;
    }

    if (!enteredHistoricalPast) {
      return scene;
    }

    // Also if Scene 3 is where he gets sent 800 years into the past ("What if he was sent 800 years into the past,"),
    // Beat 1 should NOT show a modern glass-skyscraper city with protagonist absent when the narration says "What if he was sent 800 years into the past"!
    const fixedBeats = (scene.beats || []).map((beat) => {
      let prompt = beat.imagePrompt || '';
      if (modernTechBleedRegex.test(prompt)) {
        prompt = prompt.replace(modernTechBleedRegex, historicalSettingFallback);
      }
      return {
        ...beat,
        imagePrompt: prompt,
      };
    });

    return {
      ...scene,
      beats: fixedBeats,
    };
  });
}

/**
 * Checks whether a short spoken span is a broken/connective stub fragment (e.g. a colon lead-in
 * "But he has one problem:" or bare 1-2 function words like "with a", "him live.") rather than a
 * valid 2-6 word visual phrase or cartographic/temporal anchor.
 */
function isShortConnectiveFragment(beat: Beat, isVideoMode: boolean = false): boolean {
  if (isIntentionalMontageOrSemanticBeat(beat)) {
    return false;
  }
  const span = (beat.textSpan || '').trim();
  if (extractTemporalAnchor(span) || extractGeographicAnchor(span)) {
    return false;
  }
  // Colon-terminated lead-ins ("But he has one problem:") with short word count are always stub fragments
  if (/:$/.test(span) && getWordCount(span) <= 5) {
    return true;
  }
  const words = getWordCount(span);
  const secs = beat.estimatedSeconds || 1.5;

  if (isVideoMode) {
    return words <= FILLER_FRAGMENT_MAX_WORDS || secs < FILLER_FRAGMENT_MAX_SECONDS;
  }

  // In Image Mode (Option B Phrase-Level Segmentation), preserve healthy 2-6 word phrases.
  // Only flag 1-2 word bare grammatical leftovers with negligible content weight or sub-0.5s slips.
  if (words <= 1 || secs < 0.5) {
    return true;
  }
  if (words === 2) {
    const cleanTokens = span
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const bareFunctionSet = new Set([
      'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'and', 'but', 'or', 'if', 'as',
      'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'that', 'this', 'he', 'she', 'they', 'we', 'you',
      'him', 'her', 'them', 'his', 'their', 'your', 'my', 'our', 'live',
    ]);
    if (cleanTokens.length > 0 && cleanTokens.every((t) => bareFunctionSet.has(t))) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a clean, context-faithful visual progression prompt for a beat when two beats within
 * the same scene are near-duplicates, using the scene's actual characters, location, style,
 * and the specific clause in `beat.textSpan` (ZERO hardcoded horror/phone templates!).
 */
function buildContextPreservingProgressionBeat(
  beat: Beat,
  duplicateIdxInScene: number,
  scene: Scene,
  styleProfile: StyleProfile,
  characterSheet: Record<string, string>,
  locationSheet: Record<string, string>,
  isLongForm: boolean,
  isVideoMode: boolean
): Beat {
  const charEntries = Object.entries(characterSheet);
  const leadChar = charEntries[0];
  const charLabel = leadChar
    ? (/^(?:protagonist|narrator|subject|character)$/i.test(leadChar[0]) ? 'the protagonist' : leadChar[0])
    : 'the protagonist';
  const charPhrase = leadChar
    ? `${charLabel} (${buildCompactCharacterAnchor(leadChar[1], CHARACTER_ANCHOR_MAX_WORDS)})`
    : 'the protagonist';

  const locEntries = Object.entries(locationSheet);
  const rawLocPhrase = locEntries[0]
    ? buildCompactCharacterAnchor(locEntries[0][1], 24) || locEntries[0][0]
    : styleProfile.eraAndSetting || 'the surrounding room';
  let locPhrase = rawLocPhrase
    .replace(/^(A|An|The)\s+/i, '')
    .replace(/^(Spiral|Ruined|Circular|Flooded|Decaying|Ancient|Dense|Dark|Shadowed|Submerged|Stone|Wooden|Metal)\b/, (m) => m.toLowerCase())
    .replace(/[.!?]+$/, '')
    .trim();
  const vesselMatch = (scene.narratorLine || '').match(
    /\b(?:in|inside|aboard)\s+(?:a|an|the)?\s*(?:[a-z]+\s+){0,2}(submersible|submarine|capsule|cockpit|cabin|spacecraft|shuttle|train|car)\b/i
  );
  if (vesselMatch && vesselMatch[1]) {
    locPhrase = `the ${vesselMatch[1].toLowerCase()} interior`;
  } else if (locPhrase && !/^(?:a|an|the|this|that|inside|within|in|on|at|across|beneath|under)\b/i.test(locPhrase) && /^[a-z]/.test(locPhrase)) {
    const headBeforeConnector = locPhrase.split(/\s+(?:and|with|in|of|on|under)\b|,/i)[0].trim();
    const isPluralHead = /s$/i.test(headBeforeConnector) && !/(?:glass|brass|grass|moss|abyss|chaos|darkness|mist|fog)$/i.test(headBeforeConnector);
    if (!isPluralHead) {
      const locArticle = /^[aeiou]/i.test(locPhrase) && !/^uni/i.test(locPhrase) ? 'an' : 'a';
      locPhrase = `${locArticle} ${locPhrase}`;
    }
  }

  const isBarefoot = leadChar ? /\bbarefoot\b/i.test(leadChar[1]) : false;
  const stanceNote = isBarefoot ? 'bare feet planted firmly on the floor' : 'stance planted steadily on the ground';
  const isMaskedOrMinimalist = /\b(?:stickman|stick[-\s]*figure|circle\s+head|helmet|visor|mask)\b/i.test(
    `${charPhrase} ${styleProfile.artStyle || ''}`
  );

  const lowerSpan = (beat.textSpan || '').toLowerCase();
  const variant = (Math.max(0, (scene.index || 1) - 1) + duplicateIdxInScene) % 4;
  let shotType = 'Close-Up';
  let cameraAngle = 'low-angle';
  let cameraMovement = 'Static Frame';
  let actionDescription = '';

  const hasStrictInfancyCribCue =
    /\b(?:since\s+birth|infant|newborn|baby|cradle|crib|swaddled)\b/i.test(lowerSpan) ||
    /\b(?:entity|crib|swaddled|since\s+birth)\b/i.test(scene.narratorLine || '');

  if (hasStrictInfancyCribCue && isInfancyOrChildhoodFlashback(lowerSpan)) {
    shotType = 'Medium Shot';
    cameraAngle = 'high-angle';
    cameraMovement = isVideoMode ? 'Slow Push-In' : 'Static Frame';
    actionDescription =
      'flashback view inside a dimly lit shadowed nursery room showing an infant protagonist swaddled safely inside a wooden crib while a dark gaunt entity lurks silently behind the crib slats watching';
  } else if (/\b(?:that\s+has\s+studied|studied|watching\s+from\s+behind)\b/i.test(lowerSpan)) {
    shotType = 'Over-the-Shoulder (OTS)';
    cameraAngle = 'high-angle';
    cameraMovement = isVideoMode ? 'Slow Push-In' : 'Static Frame';
    actionDescription = `${charPhrase} facing forward completely unaware inside ${locPhrase}, while a towering unsmiling dark entity looms silently out of focus directly behind in deep shadow watching`;
  } else if (/^\s*(?:it'?s\s+an\s+entity|it\s+is\s+an\s+entity|an\s+entity)\b/i.test(lowerSpan)) {
    shotType = 'Medium Close-Up';
    cameraAngle = 'low-angle';
    cameraMovement = 'Static Frame';
    actionDescription = `stark looming reveal of a gaunt shadowy entity with hollow unblinking eyes and completely unsmiling features materializing in ${locPhrase}`;
  } else if (/\b(?:every\s+blink|blink)\b/i.test(lowerSpan)) {
    shotType = 'Extreme Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Static Frame';
    actionDescription = `tight macro framing of pale eyes and dark lashes frozen mid-blink in exact 1:1 mirror symmetry inside ${locPhrase}`;
  } else if (/\b(?:every\s+breath|breath)\b/i.test(lowerSpan)) {
    shotType = 'Extreme Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Static Frame';
    actionDescription = `tight macro detail of faint frozen condensation breath mist blooming against cold mirror glass beside parted lips in exact 1:1 synchrony`;
  } else if (/\b(?:every\s+move|move)\b/i.test(lowerSpan)) {
    shotType = 'Medium Shot';
    cameraAngle = 'eye-level';
    cameraMovement = isVideoMode ? 'Tracking Subject' : 'Static Frame';
    actionDescription = `symmetrical framing of ${charPhrase} with raised shoulder and hand posture mirrored 1:1 by an unsmiling reflection inside ${locPhrase}`;
  } else if (/\bnever\s+reach\s+out\b/i.test(lowerSpan)) {
    shotType = 'Medium Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Static Frame';
    actionDescription = `${charPhrase} standing with hands kept strictly motionless at their sides inside ${locPhrase}, leaving the cold glass completely untouched`;
  } else if (/\bnever\s+cross\b/i.test(lowerSpan)) {
    shotType = 'Medium Shot';
    cameraAngle = 'low-angle';
    cameraMovement = 'Static Frame';
    actionDescription = `${charPhrase} with ${stanceNote} halted back from the dark ebony mirror frame inside ${locPhrase}, barrier unbroken`;
  } else if (/\bhalf[- ]second\s+late\b/i.test(lowerSpan)) {
    shotType = 'Medium Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Static Frame';
    actionDescription = `${charPhrase} turning slightly beside the glass inside ${locPhrase} while the unsmiling reflection remains noticeably frozen in the prior posture`;
  } else if (/\bnow\s+it'?s\s+smiling\b/i.test(lowerSpan)) {
    shotType = 'Extreme Close-Up';
    cameraAngle = 'low-angle';
    cameraMovement = 'Static Frame';
    actionDescription = `chilling close view inside the mirror glass showing the reflection's stretched, unnaturally wide smile etched in stark high-contrast shadow`;
  } else if (/\bnever\s+smiled\b/i.test(lowerSpan)) {
    shotType = 'Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Static Frame';
    actionDescription = `tight facial close-up on ${charPhrase} inside ${locPhrase} standing stone-faced with a completely motionless, unsmiling mouth and quiet dread in the eyes`;
  } else if (/\b(?:target|kings|crown|royal|own him|enemy|army|knights)\b/i.test(lowerSpan)) {
    shotType = 'Over-the-Shoulder (OTS)';
    cameraAngle = 'high-angle';
    cameraMovement = isVideoMode ? 'Tracking Subject' : 'Static Frame';
    actionDescription = `over-the-shoulder vantage looking past ${charPhrase} toward rival armed banners and advancing ranks across ${locPhrase}, tension palpable along the foreground ridge`;
  } else if (/\b(?:guarding|warden|wall|mirror|reflection|entity|mimic)\b/i.test(lowerSpan)) {
    shotType = 'Extreme Close-Up';
    cameraAngle = 'low-angle';
    cameraMovement = 'Static Frame';
    actionDescription = `tight architectural detail along the heavy shadowed border of the glass in ${locPhrase}, dark looming stillness obstructing what lies beyond while ${charPhrase} remains dimly reflected in silhouette`;
  } else if (/\b(?:let him live|defeat|future|history|survive|last|takes everything|problem)\b/i.test(lowerSpan)) {
    shotType = 'Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = isVideoMode ? 'Slow Push-In' : 'Static Frame';
    actionDescription = `showing a tight facial study on ${charPhrase}, brow furrowed in grim calculation with shallow background focus blurring ${locPhrase}`;
  } else if (/\b(?:endless wars|swords|castles|battle|fire|ammo|bullet|weapon)\b/i.test(lowerSpan)) {
    shotType = 'Low-Angle Hero Shot';
    cameraAngle = 'low-angle';
    cameraMovement = isVideoMode ? 'Slow Tilt Up' : 'Static Frame';
    actionDescription = `low-angle framing on ${charPhrase} with ${stanceNote} amid raised steel blades and smoke drift across ${locPhrase}`;
  } else if (variant === 0) {
    shotType = 'Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = isVideoMode ? 'Slow Push-In' : 'Static Frame';
    actionDescription = isMaskedOrMinimalist
      ? `${charPhrase} framed closely inside ${locPhrase}, still posture with head and shoulders angled intently forward`
      : `${charPhrase} framed in quiet stillness inside ${locPhrase}, tense composure and eyes fixed intently forward`;
  } else if (variant === 1) {
    shotType = 'Low-Angle Hero Shot';
    cameraAngle = 'low-angle';
    cameraMovement = isVideoMode ? 'Tracking Subject' : 'Static Frame';
    actionDescription = `${charPhrase} inside ${locPhrase} with ${stanceNote}, towering shadows stretching across the background surfaces`;
  } else if (variant === 2) {
    shotType = 'Over-the-Shoulder (OTS)';
    cameraAngle = 'high-angle';
    cameraMovement = isVideoMode ? 'Smooth Pan' : 'Static Frame';
    actionDescription = `vantage looking past ${charPhrase} across ${locPhrase}, revealing surrounding depth, structural details, and shadows`;
  } else {
    shotType = 'Medium Close-Up';
    cameraAngle = 'dutch-tilt';
    cameraMovement = isVideoMode ? 'Handheld Cinematic Drift' : 'Static Frame';
    actionDescription = isMaskedOrMinimalist
      ? `${charPhrase} bracing in quiet alertness inside ${locPhrase}, stark directional contrast across the figure`
      : `${charPhrase} bracing in quiet unease inside ${locPhrase}, stark directional contrast across facial contours`;
  }

  const fixedLensMatch = (styleProfile.lensAndFilmStock || '').match(/\bfixed\s+(\d{1,3}mm(?:\s+(?:prime|anamorphic|wide(?:-angle)?|macro))?)\s+lens\b/i);
  const optics = fixedLensMatch
    ? `Fixed ${fixedLensMatch[1]} lens perspective`
    : shotType.includes('Close-Up')
      ? 'Shot on 85mm f/1.8 portrait prime lens with shallow depth of field'
      : 'Shot on 35mm f/4 cinema lens with atmospheric depth';

  const cleanLighting = sanitizeMonochromeLighting(
    (buildCompactCharacterAnchor(styleProfile.lighting, 24) || styleProfile.lighting).replace(/[.!?]+$/, '').trim(),
    styleProfile
  );
  const compactStyle = (buildCompactCharacterAnchor(styleProfile.artStyle, STYLE_ANCHOR_MAX_WORDS) || styleProfile.artStyle)
    .replace(/[.!?]+$/, '')
    .trim();
  const fullBody = `${actionDescription}, ${cleanLighting}. ${optics}. Visual Style: ${compactStyle}.`;

  return formatFinalBeatPrompt(
    {
      ...beat,
      shotType,
      cameraAngle,
      cameraMovement,
      imagePrompt: fullBody,
    },
    isLongForm,
    isVideoMode,
    { styleProfile, characterSheet, locationSheet }
  );
}

/**
 * Deduplicates and progresses all beats within each scene under Option A (Visual-Event Pacing,
 * ~1.5s - 3.0s per visual event):
 * 1) Replaces any legacy fallback placeholder strings ("Alternative reaction perspective...").
 * 2) Merges short non-visual connective fragments (<= 4 words / < 1.25s) or adjacent near-duplicates
 *    when combined duration fits within 3.1s (Option A visual-event pacing).
 * 3) Detects clones across ALL beat pairs (i, j) in the scene (catching A-B-A-B clones as well!)
 *    and evolves any duplicate beat using context-preserving visual progression.
 */
export function deduplicateAndProgressSceneBeats(
  beats: Beat[],
  context?: {
    scene?: Scene;
    styleProfile?: StyleProfile;
    characterSheet?: Record<string, string>;
    locationSheet?: Record<string, string>;
    isLongForm?: boolean;
    isVideoMode?: boolean;
    maxMergeSeconds?: number;
  }
): Beat[] {
  if (!Array.isArray(beats) || beats.length === 0) return [];

  const isLongForm = !!context?.isLongForm;
  const isVideoMode = !!context?.isVideoMode;
  const maxMergeSeconds = context?.maxMergeSeconds ?? VISUAL_EVENT_MAX_SECONDS;
  const styleProfile: StyleProfile = context?.styleProfile || {
    artStyle: 'Cinematic rendering',
    colorPalette: 'Harmonious dramatic palette',
    lighting: 'Directional key light with soft rim fill',
    eraAndSetting: 'Story setting',
  };
  const characterSheet = context?.characterSheet || {};
  const locationSheet = context?.locationSheet || {};
  const ignoredSimilarityTokens = buildSharedContextIgnoreTokens(
    styleProfile,
    locationSheet,
    characterSheet
  );
  const fallbackScene: Scene = context?.scene || {
    index: 1,
    narratorLine: beats.map((b) => b.textSpan).join(' '),
    estimatedSeconds: beats.reduce((s, b) => s + (b.estimatedSeconds || 1.5), 0),
    beats,
  };

  // Pass 1: Clean each beat and flag any degenerate/fallback prompts
  const cleanedBeats: Beat[] = beats.map((b, idx) => {
    let p = normalizeUnicodeAndDashes(b.imagePrompt || '');
    p = sanitizeFakePrecisionMath(p);

    const isLegacyFallback =
      /alternative reaction perspective showing the character/i.test(p) ||
      p.trim().length < 25;

    if (isLegacyFallback) {
      return buildContextPreservingProgressionBeat(
        b,
        idx,
        fallbackScene,
        styleProfile,
        characterSheet,
        locationSheet,
        isLongForm,
        isVideoMode
      );
    }

    return {
      ...b,
      textSpan: normalizeUnicodeAndDashes(b.textSpan || ''),
      imagePrompt: p,
    };
  });

  // Pass 2: Option A Visual-Event Merge: merge adjacent near-duplicates or short connective fragments
  // when combined duration <= maxMergeSeconds (3.1s) and combined words <= 15
  const merged: Beat[] = [];
  for (let i = 0; i < cleanedBeats.length; i++) {
    const curr = { ...cleanedBeats[i] };
    if (merged.length === 0) {
      merged.push(curr);
      continue;
    }

    const prev = merged[merged.length - 1];
    const sim = computeVisualPromptSimilarity(
      prev.imagePrompt,
      curr.imagePrompt,
      ignoredSimilarityTokens
    );
    const combinedSeconds = Math.round(((prev.estimatedSeconds || 1.5) + (curr.estimatedSeconds || 1.5)) * 10) / 10;
    const combinedWords = getWordCount(`${prev.textSpan} ${curr.textSpan}`);

    const currIsTinyConnector = isShortConnectiveFragment(curr, isVideoMode);
    const prevIsTinyConnector = isShortConnectiveFragment(prev, isVideoMode);
    const distinctMontageSubjects = hasDistinctMontageFocalSubject(prev, curr);

    // In Image Mode (Option B Phrase Cuts), only merge if beats are near-identical clones (sim >= 0.52)
    // OR one of them is a genuine broken stub/colon fragment; NEVER re-merge healthy 2-6w beats past 6 words.
    const simThreshold = isVideoMode ? 0.46 : 0.52;
    const maxCombinedPhraseWords =
      isVideoMode || currIsTinyConnector || prevIsTinyConnector
        ? VISUAL_EVENT_MAX_WORDS
        : 6;

    const shouldMergeAdjacent =
      combinedSeconds <= maxMergeSeconds &&
      combinedWords <= maxCombinedPhraseWords &&
      !(distinctMontageSubjects && sim < 0.68) &&
      (sim >= simThreshold || currIsTinyConnector || prevIsTinyConnector);

    if (shouldMergeAdjacent) {
      prev.textSpan = `${prev.textSpan.trim()} ${curr.textSpan.trim()}`.trim();
      prev.estimatedSeconds = combinedSeconds;
      // Prefer whichever prompt is richer & NOT a short connector's leftover prompt
      if (prevIsTinyConnector && !currIsTinyConnector) {
        prev.imagePrompt = curr.imagePrompt;
        prev.shotType = curr.shotType;
        prev.cameraAngle = curr.cameraAngle;
        prev.cameraMovement = curr.cameraMovement;
      } else if ((curr.imagePrompt || '').length > (prev.imagePrompt || '').length) {
        prev.imagePrompt = curr.imagePrompt;
        prev.shotType = curr.shotType;
        prev.cameraAngle = curr.cameraAngle;
        prev.cameraMovement = curr.cameraMovement;
      }
    } else {
      merged.push(curr);
    }
  }

  // Pass 3: Scene-Wide Intra-Scene Clone Resolution (catches A-B-A-B non-adjacent duplicates as well!)
  const finalized: Beat[] = [];
  let dupCounter = 0;

  for (let i = 0; i < merged.length; i++) {
    let beat = { ...merged[i] };

    // Compare against ALL prior beats in finalized (not just i-1!)
    let hasDuplicateInScene = false;
    for (let j = 0; j < finalized.length; j++) {
      const sim = computeVisualPromptSimilarity(
        finalized[j].imagePrompt,
        beat.imagePrompt,
        ignoredSimilarityTokens
      );
      const distinctMontage = hasDistinctMontageFocalSubject(finalized[j], beat);
      const cloneThreshold = distinctMontage ? 0.68 : 0.48;
      if (sim >= cloneThreshold) {
        hasDuplicateInScene = true;
        break;
      }
    }

    if (hasDuplicateInScene) {
      beat = buildContextPreservingProgressionBeat(
        beat,
        dupCounter++,
        fallbackScene,
        styleProfile,
        characterSheet,
        locationSheet,
        isLongForm,
        isVideoMode
      );
    }

    finalized.push(beat);
  }

  // Pass 4: Harmonize recurring container/prop materials within the scene (e.g. ceramic bowl -> wooden bowl drift)
  const harmonized = harmonizeScenePropMaterials(finalized);

  return harmonized.map((b, idx) => ({
    ...b,
    beatIndex: idx + 1,
  }));
}

/**
 * Prevents unintended prop material drift across beats in the same scene (e.g., Beat 5 pouring broth into
 * a "ceramic bowl" while Beat 6 describes a "wooden bowl of ramen") unless a transformation is explicitly narrated.
 */
export function harmonizeScenePropMaterials(beats: Beat[]): Beat[] {
  if (!Array.isArray(beats) || beats.length <= 1) return beats;
  const materialRegex =
    /\b(ceramic|porcelain|wooden|wood|clay|glass|brass|copper|iron|steel|metal|stone|earthenware|lacquered)\s+(bowl|cup|teacup|mug|pot|kettle|cauldron|lantern(?!\s+(?:room|tower|chamber|wall|pane|window|glass|housing))|box|chest|tray)\b/gi;
  const establishedMaterial = new Map<string, string>();

  return beats.map((beat) => {
    let prompt = beat.imagePrompt || '';
    const spanLower = (beat.textSpan || '').toLowerCase();
    const isTransformBeat = /\b(?:turn(?:s|ed)?\s+into|transform(?:s|ed)?\s+into|become(?:s)?)\b/i.test(spanLower);
    if (isTransformBeat) {
      return beat;
    }

    prompt = prompt.replace(materialRegex, (fullMatch, mat: string, prop: string) => {
      const propKey = prop.toLowerCase();
      const matLower = mat.toLowerCase();
      const prevMat = establishedMaterial.get(propKey);
      if (!prevMat) {
        establishedMaterial.set(propKey, matLower);
        return fullMatch;
      }
      if (prevMat !== matLower) {
        return `${prevMat} ${prop}`;
      }
      return fullMatch;
    });

    return {
      ...beat,
      imagePrompt: prompt,
    };
  });
}

/**
 * Inspects all scenes to find any structural defects requiring Phase-2 LLM Beat Progression Repair:
 * - Intra-scene duplicate or near-duplicate beats (including non-adjacent A-B-A-B clones)
 * - Oversized multi-clause beats (> 15 words or > 3.1s in image mode) OR dense 7-14 word patterns
 *   (unsplit action triplets, entity+birth flashbacks, repeated negations, lag+smile climax merges)
 * - Era/location bleed across chronological shifts
 */
export function auditScenesForRepair(
  scenes: Scene[],
  styleProfile: StyleProfile,
  isVideoMode: boolean,
  targetVideoDuration?: number,
  characterSheet?: Record<string, string>,
  locationSheet?: Record<string, string>
): Array<{ sceneIndex: number; reasons: string[] }> {
  const flagged: Array<{ sceneIndex: number; reasons: string[] }> = [];
  const ignoredSimilarityTokens = buildSharedContextIgnoreTokens(
    styleProfile,
    locationSheet,
    characterSheet
  );
  let enteredHistoricalPast = false;

  scenes.forEach((scene) => {
    const reasons: string[] = [];
    const beats = scene.beats || [];
    const sceneText = `${scene.narratorLine} ${beats.map((b) => b.textSpan).join(' ')}`;

    if (/\b(?:sent\s+\d+\s+years\s+into\s+the\s+past|back\s+in\s+time|medieval|knight|castle|centuries\s+in\s+the\s+past)\b/i.test(sceneText)) {
      enteredHistoricalPast = true;
    }

    // 1. Check all pairs (i, j) within scene for clones (raising ceiling when distinct montage subjects apply)
    for (let i = 0; i < beats.length; i++) {
      for (let j = i + 1; j < beats.length; j++) {
        const sim = computeVisualPromptSimilarity(
          beats[i].imagePrompt,
          beats[j].imagePrompt,
          ignoredSimilarityTokens
        );
        const cloneThreshold = hasDistinctMontageFocalSubject(beats[i], beats[j]) ? 0.68 : 0.50;
        if (sim >= cloneThreshold) {
          reasons.push(`Beats ${i + 1} and ${j + 1} have near-identical visual prompts (${Math.round(sim * 100)}% overlap)`);
        }
      }

      // 2. Check oversized beat OR dense multi-concept 7-14 word patterns needing montage/semantic split
      const wc = getWordCount(beats[i].textSpan);
      const sec = beats[i].estimatedSeconds || 2;
      if (!isVideoMode && (wc > VISUAL_EVENT_MAX_WORDS || sec > VISUAL_EVENT_MAX_SECONDS)) {
        reasons.push(`Beat ${i + 1} ("${beats[i].textSpan}") spans ${wc} words / ${sec}s and needs progression into 2-3 distinct visual beats`);
      } else if (!isVideoMode || beats.length === 1) {
        const densePatternIssue = detectUnsplitDenseBeatPattern(beats[i].textSpan || '');
        if (densePatternIssue) {
          reasons.push(`Beat ${i + 1} ("${beats[i].textSpan}"): ${densePatternIssue}`);
        }
      }

      // 3. Check era bleed
      if (
        enteredHistoricalPast &&
        /\b(?:blurred armory|metallic armory racks|neon[- ]lit city|glass skyscrapers|holographic billboards)\b/i.test(beats[i].imagePrompt)
      ) {
        reasons.push(`Beat ${i + 1} leaks modern/futuristic scenery into historical past setting`);
      }
    }

    if (isVideoMode && targetVideoDuration && targetVideoDuration > 0 && beats.length === 1) {
      reasons.push(`Single-beat Video Mode clip must be broken into 2-3 cohesive visual progressions summing to ${targetVideoDuration}s`);
    }

    if (reasons.length > 0) {
      flagged.push({
        sceneIndex: scene.index,
        reasons: Array.from(new Set(reasons)),
      });
    }
  });

  return flagged;
}

/**
 * Proportionally scales beat durations inside a Text-to-Video scene so their exact sum
 * matches targetDuration (e.g., 4.0s clip = 2.0s + 2.0s or 1.4s + 1.3s + 1.3s).
 */
export function scaleBeatsToTargetDuration(beats: Beat[], targetDuration: number): Beat[] {
  if (!Array.isArray(beats) || beats.length === 0 || !targetDuration || targetDuration <= 0) {
    return beats;
  }

  const roundedTarget = Math.round(targetDuration * 10) / 10;
  const minPerBeat = Math.min(0.6, Math.round((roundedTarget / beats.length) * 10) / 10);

  const weights = beats.map((b) => {
    const wc = getWordCount(b.textSpan || '');
    const rawSec = typeof b.estimatedSeconds === 'number' && b.estimatedSeconds > 0 ? b.estimatedSeconds : Math.max(0.8, wc / 2.2);
    return Math.max(0.5, rawSec);
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || beats.length;

  const scaled = beats.map((b, idx) => {
    const share = Math.round(((weights[idx] / totalWeight) * roundedTarget) * 10) / 10;
    return {
      ...b,
      estimatedSeconds: Math.max(minPerBeat, share),
    };
  });

  // Absorb any rounding delta cleanly onto the longest beat so total equals roundedTarget exactly
  const currentSum = Math.round(scaled.reduce((acc, b) => acc + (b.estimatedSeconds || 0), 0) * 10) / 10;
  const delta = Math.round((roundedTarget - currentSum) * 10) / 10;
  if (delta !== 0) {
    let targetIdx = scaled.length - 1;
    let bestWeight = -1;
    for (let i = 0; i < scaled.length; i++) {
      if ((scaled[i].estimatedSeconds || 0) > bestWeight && (scaled[i].estimatedSeconds || 0) + delta >= minPerBeat) {
        bestWeight = scaled[i].estimatedSeconds || 0;
        targetIdx = i;
      }
    }
    const adjusted = Math.round(((scaled[targetIdx].estimatedSeconds || minPerBeat) + delta) * 10) / 10;
    if (adjusted >= 0.4) {
      scaled[targetIdx] = { ...scaled[targetIdx], estimatedSeconds: adjusted };
    }
  }

  return scaled;
}

export interface TwoPhaseProgressionParams {
  scenes: Scene[];
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
  isLongForm: boolean;
  isVideoMode: boolean;
  targetVideoDuration?: number;
  apiKey?: string;
  aiProvider?: AiProvider;
  modelQuality?: GeminiModelQuality;
  groqModel?: string;
  userSignal?: AbortSignal;
  onStatusMessage?: (msg: string) => void;
  skipLlmRepair?: boolean;
  skipOptionBPhraseSplit?: boolean;
}

/**
 * Deterministic Option B Phrase-Level Segmentation enforcer (Image Mode only):
 * If an LLM returns an oversized >= 7-word beat in Text-to-Image mode, splits its spoken textSpan
 * cleanly at natural grammatical boundaries into 2 to 6 word beats and evolves visual perspective
 * across the split sub-beats so every phrase gets a distinct framing without losing story context.
 */
function enforceOptionBPhraseBeatsInScene(
  scene: Scene,
  styleProfile: StyleProfile,
  characterSheet: Record<string, string>,
  locationSheet: Record<string, string>,
  isLongForm: boolean
): Scene {
  const inputBeats = Array.isArray(scene.beats) ? scene.beats : [];
  if (inputBeats.length === 0) return scene;

  const shotVariants = [
    { shotType: 'Close-Up', cameraAngle: 'low-angle' },
    { shotType: 'Over-the-Shoulder (OTS)', cameraAngle: 'high-angle' },
    { shotType: 'Medium Close-Up', cameraAngle: 'eye-level' },
    { shotType: 'Wide Establishing Shot', cameraAngle: 'low-angle' },
    { shotType: 'Extreme Close-Up', cameraAngle: 'eye-level' },
  ];

  const expandedBeats: Beat[] = [];
  for (let bIdx = 0; bIdx < inputBeats.length; bIdx++) {
    const beat = inputBeats[bIdx];
    const span = (beat.textSpan || '').trim();
    const wc = getWordCount(span);
    if (wc <= 6) {
      expandedBeats.push(beat);
      continue;
    }

    const subPhrases = splitPhraseIntoSubBeats(span, 6);
    if (subPhrases.length <= 1) {
      expandedBeats.push(beat);
      continue;
    }

    const totalSec = typeof beat.estimatedSeconds === 'number' && beat.estimatedSeconds > 0 ? beat.estimatedSeconds : Math.max(1.6, wc * 0.4);
    const totalSubWords = Math.max(1, subPhrases.reduce((acc, p) => acc + Math.max(1, getWordCount(p)), 0));

    subPhrases.forEach((subText, subIdx) => {
      const subWords = Math.max(1, getWordCount(subText));
      const subSec = Math.max(0.8, Math.min(2.2, Math.round(((totalSec * subWords) / totalSubWords) * 10) / 10));

      if (subIdx === 0) {
        expandedBeats.push({
          ...beat,
          textSpan: subText,
          estimatedSeconds: subSec,
        });
        return;
      }

      const v = shotVariants[(bIdx + subIdx) % shotVariants.length];
      const baseBody = stripLeadingOrientationPrefixes(beat.imagePrompt || '')
        .replace(/\s*--ar\s+[0-9:]+.*$/i, '')
        .replace(/\s*(?:Featuring|Visual Style):\s*[^.]+\.?/gi, '')
        .replace(/\s*(?:Shot on|Fixed)\s+\d{1,3}mm[^.]*\.?/gi, '')
        .replace(/^(?:Extreme\s+Wide\s+Shot|Wide\s+Establishing\s+Shot|Wide|Medium\s+Close-Up|Medium\s+Shot|Extreme\s+Close-Up|Close-Up|Over-the-Shoulder\s*\(OTS\)|Point-of-View\s*\(POV\)|Whip[-\s]*Pan)(?:\s*,\s*[a-z-]+)?(?:\s*(?:,|of|on|across|within|:)\s*)?/i, '')
        .replace(/[.!?]+$/, '')
        .trim();

      const rawSubPhrase = subText.replace(/^[.,;:!?'"-]+|[.,;:!?'"-]+$/g, '').trim();
      const cleanSubPhrase =
        rawSubPhrase
          .replace(/^(?:like|of|for|in|on|at|to|from|through|with|by)\s+(?=[a-z])/i, '')
          .trim() || rawSubPhrase;
      const hasConcreteDetailCue =
        /\b(?:journal|book|books|map|lamp|lantern|blade|beam|pages|ink|barnacles|salt|tree|pencil|sketchbook|lock|key|photo|mirror|coin|glass|hand|hands|eyes|match|flame)\b/i.test(
          cleanSubPhrase
        );

      if (baseBody && baseBody.length >= 20) {
        const pickedShot = hasConcreteDetailCue ? (subIdx % 2 === 1 ? 'Close-Up' : 'Extreme Close-Up') : v.shotType;
        const pickedAngle = hasConcreteDetailCue ? 'eye-level' : v.cameraAngle;
        const fixedLensMatch = (styleProfile.lensAndFilmStock || '').match(
          /\bfixed\s+(\d{1,3}mm(?:\s+(?:prime|anamorphic|wide(?:-angle)?|macro))?)\s+lens\b/i
        );
        const lensNote = fixedLensMatch
          ? `Fixed ${fixedLensMatch[1]} lens perspective`
          : pickedShot.includes('Close-Up')
            ? 'Shot on 85mm portrait prime lens'
            : 'Shot on 35mm cinema lens';
        const primaryLocName = Object.keys(locationSheet || {})[0] || styleProfile.eraAndSetting || 'the surrounding setting';
        const compactSetting = buildCompactCharacterAnchor(primaryLocName, 10).replace(/[.!?]+$/, '').trim() || 'the scene setting';
        const focusedBody = hasConcreteDetailCue
          ? `${pickedShot}, ${pickedAngle} isolating crisp surface details of ${cleanSubPhrase} inside ${compactSetting}. ${lensNote}.`
          : `${pickedShot}, ${pickedAngle} shifting perspective toward ${cleanSubPhrase} set across ${compactSetting}. ${lensNote}.`;

        const formattedSub = formatFinalBeatPrompt(
          {
            ...beat,
            beatIndex: bIdx + subIdx + 1,
            textSpan: subText,
            shotType: pickedShot,
            cameraAngle: pickedAngle,
            cameraMovement: 'Static Frame',
            estimatedSeconds: subSec,
            imagePrompt: focusedBody,
          },
          isLongForm,
          false,
          { styleProfile, characterSheet, locationSheet }
        );

        expandedBeats.push({
          ...formattedSub,
          textSpan: subText,
          estimatedSeconds: subSec,
        });
        return;
      }

      const progressedSub = buildContextPreservingProgressionBeat(
        {
          ...beat,
          beatIndex: bIdx + subIdx + 1,
          textSpan: subText,
          shotType: v.shotType,
          cameraAngle: v.cameraAngle,
          cameraMovement: 'Static Frame',
          estimatedSeconds: subSec,
          imagePrompt: '',
        },
        bIdx + subIdx + 1,
        scene,
        styleProfile,
        characterSheet,
        locationSheet,
        isLongForm,
        false
      );

      expandedBeats.push({
        ...progressedSub,
        textSpan: subText,
        estimatedSeconds: subSec,
      });
    });
  }

  return {
    ...scene,
    beats: expandedBeats.map((b, i) => ({ ...b, beatIndex: i + 1 })),
  };
}

/**
 * Orchestrates Phase-2 Beat Verification, Narration Coverage Recovery, Optional LLM Progression Repair,
 * Compact Character Identity Locking (Option A), Shot-Metadata Synchronization, and Scene Transition Hints.
 */
export async function runTwoPhaseProgressionAndRepair(
  params: TwoPhaseProgressionParams
): Promise<Scene[]> {
  const {
    styleProfile,
    characterSheet,
    locationSheet,
    isLongForm,
    isVideoMode,
    targetVideoDuration,
    apiKey,
    aiProvider = 'gemini',
    modelQuality,
    groqModel,
    userSignal,
    onStatusMessage,
  } = params;

  // Step 1: Normalize unicode dashes & fake precision math across all scenes
  let workingScenes: Scene[] = (params.scenes || []).map((scene) => ({
    ...scene,
    narratorLine: normalizeUnicodeAndDashes(scene.narratorLine || ''),
    beats: (scene.beats || []).map((b) => ({
      ...b,
      textSpan: normalizeUnicodeAndDashes(b.textSpan || ''),
      imagePrompt: sanitizeFakePrecisionMath(b.imagePrompt || ''),
      shotType: normalizeUnicodeAndDashes(b.shotType || ''),
      cameraAngle: normalizeUnicodeAndDashes(b.cameraAngle || ''),
      cameraMovement: normalizeUnicodeAndDashes(b.cameraMovement || ''),
    })),
  }));

  // Step 2: Scrub chronological era bleed
  workingScenes = sanitizeEraBleedAcrossScenes(workingScenes, styleProfile, locationSheet);

  // Step 2b: Synchronize canonical character sheet with concrete details established on each cast member's first appearance
  const activeCharacterSheet = synchronizeCharacterSheetWithFirstAppearances(workingScenes, characterSheet);

  // Step 3: Verify & repair 100% spoken narration word coverage in every scene
  workingScenes = verifyAndRepairSceneNarrationCoverage(
    workingScenes,
    styleProfile,
    activeCharacterSheet,
    locationSheet,
    { isLongForm, isVideoMode }
  );

  // Step 4: Audit scenes for clones, oversized run-on beats, or era bleed
  const flaggedScenes = auditScenesForRepair(
    workingScenes,
    styleProfile,
    isVideoMode,
    targetVideoDuration,
    activeCharacterSheet,
    locationSheet
  );

  const hasLiveApiKey =
    typeof apiKey === 'string' &&
    apiKey.trim().length > 10 &&
    !/^(?:mock|test|dummy|fake)/i.test(apiKey.trim()) &&
    !userSignal?.aborted;

  if (flaggedScenes.length > 0 && !params.skipLlmRepair && hasLiveApiKey && apiKey) {
    try {
      if (onStatusMessage) {
        onStatusMessage('Refining beat-to-beat visual progression and continuity...');
      }

      const compactCastSummary = Object.entries(activeCharacterSheet)
        .map(([name, desc]) => `- ${name}: ${buildCompactCharacterAnchor(desc, CHARACTER_ANCHOR_MAX_WORDS)}`)
        .join('\n');
      const compactLocSummary = Object.entries(locationSheet)
        .map(([name, desc]) => `- ${name}: ${buildCompactCharacterAnchor(desc, 30)}`)
        .join('\n');

      const orientationText = isLongForm
        ? 'Cinematic 16:9 widescreen composition'
        : 'Vertical 9:16 portrait composition';
      const arFlag = isLongForm ? '--ar 16:9' : '--ar 9:16';
      const videoClipBudgetNote =
        isVideoMode && targetVideoDuration && targetVideoDuration > 0
          ? `\n- VIDEO CLIP DURATION LOCK: Each scene represents ONE continuous ${targetVideoDuration}-second AI video clip. Keep ${targetVideoDuration <= 5 ? '2 to 3' : '3 to 4'} cohesive sub-beats whose "estimatedSeconds" values sum cleanly to ${targetVideoDuration}.0s (avoid cramming 5-6 unrelated scene jumps into one short clip).`
          : '';

      const repairSystemPrompt = `You are a senior film director and storyboard continuity supervisor performing a targeted second-pass beat progression repair.
You will receive specific scenes from a storyboard whose beats had visual repetition, missing narration coverage, oversized beats, or setting bleed.

GLOBAL PRODUCTION LOCKS:
- Art Style: ${styleProfile.artStyle}
- Color Palette: ${styleProfile.colorPalette}
- Lighting: ${styleProfile.lighting}
- Era & Setting: ${styleProfile.eraAndSetting}${videoClipBudgetNote}
${compactCastSummary ? `\nLOCKED CHARACTERS (Compact Identity Anchors - MUST include in every beat where character appears):\n${compactCastSummary}` : ''}
${compactLocSummary ? `\nLOCKED LOCATIONS:\n${compactLocSummary}` : ''}

STRICT REPAIR RULES:
1. 100% EXACT NARRATION WORD COVERAGE (DO NOT EXPAND OR ALTER): Keep each scene's "narratorLine" verbatim without adding, removing, or rewriting words. Every word in "narratorLine" MUST appear in exact sequential order across its "beats[].textSpan". Never drop or truncate trailing clauses.
2. DYNAMIC VISUAL-EVENT & SELECTIVE MONTAGE PACING:
   - Default baseline (~1.5s to 3.0s per beat): Cut on genuine physical actions, object state transitions, camera vantage shifts, or reveals. NEVER isolate plain grammar connectors ("But he has one problem:", "him live.") into stub beats.
   - EXCEPTION A - ACTION-TRIPLET / PARALLEL-LIST MONTAGE (~0.7s to 1.2s per beat): Whenever narration lists 2-3+ parallel actions/sensory items (e.g. "every blink, every breath, every move"), split EVERY item into its own rapid beat with a RADICALLY DIFFERENT shot scale and focal noun ("every blink" -> Extreme Close-Up macro on eyelids in 1:1 mirror symmetry; "every breath" -> Extreme Close-Up macro on frozen condensation mist on glass near parted lips; "every move" -> Medium Shot on raised shoulder and hand posture). Keep exact 1:1 synchrony unless lag is reached.
   - EXCEPTION B - SEMANTIC-ANCHOR & TEMPORAL FLASHBACK DECOMPOSITION (~0.8s to 1.3s per beat): When a clause packs an Entity + Observation + Time-Origin Flashback (e.g. "It's an entity that has studied you since birth"), decompose cleanly into:
     * Entity beat ("It's an entity") -> stylized reveal of the unsmiling entity.
     * Stalking/verb beat ("that has studied") -> protagonist facing forward completely unaware in sharp focus while the dark entity looms behind in deep shadow watching.
     * Origin flashback beat ("you since birth") -> infant protagonist swaddled INSIDE a wooden crib while the shadowy entity hides behind/outside the crib slats watching. Strictly NO adult turtleneck/jeans wardrobe on the baby, NO modern bedroom traits, and NO etched date timelines on glass!
   - EXCEPTION C - REPEATED NEGATIONS & CLIMAX TURNS: Split repeated rhetorical negations ("You never reach out." hands still at sides -> "You never cross." feet halted before frame) and separate timing-lag beats from smile-reveal beats ("half-second late." -> "Now it's smiling." -> "And you never smiled.").
3. CHRONOLOGICAL TWIST PROTECTION, VISIBLE CONTENT & ZERO SPOILERS:
   - Never reveal late-story horror twists early (if reflection only smiles at the end, keep it unsmiling earlier; if Scene 3 says "perfectly mimicking", show 1:1 synchrony with zero delay).
   - VISIBLE CONTENT FIDELITY: When narration states a photograph, print, newspaper, or screen "shows", "displays", or "reveals" something, depict its visible front face showing all stated items (never turn it face-down or omit named items like a headline board).
   - Never contradict negation beats, never quote spoken words inside visual prompts, and never invent unseen whispers.
4. MONOCHROME & ENTITY CONSISTENCY:
   - ${isMonochromeStyle(styleProfile) ? 'STRICT MONOCHROME INK STYLE ACTIVE: NEVER include color Kelvin temperatures (3200K warm, 5400K, cyan, amber, crimson). Use pure monochrome contrast and chiaroscuro ink shadow lighting only.' : 'Keep lighting and color palette aligned with Style Profile.'}
   - NEVER output raw JSON keys like "DarkRoom" or "Protagonist" inside imagePrompt; use natural English environmental phrases and consistent footwear/clothing (except infant flashbacks where baby wears crib blankets).
5. SYNCHRONIZED SHOT METADATA & OPENING:
   - Each beat MUST specify "shotType", "cameraAngle", and "cameraMovement".
   - NEVER place framing terms like "over-the-shoulder" or "pov" inside "cameraAngle"! Only vertical/tilt angles are allowed in cameraAngle.
   - Begin "imagePrompt" with: "${orientationText}, <shotType>, <cameraAngle>, <compact visual scene>" (NEVER insert "in a" before the angle or repeat orientation strings).
   - Ensure shotType and cameraAngle in metadata match the opening of imagePrompt 1-for-1.
6. NATURAL BIOMECHANICS & CHRONOLOGY:
   - NEVER write degree angles or body-weight percentages (e.g. "70% weight", "15 degrees"). Describe posture, weight, grip, and gaze in natural language.
   - Strictly respect chronological setting progression (do not leak earlier modern/sci-fi rooms into later historical/past scenes).
   - Do NOT use em dashes or non-breaking hyphens. Return ONLY raw JSON:
{
  "scenes": [
    {
      "index": number,
      "narratorLine": string,
      "beats": [
        {
          "beatIndex": number,
          "textSpan": string,
          "estimatedSeconds": number,
          "shotType": "Extreme Wide Shot | Wide Establishing Shot | Medium Shot | Medium Close-Up | Close-Up | Extreme Close-Up | Over-the-Shoulder (OTS) | Point-of-View (POV)",
          "cameraAngle": "eye-level | low-angle | high-angle | birds-eye | worms-eye | dutch-tilt",
          "cameraMovement": "Slow Push-In | Static Frame | Tracking Subject | Smooth Pan | Whip-Pan",
          "imagePrompt": string
        }
      ]
    }
  ]
}`;

      const flaggedPayload = flaggedScenes.map((f) => {
        const sc = workingScenes.find((s) => s.index === f.sceneIndex)!;
        return {
          sceneIndex: sc.index,
          narratorLine: sc.narratorLine,
          detectedIssues: f.reasons,
          currentBeats: sc.beats.map((b) => ({
            textSpan: b.textSpan,
            shotType: b.shotType,
            cameraAngle: b.cameraAngle,
          })),
        };
      });

      const repairUserPrompt = `Chronological Story Outline:\n${workingScenes
        .map((s) => `Scene ${s.index}: "${s.narratorLine}"`)
        .join('\n')}\n\nFlagged Scenes Requiring Progression Repair:\n${JSON.stringify(flaggedPayload, null, 2)}`;

      const repairedData = await executeJsonLlmCall<{ scenes?: Array<any> }>({
        provider: aiProvider,
        apiKey,
        systemPrompt: repairSystemPrompt,
        userPrompt: repairUserPrompt,
        modelQuality,
        groqModel,
        userSignal,
        temperature: 0.25,
        topP: 0.85,
        thinkingLevel: 'minimal',
      });

      if (repairedData && Array.isArray(repairedData.scenes)) {
        for (const repairedScene of repairedData.scenes) {
          const targetIdx = workingScenes.findIndex((s) => s.index === repairedScene.index);
          if (targetIdx !== -1 && Array.isArray(repairedScene.beats) && repairedScene.beats.length > 0) {
            const cleanedRepairedBeats: Beat[] = repairedScene.beats
              .filter((b: any) => typeof b.textSpan === 'string' && b.textSpan.trim().length > 0)
              .map((b: any, bIdx: number) => ({
                beatIndex: bIdx + 1,
                textSpan: normalizeUnicodeAndDashes(b.textSpan),
                shotType: normalizeUnicodeAndDashes(b.shotType || 'Medium Shot'),
                cameraAngle: normalizeUnicodeAndDashes(b.cameraAngle || 'eye-level'),
                cameraMovement: normalizeUnicodeAndDashes(b.cameraMovement || 'Slow Push-In'),
                imagePrompt: sanitizeFakePrecisionMath(b.imagePrompt || ''),
                estimatedSeconds:
                  typeof b.estimatedSeconds === 'number' && b.estimatedSeconds > 0
                    ? Math.round(b.estimatedSeconds * 10) / 10
                    : (() => {
                        const wc = getWordCount(b.textSpan);
                        const isMontage = extractMontageFocalCategory(b.textSpan || '') !== null;
                        return isMontage
                          ? Math.max(MONTAGE_MIN_SECONDS, Math.min(1.3, Math.round((wc / 2.3) * 10) / 10))
                          : Math.max(1.4, Math.min(3.0, Math.round((wc / 2.3) * 10) / 10));
                      })(),
              }));

            if (cleanedRepairedBeats.length > 0) {
              workingScenes[targetIdx] = {
                ...workingScenes[targetIdx],
                beats: cleanedRepairedBeats,
              };
            }
          }
        }

        // Re-verify narration coverage after LLM repair to guarantee zero dropped words
        workingScenes = verifyAndRepairSceneNarrationCoverage(
          workingScenes,
          styleProfile,
          activeCharacterSheet,
          locationSheet,
          { isLongForm, isVideoMode }
        );
      }
    } catch {
      // Non-fatal: fall through seamlessly to deterministic progression repair below
    }
  }

  // Step 4b: Deterministic Option B Phrase-Level Segmentation (2-6 words per Image beat)
  if (!isVideoMode && !params.skipOptionBPhraseSplit) {
    workingScenes = workingScenes.map((sc) =>
      enforceOptionBPhraseBeatsInScene(
        sc,
        styleProfile,
        activeCharacterSheet,
        locationSheet,
        isLongForm
      )
    );
  }

  // Step 5: Deterministic progression deduplication + compact character locks + synchronized framing opening
  const finalizedScenes = workingScenes.map((scene) => {
    const progressedBeats = deduplicateAndProgressSceneBeats(scene.beats || [], {
      scene,
      styleProfile,
      characterSheet: activeCharacterSheet,
      locationSheet,
      isLongForm,
      isVideoMode,
    });

    const formattedBeats = progressedBeats.map((beat, idx) => {
      // Preserve geographic cartographic isolation if applicable
      const geo = extractGeographicAnchor(beat.textSpan);
      if (geo && getWordCount(beat.textSpan) <= 3) {
        return {
          ...beat,
          beatIndex: idx + 1,
          shotType: 'High-Angle Macro Shot',
          cameraAngle: 'high-angle',
          cameraMovement: isVideoMode ? 'Slow Push-In' : 'Static Crisp Frame',
          imagePrompt: generateCartographicPrompt(geo, isVideoMode, styleProfile),
        };
      }

      const withCharLocks = injectCompactCharacterLocks(
        beat.imagePrompt,
        beat.textSpan,
        scene.narratorLine,
        activeCharacterSheet
      );

      const formatted = formatFinalBeatPrompt(
        {
          ...beat,
          beatIndex: idx + 1,
          imagePrompt: withCharLocks,
        },
        isLongForm,
        isVideoMode,
        {
          styleProfile,
          characterSheet: activeCharacterSheet,
          locationSheet,
        }
      );

      return {
        ...formatted,
        beatIndex: idx + 1,
      };
    });

    const totalBeatSeconds = Math.round(
      formattedBeats.reduce((sum, b) => sum + (b.estimatedSeconds || 1.5), 0) * 10
    ) / 10;

    if (isVideoMode && targetVideoDuration && targetVideoDuration > 0) {
      const scaledBeats = scaleBeatsToTargetDuration(formattedBeats, targetVideoDuration);
      const spokenSeconds = Math.round((getWordCount(scene.narratorLine || '') / 2.2) * 10) / 10;
      const syncedVideoPrompt = scene.videoPrompt
        ? updateVideoPromptDuration(scene.videoPrompt, targetVideoDuration, spokenSeconds)
        : scene.videoPrompt;

      return {
        ...scene,
        estimatedSeconds: targetVideoDuration,
        videoPrompt: syncedVideoPrompt,
        beats: scaledBeats,
      };
    }

    return {
      ...scene,
      estimatedSeconds: totalBeatSeconds > 0 ? totalBeatSeconds : scene.estimatedSeconds,
      beats: formattedBeats,
    };
  });

  return populateSceneTransitionHints(finalizedScenes, styleProfile);
}

/**
 * Checks total spoken script coverage across all generated scenes against the full original script
 * so JSON output truncation around long Video Mode scripts never silently drops the second half.
 */
export function findUncoveredTrailingScript(
  originalScript: string,
  scenes: Array<{ index?: number; narratorLine?: string }>
): {
  totalWords: number;
  coveredWords: number;
  missingWords: number;
  coverageRatio: number;
  uncoveredText: string;
} {
  const cleanOriginal = normalizeUnicodeAndDashes(originalScript || '').trim();
  if (!cleanOriginal) {
    return { totalWords: 0, coveredWords: 0, missingWords: 0, coverageRatio: 1, uncoveredText: '' };
  }

  const origRawWords = cleanOriginal.split(/\s+/).filter(Boolean);
  const norm = (w: string) =>
    normalizeUnicodeAndDashes(w)
      .toLowerCase()
      .replace(/^[^a-z0-9\u00C0-\u024F₱$€£]+|[^a-z0-9\u00C0-\u024F]+$/g, '');

  const origNorm = origRawWords.map(norm);
  const joinedGenerated = (scenes || [])
    .map((s) => normalizeUnicodeAndDashes(s.narratorLine || ''))
    .join(' ')
    .trim();
  const genNorm = joinedGenerated.split(/\s+/).map(norm).filter(Boolean);

  let origPtr = 0;
  let genPtr = 0;
  while (origPtr < origNorm.length && genPtr < genNorm.length) {
    if (origNorm[origPtr] === genNorm[genPtr]) {
      origPtr++;
      genPtr++;
    } else {
      // Allow small 1-4 word drift if punctuation or contraction split a token
      let matchedAhead = false;
      for (let lookO = 1; lookO <= 4 && origPtr + lookO < origNorm.length; lookO++) {
        if (origNorm[origPtr + lookO] === genNorm[genPtr]) {
          origPtr += lookO + 1;
          genPtr++;
          matchedAhead = true;
          break;
        }
      }
      if (!matchedAhead) {
        genPtr++;
      }
    }
  }

  const totalWords = origRawWords.length;
  const coveredWords = Math.min(totalWords, origPtr);
  const missingWords = Math.max(0, totalWords - coveredWords);
  const coverageRatio = totalWords > 0 ? coveredWords / totalWords : 1;
  const uncoveredText = missingWords > 0 ? origRawWords.slice(coveredWords).join(' ').trim() : '';

  return { totalWords, coveredWords, missingWords, coverageRatio, uncoveredText };
}

/**
 * Sanitizes a master scene videoPrompt:
 * - Resolves shortcut "(matching established look...)" references
 * - Eliminates duplicate Lighting: sections, double periods (".."), and post-Duration style dumps
 * - Preserves full character locks in Subject: and places Duration: cleanly at the very end.
 */
export function sanitizeMasterVideoPrompt(
  rawVideoPrompt: string,
  params: {
    targetVideoDuration: number;
    calculatedSceneSeconds?: number;
    styleProfile: StyleProfile;
    characterSheet: Record<string, string>;
    narratorLine?: string;
    defaultAspectRatio?: string;
  }
): string {
  let vp = normalizeUnicodeAndDashes((rawVideoPrompt || '').trim());
  const {
    targetVideoDuration,
    calculatedSceneSeconds = targetVideoDuration,
    styleProfile,
    characterSheet,
    narratorLine = '',
  } = params;

  if (!vp) return '';

  // Scrub "(matching established look...)" shortcuts and Character/Location Continuity (...) wrappers
  for (const [charName, visualDesc] of Object.entries(characterSheet || {})) {
    const esc = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    vp = vp.replace(new RegExp(`\\(${esc}\\s*\\(matching established look[^)]*\\)\\)`, 'gi'), `${charName} (${visualDesc})`);
    vp = vp.replace(new RegExp(`\\b${esc}\\s*\\(matching established look[^)]*\\)`, 'gi'), `${charName} (${visualDesc})`);
  }
  vp = vp.replace(/\s*(?:Character|Location) Continuity \([^)]*\)\.?/gi, '');

  // Strip any existing Duration clause so we can enrich Style/Subject cleanly BEFORE appending Duration at the very end
  vp = vp.replace(/\s*Duration:\s*[^.\n]*(?:\.|$)/gi, ' ').trim();

  // Upgrade Style: clause if abbreviated, without dumping duplicate Lighting:/Setting: after Duration
  const compactArt =
    buildCompactCharacterAnchor(styleProfile.artStyle || '', STYLE_ANCHOR_MAX_WORDS) ||
    (styleProfile.artStyle || '').replace(/[.!?]+$/, '').trim();
  const compactPalette = (styleProfile.colorPalette || '').replace(/[.!?]+$/, '').trim();

  if (/\bStyle:\s*/i.test(vp)) {
    vp = vp.replace(/\bStyle:\s*([^.\n]+)\.?/i, (_m, existingStyle: string) => {
      const cleanExisting = existingStyle.replace(/[.!?]+$/, '').trim();
      const hasCoreMaterials =
        compactArt.length > 0 &&
        cleanExisting.toLowerCase().includes(compactArt.toLowerCase().slice(0, Math.min(24, compactArt.length)));
      if (hasCoreMaterials) {
        return `Style: ${cleanExisting}.`;
      }
      const mergedStyle = compactArt ? `${compactArt}, ${cleanExisting}` : cleanExisting;
      return `Style: ${mergedStyle}.`;
    });
  } else if (compactArt) {
    vp += ` Style: ${compactArt}${compactPalette ? `, ${compactPalette}` : ''}.`;
  }

  // Ensure active named characters in narratorLine/Subject retain locked eyewear & wardrobe inside Subject:
  for (const [charName, fullDesc] of Object.entries(characterSheet || {})) {
    if (!fullDesc) continue;
    const compactChar = buildCompactCharacterAnchor(fullDesc, CHARACTER_ANCHOR_MAX_WORDS);
    if (!compactChar) continue;
    const esc = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRe = new RegExp(`\\b${esc}\\b`, 'i');
    if (nameRe.test(vp) || nameRe.test(narratorLine)) {
      const hasEyewear =
        !/\b(?:glasses|spectacles|eyeglasses)\b/i.test(compactChar) ||
        /\b(?:glasses|spectacles|eyeglasses)\b/i.test(vp);
      const snippet = compactChar.slice(0, 24).toLowerCase();
      if (!vp.toLowerCase().includes(snippet) || !hasEyewear) {
        if (new RegExp(`Subject:\\s*${esc}(?:,|\\s)`, 'i').test(vp)) {
          vp = vp.replace(new RegExp(`(Subject:\\s*${esc})\\b`, 'i'), `$1 (${compactChar}),`);
        } else if (!nameRe.test(vp)) {
          vp = vp.replace(/\bSubject:\s*/i, `Subject: ${charName} (${compactChar}), `);
        }
      }
    }
  }

  // Deduplicate sentences & clean punctuation (".." -> ".")
  vp = vp
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/,([^\s0-9])/g, ', $1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (vp && !/[.!?]$/.test(vp)) vp += '.';

  vp += ` Duration: ${targetVideoDuration} seconds.`;
  return updateVideoPromptDuration(vp, targetVideoDuration, calculatedSceneSeconds);
}

/**
 * Enriches Start Frame Keyframe Prompts so every clip's initial image ingredient preserves
 * full character eyewear/wardrobe locks, consistent Kelvin lighting, art medium, and clean aspect ratio.
 */
export function enrichStartFramePrompt(
  rawStartFramePrompt: string,
  params: {
    styleProfile: StyleProfile;
    characterSheet: Record<string, string>;
    narratorLine?: string;
    defaultAspectRatio: string;
  }
): string {
  let sfp = normalizeUnicodeAndDashes((rawStartFramePrompt || '').trim());
  if (!sfp) return '';
  const { styleProfile, characterSheet, defaultAspectRatio } = params;

  // Strip any stray video audio cues
  sfp = sfp.replace(/\b(?:Audio|Sound|Foley|Soundtrack|Dialogue|Ambient sound)\s*:\s*[^.;\n]+[.;]?/gi, '');

  for (const [charName, fullDesc] of Object.entries(characterSheet || {})) {
    if (!fullDesc) continue;
    const esc = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sfp = sfp.replace(new RegExp(`\\(${esc}\\s*\\(matching established look[^)]*\\)\\)`, 'gi'), `${charName} (${fullDesc})`);
    sfp = sfp.replace(new RegExp(`\\b${esc}\\s*\\(matching established look[^)]*\\)`, 'gi'), `${charName} (${fullDesc})`);

    const compactChar = buildCompactCharacterAnchor(fullDesc, CHARACTER_ANCHOR_MAX_WORDS);
    const mentionRe = new RegExp(`\\b(${esc})\\b(?!'s|\\s*\\()`, 'i');
    if (compactChar && mentionRe.test(sfp)) {
      const hasOutfitOrGlasses =
        (/\b(?:glasses|spectacles)\b/i.test(compactChar) ? /\b(?:glasses|spectacles)\b/i.test(sfp) : true) &&
        sfp.toLowerCase().includes(compactChar.slice(0, 22).toLowerCase());
      if (!hasOutfitOrGlasses) {
        sfp = sfp.replace(mentionRe, `$1 (${compactChar})`);
      }
    }
  }

  // Upgrade weak lighting/style in Start Frame if truncated to just "warm lighting, handcrafted miniature world"
  const compactStyle =
    buildCompactCharacterAnchor(styleProfile.artStyle || '', STYLE_ANCHOR_MAX_WORDS) ||
    (styleProfile.artStyle || '').replace(/[.!?]+$/, '').trim();
  if (compactStyle && !sfp.toLowerCase().includes(compactStyle.slice(0, 20).toLowerCase())) {
    sfp = `${sfp.replace(/[.,\s]+$/, '')}, ${compactStyle}.`;
  }
  if (
    styleProfile.lighting &&
    !/\b\d{4}K\b/i.test(sfp) &&
    !/\b(?:chiaroscuro|monochrome)\b/i.test(sfp)
  ) {
    const cleanLight = styleProfile.lighting.replace(/[.!?]+$/, '').trim();
    sfp = `${sfp.replace(/[.,\s]+$/, '')}, ${cleanLight}.`;
  }
  if (!/\b(?:9:16|16:9)\b/.test(sfp)) {
    sfp = `${sfp.replace(/[.,\s]+$/, '')}, ${defaultAspectRatio}.`;
  }

  return sfp
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Display normalizer for ResultsView.tsx:
 * Preserves multi-beat progression produced by the pipeline without re-splitting merged beats
 * into identical clones or stamping contradictory shot metadata, while still deduplicating
 * any accidental adjacent identical prompts, resolving geographic cartographic anchors,
 * synchronizing metadata, and populating scene transition hints.
 */
export function normalizeStoryboardForDisplay(
  scenes: Scene[],
  options: {
    isVideoMode: boolean;
    isLongForm: boolean;
    targetVideoDuration?: number;
    styleProfile?: StyleProfile;
    characterSheet?: Record<string, string>;
    locationSheet?: Record<string, string>;
  }
): Scene[] {
  if (!Array.isArray(scenes)) return [];

  const styleProfile: StyleProfile = options.styleProfile || {
    artStyle: 'Cinematic rendering',
    colorPalette: 'Harmonious dramatic palette',
    lighting: 'Directional key light with soft rim fill',
    eraAndSetting: 'Story setting',
  };

  const normalized = scenes.map((scene) => {
    const cleanNarration = normalizeUnicodeAndDashes(scene.narratorLine || '');
    const rawBeats = (scene.beats || []).map((b) => ({
      ...b,
      textSpan: normalizeUnicodeAndDashes(b.textSpan || ''),
      imagePrompt: sanitizeFakePrecisionMath(b.imagePrompt || ''),
      shotType: normalizeUnicodeAndDashes(b.shotType || ''),
      cameraAngle: normalizeUnicodeAndDashes(b.cameraAngle || ''),
      cameraMovement: normalizeUnicodeAndDashes(b.cameraMovement || ''),
      transitionHint: undefined,
    }));

    const deduped = deduplicateAndProgressSceneBeats(rawBeats, {
      scene: { ...scene, narratorLine: cleanNarration },
      styleProfile,
      characterSheet: options.characterSheet || {},
      locationSheet: options.locationSheet || {},
      isLongForm: options.isLongForm,
      isVideoMode: options.isVideoMode,
    });

    const formatted = deduped.map((b, idx) => {
      const geo = extractGeographicAnchor(b.textSpan);
      if (geo && getWordCount(b.textSpan) <= 3 && !b.userRewritten) {
        return {
          ...b,
          beatIndex: idx + 1,
          shotType: 'High-Angle Macro Shot',
          cameraAngle: 'high-angle',
          cameraMovement: options.isVideoMode ? 'Slow Push-In' : 'Static Crisp Frame',
          imagePrompt: generateCartographicPrompt(geo, options.isVideoMode, styleProfile),
        };
      }

      const formattedBeat = formatFinalBeatPrompt(
        {
          ...b,
          beatIndex: idx + 1,
        },
        options.isLongForm,
        options.isVideoMode,
        {
          styleProfile,
          characterSheet: options.characterSheet,
          locationSheet: options.locationSheet,
        }
      );

      return {
        ...formattedBeat,
        beatIndex: idx + 1,
      };
    });

    const sumSec = Math.round(
      formatted.reduce((acc, b) => acc + (b.estimatedSeconds || 1.5), 0) * 10
    ) / 10;

    if (options.isVideoMode) {
      const clipSeconds = options.targetVideoDuration || scene.estimatedSeconds || 5;
      return {
        ...scene,
        narratorLine: cleanNarration,
        estimatedSeconds: clipSeconds,
        beats: scaleBeatsToTargetDuration(formatted, clipSeconds),
      };
    }

    return {
      ...scene,
      narratorLine: cleanNarration,
      estimatedSeconds: sumSec > 0 ? sumSec : scene.estimatedSeconds,
      beats: formatted,
    };
  });

  return populateSceneTransitionHints(normalized, styleProfile);
}
