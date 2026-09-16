import { Beat } from '../types';

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
 * Ensure tight shot types (close-up, macro, extreme-close-up) have prompt prose
 * that cleanly strips any wide/establishing opening prefixes and any leftover bracketed headers.
 */
export function alignProseWithShotType(beat: Beat): Beat {
  let prompt = (beat.imagePrompt || '').replace(/^\[.*?\]\s*/, '').trim();
  const shotType = beat.shotType || '';

  if (isTightShot(shotType)) {
    // Strip conflicting wide opening phrases if present
    prompt = prompt
      .replace(/^(?:wide\s+establishing\s+shot|wide\s+shot|extreme-wide\s+shot|panoramic\s+view|aerial\s+view|full-body\s+shot)\s*(?:of)?\s*/i, '')
      .trim();
  }

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

    // Valid beat within ceiling
    validatedBeats.push(alignProseWithShotType({
      ...originalBeat,
      beatIndex: globalBeatCounter++,
      estimatedSeconds: Math.min(maxBeatSeconds, Math.max(0.8, Math.round(seconds * 10) / 10)),
    }));
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

