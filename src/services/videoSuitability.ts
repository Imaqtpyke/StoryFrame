export interface VideoSuitability {
  status: 'optimal' | 'dense' | 'sparse';
  wordsPerSecond: number;
  wordCount: number;
  naturalSeconds: number;
  targetDuration: number;
  message: string;
  suggestion: string;
}

/**
 * Evaluates whether a scene's spoken sentence / caption content is suitable
 * for the chosen video clip duration (5-15 seconds or custom).
 * Uses beat analysis and natural narration speaking rates (~2.2 words/sec).
 */
export function evaluateVideoSuitability(
  narratorLine: string,
  targetDurationSeconds: number,
  beatCount?: number
): VideoSuitability {
  const clean = (narratorLine || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const target = Math.max(1, targetDurationSeconds || 5);
  const wordsPerSecond = Math.round((wordCount / target) * 10) / 10;
  // Natural narration speaking rate is ~2.2 words/sec (approx. 132 words/minute)
  const naturalSeconds = Math.max(1, Math.round((wordCount / 2.2) * 10) / 10);
  const beats = beatCount && beatCount > 0 ? beatCount : Math.max(1, Math.ceil(wordCount / 5));

  if (wordsPerSecond > 2.8 || wordCount > target * 2.8) {
    const excessWords = Math.max(1, wordCount - Math.round(target * 2.2));
    const recommendedDuration = Math.min(15, Math.max(5, Math.ceil(naturalSeconds)));
    return {
      status: 'dense',
      wordsPerSecond,
      wordCount,
      naturalSeconds,
      targetDuration: target,
      message: `Content is too dense for a ${target}s clip (${wordCount} words across ${beats} beats, ~${wordsPerSecond.toFixed(1)} words/sec). Spoken narration will sound rushed.`,
      suggestion: `This line naturally requires ~${Math.round(naturalSeconds)}s to speak comfortably. Consider trimming ~${excessWords} words, splitting into two sequential clips, or adjusting clip duration to ${recommendedDuration}s.`,
    };
  }

  if (wordsPerSecond < 1.1 && wordCount > 0 && naturalSeconds < target * 0.6) {
    const quietSeconds = Math.max(1, Math.round(target - naturalSeconds));
    const deficitWords = Math.max(1, Math.round(target * 2.0 - wordCount));
    const recommendedDuration = Math.max(5, Math.min(15, Math.round(naturalSeconds)));
    return {
      status: 'sparse',
      wordsPerSecond,
      wordCount,
      naturalSeconds,
      targetDuration: target,
      message: `Content is sparse for a ${target}s clip (${wordCount} words, ~${wordsPerSecond.toFixed(1)} words/sec). Narration completes in ~${Math.round(naturalSeconds)}s, leaving ~${quietSeconds}s of ambient silence.`,
      suggestion: `Consider expanding the narration by ~${deficitWords} descriptive words, adding visual pause cues, or setting clip duration to ${recommendedDuration}s.`,
    };
  }

  return {
    status: 'optimal',
    wordsPerSecond,
    wordCount,
    naturalSeconds,
    targetDuration: target,
    message: `Optimal narration pacing for a ${target}s clip (${wordCount} words across ${beats} visual beats, ~${wordsPerSecond.toFixed(1)} words/sec).`,
    suggestion: `Dialogue timing matches natural voiceover cadence and fits comfortably within a single ${target}s video generation.`,
  };
}

/**
 * Regenerates the duration line or entire video prompt when target clip duration changes
 */
export function updateVideoPromptDuration(
  prompt: string,
  targetDuration: number,
  sceneEstimatedSeconds: number
): string {
  if (!prompt) return prompt;

  const durationRegex = /Duration:\s*[^.\n]*(?:\.|$)/i;
  let durationText = `Duration: ${targetDuration} seconds`;
  if (sceneEstimatedSeconds > targetDuration + 1) {
    durationText += ` (Note: Scene spoken narration runs ~${sceneEstimatedSeconds}s; consider splitting into 2 sequential shots or trimming voiceover for single-clip generation).`;
  } else {
    durationText += `.`;
  }

  if (durationRegex.test(prompt)) {
    return prompt.replace(durationRegex, durationText);
  }

  return prompt.trim() + `\nDuration: ` + durationText;
}
