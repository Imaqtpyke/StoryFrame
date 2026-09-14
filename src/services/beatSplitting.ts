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
export function splitPhraseIntoSubBeats(phrase: string): string[] {
  const clean = phrase.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  // Step 1: First split on explicit punctuation (, ; : — - ...)
  const rawPunctParts = clean.split(/(?<=[,;:\u2014\u2013\-])\s+|(?<=\.{3})\s+/).map(p => p.trim()).filter(Boolean);

  const clauseChunks: string[] = [];

  for (const part of rawPunctParts) {
    const words = part.split(/\s+/).filter(Boolean);

    // If already small enough (<= 8 words), keep as is
    if (words.length <= MAX_BEAT_WORDS) {
      clauseChunks.push(part);
      continue;
    }

    // Need to split words by conjunctions, prepositions, or clause boundaries
    let currentChunk: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lowerCleanWord = word.toLowerCase().replace(/[^a-z]/g, '');

      // Check if we should split at this boundary:
      // Condition: we already have accumulated at least 2 words AND
      // (a) this word is a split connector, OR
      // (b) current chunk is reaching the max words limit (>= 6 words)
      const isConnector = SPLIT_CONNECTORS.has(lowerCleanWord);
      const isReachingMax = currentChunk.length >= 6;
      const remainingWords = words.length - i;

      if (currentChunk.length >= 2 && (isConnector || isReachingMax) && remainingWords >= 2) {
        clauseChunks.push(currentChunk.join(' '));
        currentChunk = [word];
      } else {
        currentChunk.push(word);
        if (currentChunk.length >= MAX_BEAT_WORDS) {
          clauseChunks.push(currentChunk.join(' '));
          currentChunk = [];
        }
      }
    }

    if (currentChunk.length > 0) {
      clauseChunks.push(currentChunk.join(' '));
    }
  }

  // Final check: if any chunk is still > MAX_BEAT_WORDS, forcefully cut into chunks of 5-6 words
  const resultChunks: string[] = [];
  for (const chunk of clauseChunks) {
    const words = chunk.split(/\s+/).filter(Boolean);
    if (words.length <= MAX_BEAT_WORDS) {
      resultChunks.push(chunk);
    } else {
      for (let i = 0; i < words.length; i += 5) {
        resultChunks.push(words.slice(i, i + 5).join(' '));
      }
    }
  }

  return resultChunks.filter(c => c.trim().length > 0);
}

/**
 * Validate and enforce hard ceiling on all beats in a scene.
 * Ceiling: estimatedSeconds <= 2.0 AND wordCount <= 8.
 * Automatically splits any beat that exceeds either ceiling into sub-beats.
 */
export function enforceBeatCeilings(beats: Beat[], sceneIndex: number): Beat[] {
  const validatedBeats: Beat[] = [];
  let globalBeatCounter = 1;

  for (let bIdx = 0; bIdx < beats.length; bIdx++) {
    const originalBeat = beats[bIdx];
    const text = (originalBeat.textSpan || '').trim();
    const wordCount = getWordCount(text);
    const seconds = typeof originalBeat.estimatedSeconds === 'number' && originalBeat.estimatedSeconds > 0
      ? originalBeat.estimatedSeconds
      : Math.max(1.0, Math.min(2.0, Math.round(wordCount * 0.35 * 10) / 10));

    // Check if this beat violates the hard ceiling:
    const exceedsWords = wordCount > MAX_BEAT_WORDS;
    const exceedsSeconds = seconds > MAX_BEAT_SECONDS;

    if (!exceedsWords && !exceedsSeconds) {
      // Valid beat within ceiling
      validatedBeats.push({
        ...originalBeat,
        beatIndex: globalBeatCounter++,
        estimatedSeconds: Math.min(MAX_BEAT_SECONDS, Math.max(0.8, Math.round(seconds * 10) / 10)),
      });
      continue;
    }

    // Split this beat into micro-beats
    const subPhrases = splitPhraseIntoSubBeats(text);

    // If splitting produced multiple sub-phrases:
    if (subPhrases.length > 1) {
      const basePrompt = originalBeat.imagePrompt || '';

      subPhrases.forEach((subPhrase, subIdx) => {
        const subWords = getWordCount(subPhrase);
        // Estimate 1.0 - 2.0s per sub-beat
        const subSeconds = Math.min(
          MAX_BEAT_SECONDS,
          Math.max(0.8, Math.round((subWords * 0.35 + 0.3) * 10) / 10)
        );

        // Dynamically rotate shot types and camera movements so each micro-beat feels varied
        const shotCycleIndex = (sceneIndex * 3 + globalBeatCounter) % DYNAMIC_SHOT_CYCLE.length;
        const moveCycleIndex = (sceneIndex * 2 + globalBeatCounter) % DYNAMIC_MOVEMENT_CYCLE.length;
        
        const subShotType = subIdx === 0 && originalBeat.shotType
          ? originalBeat.shotType
          : DYNAMIC_SHOT_CYCLE[shotCycleIndex];

        const subCameraMove = subIdx === 0 && originalBeat.cameraMovement
          ? originalBeat.cameraMovement
          : DYNAMIC_MOVEMENT_CYCLE[moveCycleIndex];

        // Adapt the image prompt to emphasize this sub-beat's visual focus
        let adaptedPrompt = basePrompt;
        if (subIdx > 0) {
          // Replace or prefix the shot type in the prompt
          adaptedPrompt = `[${subShotType}, ${subCameraMove}] Focusing on "${subPhrase}": ` +
            basePrompt.replace(/^\[.*?\]\s*/, '');
        }

        validatedBeats.push({
          beatIndex: globalBeatCounter++,
          textSpan: subPhrase,
          imagePrompt: adaptedPrompt,
          estimatedSeconds: subSeconds,
          shotType: subShotType,
          cameraMovement: subCameraMove,
        });
      });
    } else {
      // Could not sub-split phrase further, but seconds exceeded ceiling: clamp seconds
      validatedBeats.push({
        ...originalBeat,
        beatIndex: globalBeatCounter++,
        estimatedSeconds: Math.min(MAX_BEAT_SECONDS, seconds),
      });
    }
  }

  return validatedBeats;
}
