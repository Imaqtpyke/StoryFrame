import { Beat } from '../types';

export const MAX_BEAT_SECONDS = 2.0;
export const MAX_BEAT_WORDS = 8;

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

  const validatedBeats: Beat[] = [];
  let globalBeatCounter = 1;

  for (let bIdx = 0; bIdx < beats.length; bIdx++) {
    const originalBeat = beats[bIdx];
    const text = (originalBeat.textSpan || '').trim();
    const wordCount = getWordCount(text);
    const seconds = typeof originalBeat.estimatedSeconds === 'number' && originalBeat.estimatedSeconds > 0
      ? originalBeat.estimatedSeconds
      : Math.max(1.0, Math.min(maxBeatSeconds, Math.round(wordCount * 0.35 * 10) / 10));

    // Check if this beat violates the ceiling:
    const exceedsWords = wordCount > maxBeatWords;
    const exceedsSeconds = seconds > maxBeatSeconds;

    if (!exceedsWords && !exceedsSeconds) {
      // Valid beat within ceiling
      validatedBeats.push({
        ...originalBeat,
        beatIndex: globalBeatCounter++,
        estimatedSeconds: Math.min(maxBeatSeconds, Math.max(0.8, Math.round(seconds * 10) / 10)),
      });
      continue;
    }

    // Split this beat into micro-beats
    const subPhrases = splitPhraseIntoSubBeats(text, maxBeatWords);

    // If splitting produced multiple sub-phrases:
    if (subPhrases.length > 1) {
      const basePrompt = originalBeat.imagePrompt || '';

      subPhrases.forEach((subPhrase, subIdx) => {
        const subWords = getWordCount(subPhrase);
        const subSeconds = Math.min(
          maxBeatSeconds,
          Math.max(0.8, Math.round((subWords * 0.35 + 0.3) * 10) / 10)
        );

        // Dynamically rotate shot types, camera angles, and camera movements so each micro-beat feels varied
        const shotCycleIndex = (sceneIndex * 3 + globalBeatCounter) % DYNAMIC_SHOT_CYCLE.length;
        const moveCycleIndex = (sceneIndex * 2 + globalBeatCounter) % DYNAMIC_MOVEMENT_CYCLE.length;
        const angleCycleIndex = (sceneIndex * 4 + globalBeatCounter) % DYNAMIC_ANGLE_CYCLE.length;
        
        const subShotType = subIdx === 0 && originalBeat.shotType
          ? originalBeat.shotType
          : DYNAMIC_SHOT_CYCLE[shotCycleIndex];

        const subCameraAngle = originalBeat.cameraAngle
          ? originalBeat.cameraAngle
          : DYNAMIC_ANGLE_CYCLE[angleCycleIndex];

        const subCameraMove = subIdx === 0 && originalBeat.cameraMovement
          ? originalBeat.cameraMovement
          : DYNAMIC_MOVEMENT_CYCLE[moveCycleIndex];

        // Adapt the prompt to emphasize this sub-beat's visual focus
        let adaptedPrompt = basePrompt;
        if (subIdx > 0) {
          adaptedPrompt = `[${subShotType}, ${subCameraAngle}, ${subCameraMove}] Focusing on "${subPhrase}": ` +
            basePrompt.replace(/^\[.*?\]\s*/, '');
        }

        validatedBeats.push({
          beatIndex: globalBeatCounter++,
          textSpan: subPhrase,
          imagePrompt: adaptedPrompt,
          estimatedSeconds: subSeconds,
          shotType: subShotType,
          cameraAngle: subCameraAngle,
          cameraMovement: subCameraMove,
        });
      });
    } else {
      // Could not sub-split phrase further, clamp seconds
      validatedBeats.push({
        ...originalBeat,
        beatIndex: globalBeatCounter++,
        estimatedSeconds: Math.min(maxBeatSeconds, seconds),
      });
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

