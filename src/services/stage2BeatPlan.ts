/**
 * Stage 2: Picture-Grounded Beat Planning
 * Divides the numbered words into contiguous, non-overlapping picture beats
 * governed by strict pacing constants (short-form vs long-form) and clip mapping for video.
 */

import { StoryBible, StoryFormat, GenerationMode } from '../types';
import { NumberedWord } from './stage0Prepare';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';

export interface PacingConfig {
  minDwell: number;
  fastCutBelow: number;
  maxDwell: number;
  targetAvgMin: number;
  targetAvgMax: number;
}

export const SHORT_FORM_PACING: PacingConfig = {
  minDwell: 0.8,
  fastCutBelow: 1.1,
  maxDwell: 2.0,
  targetAvgMin: 1.2,
  targetAvgMax: 1.8,
};

export const LONG_FORM_PACING: PacingConfig = {
  minDwell: 0.8,
  fastCutBelow: 1.2,
  maxDwell: 3.0,
  targetAvgMin: 1.5,
  targetAvgMax: 2.5,
};

// Default constants for backward compatibility
export const MIN_DWELL = 0.8;
export const FAST_CUT_BELOW = 1.2;
export const MAX_DWELL = 3.0;
export const TARGET_SCENE_AVG_MIN = 1.5;
export const TARGET_SCENE_AVG_MAX = 2.5;

export interface PlannedBeat {
  beatIndex: number;
  wordRange: [number, number]; // [startIndex, endIndex] inclusive
  textSpan: string;
  depicts: string;
  kind: 'literal' | 'figurative' | 'withheld-effect';
  referentId?: string;
  intensity: 'low' | 'medium' | 'high';
  subjectIds: string[];
  shotSize: string;
  angle: string;
  newInfo: string;
  overlayText?: string;
  estimatedSeconds: number;
  flaggedIssue?: string;
  clipIndex?: number;
}

export interface PlannedScene {
  index: number;
  narratorLine: string;
  beats: PlannedBeat[];
  estimatedSeconds: number;
  averageBeatSeconds: number;
  fastCutRatio: number;
  beatToClipMap?: Record<number, number>;
}

export const BEAT_PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scenes: {
      type: 'ARRAY',
      description: 'Ordered sequence of scenes containing contiguous visual beats',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          narratorLine: { type: 'STRING' },
          beats: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                startWordIndex: { type: 'INTEGER' },
                endWordIndex: { type: 'INTEGER' },
                depicts: { type: 'STRING', description: 'One plain sentence of what is visible in story terms' },
                kind: { type: 'STRING', enum: ['literal', 'figurative', 'withheld-effect'] },
                referentId: { type: 'STRING', description: 'Referent ID from bible if figurative' },
                intensity: { type: 'STRING', enum: ['low', 'medium', 'high'] },
                subjectIds: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: 'Entity IDs from the Bible who are visually present in this shot',
                },
                shotSize: {
                  type: 'STRING',
                  enum: ['wide', 'medium', 'close-up', 'extreme close-up', 'over-the-shoulder'],
                },
                angle: {
                  type: 'STRING',
                  enum: ['eye level', 'high', 'low', 'overhead', 'dutch tilt'],
                },
                newInfo: {
                  type: 'STRING',
                  description: 'Specific visual progression not seen in earlier beats in this scene',
                },
                overlayText: {
                  type: 'STRING',
                  description: 'Optional on-screen text for editor (e.g. 1348), never part of image prompt',
                },
              },
              required: [
                'startWordIndex',
                'endWordIndex',
                'depicts',
                'kind',
                'intensity',
                'subjectIds',
                'shotSize',
                'angle',
                'newInfo',
              ],
            },
          },
        },
        required: ['index', 'narratorLine', 'beats'],
      },
    },
  },
  required: ['scenes'],
};

