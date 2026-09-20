import { Beat, Scene, StyleProfile } from '../types';

export const MAX_BEAT_SECONDS = 2.0;
export const MAX_BEAT_WORDS = 8;

/**
 * Detects whether a beat's text span or spoken phrase contains a date, year, century, decade, or elapsed time anchor.
 * Examples: "in 1945", "1945", "for 29 years", "in 1974", "October 14, 1962", "in the 1920s", "300 BC".
 */
export function extractTemporalAnchor(text: string): string | null {
  if (!text || !text.trim()) return null;
  const clean = text.trim();

  // Pattern 1: Exact 4-digit years or year ranges with optional 'in/by/around' (e.g. "in 1945", "1945", "1939-1945", "1800s", "the 1920s")
  const yearMatch = clean.match(/\b(?:in|by|around|during|circa|c\.)?\s*([12]\d{3}s?|[5-9]\d{2}(?:\s*(?:BC|AD|BCE|CE))?)\b/i);
  if (yearMatch && yearMatch[1]) {
    const yr = yearMatch[1].trim();
    // Verify it's a plausible year number (not just a generic 4-digit number like 1000 meters)
    const num = parseInt(yr.replace(/\D/g, ''), 10);
    if ((num >= 1000 && num <= 2100) || /BC|BCE|AD|CE/i.test(yr)) {
      return yr;
    }
  }

  // Pattern 2: Specific calendar dates (e.g. "December 24, 1971", "July 4th", "August 1945", "June 6, 1944")
  const dateMatch = clean.match(/\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*[12]\d{3})?)\b/i);
  if (dateMatch && dateMatch[1]) {
    return dateMatch[1].trim();
  }

  // Pattern 3: Elapsed duration phrases (e.g. "for 29 years", "after 30 years", "over 10 decades", "over 50 years", "for nearly three decades")
  const durationMatch = clean.match(/\b((?:for|after|nearly|over|past|across)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)\s+(?:years|decades|centuries|months))\b/i);
  if (durationMatch && durationMatch[1]) {
    return durationMatch[1].trim();
  }

  // Pattern 4: Standalone year token like "1945" or "1974"
  const standaloneYear = clean.match(/\b([12]\d{3})\b/);
  if (standaloneYear && standaloneYear[1]) {
    const num = parseInt(standaloneYear[1], 10);
    if (num >= 1200 && num <= 2100) {
      return standaloneYear[1];
    }
  }

  return null;
}

/**
 * Strips any shot framing words, camera angles, perspective descriptions,
 * "focusing on" meta-framing, and bracketed labels from an imagePrompt.
 * Runs in an iterative loop until no stacked prefixes or framing remain.
 * The prompt must start directly with the scene description (subject, action, setting).
 */
