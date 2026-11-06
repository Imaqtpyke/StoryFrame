import { AiProvider, Beat, Scene, StyleProfile } from '../types';
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

// Option A: Visual-Event Pacing ceilings (~1.5s - 3.0s per visual event)
export const VISUAL_EVENT_MAX_SECONDS = 3.1;
export const VISUAL_EVENT_MAX_WORDS = 15;
export const FILLER_FRAGMENT_MAX_WORDS = 4;
export const FILLER_FRAGMENT_MAX_SECONDS = 1.25;

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
];

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
 * ignoring framing boilerplate and style suffix so true content clones are caught reliably.
 */
export function computeVisualPromptSimilarity(a: string, b: string): number {
  const tokenize = (raw: string): string[] => {
    let clean = raw || '';
    for (const pat of BOILERPLATE_STRIP_PATTERNS) {
      clean = clean.replace(pat, ' ');
    }
    return clean
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
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
 * Option A: Builds a compact, high-signal 14-18 word visual identity + outfit/gear anchor
 * from a potentially long characterSheet entry so every character beat stays visually consistent
 * in stateless diffusion models without bloating prompt token budgets.
 */
export function buildCompactCharacterAnchor(fullDesc: string, maxWords: number = 18): string {
  if (!fullDesc || typeof fullDesc !== 'string') return '';
  let clean = normalizeUnicodeAndDashes(fullDesc)
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

  // Split by sentences/clauses and pick high-value visual identity tokens
  const clauses = clean
    .split(/[.;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const selectedWords: string[] = [];
  for (const clause of clauses) {
    const words = clause.split(/\s+/).filter(Boolean);
    if (selectedWords.length + words.length <= maxWords) {
      selectedWords.push(...words);
    } else {
      const remaining = maxWords - selectedWords.length;
      if (remaining >= 4) {
        selectedWords.push(...words.slice(0, remaining));
      }
      break;
    }
  }

  let summary = selectedWords.join(' ').replace(/[,:;]+$/, '').trim();
  if (!summary) {
    summary = clean.split(/\s+/).slice(0, maxWords).join(' ').replace(/[,:;]+$/, '').trim();
  }
  return summary;
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

  let updated = prompt;
  const charEntries = Object.entries(characterSheet);
  const singleLeadChar = charEntries.length === 1 ? charEntries[0] : null;
  const combinedBeatAndNarration = `${textSpan} ${sceneNarration}`;

  for (const [charName, fullDesc] of charEntries) {
    if (!fullDesc || fullDesc.trim().length < 6) continue;
    const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\b${escapedName}(?:'s)?\\b`, 'i');

    const promptMentionsName = nameRegex.test(updated);
    const beatMentionsName = nameRegex.test(textSpan);
    const pronounOrRoleMatch = /\b(?:he|him|his|she|her|hers|soldier|warrior|knight|hero|man|woman|boy|girl|forearm|chest plate|trigger|rifle|boots)\b/i.test(
      `${textSpan} ${updated}`
    );
    const sceneMentionsChar =
      nameRegex.test(combinedBeatAndNarration) ||
      (singleLeadChar && singleLeadChar[0] === charName && pronounOrRoleMatch);

    if (!promptMentionsName && !beatMentionsName && !sceneMentionsChar) {
      continue;
    }

    const compactAnchor = buildCompactCharacterAnchor(fullDesc, 18);
    if (!compactAnchor) continue;

    // Check if significant locked traits are already embedded in the prompt
    const anchorTokens = compactAnchor
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    const lowerUpdated = updated.toLowerCase();
    let matchedTokens = 0;
    for (const t of anchorTokens) {
      if (lowerUpdated.includes(t)) matchedTokens++;
    }
    const coverageRatio = anchorTokens.length > 0 ? matchedTokens / anchorTokens.length : 1;

    // If prompt already mentions character and has >= 55% of compact lock tokens, skip
    if (promptMentionsName && coverageRatio >= 0.55) {
      continue;
    }

    if (promptMentionsName) {
      // Attach compact visual anchor right after the first mention of the character name (avoid possessive breaking)
      const nonPossessiveRegex = new RegExp(`\\b(${escapedName})\\b(?!'s|\\s*\\()`, 'i');
      if (nonPossessiveRegex.test(updated)) {
        updated = updated.replace(nonPossessiveRegex, `$1 (${compactAnchor})`);
      } else {
        // Insert before Visual Style or --ar
        updated = insertClauseBeforeStyleOrAr(updated, `${charName} (${compactAnchor})`);
      }
    } else if (beatMentionsName || sceneMentionsChar) {
      // Character is active in the beat via pronoun or narration: inject compact identity anchor cleanly
      updated = insertClauseBeforeStyleOrAr(updated, `Featuring ${charName} (${compactAnchor})`);
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
      /^(?:Cinematic 16:9 widescreen composition|Vertical 9:16 portrait composition|9:16 vertical composition|16:9 widescreen composition)(?:\s*[,.:;-]\s*|\s+)/gi,
      ''
    );
  }
  return cleaned.trim();
}

/**
 * Extracts explicit shot type and camera angle written in the opening of prompt prose
 * and synchronizes table metadata (`shotType`, `cameraAngle`, `cameraMovement`) with prose
 * so metadata and visual prompt NEVER contradict each other.
 */
export function synchronizeBeatMetadataWithPrompt(beat: Beat): Beat {
  const withoutOrientation = stripLeadingOrientationPrefixes(beat.imagePrompt || '');
  const openingWindow = withoutOrientation.slice(0, 90).toLowerCase();

  let syncedShotType = (beat.shotType || '').trim();
  let syncedAngle = (beat.cameraAngle || '').trim();
  let syncedMovement = (beat.cameraMovement || '').trim();

  // Detect shot size explicitly present in prompt opening
  if (/\b(?:extreme[-\s]*close[-\s]*up|macro\s+(?:insert|detail|shot|view))\b/i.test(openingWindow)) {
    syncedShotType = 'Extreme Close-Up';
  } else if (/\bclose[-\s]*up\b/i.test(openingWindow)) {
    syncedShotType = 'Close-Up';
  } else if (/\b(?:extreme[-\s]*wide|establishing\s+(?:wide|vista))\b/i.test(openingWindow)) {
    syncedShotType = 'Extreme Wide Shot';
  } else if (/\bwide\b/i.test(openingWindow)) {
    syncedShotType = 'Wide Establishing Shot';
  } else if (/\b(?:over[-\s]*the[-\s]*shoulder|ots)\b/i.test(openingWindow)) {
    syncedShotType = 'Over-the-Shoulder (OTS)';
  } else if (/\b(?:point[-\s]*of[-\s]*view|first[-\s]*person|pov)\b/i.test(openingWindow)) {
    syncedShotType = 'Point-of-View (POV)';
  } else if (/\bmedium\s+close[-\s]*up\b/i.test(openingWindow)) {
    syncedShotType = 'Medium Close-Up';
  } else if (/\bmedium\b/i.test(openingWindow)) {
    syncedShotType = 'Medium Shot';
  }

  // Detect camera angle explicitly present in prompt opening
  if (/\b(?:birds?[-\s]*eye|overhead|top[-\s]*down)\b/i.test(openingWindow)) {
    syncedAngle = 'birds-eye';
  } else if (/\b(?:worms?[-\s]*eye|ground[-\s]*level)\b/i.test(openingWindow)) {
    syncedAngle = 'worms-eye';
  } else if (/\b(?:low[-\s]*angle|slightly\s+low\s+angle|looking\s+up)\b/i.test(openingWindow)) {
    syncedAngle = 'low-angle';
  } else if (/\b(?:high[-\s]*angle|slightly\s+elevated\s+angle|elevated\s+angle|looking\s+down)\b/i.test(openingWindow)) {
    syncedAngle = 'high-angle';
  } else if (/\b(?:dutch[-\s]*angle|dutch[-\s]*tilt|canted)\b/i.test(openingWindow)) {
    syncedAngle = 'dutch-tilt';
  } else if (/\b(?:eye[-\s]*level|straight[-\s]*on)\b/i.test(openingWindow)) {
    syncedAngle = 'eye-level';
  }

  // Fallbacks if missing
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
  if (!syncedAngle) {
    syncedAngle = 'eye-level';
  }
  if (!syncedMovement) {
    syncedMovement = 'Slow Push-In';
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
 * when none is present in the prose, cleaned punctuation, and exact --ar parameter flag.
 */
export function formatFinalBeatPrompt(
  beat: Beat,
  isLongForm: boolean,
  isVideoMode: boolean
): Beat {
  const synced = synchronizeBeatMetadataWithPrompt(beat);
  let body = stripLeadingOrientationPrefixes(synced.imagePrompt || '');

  // Strip stray ar flags anywhere in body
  body = body
    .replace(/\s*--ar\s+[0-9:]+/gi, '')
    .replace(/,\s*ar\s+[0-9:]+[.,]?/gi, '')
    .replace(/\bar\s+[0-9:]+[.,]?/gi, '')
    .trim();

  // Check if prose already opens with shot framing; if not in Image mode, prepend synchronized shotType & cameraAngle
  const hasOpeningFraming =
    /^(?:Extreme\s+Wide|Wide\s+Establishing|Wide|Medium\s+Close-Up|Medium|Extreme\s+Close-Up|Close-Up|Macro|Over-the-Shoulder|Point-of-View|First-person|Low-angle|High-angle|Birds-eye|Worms-eye|Dutch)/i.test(
      body
    );

  if (!isVideoMode && !hasOpeningFraming && body.length > 0) {
    const lowerFirst = body.charAt(0).toLowerCase() + body.slice(1);
    const startsWithOf = /^(?:of|showing|depicting|capturing)\b/i.test(lowerFirst);
    const connector = startsWithOf ? ' ' : ' of ';
    const angleLabel = synced.cameraAngle ? `, ${synced.cameraAngle}` : '';
    body = `${synced.shotType}${angleLabel}${connector}${lowerFirst}`;
  }

  // Ensure uppercase first letter of body and clean trailing period
  body = body.replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
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

    // If only 1-3 trailing words were dropped and last beat has room under Option A pacing, append cleanly
    if (lastBeat && missingWordCount <= 3 && getWordCount(lastBeat.textSpan) + missingWordCount <= VISUAL_EVENT_MAX_WORDS) {
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

    // Partition longer missing narration into visual-event chunks (~6-11 words per beat under Option A)
    const missingChunks = splitPhraseIntoSubBeats(missingText, 11);
    const mergedMissingChunks: string[] = [];
    for (const chunk of missingChunks) {
      if (
        mergedMissingChunks.length > 0 &&
        (getWordCount(chunk) <= 4 || getWordCount(mergedMissingChunks[mergedMissingChunks.length - 1]) + getWordCount(chunk) <= 11) &&
        !extractGeographicAnchor(chunk) &&
        !extractTemporalAnchor(chunk)
      ) {
        mergedMissingChunks[mergedMissingChunks.length - 1] = `${mergedMissingChunks[mergedMissingChunks.length - 1]} ${chunk}`.trim();
      } else {
        mergedMissingChunks.push(chunk);
      }
    }

    const leadCharEntry = Object.entries(characterSheet)[0];
    const leadCharClause = leadCharEntry
      ? `${leadCharEntry[0]} (${buildCompactCharacterAnchor(leadCharEntry[1], 18)})`
      : 'the solitary protagonist in period-accurate battle gear';
    const locEntry = Object.entries(locationSheet)[0];
    const activeLocDesc = locEntry
      ? `${locEntry[0]} (${buildCompactCharacterAnchor(locEntry[1], 16)})`
      : styleProfile.eraAndSetting || 'weathered stone ramparts under turbulent twilight skies';

    const shotProgression = [
      { shotType: 'Close-Up', angle: 'low-angle', move: 'Slow Push-In', lens: '85mm f/1.8 prime lens' },
      { shotType: 'Over-the-Shoulder (OTS)', angle: 'eye-level', move: 'Tracking Subject', lens: '50mm f/2.0 lens' },
      { shotType: 'Wide Establishing Shot', angle: 'high-angle', move: 'Smooth Pan', lens: '35mm f/4 wide lens' },
    ];

    mergedMissingChunks.forEach((span, idx) => {
      const framing = shotProgression[(currentBeats.length + idx) % shotProgression.length];
      const wordCnt = getWordCount(span);
      const sec = Math.max(1.5, Math.min(VISUAL_EVENT_MAX_SECONDS, Math.round((wordCnt / 2.2) * 10) / 10));
      const cleanActionFocus = span.replace(/["'.,;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

      const rawContinuationPrompt =
        idx % 2 === 0
          ? `${framing.shotType}, ${framing.angle} focusing on ${leadCharClause} confronting the escalating stakes of ${cleanActionFocus}, set within ${activeLocDesc}, dramatic ${styleProfile.lighting}, ${styleProfile.colorPalette} palette, ${framing.lens}, Visual Style: ${styleProfile.artStyle}.`
          : `${framing.shotType}, ${framing.angle} capturing the physical aftermath and environmental tension of ${cleanActionFocus} across ${activeLocDesc}, ${leadCharClause} positioned in taut readiness, ${styleProfile.lighting}, ${framing.lens}, Visual Style: ${styleProfile.artStyle}.`;

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
          options.isVideoMode
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
 * Checks whether a short spoken span is a connective filler fragment (e.g. "But he has one problem:",
 * "target for kings", "him live.") rather than a standalone visual event or cartographic/temporal anchor.
 */
function isShortConnectiveFragment(beat: Beat): boolean {
  const words = getWordCount(beat.textSpan);
  const secs = beat.estimatedSeconds || 1.5;
  if (words > FILLER_FRAGMENT_MAX_WORDS && secs > FILLER_FRAGMENT_MAX_SECONDS) {
    return false;
  }
  if (extractTemporalAnchor(beat.textSpan) || extractGeographicAnchor(beat.textSpan)) {
    return false;
  }
  return words <= FILLER_FRAGMENT_MAX_WORDS || secs < FILLER_FRAGMENT_MAX_SECONDS;
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
  const charPhrase = leadChar
    ? `${leadChar[0]} (${buildCompactCharacterAnchor(leadChar[1], 18)})`
    : 'the armored soldier';
  const locEntries = Object.entries(locationSheet);
  const locPhrase = locEntries[0]
    ? `${locEntries[0]}`
    : styleProfile.eraAndSetting || 'the battleground';

  const lowerSpan = (beat.textSpan || '').toLowerCase();
  const focusClause = (beat.textSpan || scene.narratorLine)
    .replace(/["'.,;:!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Select contrasting shot & subject angle based on semantic cues in textSpan & duplicate index
  const variant = duplicateIdxInScene % 4;
  let shotType = 'Close-Up';
  let cameraAngle = 'low-angle';
  let cameraMovement = 'Slow Push-In';
  let actionDescription = '';

  if (/\b(?:target|kings|crown|royal|own him|enemy|army|knights)\b/i.test(lowerSpan)) {
    shotType = 'Over-the-Shoulder (OTS)';
    cameraAngle = 'high-angle';
    cameraMovement = 'Tracking Subject';
    actionDescription = `over-the-shoulder perspective looking past ${charPhrase} toward rival royal banners and advancing armed ranks near ${locPhrase}, warlords watching intently from a raised stone vantage as tension tightens around ${focusClause}`;
  } else if (/\b(?:let him live|defeat|future|history|survive|last|takes everything|problem)\b/i.test(lowerSpan)) {
    shotType = 'Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Slow Push-In';
    actionDescription = `tight character study on ${charPhrase}, dust smudged across weathered armor and brow creased in grim calculation as ${focusClause} weighs on his stance, shallow focus with ${locPhrase} blurred behind`;
  } else if (/\b(?:endless wars|swords|castles|battle|fire|ammo|bullet|weapon)\b/i.test(lowerSpan)) {
    shotType = 'Low-Angle Hero Shot';
    cameraAngle = 'low-angle';
    cameraMovement = 'Slow Tilt Up';
    actionDescription = `low-angle composition framing ${charPhrase} planted in a wide battle stance amid raised steel blades and smoke drift across ${locPhrase}, capturing the scale and peril of ${focusClause}`;
  } else if (variant === 0) {
    shotType = 'Close-Up';
    cameraAngle = 'eye-level';
    cameraMovement = 'Slow Push-In';
    actionDescription = `tight reaction framing on ${charPhrase} inside ${locPhrase}, taut posture and focused gaze reacting directly to the turning point of ${focusClause}`;
  } else if (variant === 1) {
    shotType = 'Low-Angle Hero Shot';
    cameraAngle = 'low-angle';
    cameraMovement = 'Tracking Subject';
    actionDescription = `low-angle perspective following ${charPhrase} through ${locPhrase}, dramatic sky and looming stone architecture emphasizing the consequence of ${focusClause}`;
  } else if (variant === 2) {
    shotType = 'Over-the-Shoulder (OTS)';
    cameraAngle = 'high-angle';
    cameraMovement = 'Smooth Pan';
    actionDescription = `elevated over-the-shoulder vantage across ${locPhrase}, revealing surrounding terrain, tactical obstacles, and approaching figures tied to ${focusClause} while keeping ${charPhrase} in foreground`;
  } else {
    shotType = 'Medium Close-Up';
    cameraAngle = 'dutch-tilt';
    cameraMovement = 'Handheld Cinematic Drift';
    actionDescription = `canted medium close-up capturing ${charPhrase} bracing in rugged terrain near ${locPhrase}, dust motes catching dramatic key light during ${focusClause}`;
  }

  const optics =
    shotType.includes('Close-Up')
      ? 'Shot on 85mm f/1.8 portrait prime lens with shallow depth of field'
      : 'Shot on 35mm f/4 cinema lens with atmospheric depth';

  const fullBody = `${actionDescription}, ${styleProfile.lighting}, ${styleProfile.colorPalette} palette, ${optics}, Visual Style: ${styleProfile.artStyle}.`;

  return formatFinalBeatPrompt(
    {
      ...beat,
      shotType,
      cameraAngle,
      cameraMovement,
      imagePrompt: fullBody,
    },
    isLongForm,
    isVideoMode
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
    const sim = computeVisualPromptSimilarity(prev.imagePrompt, curr.imagePrompt);
    const combinedSeconds = Math.round(((prev.estimatedSeconds || 1.5) + (curr.estimatedSeconds || 1.5)) * 10) / 10;
    const combinedWords = getWordCount(`${prev.textSpan} ${curr.textSpan}`);

    const currIsTinyConnector = isShortConnectiveFragment(curr);
    const prevIsTinyConnector = isShortConnectiveFragment(prev);

    const shouldMergeAdjacent =
      combinedSeconds <= maxMergeSeconds &&
      combinedWords <= VISUAL_EVENT_MAX_WORDS &&
      (sim >= 0.46 || currIsTinyConnector || prevIsTinyConnector);

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
      const sim = computeVisualPromptSimilarity(finalized[j].imagePrompt, beat.imagePrompt);
      if (sim >= 0.48) {
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

  return finalized.map((b, idx) => ({
    ...b,
    beatIndex: idx + 1,
  }));
}

/**
 * Inspects all scenes to find any structural defects requiring Phase-2 LLM Beat Progression Repair:
 * - Intra-scene duplicate or near-duplicate beats (including non-adjacent A-B-A-B clones)
 * - Oversized multi-clause beats (> 15 words or > 3.2s in image mode) that need multi-beat progression
 * - Era/location bleed across chronological shifts
 */
export function auditScenesForRepair(
  scenes: Scene[],
  styleProfile: StyleProfile,
  isVideoMode: boolean
): Array<{ sceneIndex: number; reasons: string[] }> {
  const flagged: Array<{ sceneIndex: number; reasons: string[] }> = [];
  let enteredHistoricalPast = false;

  scenes.forEach((scene) => {
    const reasons: string[] = [];
    const beats = scene.beats || [];
    const sceneText = `${scene.narratorLine} ${beats.map((b) => b.textSpan).join(' ')}`;

    if (/\b(?:sent\s+\d+\s+years\s+into\s+the\s+past|back\s+in\s+time|medieval|knight|castle|centuries\s+in\s+the\s+past)\b/i.test(sceneText)) {
      enteredHistoricalPast = true;
    }

    // 1. Check all pairs (i, j) within scene for clones
    for (let i = 0; i < beats.length; i++) {
      for (let j = i + 1; j < beats.length; j++) {
        const sim = computeVisualPromptSimilarity(beats[i].imagePrompt, beats[j].imagePrompt);
        if (sim >= 0.50) {
          reasons.push(`Beats ${i + 1} and ${j + 1} have near-identical visual prompts (${Math.round(sim * 100)}% overlap)`);
        }
      }

      // 2. Check oversized beat needing multi-beat progression
      const wc = getWordCount(beats[i].textSpan);
      const sec = beats[i].estimatedSeconds || 2;
      if (!isVideoMode && (wc > VISUAL_EVENT_MAX_WORDS || sec > VISUAL_EVENT_MAX_SECONDS)) {
        reasons.push(`Beat ${i + 1} ("${beats[i].textSpan}") spans ${wc} words / ${sec}s and needs progression into 2-3 distinct visual beats`);
      }

      // 3. Check era bleed
      if (
        enteredHistoricalPast &&
        /\b(?:blurred armory|metallic armory racks|neon[- ]lit city|glass skyscrapers|holographic billboards)\b/i.test(beats[i].imagePrompt)
      ) {
        reasons.push(`Beat ${i + 1} leaks modern/futuristic scenery into historical past setting`);
      }
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

export interface TwoPhaseProgressionParams {
  scenes: Scene[];
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
  isLongForm: boolean;
  isVideoMode: boolean;
  apiKey?: string;
  aiProvider?: AiProvider;
  modelQuality?: 'standard' | 'high';
  groqModel?: string;
  userSignal?: AbortSignal;
  onStatusMessage?: (msg: string) => void;
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

  // Step 3: Verify & repair 100% spoken narration word coverage in every scene
  workingScenes = verifyAndRepairSceneNarrationCoverage(
    workingScenes,
    styleProfile,
    characterSheet,
    locationSheet,
    { isLongForm, isVideoMode }
  );

  // Step 4: Audit scenes for clones, oversized run-on beats, or era bleed
  const flaggedScenes = auditScenesForRepair(workingScenes, styleProfile, isVideoMode);

  const hasLiveApiKey =
    typeof apiKey === 'string' &&
    apiKey.trim().length > 10 &&
    !/^(?:mock|test|dummy|fake)/i.test(apiKey.trim()) &&
    !userSignal?.aborted;

  if (flaggedScenes.length > 0 && hasLiveApiKey && apiKey) {
    try {
      if (onStatusMessage) {
        onStatusMessage('Refining beat-to-beat visual progression and continuity...');
      }

      const compactCastSummary = Object.entries(characterSheet)
        .map(([name, desc]) => `- ${name}: ${buildCompactCharacterAnchor(desc, 22)}`)
        .join('\n');
      const compactLocSummary = Object.entries(locationSheet)
        .map(([name, desc]) => `- ${name}: ${buildCompactCharacterAnchor(desc, 22)}`)
        .join('\n');

      const orientationText = isLongForm
        ? 'Cinematic 16:9 widescreen composition'
        : 'Vertical 9:16 portrait composition';
      const arFlag = isLongForm ? '--ar 16:9' : '--ar 9:16';

      const repairSystemPrompt = `You are a senior film director and storyboard continuity supervisor performing a targeted second-pass beat progression repair.
You will receive specific scenes from a storyboard whose beats had visual repetition, missing narration coverage, oversized beats, or setting bleed.

GLOBAL PRODUCTION LOCKS:
- Art Style: ${styleProfile.artStyle}
- Color Palette: ${styleProfile.colorPalette}
- Lighting: ${styleProfile.lighting}
- Era & Setting: ${styleProfile.eraAndSetting}
${compactCastSummary ? `\nLOCKED CHARACTERS (Compact Identity Anchors - MUST include in every beat where character appears):\n${compactCastSummary}` : ''}
${compactLocSummary ? `\nLOCKED LOCATIONS:\n${compactLocSummary}` : ''}

STRICT REPAIR RULES:
1. 100% NARRATION WORD COVERAGE: Every word in the scene's "narratorLine" MUST appear in exact sequential order across its "beats[].textSpan". Never drop or truncate trailing clauses.
2. VISUAL-EVENT PACING (~1.5s to 3.0s per beat, max ~14 words per beat):
   - Cut to a new beat ONLY when a genuine physical action, object state transition, camera vantage shift, or reveal occurs.
   - NEVER isolate short non-visual filler fragments (like "But he has one problem:", "target for kings", "him live.") into standalone beats! Merge short connective fragments with the action clause they belong to.
   - If a sentence is long (16+ words with multiple distinct actions/events), divide it into 2 to 4 progressive visual-event beats, each showing a completely different visual action, camera distance, or perspective.
3. ZERO DUPLICATE OR CLONE PROMPTS: Every beat within a scene MUST depict a distinct physical moment, object state, or camera angle. Never repeat the same scene description across beats.
4. SYNCHRONIZED SHOT METADATA & OPENING:
   - Each beat MUST specify "shotType", "cameraAngle", and "cameraMovement".
   - Begin "imagePrompt" with: "${orientationText}, <shotType>, <cameraAngle>, <Art Style> - <Subject with compact locked identity> <concrete action/state>, <setting>, <lighting & lens> ${arFlag}"
   - Ensure shotType and cameraAngle in metadata match the opening of imagePrompt 1-for-1.
5. NATURAL BIOMECHANICS & CHRONOLOGY:
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
                    : Math.max(1.5, Math.min(3.0, Math.round((getWordCount(b.textSpan) / 2.2) * 10) / 10)),
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
          characterSheet,
          locationSheet,
          { isLongForm, isVideoMode }
        );
      }
    } catch {
      // Non-fatal: fall through seamlessly to deterministic progression repair below
    }
  }

  // Step 5: Deterministic progression deduplication + compact character locks + synchronized framing opening
  const finalizedScenes = workingScenes.map((scene) => {
    const progressedBeats = deduplicateAndProgressSceneBeats(scene.beats || [], {
      scene,
      styleProfile,
      characterSheet,
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
        characterSheet
      );

      const formatted = formatFinalBeatPrompt(
        {
          ...beat,
          beatIndex: idx + 1,
          imagePrompt: withCharLocks,
        },
        isLongForm,
        isVideoMode
      );

      return {
        ...formatted,
        beatIndex: idx + 1,
      };
    });

    const totalBeatSeconds = Math.round(
      formattedBeats.reduce((sum, b) => sum + (b.estimatedSeconds || 1.5), 0) * 10
    ) / 10;

    return {
      ...scene,
      estimatedSeconds: totalBeatSeconds > 0 ? totalBeatSeconds : scene.estimatedSeconds,
      beats: formattedBeats,
    };
  });

  return populateSceneTransitionHints(finalizedScenes, styleProfile);
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
      transitionHint: b.transitionHint ? normalizeUnicodeAndDashes(b.transitionHint) : undefined,
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
      if (geo && getWordCount(b.textSpan) <= 3) {
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
        options.isVideoMode
      );

      return {
        ...formattedBeat,
        beatIndex: idx + 1,
      };
    });

    const sumSec = Math.round(
      formatted.reduce((acc, b) => acc + (b.estimatedSeconds || 1.5), 0) * 10
    ) / 10;

    return {
      ...scene,
      narratorLine: cleanNarration,
      estimatedSeconds: options.isVideoMode
        ? (options.targetVideoDuration || scene.estimatedSeconds || 5)
        : (sumSec > 0 ? sumSec : scene.estimatedSeconds),
      beats: formatted,
    };
  });

  return populateSceneTransitionHints(normalized, styleProfile);
}