/**
 * Validates and repairs beat pacing deterministically:
 * - Sub-minDwell beats merged into neighbor.
 * - Fast cut rules: < fastCutBelow allowed only if high intensity, distinct visual, max 25% per scene, max 2 in a row.
 * - Trailing beat after fast cuts holds >= 2.0s (or >= 1.5s in short-form).
 * - For video mode: one beat = one clip, or at most 2-3 consecutive beats with same subject capped at 8s.
 */
export function enforceStage2Pacing(
  rawScenes: PlannedScene[],
  words: NumberedWord[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image'
): PlannedScene[] {
  const config = format === 'short' ? SHORT_FORM_PACING : LONG_FORM_PACING;
  const isVideo = generationMode === 'video';

  return rawScenes.map((scene) => {
    let beats = [...scene.beats];
    if (beats.length === 0) return scene;

    // 1. Merge sub-minDwell beats into neighbor
    let i = 0;
    while (i < beats.length) {
      const b = beats[i];
      if (b.estimatedSeconds < config.minDwell && beats.length > 1) {
        if (i < beats.length - 1) {
          // Merge with next
          const next = beats[i + 1];
          const newStart = Math.min(b.wordRange[0], next.wordRange[0]);
          const newEnd = Math.max(b.wordRange[1], next.wordRange[1]);
          const mergedWords = words.slice(newStart, newEnd + 1);
          const newDuration = Math.round((b.estimatedSeconds + next.estimatedSeconds) * 10) / 10;
          beats[i + 1] = {
            ...next,
            wordRange: [newStart, newEnd],
            textSpan: mergedWords.map((w) => w.word).join(' '),
            estimatedSeconds: newDuration,
            newInfo: `${b.newInfo} ${next.newInfo}`.trim(),
            overlayText: b.overlayText || next.overlayText,
          };
          beats.splice(i, 1);
        } else {
          // Merge with previous
          const prev = beats[i - 1];
          const newStart = Math.min(prev.wordRange[0], b.wordRange[0]);
          const newEnd = Math.max(prev.wordRange[1], b.wordRange[1]);
          const mergedWords = words.slice(newStart, newEnd + 1);
          const newDuration = Math.round((prev.estimatedSeconds + b.estimatedSeconds) * 10) / 10;
          beats[i - 1] = {
            ...prev,
            wordRange: [newStart, newEnd],
            textSpan: mergedWords.map((w) => w.word).join(' '),
            estimatedSeconds: newDuration,
            newInfo: `${prev.newInfo} ${b.newInfo}`.trim(),
            overlayText: prev.overlayText || b.overlayText,
          };
          beats.splice(i, 1);
        }
      } else {
        i++;
      }
    }

    // 2. Check fast cut ceiling: max 25% per scene, max 2 in a row
    let consecutiveFastCuts = 0;
    const postFastCutHold = format === 'short' ? 1.5 : 2.0;

    for (let j = 0; j < beats.length; j++) {
      const b = beats[j];
      const isFastCut = b.estimatedSeconds < config.fastCutBelow;

      if (isFastCut) {
        consecutiveFastCuts++;
        if (consecutiveFastCuts > 2 || b.intensity !== 'high' || !b.newInfo.trim()) {
          b.estimatedSeconds = config.fastCutBelow;
          consecutiveFastCuts = 0;
        }
      } else {
        if (consecutiveFastCuts > 0) {
          b.estimatedSeconds = Math.max(postFastCutHold, b.estimatedSeconds);
        }
        consecutiveFastCuts = 0;
      }
    }

    // Cap fast cuts to at most 25% of scene
    const fastCutCount = beats.filter((b) => b.estimatedSeconds < config.fastCutBelow).length;
    const maxAllowedFastCuts = Math.floor(beats.length * 0.25);
    if (fastCutCount > maxAllowedFastCuts) {
      let excess = fastCutCount - maxAllowedFastCuts;
      for (const b of beats) {
        if (excess <= 0) break;
        if (b.estimatedSeconds < config.fastCutBelow) {
          b.estimatedSeconds = config.fastCutBelow;
          excess--;
        }
      }
    }

    // Re-index beats
    beats = beats.map((b, idx) => ({ ...b, beatIndex: idx + 1 }));

    // 3. Video clip mapping: one beat = one clip, or at most 2-3 consecutive beats with same subject capped at 8s
    let beatToClipMap: Record<number, number> | undefined = undefined;
    if (isVideo) {
      beatToClipMap = {};
      let currentClip = 1;
      let clipDur = 0;
      let clipCount = 0;
      let clipSub = '';

      for (let k = 0; k < beats.length; k++) {
        const b = beats[k];
        const primarySub = b.subjectIds[0] || 'scene';
        const canGroup =
          clipCount > 0 &&
          clipCount < 3 &&
          clipSub === primarySub &&
          clipDur + b.estimatedSeconds <= 8.0;

        if (canGroup) {
          b.clipIndex = currentClip;
          clipDur += b.estimatedSeconds;
          clipCount++;
        } else {
          if (clipCount > 0) currentClip++;
          b.clipIndex = currentClip;
          clipDur = b.estimatedSeconds;
          clipCount = 1;
          clipSub = primarySub;
        }
        beatToClipMap[b.beatIndex] = b.clipIndex;
      }
    }

    const totalSec = beats.reduce((acc, b) => acc + b.estimatedSeconds, 0);
    const avgSec = beats.length > 0 ? Math.round((totalSec / beats.length) * 10) / 10 : 0;
    const currentFastCutRatio =
      beats.length > 0 ? beats.filter((b) => b.estimatedSeconds < config.fastCutBelow).length / beats.length : 0;

    return {
      ...scene,
      beats,
      estimatedSeconds: Math.round(totalSec * 10) / 10,
      averageBeatSeconds: avgSec,
      fastCutRatio: Math.round(currentFastCutRatio * 100) / 100,
      beatToClipMap,
    };
  });
}

/**
 * Main Stage 2 entry point
 */
export async function stage2GenerateBeatPlan(
  words: NumberedWord[],
  bible: StoryBible,
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void
): Promise<PlannedScene[]> {
  const modelName = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const isShortForm = format === 'short';
  const pacingDesc = isShortForm
    ? 'SHORT-FORM PACING: rapid pattern interrupts every 1.2s to 1.8s (min dwell 0.8s, fast cut below 1.1s, max dwell 2.0s)'
    : 'LONG-FORM PACING: cinematic scene progression every 1.5s to 2.5s (min dwell 0.8s, fast cut below 1.2s, max dwell 3.0s)';

  const indexedWordsText = words
    .map((w) => `[${w.index}] ${w.word} (${w.startSec}s-${w.endSec}s)`)
    .join(' ');

  const prompt = `You are a cinematic storyboard director.
Divide the following narration words into PICTURE BEATS.
Format: ${format === 'short' ? '9:16 Vertical Portrait' : '16:9 Widescreen Landscape'}.
Mode: ${generationMode === 'video' ? 'Text to Video' : 'Text to Image'}.
${pacingDesc}.

STORY BIBLE CONTRACT:
Cast: ${bible.cast.map((c) => `${c.id} (${c.role})`).join(', ')}
Threat: ${bible.threat.canonicalLook}
Locations: ${bible.locations.map((l) => l.id).join(', ')}
Referents: ${bible.referents.map((r) => `"${r.phrase}" -> ${r.concreteEntity} (${r.visualDepiction})`).join('; ')}
Withheld (Do NOT reveal cause): ${bible.withheld.join('; ')}
Forbidden: ${bible.forbidden.join('; ')}

INDEXED NARRATION WORDS (Tile from word 0 to word ${words.length - 1} with NO GAPS and NO OVERLAPS):
"""
${indexedWordsText}
"""

RULES FOR BEAT PLANNING:
1. PICTURES, NOT GRAMMAR: Split by what is visibly distinct in the world. Never cut inside a clause that has no picture on its own (e.g. "was the worst", "as if he", "of the coffin lid"). Merge fragments into the beat carrying the noun or verb.
2. CONTINUOUS TILING: The first beat of scene 0 must start at word 0. Every beat's startWordIndex must equal the previous beat's endWordIndex + 1. The final beat must end at word ${words.length - 1}.
3. FIGURATIVE LINES: For lines in Bible Referents (e.g. "the worst thing God could send them. They were wrong."), mark kind="figurative", set referentId, and depict the concrete referent (the risen dead), NOT the spoken metaphor.
4. WITHHELD MYSTERIES: For moments that the story hides (e.g. what calls the dead), mark kind="withheld-effect", and depict only physical effects or reactions (faces turning, dust sifting, bell swinging), NEVER the source.
5. FAST CUTS: Allowed ONLY if intensity="high" (a reveal, shock, escalation) and newInfo has a genuine distinct visual element. Max 25% of beats in a scene.
6. OVERLAY TEXT: If the narration mentions an explicit date or year (e.g. "1348"), put it in "overlayText" for the video editor. NEVER put dates or numbers into the image description.
7. SHOT VOCABULARY: shotSize in ['wide', 'medium', 'close-up', 'extreme close-up', 'over-the-shoulder']. Angle in ['eye level', 'high', 'low', 'overhead', 'dutch tilt']. OTS strictly requires two people.

Output valid JSON matching the schema.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: BEAT_PLAN_SCHEMA,
      temperature: 0.2,
    },
  };

  const response = await fetchWithExponentialBackoff(
    () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: userSignal,
      }),
    {
      initialDelayMs: 2000,
      maxAttempts: 4,
      onRetry: (attempt, _max, delayMs) => {
        if (onStatusMessage) {
          onStatusMessage(`Planning visual story beats (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
        }
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Beat Plan API error: HTTP ${response.status}`);
  }

  const json = await response.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Beat Plan generator');
  }

  const parsed = JSON.parse(rawText);
  const rawScenes: PlannedScene[] = (parsed.scenes || []).map((sc: any, scIdx: number) => {
    const beats: PlannedBeat[] = (sc.beats || []).map((b: any, bIdx: number) => {
      const start = Math.max(0, Math.min(words.length - 1, b.startWordIndex || 0));
      const end = Math.max(start, Math.min(words.length - 1, b.endWordIndex || start));
      const spanWords = words.slice(start, end + 1);
      const startSec = spanWords[0]?.startSec || 0;
      const endSec = spanWords[spanWords.length - 1]?.endSec || startSec + 1.5;
      const duration = Math.max(0.5, Math.round((endSec - startSec) * 10) / 10);

      return {
        beatIndex: bIdx + 1,
        wordRange: [start, end] as [number, number],
        textSpan: spanWords.map((w) => w.word).join(' '),
        depicts: b.depicts || '',
        kind: b.kind || 'literal',
        referentId: b.referentId,
        intensity: b.intensity || 'medium',
        subjectIds: Array.isArray(b.subjectIds) ? b.subjectIds : [],
        shotSize: b.shotSize || 'medium',
        angle: b.angle || 'eye level',
        newInfo: b.newInfo || '',
        overlayText: b.overlayText,
        estimatedSeconds: duration,
      };
    });

    const totalSec = beats.reduce((acc, b) => acc + b.estimatedSeconds, 0);

    return {
      index: sc.index || scIdx + 1,
      narratorLine: sc.narratorLine || beats.map((b) => b.textSpan).join(' '),
      beats,
      estimatedSeconds: Math.round(totalSec * 10) / 10,
      averageBeatSeconds: beats.length > 0 ? Math.round((totalSec / beats.length) * 10) / 10 : 0,
      fastCutRatio: 0,
    };
  });

  return enforceStage2Pacing(rawScenes, words, format, generationMode);
}