export function sanitizeImagePromptShotFraming(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = prompt.trim();

  let prev = '';
  // Loop until string stabilizes (handles stacked/nested framing prefixes)
  let iterations = 0;
  while (cleaned !== prev && iterations < 10) {
    prev = cleaned;
    iterations++;

    // 1. Strip any leading bracketed tokens like [Shot, Angle, Movement] or [Extreme Close-Up, Eye-Level]
    cleaned = cleaned.replace(/^\[.*?\]\s*/, '');

    // 2. Remove meta-framing sentences like:
    // "Extreme close-up detail shot focusing tightly on '...':"
    // "Focusing tightly on '...':"
    // "Focusing on the specific detail of '...':"
    // "Shot focusing on the words '...':"
    cleaned = cleaned.replace(/^(?:[a-z0-9\s-]+\s+)?(?:shot\s+)?focusing\s+(?:tightly\s+|directly\s+|closely\s+)?on\s*(?:the\s+words?\s*|phrase\s*|the\s+specific\s+detail\s+of\s*)?['"][^'"]*['"](?:\s*from\s+a\s+[^,.:]+)?\s*[:,-]?\s*/i, '');
    cleaned = cleaned.replace(/^focusing\s+(?:tightly\s+|directly\s+|closely\s+)?on\s*[^:,.-]+[:,-]\s*/i, '');
    cleaned = cleaned.replace(/^visual\s+moment\s+(?:specifically\s+)?(?:depicting\s+and\s+focusing\s+on|capturing)\s*['"][^'"]*['"]\s*[:,-.]?\s*/i, '');

    // 3. Remove opening shot/framing prefixes such as:
    // "Extreme close-up detail shot of..."
    // "Wide establishing shot of..."
    // "Medium shot, low-angle of..."
    // "Close-up shot of..."
    // "Low-angle hero shot of..."
    // "Dutch angle shot of..."
    const openingFramingRegex = /^(?:(?:extreme[-\s]+)?(?:close[-\s]*up|wide|medium|macro|panoramic|aerial|establishing|full[-\s]*body|low[-\s]*angle|high[-\s]*angle|dutch[-\s]*angle|birds[-\s]*eye|worms[-\s]*eye|over[-\s]*the[-\s]*shoulder|ots|first[-\s]*person|pov|telephoto|whip[-\s]*pan)\s+(?:detail\s+|hero\s+|cinematic\s+|establishing\s+|perspective\s+)?(?:shot|view|angle|framing|composition|perspective|take)?(?:\s*,\s*(?:low|high|dutch|eye[-\s]*level|worms[-\s]*eye|birds[-\s]*eye)[-\s]*(?:angle|tilt|level|view|shot)?)?\s*(?:of|showing|depicting|capturing|framing|features|featuring|:)?\s*)+/i;
    cleaned = cleaned.replace(openingFramingRegex, '');

    // 4. Remove simple opening shot names with colon or comma, e.g. "Medium shot: ..." or "Close-up: ..."
    cleaned = cleaned.replace(/^(?:Extreme\s+close-up|Close-up|Medium\s+shot|Wide\s+shot|Macro\s+shot|Establishing\s+shot|Detail\s+shot|Low-angle\s+shot|High-angle\s+shot|Dutch-angle\s+shot|Aerial\s+shot|POV\s+shot|Whip-pan\s+shot|Whip-pan)\s*[:,-]\s*/i, '');

    // 5. Clean up any remaining leading "of " or colon/dashes/whitespace
    cleaned = cleaned.replace(/^(?:of|showing|depicting)\s+/i, '');
    cleaned = cleaned.replace(/^[:;,-]\s*/, '').trim();
  }

  // 6. Strip any inline / embedded shot framing phrases such as:
  // ", in a wide establishing shot," or ", seen from a low-angle shot," or "captured in a close-up shot"
  cleaned = cleaned.replace(/\b(?:captured\s+in|seen\s+from|framed\s+as|in)\s+a\s+(?:extreme[-\s]+close[-\s]*up|close[-\s]*up|wide|medium|macro|panoramic|aerial|establishing|low[-\s]*angle|high[-\s]*angle|dutch[-\s]*angle|whip[-\s]*pan)\s+(?:shot|view|framing|perspective)\b/gi, '');
  cleaned = cleaned.replace(/\b(?:extreme[-\s]+close[-\s]*up|close[-\s]*up|wide|medium|macro|panoramic|aerial|establishing|low[-\s]*angle|high[-\s]*angle|dutch[-\s]*angle|whip[-\s]*pan)\s+(?:shot|framing|angle)\s*,\s*/gi, '');

  // 7. Remove any residual bracketed tokens anywhere in the prompt
  cleaned = cleaned.replace(/\[(?:Wide|Medium|Close-up|Macro|Extreme\s+Close-Up|Low-angle|High-angle|Dutch\s+Angle|Eye-level|Static|Pan|Tilt|Zoom|Tracking|Whip-Pan|Whip\s+Pan)[^\]]*\]\s*/gi, '');

  // 8. Clean up double spaces, dangling commas, and ensure capitalized first letter
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s*,\s*,/g, ',').replace(/^[,:;\s-]+/, '').trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Strips redundant or accidental on-screen text overlay instructions regarding a date/year
 * from prompts of beats that do NOT introduce that date.
 */
export function cleanRedundantOnScreenText(prompt: string, anchor?: string): string {
  if (!prompt) return '';
  let cleaned = prompt;
  if (anchor && anchor.trim()) {
    const escaped = anchor.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const specificRegex = new RegExp(`\\s*(?:Featuring|With|Includes?|Displaying)?\\s*(?:large\\s+clear\\s+legible|bold\\s+stylized|prominent\\s+stylized|clear\\s+legible|bold)?\\s*(?:on-screen\\s+text|text\\s+overlay|title\\s+text|typography|lettering)\\s*(?:overlay)?\\s*reading\\s*["']?${escaped}["']?[^.]*\\.?`, 'gi');
    cleaned = cleaned.replace(specificRegex, '');
  }
  // Remove generic on-screen year/date text overlay instructions
  const genericDateRegex = /\s*(?:Featuring|With|Includes?|Displaying)\s+(?:large\s+clear\s+legible|bold\s+stylized|prominent\s+stylized|clear\s+legible|bold)?\s*(?:on-screen\s+text|text\s+overlay|title\s+text|typography)\s*(?:overlay)?\s*reading\s*["']?(?:[12]\d{3}s?|FOR\s+\d+\s+YEARS|DECEMBER\s+\d+|OCTOBER\s+\d+|JANUARY\s+\d+|AUGUST\s+\d+|JULY\s+\d+|JUNE\s+\d+|IN\s+\d{4})["']?[^.]*\.?/gi;
  cleaned = cleaned.replace(genericDateRegex, '');
  // Also remove any residual phrases like 'Featuring large clear legible on-screen text reading "..." displayed above...'
  const residualOverlayRegex = /\s*Featuring\s+large\s+clear\s+legible\s+on-screen\s+text\s+reading\s+["'][^"']+["']\s+displayed\s+above[^.]*\.?/gi;
  cleaned = cleaned.replace(residualOverlayRegex, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

// Natural pause and clause split patterns:
// 1. Punctuation boundaries: commas, semicolons, colons, dashes, ellipses
// 2. Conjunctions & transition words: and, but, or, so, yet, because, although, while, as, if, when, where, that, which
// 3. Prepositional phrases: with, without, to, from, in, into, on, at, by, for, of, through, over, under, across, behind, before, after
const SPLIT_CONNECTORS = new Set([
  'and', 'but', 'or', 'nor', 'so', 'yet',
  'if', 'that', 'which', 'who', 'whom', 'whose',
  'when', 'while', 'where', 'as', 'because', 'although', 'though', 'since', 'unless', 'until',
  'with', 'without', 'to', 'from', 'in', 'into', 'on', 'onto', 'at', 'by', 'for', 'of',
  'through', 'over', 'under', 'between', 'around', 'about', 'across', 'behind', 'before', 'after',
  'then', 'now', 'just', 'even', 'like'
]);

const DYNAMIC_SHOT_CYCLE = [
  'Wide Establishing Shot',
  'Medium Shot',
  'Close-Up Detail',
  'Over-the-Shoulder (OTS)',
  'Low-Angle Hero Shot',
  'Macro Detail Shot',
  'Tight Facial Reaction',
  'Dutch Angle Perspective',
  'High-Angle Overview',
  'Point-of-View (POV)'
];

const DYNAMIC_MOVEMENT_CYCLE = [
  'Slow Push-In',
  'Micro Rack Focus',
  'Tracking Subject',
  'Subtle Handheld Drift',
  'Smooth Pan Across',
  'Low Dolly Glide',
  'Static Crisp Frame',
  'Slow Tilt Up'
];

const DYNAMIC_ANGLE_CYCLE = [
  'eye-level',
  'high-angle',
  'low-angle',
  'birds-eye',
  'worms-eye',
  'dutch-tilt'
];

/**
 * Count non-empty words in a phrase
 */
export function getWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Get first few words (up to 4-5 words) for compact preview
 */
export function getPreviewText(text: string, maxWords: number = 4): string {
  if (!text || !text.trim()) return '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Check if a shot type represents a tight close-up / macro framing
 */
export function isTightShot(shotType?: string): boolean {
  if (!shotType) return false;
  const lower = shotType.toLowerCase();
  return (
    lower.includes('close-up') ||
    lower.includes('macro') ||
    lower.includes('detail') ||
    lower.includes('tight') ||
    lower.includes('ots') ||
    lower.includes('over-the-shoulder')
  );
}

/**
 * Sanitizes beat prompt prose to strip all shot framing prefixes and leftover bracketed headers.
 */
export function alignProseWithShotType(beat: Beat): Beat {
  const prompt = sanitizeImagePromptShotFraming(beat.imagePrompt || '');

  return {
    ...beat,
    imagePrompt: prompt
  };
}

/**
 * Merge adjacent near-duplicate beats within a scene if they lack distinct visual progression
 * or if keeping them separate creates redundant identical images.
 */
export function mergeRedundantNearDuplicateBeats(
  beats: Beat[],
  maxBeatWords: number = MAX_BEAT_WORDS,
  maxBeatSeconds: number = MAX_BEAT_SECONDS
): Beat[] {
  if (beats.length <= 1) return beats;

  const merged: Beat[] = [];
  let current = beats[0];

  for (let i = 1; i < beats.length; i++) {
    const next = beats[i];
    const combinedWords = getWordCount(current.textSpan + ' ' + next.textSpan);
    const combinedSeconds = (current.estimatedSeconds || 1.5) + (next.estimatedSeconds || 1.5);

    // Normalize prompts for comparison
    const normPrompt1 = (current.imagePrompt || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const normPrompt2 = (next.imagePrompt || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Check if prompts are near-identical or share identical subject & action descriptions
    const isIdenticalPrompt = normPrompt1 === normPrompt2 || (normPrompt1.length > 20 && normPrompt2.length > 20 && (normPrompt1.includes(normPrompt2) || normPrompt2.includes(normPrompt1)));
    const fitsWithinCeiling = combinedWords <= maxBeatWords && combinedSeconds <= maxBeatSeconds;

    if (fitsWithinCeiling && isIdenticalPrompt) {
      // Merge next into current
      current = {
        ...current,
        textSpan: `${current.textSpan.trim()} ${next.textSpan.trim()}`,
        estimatedSeconds: Math.round(combinedSeconds * 10) / 10,
        // Keep current's prompt or pick longer
        imagePrompt: current.imagePrompt.length >= next.imagePrompt.length ? current.imagePrompt : next.imagePrompt
      };
    } else {
      merged.push(alignProseWithShotType(current));
      current = next;
    }
  }

  merged.push(alignProseWithShotType(current));

  // Re-index beats
  return merged.map((b, idx) => ({
    ...b,
    beatIndex: idx + 1
  }));
}

/**
 * Cleanly extract sub-phrases from a broad phrase using punctuation,
 * conjunctions, prepositions, and grammatical clauses.
 */
export function splitPhraseIntoSubBeats(phrase: string, maxWordsPerBeat: number = MAX_BEAT_WORDS): string[] {
  const clean = phrase.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  // Step 1: First split on explicit punctuation (, ; : — - ...)
  const rawPunctParts = clean.split(/(?<=[,;:\u2014\u2013\-])\s+|(?<=\.{3})\s+/).map(p => p.trim()).filter(Boolean);

  const clauseChunks: string[] = [];

  for (const part of rawPunctParts) {
    const words = part.split(/\s+/).filter(Boolean);

    // If already small enough (<= maxWordsPerBeat), keep as is
    if (words.length <= maxWordsPerBeat) {
      clauseChunks.push(part);
      continue;
    }

    // Need to split words by conjunctions, prepositions, or clause boundaries
    let currentChunk: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lowerCleanWord = word.toLowerCase().replace(/[^a-z]/g, '');

      const isConnector = SPLIT_CONNECTORS.has(lowerCleanWord);
      const isReachingMax = currentChunk.length >= Math.max(4, Math.floor(maxWordsPerBeat * 0.75));
      const remainingWords = words.length - i;

      if (currentChunk.length >= 2 && (isConnector || isReachingMax) && remainingWords >= 2) {
        clauseChunks.push(currentChunk.join(' '));
        currentChunk = [word];
      } else {
        currentChunk.push(word);
        if (currentChunk.length >= maxWordsPerBeat) {
          clauseChunks.push(currentChunk.join(' '));
          currentChunk = [];
        }
      }
    }

    if (currentChunk.length > 0) {
      clauseChunks.push(currentChunk.join(' '));
    }
  }

  // Final check: if any chunk is still > maxWordsPerBeat, forcefully cut into smaller chunks
  const resultChunks: string[] = [];
  const fallbackChunkSize = Math.max(4, Math.floor(maxWordsPerBeat * 0.75));
  for (const chunk of clauseChunks) {
    const words = chunk.split(/\s+/).filter(Boolean);
    if (words.length <= maxWordsPerBeat) {
      resultChunks.push(chunk);
    } else {
      for (let i = 0; i < words.length; i += fallbackChunkSize) {
        resultChunks.push(words.slice(i, i + fallbackChunkSize).join(' '));
      }
    }
  }

  return resultChunks.filter(c => c.trim().length > 0);
}

/**
 * Validate and enforce duration and word ceilings on all beats in a scene.
 * For Image mode: strict 2.0s ceiling, max 8 words.
 * For Video mode: smart duration calibration spanning targetVideoDuration (e.g. 5s, 10s, 15s).
 */
export function enforceBeatCeilings(
  beats: Beat[],
  sceneIndex: number,
  options?: { isVideoMode?: boolean; targetVideoDuration?: number }
): Beat[] {
  const isVideoMode = !!options?.isVideoMode;
  const targetVideoDuration = options?.targetVideoDuration || 5;

  // In video mode, adapt the beat ceiling and word thresholds to comfortably span target clip length
  const maxBeatSeconds = isVideoMode
    ? (targetVideoDuration <= 5 ? 2.5 : targetVideoDuration <= 10 ? 3.5 : 4.5)
    : MAX_BEAT_SECONDS;
  const maxBeatWords = isVideoMode
    ? (targetVideoDuration <= 5 ? 10 : targetVideoDuration <= 10 ? 14 : 18)
    : MAX_BEAT_WORDS;

  // Step 1: Deduplicate near-duplicate adjacent beats that lack distinct visual progression
  const deduplicatedInputBeats = mergeRedundantNearDuplicateBeats(beats, maxBeatWords, maxBeatSeconds);

  const validatedBeats: Beat[] = [];
  let globalBeatCounter = 1;

  for (let bIdx = 0; bIdx < deduplicatedInputBeats.length; bIdx++) {
    const originalBeat = deduplicatedInputBeats[bIdx];
    const text = (originalBeat.textSpan || '').trim();
    const wordCount = getWordCount(text);
    const seconds = typeof originalBeat.estimatedSeconds === 'number' && originalBeat.estimatedSeconds > 0
      ? originalBeat.estimatedSeconds
      : Math.max(1.0, Math.min(maxBeatSeconds, Math.round(wordCount * 0.35 * 10) / 10));

    // Check if beat needs subdivision:
    // 1. Exceeds maxBeatWords or maxBeatSeconds
    // 2. In video mode, if this is the ONLY beat in the scene and has 5 or more words
    const shouldSplit = wordCount > maxBeatWords || seconds > maxBeatSeconds || (isVideoMode && deduplicatedInputBeats.length === 1 && wordCount >= 5);

    if (shouldSplit) {
      const targetChunkWords = isVideoMode
        ? Math.max(3, Math.min(maxBeatWords, Math.ceil(wordCount / (targetVideoDuration <= 6 ? 2 : 3))))
        : MAX_BEAT_WORDS;
      const subPhrases = splitPhraseIntoSubBeats(text, targetChunkWords);

      if (subPhrases.length > 1) {
        const subDuration = Math.round((seconds / subPhrases.length) * 10) / 10;
        subPhrases.forEach((subText, subIdx) => {
          const subWordCount = getWordCount(subText);
          const subEstimatedSec = Math.max(0.8, Math.round(subWordCount * 0.35 * 10) / 10);
          const shotCycleIdx = (bIdx + subIdx) % DYNAMIC_SHOT_CYCLE.length;
          const moveCycleIdx = (bIdx + subIdx) % DYNAMIC_MOVEMENT_CYCLE.length;
          const angleCycleIdx = (bIdx + subIdx) % DYNAMIC_ANGLE_CYCLE.length;

          const assignedShotType = subIdx === 0
            ? (originalBeat.shotType || DYNAMIC_SHOT_CYCLE[0])
            : DYNAMIC_SHOT_CYCLE[shotCycleIdx];

          const assignedCameraAngle = subIdx === 0
            ? (originalBeat.cameraAngle || DYNAMIC_ANGLE_CYCLE[0])
            : DYNAMIC_ANGLE_CYCLE[angleCycleIdx];

          const assignedCameraMovement = subIdx === 0
            ? (originalBeat.cameraMovement || DYNAMIC_MOVEMENT_CYCLE[0])
            : DYNAMIC_MOVEMENT_CYCLE[moveCycleIdx];

          validatedBeats.push(alignProseWithShotType({
            ...originalBeat,
            beatIndex: globalBeatCounter++,
            textSpan: subText,
            shotType: assignedShotType,
            cameraAngle: assignedCameraAngle,
            cameraMovement: assignedCameraMovement,
            estimatedSeconds: Math.min(maxBeatSeconds, Math.max(0.8, subEstimatedSec || subDuration)),
            imagePrompt: originalBeat.imagePrompt || subText,
          }));
        });
        continue;
      }
    }

    // Valid beat within ceiling
    validatedBeats.push(alignProseWithShotType({
      ...originalBeat,
      beatIndex: globalBeatCounter++,
      estimatedSeconds: Math.min(maxBeatSeconds, Math.max(0.8, Math.round(seconds * 10) / 10)),
    }));
  }

  // Safety fallback for Video mode: never allow a single-beat video scene
  if (isVideoMode && validatedBeats.length === 1 && targetVideoDuration >= 3) {
    const singleBeat = validatedBeats[0];
    const words = (singleBeat.textSpan || '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 4) {
      const mid = Math.ceil(words.length / 2);
      const span1 = words.slice(0, mid).join(' ');
      const span2 = words.slice(mid).join(' ');
      const halfSec = Math.round((targetVideoDuration / 2) * 10) / 10;

      validatedBeats.length = 0;
      validatedBeats.push(alignProseWithShotType({
        ...singleBeat,
        beatIndex: 1,
        textSpan: span1,
        shotType: singleBeat.shotType || 'Medium Shot',
        cameraAngle: singleBeat.cameraAngle || 'eye-level',
        cameraMovement: singleBeat.cameraMovement || 'Slow Push-In',
        estimatedSeconds: halfSec,
      }));
      validatedBeats.push(alignProseWithShotType({
        ...singleBeat,
        beatIndex: 2,
        textSpan: span2,
        shotType: isTightShot(singleBeat.shotType) ? 'Medium Shot' : 'Close-Up Detail',
        cameraAngle: singleBeat.cameraAngle === 'low-angle' ? 'eye-level' : 'low-angle',
        cameraMovement: 'Tracking Subject',
        estimatedSeconds: Math.max(0.8, Math.round((targetVideoDuration - halfSec) * 10) / 10),
      }));
    }
  }

  // In Video mode: smartly balance the sum of beat durations to cover the target clip duration
  if (isVideoMode && validatedBeats.length > 0 && targetVideoDuration > 0) {
    const totalRaw = validatedBeats.reduce((acc, b) => acc + (b.estimatedSeconds || 1.5), 0);
    if (totalRaw > 0) {
      const scale = targetVideoDuration / totalRaw;
      let runningSum = 0;
      for (let i = 0; i < validatedBeats.length; i++) {
        if (i === validatedBeats.length - 1) {
          // Final beat absorbs any rounding difference
          validatedBeats[i].estimatedSeconds = Math.max(0.8, Math.round((targetVideoDuration - runningSum) * 10) / 10);
        } else {
          const scaled = Math.max(0.8, Math.round(validatedBeats[i].estimatedSeconds * scale * 10) / 10);
          validatedBeats[i].estimatedSeconds = scaled;
          runningSum += scaled;
        }
      }
    }
  }

  return validatedBeats;
}

/**
 * Populates and validates `transitionHint` fields across all scenes.
 * STRICT SPECIFICATION:
 * - Populated ONLY on the last beat of a scene (scene i) and the first beat of the next scene (scene i + 1).
 * - All intermediate beats and outer terminals (first beat of Scene 1, last beat of final scene)
 *   MUST have `transitionHint` set to `undefined`.
 * - Describes a shared visual anchor (shape, color, motion direction, screen position) to make editing cuts
 *   or dissolves intentional rather than random.
 * - This applies to both Image mode (crossfades/match-cuts between stills) and Video mode.
 * - Explicitly framed as an editing-stage operation, NOT an AI-generated clip transition.
 */
export function populateSceneTransitionHints(scenes: Scene[], styleProfile?: StyleProfile): Scene[] {
  if (!Array.isArray(scenes) || scenes.length <= 1) {
    return (scenes || []).map((scene) => ({
      ...scene,
      beats: (scene.beats || []).map((beat) => ({
        ...beat,
        transitionHint: undefined,
      })),
    }));
  }

  return scenes.map((scene, sIdx) => {
    const isFirstScene = sIdx === 0;
    const isLastScene = sIdx === scenes.length - 1;
    const beats = scene.beats || [];
    if (beats.length === 0) return scene;

    const updatedBeats = beats.map((beat, bIdx) => {
      const isSceneFirstBeat = bIdx === 0;
      const isSceneLastBeat = bIdx === beats.length - 1;

      // Only incoming boundary (first beat of scene > 0) or outgoing boundary (last beat of scene < lastScene)
      const isIncomingTransitionBeat = !isFirstScene && isSceneFirstBeat;
      const isOutgoingTransitionBeat = !isLastScene && isSceneLastBeat;

      if (!isIncomingTransitionBeat && !isOutgoingTransitionBeat) {
        return {
          ...beat,
          transitionHint: undefined,
        };
      }

      // If already populated cleanly and contextually, sanitize it
      if (beat.transitionHint && beat.transitionHint.trim().length > 6) {
        const cleaned = beat.transitionHint
          .replace(/[\u2014\u2013]|--/g, ', ')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          ...beat,
          transitionHint: cleaned,
        };
      }

      // Generate a structured visual anchor note for editing assembly
      if (isOutgoingTransitionBeat) {
        const nextScene = scenes[sIdx + 1];
        const nextFirstBeat = nextScene?.beats?.[0];
        const hasWhipPan =
          (beat.cameraMovement || '').toLowerCase().includes('whip') ||
          (beat.shotType || '').toLowerCase().includes('whip');

        if (hasWhipPan) {
          return {
            ...beat,
            transitionHint: `Outgoing anchor: Fast lateral whip-pan motion blur providing kinetic exit momentum to match cut or dissolve into Scene ${sIdx + 2}.`,
          };
        }

        const colorHint = styleProfile?.colorPalette
          ? `tonal ${styleProfile.colorPalette.split(/[,;]/)[0].trim()}`
          : 'ambient lighting';
        const motionHint =
          beat.cameraMovement && beat.cameraMovement !== 'Static Frame' && beat.cameraMovement !== 'Static'
            ? `${beat.cameraMovement.toLowerCase()} motion direction`
            : 'screen position and focal third';
        const nextSubject = nextFirstBeat?.textSpan
          ? `"${nextFirstBeat.textSpan.slice(0, 32)}..."`
          : `Scene ${sIdx + 2}`;

        return {
          ...beat,
          transitionHint: `Outgoing anchor: Harmonized ${colorHint} and ${motionHint} aligning screen geometry for an intentional cut into ${nextSubject}.`,
        };
      }

      if (isIncomingTransitionBeat) {
        const prevScene = scenes[sIdx - 1];
        const prevLastBeat = prevScene?.beats?.[prevScene.beats.length - 1];
        const hasWhipPan =
          (beat.cameraMovement || '').toLowerCase().includes('whip') ||
          (beat.shotType || '').toLowerCase().includes('whip') ||
          (prevLastBeat?.cameraMovement || '').toLowerCase().includes('whip') ||
          (prevLastBeat?.shotType || '').toLowerCase().includes('whip');

        if (hasWhipPan) {
          return {
            ...beat,
            transitionHint: `Incoming anchor: Motion blur settling smoothly onto subject, resolving the whip-pan momentum exiting Scene ${sIdx}.`,
          };
        }

        const colorHint = styleProfile?.colorPalette
          ? `matching ${styleProfile.colorPalette.split(/[,;]/)[0].trim()} palette`
          : 'tonal continuity';
        const prevSubject = prevLastBeat?.textSpan
          ? `"${prevLastBeat.textSpan.slice(0, 32)}..."`
          : `Scene ${sIdx}`;

        return {
          ...beat,
          transitionHint: `Incoming anchor: Shared visual orientation and ${colorHint} picking up the eye position from ${prevSubject} for a deliberate cut or crossfade.`,
        };
      }

      return {
        ...beat,
        transitionHint: undefined,
      };
    });

    return {
      ...scene,
      beats: updatedBeats,
    };
  });
}

